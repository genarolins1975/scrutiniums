import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { apagarRecorte, renomearRecorte } from "@/lib/conta/recortes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renomear (PATCH) e apagar (DELETE) um recorte da própria conta; recorte de outra conta responde 404. */
const semSessao = () => NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
const naoEncontrado = () => NextResponse.json({ error: "Recorte não encontrado." }, { status: 404 });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return semSessao();
  let json: { titulo?: unknown } | null;
  try {
    json = (await req.json()) as { titulo?: unknown } | null;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const r = await renomearRecorte(user.id, params.id, json?.titulo);
  if (r === "invalido") return NextResponse.json({ error: "Dê um título de 1 a 120 caracteres.", campo: "titulo" }, { status: 400 });
  if (!r) return naoEncontrado();
  return NextResponse.json({ recorte: r });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return semSessao();
  if (!(await apagarRecorte(user.id, params.id))) return naoEncontrado();
  return NextResponse.json({ apagado: true });
}
