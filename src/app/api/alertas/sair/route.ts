import { NextResponse } from "next/server";
import { cancelarPorToken } from "@/lib/conta/alertas";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Cancelamento de um alerta de atualização em um clique, pelo próprio cliente de e-mail (RFC 8058): POST com o token
 * assinado na URL do cabeçalho List-Unsubscribe. Idempotente e sem login. Nunca por GET: scanners de e-mail pré-buscam
 * links. Na página da conta, o cancelamento passa por DELETE /api/conta/alertas/[dominio].
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token || token.length > 300 || !(await cancelarPorToken(token))) {
    return NextResponse.json({ error: "Link de saída inválido." }, { status: 400 });
  }
  await trackEvent("alerta_cancelado");
  return new NextResponse(null, { status: 204 });
}
