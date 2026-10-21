import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { doiDeposito, ehDominio, fontesCitacao } from "@/lib/conta/metadados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dados do "Citar" de uma página: para cada fonte pedida (?dominios=energia,gas), a referência mais recente, a data de
 * publicação e o identificador da publicação quando o manifesto o declara; e o DOI do depósito mensal, nulo enquanto não
 * houver. Exige sessão: o pacote para citar é recurso da conta.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
  const pedidos = (new URL(req.url).searchParams.get("dominios") ?? "").split(",").filter(Boolean);
  if (!pedidos.length || pedidos.length > 12 || !pedidos.every(ehDominio)) {
    return NextResponse.json({ error: "Fontes de dados não reconhecidas." }, { status: 400 });
  }
  return NextResponse.json(
    { fontes: fontesCitacao([...new Set(pedidos)]), doi: doiDeposito() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
