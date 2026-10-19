import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { chaveDeTaxa, decidirColeta, recusaAntesDoCaminho, registrarVisita } from "@/lib/uso/coleta";
import { cabecalhosRecusamRastreio } from "@/lib/uso/sinais";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Medição de uso agregada (docs/observatorios/MEDICAO_DE_USO.md). Recebe só
 * { rota: caminho da página } do componente MedeUso e soma 1 ao contador do dia.
 * Resposta sempre 204 e sem corpo, conte ou não: o cliente (sendBeacon) não lê
 * a resposta e nada sobre a decisão é revelado. 429 só no limite de taxa.
 */
const TAMANHO_MAXIMO = 1024;

export async function POST(req: Request) {
  const vazio = () => new NextResponse(null, { status: 204 });
  // Do Not Track ou Global Privacy Control: nem a sessão é consultada.
  if (cabecalhosRecusamRastreio(req.headers)) return vazio();

  // Banco indisponível: segue como sem conta (e, com a contagem anônima desligada, nada acontece).
  const comConta = Boolean(await getSessionUser().catch(() => null));
  // Sem sessão e contagem anônima desligada: descarta antes de olhar IP ou corpo.
  if (recusaAntesDoCaminho({ comConta, cabecalhos: req.headers })) return vazio();

  if (!checkRateLimit(chaveDeTaxa(requestIp(req)), POLICIES.usoPorIp).allowed) {
    return new NextResponse(null, { status: 429 });
  }

  let texto: string;
  try {
    texto = await req.text();
  } catch {
    return vazio();
  }
  if (texto.length > TAMANHO_MAXIMO) return vazio();
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return vazio();
  }
  const caminho = corpo && typeof corpo === "object" ? (corpo as { rota?: unknown }).rota : undefined;
  const decisao = decidirColeta({ caminho, comConta, cabecalhos: req.headers });
  if (decisao.contar) await registrarVisita(decisao.rota, comConta);
  return vazio();
}
