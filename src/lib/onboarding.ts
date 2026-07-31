import { and, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { getDb, newId, schema } from "./db";
import { generateOtp, hashToken } from "./crypto";
import { sendEmailCode } from "./mailer";
import type { OnboardingStatus, User } from "./schema";

export const PRIVACY_VERSION = "2026-07";

const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 5;

/**
 * Máquina de estados retomável do onboarding.
 * EMAIL_PENDING → PHONE_PENDING → PROFILE_PENDING → ACCESS_PENDING → COMPLETE
 * (WAITLIST fica na mesma rota de acesso: pode entrar quando receber código.)
 */
export function nextStepPath(status: OnboardingStatus): string {
  switch (status) {
    case "EMAIL_PENDING":
      return "/cadastro";
    case "PHONE_PENDING":
      return "/cadastro/telefone";
    case "PROFILE_PENDING":
      return "/cadastro/perfil";
    case "ACCESS_PENDING":
    case "WAITLIST":
      return "/cadastro/acesso";
    case "COMPLETE":
      // Destino principal pós-login: o Observatório completo.
      return "/observatorio";
  }
}

/**
 * Valida um destino pós-login vindo da query (?de=...): aceita apenas
 * caminho interno absoluto ("/...") — nunca "//host", "\", esquema externo
 * ou rotas de API. Retorna null quando o valor não é seguro.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  if (raw.includes("://")) return null;
  if (raw === "/api" || raw.startsWith("/api/")) return null;
  return raw;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0];
}

/** Busca por CPF normalizado (unicidade de conta por pessoa). */
export async function findUserByCpf(cpf: string): Promise<User | undefined> {
  const db = await getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.cpf, cpf)).limit(1);
  return rows[0];
}

export async function findUserById(id: string): Promise<User | undefined> {
  const db = await getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return rows[0];
}

/** Localiza usuário pelo telefone E.164 já verificado (login por SMS). */
export async function findUserByVerifiedPhone(phoneE164: string): Promise<User | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(
      and(eq(schema.users.phoneE164, phoneE164), isNotNull(schema.users.phoneVerifiedAt)),
    )
    .limit(1);
  return rows[0];
}

/**
 * Etapa 1 do cadastro (modelo somente-SMS): registra o e-mail como dado de
 * contato, SEM enviar código. Cria o usuário direto em PHONE_PENDING com o
 * aceite de termos; usuário legado em EMAIL_PENDING é promovido a
 * PHONE_PENDING. Contas em etapa posterior (inclusive COMPLETE) não são
 * alteradas — o chamador responde de forma genérica, sem revelar existência.
 */
export async function registerContactEmail(
  email: string,
  opts: { marketingOptIn: boolean },
): Promise<{ userId: string; created: boolean }> {
  const db = await getDb();
  const normalized = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalized);
  const now = new Date();

  if (!existing) {
    const id = newId();
    await db.insert(schema.users).values({
      id,
      email: normalized,
      onboardingStatus: "PHONE_PENDING",
      termsAcceptedAt: now,
      privacyVersion: PRIVACY_VERSION,
      marketingOptIn: opts.marketingOptIn,
      createdAt: now,
      updatedAt: now,
    });
    return { userId: id, created: true };
  }

  if (existing.onboardingStatus === "EMAIL_PENDING") {
    // Usuário legado do fluxo antigo (código por e-mail): promove para a
    // etapa do telefone, preservando aceite anterior quando houver.
    await updateUser(existing.id, {
      onboardingStatus: "PHONE_PENDING",
      termsAcceptedAt: existing.termsAcceptedAt ?? now,
      privacyVersion: existing.privacyVersion ?? PRIVACY_VERSION,
    });
  }
  return { userId: existing.id, created: false };
}

/**
 * Cria (ou reaproveita) o usuário e envia código de verificação por e-mail.
 * Política para e-mail já cadastrado e verificado: não criar conta nova,
 * não vazar existência — o chamador responde de forma genérica e o
 * usuário verificado recebe orientação de login em vez de código de cadastro.
 */
export async function startEmailVerification(
  email: string,
  purpose: "EMAIL_VERIFY" | "LOGIN" | "RECOVERY",
): Promise<{ userId: string }> {
  const db = await getDb();
  const normalized = email.toLowerCase().trim();
  let user = await findUserByEmail(normalized);
  const now = new Date();

  if (!user && purpose === "EMAIL_VERIFY") {
    const id = newId();
    await db.insert(schema.users).values({
      id,
      email: normalized,
      onboardingStatus: "EMAIL_PENDING",
      createdAt: now,
      updatedAt: now,
    });
    user = (await findUserById(id))!;
  }
  if (!user) {
    // LOGIN/RECOVERY de e-mail inexistente: não revelar. Chamador responde genérico.
    return { userId: "" };
  }

  const code = generateOtp();
  await db.insert(schema.verificationTokens).values({
    id: newId(),
    userId: user.id,
    purpose,
    tokenHash: hashToken(code),
    expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
    createdAt: now,
  });
  await sendEmailCode(user.email, code, purpose);
  return { userId: user.id };
}

export type EmailCheckResult = "approved" | "invalid" | "expired" | "locked";

/** Confere o código de e-mail. Nunca compara em claro: somente hashes. */
export async function checkEmailCode(
  userId: string,
  purpose: string,
  code: string,
): Promise<EmailCheckResult> {
  const db = await getDb();
  const tokens = await db
    .select()
    .from(schema.verificationTokens)
    .where(
      and(
        eq(schema.verificationTokens.userId, userId),
        eq(schema.verificationTokens.purpose, purpose),
        isNull(schema.verificationTokens.usedAt),
        gt(schema.verificationTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(schema.verificationTokens.createdAt))
    .limit(1);
  const token = tokens[0];

  if (!token) return "expired";
  if (token.attempts >= EMAIL_MAX_ATTEMPTS) return "locked";

  await db
    .update(schema.verificationTokens)
    .set({ attempts: token.attempts + 1 })
    .where(eq(schema.verificationTokens.id, token.id));

  if (token.tokenHash !== hashToken(code)) return "invalid";

  await db
    .update(schema.verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.verificationTokens.id, token.id));
  return "approved";
}

export async function updateUser(
  userId: string,
  values: Partial<typeof schema.users.$inferInsert>,
): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}
