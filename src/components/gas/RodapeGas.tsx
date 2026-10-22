import { goldGas } from "@/lib/gas/gold";
import { carimbo } from "@/lib/gas/formato";
import { RodapeColecao } from "@/components/layout/RodapeColecao";

/**
 * Rodapé do Gás Natural: o rodapé da coleção (RodapeColecao: entrada, dados, método e a parceria técnica com o FGV CERI) com
 * os órgãos das fontes, a data da captura mais recente e o caminho para o gás na geração de eletricidade.
 */
export function RodapeGas() {
  const meta = goldGas.meta();
  const orgaos = Array.from(new Set(meta.fontes.map((f) => f.orgao)));
  const lista = orgaos.length > 1 ? `${orgaos.slice(0, -1).join(", ")} e ${orgaos.at(-1)}` : orgaos.join("");
  return (
    <RodapeColecao colecao="gas" extras={[{ rotulo: "Gás na geração de eletricidade (Setor Elétrico)", href: "/setor-eletrico/geracao/termica" }]}>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {meta.fontes.length} conjuntos de dados abertos de {lista}. Cada número traz fonte, período e natureza; as fórmulas, as validações e o
        sha256 de cada arquivo original estão em Dados.
      </p>
      {meta.dados_capturados_em && (
        <p className="py-1 text-xs text-mineral">Captura mais recente das fontes: {carimbo(meta.dados_capturados_em)}. Versão {meta.versao_pipeline}, {meta.versao_codigo}.</p>
      )}
    </RodapeColecao>
  );
}
