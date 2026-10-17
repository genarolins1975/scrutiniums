"use client";

import { useMemo } from "react";
import { ContaEscolha, type OpcaoConta } from "@/components/energia/ContaControles";
import { GraficoBarras, type LinhaBarras, type SerieBarra } from "@/components/energia/GraficoBarras";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { num } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { CAMPO_VALORES, emReaisDoMesBase, type FatorReal } from "@/lib/energia/conta";

/**
 * Barras por ano com a alternância entre valores nominais (a moeda da época, como a fonte publica) e valores em reais constantes do
 * mês-base do IPCA. Os subsídios e o orçamento da CDE vêm da fonte em reais nominais, e a tarifa B1 da mesma página já tinha série
 * em reais com IPCA e mês-base: sem a alternância, o crescimento de 2014 a 2025 parecia o dobro do que é em poder de compra. A escolha
 * (?valores=) é uma só para os dois gráficos da página: trocar num deles troca no outro.
 *
 * O valor em reais é o nominal do ano vezes o fator do ano (`fatoresReaisPorAno`: índice do IPCA do mês-base dividido pela média dos
 * índices mensais do ano). A nota diz o mês-base, a regra e o ano em que o IPCA cobre só parte dos meses; ano sem fator fica sem valor
 * (nunca o nominal passando por real). Sem nenhum fator, só os valores nominais, e a nota diz que falta o IPCA.
 */

const ESQUEMA = { valores: CAMPO_VALORES };

export function ContaBarrasReais({
  titulo,
  linhas,
  chaves,
  series,
  fatores,
  base,
  unidade,
  casas = 2,
  altura = 340,
  chaveCategoria,
  chaveRotulo,
}: {
  titulo: string;
  /** Uma linha por ano, em valores nominais (R$ bilhões). */
  linhas: LinhaBarras[];
  /** Colunas de dinheiro de cada linha (as séries e os totais); as demais passam sem mudar. */
  chaves: string[];
  series: SerieBarra[];
  /** Fator do ano para reais do mês-base; null quando o IPCA não cobre o ano. */
  fatores: Record<string, FatorReal | null>;
  /** Mês-base do IPCA, "ago/2026" (texto pronto), ou null sem IPCA. */
  base: string | null;
  unidade: string;
  casas?: number;
  altura?: number;
  chaveCategoria: string;
  chaveRotulo?: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const temReal = base !== null && Object.values(fatores).some((f) => f !== null);
  const real = temReal && v.valores === "real";
  const dados = useMemo(() => (real ? emReaisDoMesBase(linhas as Record<string, string | number | null>[], chaves, fatores, chaveCategoria) : linhas), [real, linhas, chaves, fatores, chaveCategoria]);
  const opcoes: OpcaoConta<"nominal" | "real">[] = [
    { id: "nominal", rotulo: tx("Nominais (valores da época)", "Nominal (values of the time)") },
    { id: "real", rotulo: tx(`Em reais de ${base ?? "mês-base"}`, `In ${base ?? "base-month"} reais`) },
  ];
  const parcial = Object.entries(fatores).filter(([, f]) => f !== null && f.meses < 12);
  const partesParcial = parcial.map(([ano, f]) => tx(`${ano} o IPCA cobre ${num(f!.meses, 0, idioma)} meses`, `${ano} the IPCA covers ${num(f!.meses, 0, idioma)} months`));
  return (
    <div className="space-y-3" data-valores={real ? "real" : "nominal"}>
      {temReal ? (
        <ContaEscolha emLinha legenda={tx("Valores", "Values")} opcoes={opcoes} valor={v.valores} onEscolher={(x) => definir({ valores: x })} />
      ) : (
        <p className="text-xs text-carvao-muted" data-nota="sem-ipca">
          {tx("Sem IPCA publicado nesta publicação: só os valores nominais, na moeda da época.", "No IPCA published in this publication: nominal values only, in the currency of the time.")}
        </p>
      )}
      <GraficoBarras
        titulo={
          real
            ? tx(`${titulo}, em reais de ${base} (corrigidos pelo IPCA)`, `${titulo}, in ${base} reais (adjusted by the IPCA)`)
            : tx(`${titulo}, em reais nominais (valores da época)`, `${titulo}, in nominal reais (values of the time)`)
        }
        dados={dados}
        chaveCategoria={chaveCategoria}
        chaveRotulo={chaveRotulo}
        series={series}
        empilhado
        unidade={unidade}
        casas={casas}
        altura={altura}
      />
      {real && (
        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="deflator">
          {tx(
            <>
              Em reais de {base}: cada ano é multiplicado pelo índice do IPCA de {base} dividido pela média dos índices mensais do ano (IPCA do IBGE). O IPCA mede preços ao consumidor em geral, não só a
              energia.
            </>,
            <>
              In {base} reais: each year is multiplied by the IPCA index for {base} divided by the average of the year&apos;s monthly indices (IBGE&apos;s IPCA). The IPCA measures consumer prices in
              general, not only energy.
            </>,
          )}
          {parcial.length > 0 &&
            tx(` Em ${partesParcial.join(" e em ")}: a média é a desses meses.`, ` In ${partesParcial.join(" and in ")}: the average is that of those months.`)}
        </p>
      )}
    </div>
  );
}
