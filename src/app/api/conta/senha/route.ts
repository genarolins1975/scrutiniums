import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";
import {
  hashPassword,
  verifyPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Define ou troca a senha da conta. Sessão obrigatória.
 * - Conta COM senha: exige a senha atual correta (erro genérico em falha).
 * - Conta SEM senha (cadastro antigo, entrada por SMS): define direto.
 * Somente o hash scrypt é gravado; senhas NUNCA são logadas.
 */

const GENERIC_ERROR = "Não foi possível alterar a senha. Verifique os dados informados.";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH).optional(),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  if (user.passwordHash) {
    const ok = await verifyPassword(parsed.data.currentPassword ?? "", user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await updateUser(user.id, { passwordHash });
  await audit(user.id, "PASSWORD_CHANGED");

  return NextResponse.json({ ok: true });
}
