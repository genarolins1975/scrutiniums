import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";

/**
 * Atualiza empresa e cargo do perfil.
 * Sessão obrigatória; payload validado com zod; erros genéricos.
 */
const bodySchema = z.object({
  company: z.string().trim().min(2).max(120),
  jobTitle: z.string().trim().min(2).max(120),
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
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  updateUser(user.id, {
    company: parsed.data.company,
    jobTitle: parsed.data.jobTitle,
  });

  return NextResponse.json({ ok: true });
}
