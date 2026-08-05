import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { sendTransactionalEmail } from "@/lib/mailer";
import { trackEvent } from "@/lib/events";
import {
  boletimEnviadoNoMes,
  destinatariosBoletim,
  montarBoletim,
  rodapeBoletim,
  urlSaidaBoletim,
} from "@/lib/boletim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Envio sequencial com intervalo: a duração cresce com a base.
export const maxDuration = 300;

/**
 * Dispara o boletim mensal para a base com consentimento de comunicações.
 * Autorização: `Authorization: Bearer ${BOLETIM_SECRET}` (usada pelo
 * workflow mensal do GitHub Actions) OU sessão de administrador. Uma
 * guarda impede dois envios no mesmo mês-calendário (cron + manual).
 * Nenhum conteúdo por usuário: o corpo é único, só o rodapé de saída muda.
 */

function bearerValido(req: Request): boolean {
  const segredo = process.env.BOLETIM_SECRET;
  if (!segredo || segredo.length < 16) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length);
  const a = Buffer.from(token, "utf-8");
  const b = Buffer.from(segredo, "utf-8");
  return a.length === b.length && timingSafeEqual(a, b);
}

const INTERVALO_MS = 400;
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  let autorizado = bearerValido(req);
  if (!autorizado) {
    const user = await getSessionUser();
    autorizado = !!user && isAdmin(user);
  }
  if (!autorizado) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const agora = new Date();
  const boletim = montarBoletim(agora);
  if (!boletim) {
    return NextResponse.json(
      { error: "Central de alertas indisponível; boletim não enviado." },
      { status: 503 },
    );
  }

  if (await boletimEnviadoNoMes(agora)) {
    return NextResponse.json({ jaEnviadoNoMes: true, enviados: 0, falhas: 0 });
  }

  const destinatarios = await destinatariosBoletim();
  let enviados = 0;
  let falhas = 0;
  for (let i = 0; i < destinatarios.length; i++) {
    const d = destinatarios[i];
    if (i > 0) await pausa(INTERVALO_MS);
    const { sent } = await sendTransactionalEmail({
      to: d.email,
      subject: boletim.subject,
      text: boletim.corpo + rodapeBoletim(urlSaidaBoletim(d.id)),
    });
    if (sent) {
      enviados += 1;
      await trackEvent("boletim_enviado", d.id);
    } else {
      falhas += 1;
    }
  }

  return NextResponse.json({ destinatarios: destinatarios.length, enviados, falhas });
}
