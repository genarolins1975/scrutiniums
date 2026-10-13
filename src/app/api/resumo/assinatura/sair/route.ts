import { NextResponse } from "next/server";
import { cancelarAssinatura } from "@/lib/assinaturaResumo";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Descadastro do resumo, idempotente e sem login. Aceita dois formatos de POST:
 * - JSON `{ token }`, do botão da página /resumo/assinatura/sair;
 * - o POST de um clique dos clientes de e-mail (RFC 8058), com o token na URL
 *   do cabeçalho List-Unsubscribe e corpo `List-Unsubscribe=One-Click`.
 * Nunca por GET: scanners de e-mail pré-buscam links.
 */
export async function POST(req: Request) {
  let token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token && (req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const j = (await req.json()) as { token?: unknown };
      token = typeof j.token === "string" ? j.token : "";
    } catch {
      token = "";
    }
  }
  if (!token || token.length > 300 || !(await cancelarAssinatura(token))) {
    return NextResponse.json({ error: "Link de saída inválido." }, { status: 400 });
  }
  await trackEvent("resumo_assinatura_cancelada");
  return new NextResponse(null, { status: 204 });
}
