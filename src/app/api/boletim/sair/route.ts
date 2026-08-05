import { NextResponse } from "next/server";
import { z } from "zod";
import { verificarSaidaBoletim } from "@/lib/boletim";
import { updateUser } from "@/lib/onboarding";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Saída do boletim SEM login: o token assinado (HMAC com propósito fixo)
 * identifica a conta sem expor e-mail. Idempotente — sair duas vezes tem o
 * mesmo efeito — e a resposta é sempre genérica (nada a revelar sobre a
 * existência de contas).
 */
const bodySchema = z.object({ token: z.string().min(10).max(200) });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const userId = verificarSaidaBoletim(parsed.data.token);
  if (!userId) {
    return NextResponse.json({ error: "Link de saída inválido." }, { status: 400 });
  }

  await updateUser(userId, { marketingOptIn: false });
  await trackEvent("boletim_optout", userId);
  return new NextResponse(null, { status: 204 });
}
