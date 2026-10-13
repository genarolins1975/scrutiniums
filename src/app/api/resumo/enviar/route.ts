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
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  let autorizado = bearerDisparoValido(req);
  if (!autorizado) {
    const user = await getSessionUser();
    autorizado = !!user && isAdmin(user);
  }
  if (!autorizado) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const agora = new Date();
  await purgarPendentes(agora);
  const resumo = montarResumoEmail(agora);
  if (!resumo) {
    return NextResponse.json({ error: "Resumo indisponível no gold publicado; nada enviado." }, { status: 503 });
  }
  const alvo = (await assinaturasAtivas()).filter((a) => deveReceber(a, resumo.edicao, agora));
  let enviados = 0;
  let falhas = 0;
  for (let i = 0; i < alvo.length; i++) {
    const a = alvo[i];
    // reserva atômica antes do envio: outro disparo em paralelo não manda a mesma edição
    if (!(await reservarEnvio(a, resumo.edicao, agora))) continue;
    if (i > 0) await pausa(INTERVALO_MS);
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
  return NextResponse.json({ edicao: resumo.edicao, destinatarios: alvo.length, enviados, falhas });
}
