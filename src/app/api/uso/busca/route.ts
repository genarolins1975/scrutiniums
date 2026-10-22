import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { chaveDeTaxa, recusaAntesDoCaminho } from "@/lib/uso/coleta";
import { cabecalhosRecusamRastreio } from "@/lib/uso/sinais";
import { registrarBusca, termoParaContagem } from "@/lib/uso/busca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Medição agregada da busca da plataforma (docs/observatorios/MEDICAO_DE_USO.md). Recebe só { termo } do campo de busca ou da
 * página /buscar e soma 1 ao contador do dia. As regras são as de /api/uso: resposta sempre 204 e sem corpo, Do Not Track e
 * Global Privacy Control nunca contam, sem conta só com USO_ANONIMO_ATIVO=1; 429 só no limite de taxa.
 */
const TAMANHO_MAXIMO = 512;

export async function POST(req: Request) {
  const vazio = () => new NextResponse(null, { status: 204 });
  if (cabecalhosRecusamRastreio(req.headers)) return vazio();
  const comConta = Boolean(await getSessionUser().catch(() => null));
  if (recusaAntesDoCaminho({ comConta, cabecalhos: req.headers })) return vazio();
  if (!checkRateLimit(chaveDeTaxa(requestIp(req)), POLICIES.usoPorIp).allowed) {
    return new NextResponse(null, { status: 429 });
  }
  let corpo: unknown;
  try {
    const texto = await req.text();
    if (texto.length > TAMANHO_MAXIMO) return vazio();
    corpo = JSON.parse(texto);
  } catch {
    return vazio();
  }
  const termo = termoParaContagem(corpo && typeof corpo === "object" ? (corpo as { termo?: unknown }).termo : undefined);
  if (termo) await registrarBusca(termo, comConta);
  return vazio();
}
