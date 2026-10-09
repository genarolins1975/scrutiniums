import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { mesAno } from "@/lib/energia/formato";
import type { LinhaEvolucao } from "@/lib/energia/conta";

/**
 * P047, evolução da mediana: a tarifa B1 residencial (TE + TUSD) mediana entre as distribuidoras no dia 1º de cada mês, em valores da
 * época (nominal) e em reais do último mês com IPCA publicado (real), as duas na mesma unidade (R$/MWh) e visíveis desde o início. A
 * série em reais é a que a gold publica (`mediana × IPCA do mês-base ÷ IPCA do mês`); o gráfico só a desenha, com a data-base na legenda.
 * Sem IPCA publicado, só a série em valores da época. As linhas são as mesmas da evolução que o histórico por distribuidora (Analisar)
 * usa: o conjunto de distribuidoras muda ao longo do tempo, e o texto da seção diz isso.
 */
export function ContaSerieReal({ evolucao, ultimoIpca }: { evolucao: LinhaEvolucao[]; ultimoIpca: string | null }) {
  const base = ultimoIpca ? mesAno(`${ultimoIpca}-01`) : null;
  return (
    <GraficoLinhas
      titulo={`Mediana da tarifa B1 residencial no dia 1º de cada mês, em valores da época${base ? ` e em reais de ${base} (corrigidos pelo IPCA)` : ""}`}
      dados={evolucao}
      chaveX="m"
      formatoX="mes"
      series={[
        { id: "mediana", rotulo: "Valores da época", sigla: "Época", cor: "var(--serie-1)", espessura: 2.5 },
        ...(base ? [{ id: "real", rotulo: `Em reais de ${base}`, sigla: "Real", cor: "var(--cor-energia)", tracejada: true, espessura: 2.5 }] : []),
      ]}
      unidade="R$/MWh"
      casas={2}
      legendaInterativa
      altura={300}
    />
  );
}
