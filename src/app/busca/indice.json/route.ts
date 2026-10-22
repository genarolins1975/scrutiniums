import { indiceDeBusca } from "@/lib/busca/indice";

/**
 * Índice da busca da plataforma (src/lib/busca/indice.ts), gerado no build e servido como arquivo estático, no mesmo padrão do
 * índice de municípios da Conta de luz: o campo de busca só o baixa quando recebe foco. Aberto sem conta pelo endereço exato
 * (ARQUIVOS_DAS_CONSULTAS em src/lib/rotasPublicas.ts): leva só títulos, resumos, endereços, situação e termos, nunca dado.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(indiceDeBusca(), { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
