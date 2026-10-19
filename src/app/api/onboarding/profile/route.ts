import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { cookies } from "next/headers";
import { findUserByCpf, safeInternalPath, completeProfile } from "@/lib/onboarding";
import { COOKIE_DESTINO } from "@/lib/rotasPublicas";
import { hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { cpfObrigatorioParaTelefone } from "@/lib/cpf-telefone";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";
import { camposPerfil, comPerfilNormalizado, mensagemPerfil } from "@/lib/perfilServidor";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Etapa 3: senha de acesso + perfil ESTRUTURADO (sem texto livre) + CPF.
 * - Senha (8..72): vira o login principal; só o hash scrypt é persistido.
 * - CPF: exigido apenas para telefone +55 verificado, validado e único.
 *   Finalidade única: uma conta por pessoa. Nunca é logado nem exibido
 *   integralmente. Duplicidade responde erro específico sem revelar dados.
 * - Perfil: perfil de uso e UF sempre; tipo de instituição, área e nível
 *   de cargo só nos perfis de uso profissionais (null nos demais). Mesma
 *   regra do formulário (errosPerfil em perfilOpcoes.ts), aplicada aqui.
 * Etapa FINAL do cadastro: perfil completo conclui o onboarding (COMPLETE)
 * e entra direto no Observatório — não existe mais código de acesso.
 */

const camposBase = {
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  cpf: z
    .string()
    .transform(normalizeCpf)
    .refine(isValidCpf, { message: "CPF inválido" }),
  ...camposPerfil,
};
const schemaComCpf = z.object(camposBase).transform(comPerfilNormalizado);
const schemaSemCpf = z
  .object({ ...camposBase, cpf: z.literal("").nullish().transform(() => null) })
  .transform(comPerfilNormalizado);

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
  const exigeCpf = cpfObrigatorioParaTelefone(user);
  if (exigeCpf === null) {
    return NextResponse.json({ error: "Confirme seu telefone antes de concluir o perfil." }, { status: 401 });
  }
  const schemaPerfil = exigeCpf ? schemaComCpf : schemaSemCpf;
  const parsed = schemaPerfil.safeParse(json);
  if (!parsed.success) {
    const cpfInvalido = parsed.error.issues.some((i) => i.path[0] === "cpf");
    return NextResponse.json(
      { error: cpfInvalido ? "CPF inválido. Confira os dígitos." : mensagemPerfil(parsed.error.issues) ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  // Unicidade: um CPF, uma conta. Mensagem específica sem revelar qual conta.
  const existente = parsed.data.cpf ? await findUserByCpf(parsed.data.cpf) : undefined;
  if (existente && existente.id !== user.id) {
    return NextResponse.json(
      { error: "Este CPF já está vinculado a outra conta. Se ela é sua, use a recuperação de acesso." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const atualizado = await completeProfile(user, {
      passwordHash,
      cpf: parsed.data.cpf,
      perfilUso: parsed.data.perfilUso,
      orgType: parsed.data.orgType,
      orgArea: parsed.data.orgArea,
      orgRole: parsed.data.orgRole,
      uf: parsed.data.uf,
    });
    if (!atualizado) return NextResponse.json({ error: "O cadastro mudou. Atualize a página e tente novamente." }, { status: 409 });
  } catch (erro) {
    const causa = erro as { code?: string; cause?: { code?: string } };
    if (causa.code === "23505" || causa.cause?.code === "23505") {
      return NextResponse.json({ error: "Não foi possível concluir com estes dados de cadastro." }, { status: 409 });
    }
    throw erro;
  }

  await trackEvent("profile_completed", user.id);
  await trackEvent("onboarding_completed", user.id);

  // Quem chegou ao cadastro vindo de um painel volta direto a ele.
  const jar = cookies();
  const destino = safeInternalPath(jar.get(COOKIE_DESTINO)?.value);
  if (destino) jar.delete(COOKIE_DESTINO);
  return NextResponse.json({ ok: true, next: destino ?? "/app/observatorios" });
}
