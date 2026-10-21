import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { trackEvent } from "@/lib/events";
import { LIMITE_RECORTES, criarRecorte, listarRecortes } from "@/lib/conta/recortes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recortes salvos da conta: listar (GET) e salvar (POST). Exige sessão; cada conta só vê os próprios. */
const semSessao = () => NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return semSessao();
  const recortes = await listarRecortes(user.id);
  return NextResponse.json({ recortes, limite: LIMITE_RECORTES }, { headers: { "Cache-Control": "no-store" } });
}

const ERROS = {
  titulo: "Dê um título de 1 a 120 caracteres.",
  caminho: "Este endereço não pode ser salvo como recorte.",
  observatorio: "Observatório não reconhecido.",
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return semSessao();
  let json: Record<string, unknown> | null;
  try {
    json = (await req.json()) as Record<string, unknown> | null;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!json || typeof json !== "object") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const r = await criarRecorte(user.id, { titulo: json.titulo, caminho: json.caminho, observatorio: json.observatorio });
  switch (r.tipo) {
    case "invalido":
      return NextResponse.json({ error: ERROS[r.campo], campo: r.campo }, { status: 400 });
    case "limite":
      return NextResponse.json(
        {
          error: `Você já tem ${LIMITE_RECORTES} recortes salvos, o limite da conta. Apague algum em Minha conta para salvar outro.`,
          limite: LIMITE_RECORTES,
        },
        { status: 409 },
      );
    case "existente":
      return NextResponse.json({ recorte: r.recorte, existente: true });
    case "criado":
      await trackEvent("recorte_salvo", user.id);
      return NextResponse.json({ recorte: r.recorte, existente: false }, { status: 201 });
  }
}
