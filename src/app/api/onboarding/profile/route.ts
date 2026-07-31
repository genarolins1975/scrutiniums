import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { findUserByCpf, updateUser } from "@/lib/onboarding";
import { hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";
import { AREAS_SET, NIVEIS_SET, TIPOS_SET, UFS_SET } from "@/lib/perfilOpcoes";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Etapa 3: senha de acesso + perfil ESTRUTURADO (sem texto livre) + CPF.
 * - Senha (8..72): vira o login principal; só o hash scrypt é persistido.
 * - CPF: validado (dígitos verificadores), normalizado e único por conta.
 *   Finalidade única: uma conta por pessoa. Nunca é logado nem exibido
 *   integralmente. Duplicidade responde erro específico sem revelar dados.
 * - Perfil: tipo de instituição, área, nível de cargo e UF, validados
 *   contra as allowlists de perfilOpcoes.ts (mesma lista do cliente).
 * Não conclui o onboarding: encaminha ao código de acesso (ACCESS_PENDING).
 */

const bodySchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  cpf: z
    .string()
    .transform(normalizeCpf)
    .refine(isValidCpf, { message: "CPF inválido" }),
  orgType: z.string().refine((v) => TIPOS_SET.has(v)),
  orgArea: z.string().refine((v) => AREAS_SET.has(v)),
  orgRole: z.string().refine((v) => NIVEIS_SET.has(v)),
  uf: z.string().refine((v) => UFS_SET.has(v)),
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
    const cpfInvalido = parsed.error.issues.some((i) => i.path[0] === "cpf");
    return NextResponse.json(
      { error: cpfInvalido ? "CPF inválido. Confira os dígitos." : "Dados inválidos." },
      { status: 400 },
    );
  }

  // Unicidade: um CPF, uma conta. Mensagem específica sem revelar qual conta.
  const existente = await findUserByCpf(parsed.data.cpf);
  if (existente && existente.id !== user.id) {
    return NextResponse.json(
      { error: "Este CPF já está vinculado a outra conta. Se ela é sua, use a recuperação de acesso." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await updateUser(user.id, {
    passwordHash,
    cpf: parsed.data.cpf,
    orgType: parsed.data.orgType,
    orgArea: parsed.data.orgArea,
    orgRole: parsed.data.orgRole,
    uf: parsed.data.uf,
    onboardingStatus: "ACCESS_PENDING",
  });

  await trackEvent("profile_completed", user.id);

  return NextResponse.json({ ok: true, next: "/cadastro/acesso" });
}
