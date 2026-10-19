import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { trackEvent } from "@/lib/events";
import { assinarAlerta, envioLigado, listarAlertas } from "@/lib/conta/alertas";
import { ehDominio } from "@/lib/conta/metadados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alertas de atualização da conta: listar (GET) e assinar uma fonte de dados (POST). Exige sessão. */
const semSessao = () => NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return semSessao();
  const [alertas, ligado] = await Promise.all([listarAlertas(user.id), envioLigado()]);
  return NextResponse.json({ alertas, envioLigado: ligado }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return semSessao();
  let json: { dominio?: unknown } | null;
  try {
    json = (await req.json()) as { dominio?: unknown } | null;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const dominio = json?.dominio;
  if (!ehDominio(dominio)) return NextResponse.json({ error: "Fonte de dados não reconhecida." }, { status: 400 });
  const alerta = await assinarAlerta(user.id, dominio);
  await trackEvent("alerta_assinado", user.id);
  return NextResponse.json({ alerta }, { status: 201 });
}
