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
 */
const INTERVALO_MS = 400;
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  let autorizado = bearerDisparoValido(req);
  if (!autorizado) {
    const user = await getSessionUser();
    autorizado = !!user && isAdmin(user);
  }
  if (!autorizado) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const agora = new Date();
  await trackEvent("alertas_verificacao");
  const assinaturas = await assinaturasComEmail();
  const publicadas = referenciasPublicadas(assinaturas.map((a) => a.dominio));
  const alvo = assinaturas.filter((a) => referenciaAvancou(a.referenciaAvisada, publicadas.get(a.dominio)?.referencia ?? null));
  let enviados = 0;
  let falhas = 0;
  for (let i = 0; i < alvo.length; i++) {
    const a = alvo[i];
    const f = publicadas.get(a.dominio)!;
    // reserva atômica antes do envio: outro disparo em paralelo não manda o mesmo aviso
    if (!(await reservarAviso(a, f.referencia!, agora))) continue;
    if (i > 0) await pausa(INTERVALO_MS);
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
  return NextResponse.json({ assinaturas: assinaturas.length, destinatarios: alvo.length, enviados, falhas });
}
