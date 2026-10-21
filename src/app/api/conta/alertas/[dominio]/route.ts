import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { cancelarAlerta } from "@/lib/conta/alertas";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cancela o alerta de uma fonte de dados da própria conta. */
export async function DELETE(_req: Request, { params }: { params: { dominio: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
  if (!(await cancelarAlerta(user.id, params.dominio))) {
    return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
  }
  await trackEvent("alerta_cancelado", user.id);
  return NextResponse.json({ cancelado: true });
}
