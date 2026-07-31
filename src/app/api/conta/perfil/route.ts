import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { findUserByCpf, updateUser } from "@/lib/onboarding";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";
import { AREAS_SET, NIVEIS_SET, TIPOS_SET, UFS_SET } from "@/lib/perfilOpcoes";

export const runtime = "nodejs";

/**
 * Atualiza o perfil ESTRUTURADO (allowlists de perfilOpcoes.ts; sem texto
 * livre). O CPF só é aceito quando a conta ainda não tem um (contas
 * anteriores à exigência): depois de gravado, alteração apenas pelo canal
 * de privacidade. CPF nunca é logado nem devolvido na resposta.
 */
const bodySchema = z.object({
  orgType: z.string().refine((v) => TIPOS_SET.has(v)),
  orgArea: z.string().refine((v) => AREAS_SET.has(v)),
  orgRole: z.string().refine((v) => NIVEIS_SET.has(v)),
  uf: z.string().refine((v) => UFS_SET.has(v)),
  cpf: z.string().transform(normalizeCpf).refine(isValidCpf, { message: "CPF inválido" }).optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    const cpfInvalido = parsed.error.issues.some((i) => i.path[0] === "cpf");
    return NextResponse.json(
      { error: cpfInvalido ? "CPF inválido. Confira os dígitos." : "Dados inválidos." },
      { status: 400 },
    );
  }

  const mudancas: Parameters<typeof updateUser>[1] = {
    orgType: parsed.data.orgType,
    orgArea: parsed.data.orgArea,
    orgRole: parsed.data.orgRole,
    uf: parsed.data.uf,
  };

  if (parsed.data.cpf) {
    if (user.cpf) {
      return NextResponse.json(
        { error: "O CPF da conta não pode ser alterado por aqui. Fale com privacidade@scrutiniums.com." },
        { status: 400 },
      );
    }
    const existente = await findUserByCpf(parsed.data.cpf);
    if (existente && existente.id !== user.id) {
      return NextResponse.json(
        { error: "Este CPF já está vinculado a outra conta. Se ela é sua, use a recuperação de acesso." },
        { status: 409 },
      );
    }
    mudancas.cpf = parsed.data.cpf;
  }

  await updateUser(user.id, mudancas);

  return NextResponse.json({ ok: true });
}
