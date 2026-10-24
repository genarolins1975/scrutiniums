import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { bearerDisparoValido } from "@/lib/disparo";
import { sendTransactionalEmail } from "@/lib/mailer";
import { trackEvent } from "@/lib/events";
import {
  assinaturasComEmail,
  cabecalhosSaidaAlerta,
  emailAlerta,
  liberarAviso,
  referenciaAvancou,
  referenciasPublicadas,
  reservarAviso,
  rodapeAlerta,
} from "@/lib/conta/alertas";
import type { DominioFrescorId } from "@/lib/frescor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Disparo dos alertas de atualização. Autorização: Bearer BOLETIM_SECRET (workflow alertas-atualizacao.yml) ou sessão de
 * administrador. Lê a referência publicada de cada fonte neste deploy e avisa cada assinatura cuja referência avançou;
 * sem avanço, nada sai. Idempotente: a reserva atômica grava a referência avisada antes do envio, e envio que falha a
 * devolve.
 *
 * A pausa entre envios vem antes da reserva, e o disparo para de reservar quando o tempo da função está perto do fim:
 * uma assinatura nunca fica reservada sem que o envio dela tenha sido tentado, e o que sobrar sai no disparo seguinte.
 * Falha de envio responde 502 (o workflow fica vermelho), e só um disparo sem falha registra "alertas_verificacao",
 * o evento que faz a conta dizer que o envio está ligado.
 */
const INTERVALO_MS = 400;
/** Para de reservar com folga antes do maxDuration (300 s): o envio em curso ainda termina. */
const ORCAMENTO_MS = 240_000;
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET só simula; não chama envio em versões antigas que ainda não oferecem este método. */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("simular") !== "1") {
    return NextResponse.json({ error: "GET disponível somente para simulação." }, { status: 405 });
  }
  return POST(req);
}

export async function POST(req: Request) {
  let autorizado = bearerDisparoValido(req);
  if (!autorizado) {
    const user = await getSessionUser();
    autorizado = !!user && isAdmin(user);
  }
  if (!autorizado) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const agora = new Date();
  const inicio = Date.now();
  const assinaturas = await assinaturasComEmail();
  const publicadas = referenciasPublicadas(assinaturas.map((a) => a.dominio));
  const alvo = assinaturas.filter((a) => referenciaAvancou(a.referenciaAvisada, publicadas.get(a.dominio)?.referencia ?? null));
  if (new URL(req.url).searchParams.get("simular") === "1") {
    const dominios = [...new Set(alvo.map((a) => a.dominio))];
    const previas = dominios.map((dominio) => ({ dominio, referencia: publicadas.get(dominio)!.referencia,
      assunto: emailAlerta(dominio as DominioFrescorId, null, publicadas.get(dominio)!).subject }));
    return NextResponse.json({ simulacao: true, assinaturas: assinaturas.length, destinatarios: alvo.length,
      previas, enviados: 0, falhas: 0, pendentes: 0 }, { headers: { "Cache-Control": "private, no-store" } });
  }
  let enviados = 0;
  let falhas = 0;
  let pendentes = 0;
  let tentou = false;
  for (let i = 0; i < alvo.length; i++) {
    if (Date.now() - inicio > ORCAMENTO_MS) {
      pendentes = alvo.length - i;
      break;
    }
    const a = alvo[i];
    const f = publicadas.get(a.dominio)!;
    if (tentou) await pausa(INTERVALO_MS);
    // reserva atômica logo antes do envio: outro disparo em paralelo não manda o mesmo aviso
    if (!(await reservarAviso(a, f.referencia!, agora))) continue;
    tentou = true;
    const dominio = a.dominio as DominioFrescorId;
    const email = emailAlerta(dominio, a.referenciaAvisada, f);
    const { sent } = await sendTransactionalEmail({
      to: a.email,
      subject: email.subject,
      text: email.text + rodapeAlerta(dominio),
      headers: cabecalhosSaidaAlerta(a.id),
    });
    if (sent) {
      enviados += 1;
      await trackEvent("alerta_enviado", a.userId);
    } else {
      falhas += 1;
      await liberarAviso(a);
    }
  }
  if (falhas === 0) await trackEvent("alertas_verificacao");
  const corpo = { assinaturas: assinaturas.length, destinatarios: alvo.length, enviados, falhas, pendentes };
  return NextResponse.json(corpo, { status: falhas > 0 ? 502 : 200 });
}
