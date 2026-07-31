import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { isValidAccessCode } from "@/lib/access";
import { conviteEmail, sendTransactionalEmail } from "@/lib/mailer";
import { checkRateLimit, POLICIES } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Envio de convites para toda a lista de espera (WAITLIST), restrito a
 * administradores (ADMIN_EMAILS). Não-admin recebe 403 genérico, sem
 * revelar a existência da rota. O código informado precisa estar ativo em
 * ACCESS_CODES — caso contrário o convidado receberia um código inútil.
 * Envio sequencial com pequeno intervalo para respeitar os limites do
 * Resend; em dev sem RESEND_API_KEY o envio é simulado (log mascarado).
 */

const bodySchema = z.object({ code: z.string().min(1).max(64) });

/** Intervalo entre envios (limite de taxa do Resend). */
const SEND_INTERVAL_MS = 350;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const rl = checkRateLimit(`admin-convites:${user.id}`, POLICIES.invitesPerAdmin);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde e tente novamente." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const code = parsed.data.code.trim();
  if (!isValidAccessCode(code)) {
    return NextResponse.json(
      { error: "Código não está ativo em ACCESS_CODES." },
      { status: 400 },
    );
  }

  const db = await getDb();
  const waitlisted = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.onboardingStatus, "WAITLIST"))
    .orderBy(schema.users.createdAt);

  // Em dev sem RESEND_API_KEY o envio é simulado (corpo no log, e-mail
  // mascarado) e conta como entregue — nunca em produção.
  const devSimulated =
    !process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production";

  const { subject, text } = conviteEmail(code);
  let enviados = 0;
  let falhas = 0;

  for (let i = 0; i < waitlisted.length; i += 1) {
    if (i > 0) await sleep(SEND_INTERVAL_MS);
    const destinatario = waitlisted[i];
    const result = await sendTransactionalEmail({ to: destinatario.email, subject, text });
    if (result.sent || devSimulated) {
      enviados += 1;
      await trackEvent("waitlist_invited", destinatario.id);
    } else {
      falhas += 1;
    }
  }

  return NextResponse.json({ ok: true, enviados, falhas });
}
