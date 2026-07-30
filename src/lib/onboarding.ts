import { and, eq, gt, isNull } from "drizzle-orm";
import { db, newId, schema } from "./db";
import { generateOtp, hashToken } from "./crypto";
import { sendEmailCode } from "./mailer";
import type { OnboardingStatus, User } from "./schema";

export const PRIVACY_VERSION = "2026-07";

const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 5;

/**
 * Máquina de estados retomável do onboarding.
 * EMAIL_PENDING → PHONE_PENDING → PROFILE_PENDING → COMPLETE
 */
export function nextStepPath(status: OnboardingStatus): string {
  switch (status) {
    case "EMAIL_PENDING":
      return "/cadastro";
    case "PHONE_PENDING":
      return "/cadastro/telefone";
    case "PROFILE_PENDING":
      return "/cadastro/perfil";
    case "COMPLETE":
      return "/app";
  }
}

export function findUserByEmail(email: string): User | undefined {
  return db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()))
    .limit(1)
    .all()[0];
}

export function findUserById(id: string): User | undefined {
  return db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1).all()[0];
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
  const normalized = email.toLowerCase().trim();
  let user = findUserByEmail(normalized);
  const now = new Date();

  if (!user && purpose === "EMAIL_VERIFY") {
    const id = newId();
    db.insert(schema.users)
      .values({
        id,
        email: normalized,
        onboardingStatus: "EMAIL_PENDING",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    user = findUserById(id)!;
  }
  if (!user) {
    // LOGIN/RECOVERY de e-mail inexistente: não revelar. Chamador responde genérico.
    return { userId: "" };
  }

  const code = generateOtp();
  db.insert(schema.verificationTokens)
    .values({
      id: newId(),
      userId: user.id,
      purpose,
      tokenHash: hashToken(code),
      expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
      createdAt: now,
    })
    .run();
  await sendEmailCode(user.email, code, purpose);
  return { userId: user.id };
}

export type EmailCheckResult = "approved" | "invalid" | "expired" | "locked";

/** Confere o código de e-mail. Nunca compara em claro: somente hashes. */
export function checkEmailCode(
  userId: string,
  purpose: string,
  code: string,
): EmailCheckResult {
  const token = db
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
    .orderBy(schema.verificationTokens.createdAt)
    .all()
    .at(-1);

  if (!token) return "expired";
  if (token.attempts >= EMAIL_MAX_ATTEMPTS) return "locked";

  db.update(schema.verificationTokens)
    .set({ attempts: token.attempts + 1 })
    .where(eq(schema.verificationTokens.id, token.id))
    .run();

  if (token.tokenHash !== hashToken(code)) return "invalid";

  db.update(schema.verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.verificationTokens.id, token.id))
    .run();
  return "approved";
}

export function updateUser(userId: string, values: Partial<typeof schema.users.$inferInsert>): void {
  db.update(schema.users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .run();
}
