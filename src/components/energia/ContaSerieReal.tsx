import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { mesAno } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
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
      titulo={tx(
        `Mediana da tarifa B1 residencial no dia 1º de cada mês, em valores da época${base ? ` e em reais de ${base} (corrigidos pelo IPCA)` : ""}`,
        `Median residential B1 tariff on the 1st of each month, at the prices of the time${base ? ` and in ${base} reais (adjusted by the IPCA)` : ""}`,
      )}
      dados={evolucao}
      chaveX="m"
      formatoX="mes"
      series={[
        { id: "mediana", rotulo: tx("Valores da época", "Values of the time"), sigla: tx("Época", "Nominal"), cor: "var(--serie-1)", espessura: 2.5 },
        ...(base ? [{ id: "real", rotulo: tx(`Em reais de ${base}`, `In ${base} reais`), sigla: "Real", cor: "var(--cor-energia)", tracejada: true, espessura: 2.5 }] : []), // i18n: dado
      ]}
      unidade="R$/MWh"
      casas={2}
      legendaInterativa
      altura={300}
    />
  );
}
