import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmarAssinatura } from "@/lib/assinaturaResumo";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/** Confirmação da assinatura: só por POST (o GET da página nunca muda nada). */
const bodySchema = z.object({ token: z.string().min(10).max(300) });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const ok = await confirmarAssinatura(parsed.data.token, new Date());
  if (!ok) {
    return NextResponse.json({ error: "Link de confirmação inválido ou vencido. Peça a assinatura de novo em /resumo." }, { status: 400 });
  }
  await trackEvent("resumo_assinatura_confirmada");
  return new NextResponse(null, { status: 204 });
}
