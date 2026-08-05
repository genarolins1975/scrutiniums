import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Checagem anônima de sessão usada pela SPA do Observatório (agora pública)
 * para decidir o rodapé da navegação: visitante vê "Entrar"; usuário logado
 * vê "Minha conta"/"Sair". Resposta mínima, sem PII e sem cache.
 */
export async function GET() {
  const user = await getSessionUser();
  const status = user ? 204 : 401;
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
