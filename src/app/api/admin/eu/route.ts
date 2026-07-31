import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * Checagem interna de admin usada pelo middleware (que roda no edge e não
 * acessa o banco) para decidir se /app/admin existe para esta sessão.
 * Resposta mínima e genérica: não-admin recebe o mesmo 403 de sempre.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
