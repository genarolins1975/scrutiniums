import { NextResponse } from "next/server";
import { destroySession, getSessionUser, revokeAllSessions } from "@/lib/session";
import { audit } from "@/lib/audit";

/**
 * Encerra todas as sessões do usuário, inclusive a atual.
 * O cliente redireciona para /entrar após a resposta.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
  }

  await revokeAllSessions(user.id);
  audit(user.id, "SESSION_REVOKED");
  await destroySession();

  return NextResponse.json({ ok: true });
}
