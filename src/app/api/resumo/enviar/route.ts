import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { bearerDisparoValido } from "@/lib/disparo";
import { sendTransactionalEmail } from "@/lib/mailer";
import { trackEvent } from "@/lib/events";
import {
  assinaturasAtivas,
  cabecalhosSaida,
  deveReceber,
  liberarEnvio,
  montarResumoEmail,
  purgarPendentes,
  reservarEnvio,
  rodapeResumo,
} from "@/lib/assinaturaResumo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Envio do resumo às assinaturas ativas. Autorização: Bearer BOLETIM_SECRET
 * (workflow resumo-email.yml) ou sessão de administrador. Idempotente: a
 * diária só recebe edição nova; a semanal, uma vez por semana, às segundas.
 */
const INTERVALO_MS = 400;
const ORCAMENTO_MS = 240_000;
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET só simula: um deploy antigo sem este método responde 405 e nunca envia por acidente. */
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
  const resumo = montarResumoEmail(agora);
  if (!resumo) {
    return NextResponse.json({ error: "Resumo indisponível no gold publicado; nada enviado." }, { status: 503 });
  }
  const alvo = (await assinaturasAtivas()).filter((a) => deveReceber(a, resumo.edicao, agora));
  if (new URL(req.url).searchParams.get("simular") === "1") {
    return NextResponse.json({ simulacao: true, edicao: resumo.edicao, destinatarios: alvo.length,
      assunto: resumo.subject, enviados: 0, falhas: 0 }, { headers: { "Cache-Control": "private, no-store" } });
  }
  await purgarPendentes(agora);
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
    if (tentou) await pausa(INTERVALO_MS);
    // reserva atômica antes do envio: outro disparo em paralelo não manda a mesma edição
    if (!(await reservarEnvio(a, resumo.edicao, agora))) continue;
    tentou = true;
    const { sent } = await sendTransactionalEmail({
      to: a.email,
      subject: resumo.subject,
      text: resumo.corpo + rodapeResumo(a),
      headers: cabecalhosSaida(a.id),
    });
    if (sent) {
      enviados += 1;
      await trackEvent("resumo_enviado");
    } else {
      falhas += 1;
      await liberarEnvio(a);
    }
  }
  return NextResponse.json({ edicao: resumo.edicao, destinatarios: alvo.length, enviados, falhas, pendentes },
    { status: falhas > 0 ? 502 : 200 });
}
