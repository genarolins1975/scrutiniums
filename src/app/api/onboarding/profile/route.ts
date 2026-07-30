import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";
import { hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Etapa 3: senha de acesso + empresa e cargo (texto livre, 1..120 caracteres).
 * A senha (8..72) vira o login principal (e-mail + senha); apenas o hash
 * scrypt é persistido e a senha em claro NUNCA é logada. A confirmação da
 * senha é conferida apenas no cliente. Não conclui o onboarding: encaminha
 * para o código de acesso (ACCESS_PENDING → /cadastro/acesso).
 * "onboarding_completed" só é emitido na validação do código
 * (api/onboarding/access/check).
 */

const bodySchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  company: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(1).max(120),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.onboardingStatus !== "PROFILE_PENDING") {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await updateUser(user.id, {
    passwordHash,
    company: parsed.data.company,
    jobTitle: parsed.data.jobTitle,
    onboardingStatus: "ACCESS_PENDING",
  });

  await trackEvent("profile_completed", user.id);

  return NextResponse.json({ ok: true, next: "/cadastro/acesso" });
}
