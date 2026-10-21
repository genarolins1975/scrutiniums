import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Estado de sessão para cabeçalhos de páginas estáticas: sempre 200, com
 * { logado } e nada mais (sem PII, sem cache). Diferente de /api/auth/eu, que a
 * SPA do Crédito usa com 204/401, esta resposta não gera erro de console para o
 * visitante anônimo.
 */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ logado: !!user }, { headers: { "Cache-Control": "no-store" } });
}
