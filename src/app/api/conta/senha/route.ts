import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getSessionUser, revokeAllSessions } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";
import {
  hashPassword,
  verifyPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password";
import { audit } from "@/lib/audit";
import {
  clearRecuperacaoSenhaCookie,
  recuperacaoSenhaValida,
} from "@/components/onboarding/signedEmailCookie";

export const runtime = "nodejs";

/**
 * Define ou troca a senha da conta. Sessão obrigatória.
 * - Conta COM senha: exige a senha atual correta (erro genérico em falha).
 * - Conta SEM senha (cadastro antigo, entrada por SMS): define direto.
 * - Recuperação (código SMS aprovado em "esqueci minha senha", até 10 min):
 *   define sem a atual, uma única vez, e encerra as demais sessões.
 * Somente o hash scrypt é gravado; senhas NUNCA são logadas.
 */

const GENERIC_ERROR = "Não foi possível alterar a senha. Verifique os dados informados.";
const RECUPERACAO_EXPIRADA =
  "O prazo de 10 minutos para definir a senha sem a atual terminou. Peça um novo código por SMS.";

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

  const recuperacao = Boolean(user.passwordHash) && recuperacaoSenhaValida(user.id);
  if (user.passwordHash && !recuperacao) {
    // Sem a senha atual numa conta que tem senha: a janela de recuperação
    // venceu (ou nunca existiu). Sessão já autenticada; nada a enumerar.
    if (parsed.data.currentPassword === undefined) {
      return NextResponse.json(
        { error: RECUPERACAO_EXPIRADA, codigo: "recuperacao_expirada" },
        { status: 400 },
      );
    }
    const ok = await verifyPassword(parsed.data.currentPassword ?? "", user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await updateUser(user.id, { passwordHash });
  // Qualquer definição de senha consome a janela de recuperação.
  clearRecuperacaoSenhaCookie();

  if (recuperacao) {
    // Quem tinha a senha antiga perde o acesso; este dispositivo segue logado.
    await revokeAllSessions(user.id);
    await createSession(user.id);
    await audit(user.id, "PASSWORD_RESET", "sms");
    return NextResponse.json({ ok: true });
  }

  await audit(user.id, "PASSWORD_CHANGED");

  return NextResponse.json({ ok: true });
}
