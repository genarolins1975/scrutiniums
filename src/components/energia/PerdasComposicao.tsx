"use client";

import { useEffect, useMemo, useState } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useSelecaoPerdas } from "@/components/energia/PerdasSelecao";
import { Nome } from "@/components/i18n/Nome";
import { num } from "@/lib/energia/formato";
import type { ColunaTabela } from "@/lib/energia/tabela";
import { carregarJson, historicoDistribuidora, rotulosDecomposicao, type LinhaComposicao } from "@/lib/energia/perdas";
import type { SerieAnualPerdas } from "@/lib/energia/tipos-perdas";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Composição das perdas por distribuidora no ano de referência (P056): barras empilhadas
 * de técnicas e não técnicas sobre a MESMA energia injetada de referência, só onde a
 * decomposição fecha (só então as duas somam a taxa total). A distribuidora escolhida
 * (?d=, a mesma do mapa) acende nas barras e na tabela e ganha o histórico por
 * componente, lido da série anual sob demanda; não técnica sobre a baixa tensão fica em
 * gráfico próprio, porque tem outro denominador e não se soma às outras.
 */

function colunas(tx: <T>(pt: T, en: T) => T): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", idiomaTexto: "nome" },
    { id: "tecnica", rotulo: tx("Técnicas", "Technical"), tipo: "percentual", casas: 2 },
    { id: "nao_tecnica", rotulo: tx("Não técnicas sobre a injetada", "Non-technical over the injected energy"), tipo: "percentual", casas: 2 },
    { id: "total", rotulo: tx("Perdas totais", "Total losses"), tipo: "percentual", casas: 2 }, // i18n: dado
    { id: "pnt_bt", rotulo: tx("Não técnicas sobre a baixa tensão", "Non-technical over the low voltage"), tipo: "percentual", casas: 2 },
    { id: "residuo_mwh", rotulo: tx("Total − técnica − não técnica", "Total − technical − non-technical"), tipo: "numero", unidade: "MWh", casas: 0 },
    { id: "decomposicao", rotulo: tx("Decomposição", "Decomposition"), tipo: "texto", categorica: true },
  ];
}

export type PerdasComposicaoProps = {
  linhas: LinhaComposicao[];
  /** Todas as distribuidoras (para ler o ?d= comum) e por que cada uma não está no gráfico. */
  ids: string[];
  rotulos: Record<string, string>;
  motivos: Record<string, string>;
  anoRef: number;
  taxaNacional: number | null;
  urlAnual: string;
  versao: string;
};

export function PerdasComposicao({ linhas, ids, rotulos, motivos, anoRef, taxaNacional, urlAnual, versao }: PerdasComposicaoProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const idioma = useIdioma();
  const tx = useTx();
  const ROTULO_DECOMPOSICAO = rotulosDecomposicao(idioma);
  const naGrafico = sel ? linhas.find((l) => l.id === sel) ?? null : null;

  const [anual, setAnual] = useState<SerieAnualPerdas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!sel) return;
    let vivo = true;
    // nova escolha ou nova tentativa: o erro anterior não fica preso na tela
    setErro(null);
    carregarJson<SerieAnualPerdas>(urlAnual).then(
      (a) => vivo && setAnual(a),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [sel, urlAnual, tentativa]);
  const historico = useMemo(() => (sel && anual ? historicoDistribuidora(anual.distribuidoras[sel] ?? [], idioma) : null), [sel, anual, idioma]);

  // as barras recebem os valores exatos (ver LinhaComposicao): o total no fim da barra, na dica e na tabela do gráfico é o mesmo número da tabela da página
  const dados = useMemo(() => linhas.map((l) => ({ id: l.id, rotulo: l.rotulo, tecnica: l.tecnica_barra, nao_tecnica: l.nao_tecnica_barra })), [linhas]);
  const linhasTabela = useMemo(
    () => linhas.map((l) => ({ id: l.id, rotulo: l.rotulo, tecnica: l.tecnica, nao_tecnica: l.nao_tecnica, total: l.total, pnt_bt: l.pnt_bt, residuo_mwh: l.residuo_mwh, decomposicao: ROTULO_DECOMPOSICAO[l.decomposicao] })),
    [linhas, ROTULO_DECOMPOSICAO],
  );

  return (
    <div className="space-y-5">
      <GraficoBarras
        titulo={tx(`Perdas técnicas e não técnicas por distribuidora, ${anoRef}`, `Technical and non-technical losses by distribution utility, ${anoRef}`)}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        rotulosSaoNomes
        series={[
          { id: "tecnica", rotulo: tx("Técnicas", "Technical"), cor: "var(--escala-seq-4)" },
          { id: "nao_tecnica", rotulo: tx("Não técnicas", "Non-technical"), cor: "var(--serie-termica)" },
        ]}
        unidade={tx("% da energia injetada", "% of injected energy")}
        casas={2}
        orientacao="horizontal"
        empilhado
        rotulosValor
        referencias={taxaNacional !== null ? [{ valor: taxaNacional, rotulo: tx(`Perdas totais das concessionárias em ${anoRef}`, `Total losses of the concession holders in ${anoRef}`) }] : []}
        selecionado={naGrafico ? naGrafico.id : null}
        onSelecionar={selecionar}
      />

      <div className="border border-linha bg-papel px-4 py-3 text-sm text-carvao" data-selecao={sel ?? ""}>
        {!sel ? (
          <p className="text-carvao-muted">
            {tx(
              "Escolha uma barra ou uma linha da tabela para ver a composição de uma distribuidora ao longo dos anos.",
              "Choose a bar or a table row to see the composition of a distribution utility over the years.",
            )}
          </p>
        ) : (
          <>
            <p data-resposta="composicao-distribuidora">
              {naGrafico
                ? tx(
                    <>{`${naGrafico.rotulo}, ${anoRef}: técnicas ${num(naGrafico.tecnica, 2)}% e não técnicas ${num(naGrafico.nao_tecnica, 2)}% da energia injetada; perdas totais de ${num(naGrafico.total, 2)}% sobre a mesma base (decomposição ${ROTULO_DECOMPOSICAO[naGrafico.decomposicao]}${naGrafico.residuo_mwh ? `, diferença de ${num(naGrafico.residuo_mwh, 0)} MWh no ano` : ""}).`}</>,
                    <>
                      <Nome>{naGrafico.rotulo}</Nome>
                      {`, ${anoRef}: technical ${num(naGrafico.tecnica, 2, idioma)}% and non-technical ${num(naGrafico.nao_tecnica, 2, idioma)}% of the injected energy; total losses of ${num(naGrafico.total, 2, idioma)}% on the same base (decomposition ${ROTULO_DECOMPOSICAO[naGrafico.decomposicao]}${naGrafico.residuo_mwh ? `, difference of ${num(naGrafico.residuo_mwh, 0, idioma)} MWh in the year` : ""}).`}
                    </>,
                  )
                : tx(
                    <>{`${rotulos[sel] ?? sel} não está no gráfico de ${anoRef}: ${motivos[sel] ?? "sem dado"}.`}</>,
                    <>
                      <Nome>{rotulos[sel] ?? sel}</Nome>
                      {` is not in the ${anoRef} chart: ${motivos[sel] ?? "no data"}.`}
                    </>,
                  )}
            </p>
            {historico ? (
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <GraficoLinhas
                  titulo={tx(`${rotulos[sel] ?? sel}: perdas totais e técnicas por ano`, `${rotulos[sel] ?? sel}: total and technical losses by year`)}
                  dados={historico.pontos}
                  chaveX="ano" // i18n: dado
                  formatoX="texto"
                  series={[
                    { id: "taxa", rotulo: tx("Perdas totais", "Total losses"), cor: "var(--cor-energia)" }, // i18n: dado
                    { id: "tecnica", rotulo: tx("Técnicas", "Technical"), cor: "var(--escala-seq-4)", tracejada: true },
                  ]}
                  unidade={tx("% da energia injetada", "% of injected energy")}
                  casas={2}
                  zeroNoEixo
                  altura={240}
                />
                <GraficoLinhas
                  titulo={tx(`${rotulos[sel] ?? sel}: não técnicas sobre a baixa tensão por ano`, `${rotulos[sel] ?? sel}: non-technical losses over the low voltage by year`)}
                  dados={historico.pontos}
                  chaveX="ano" // i18n: dado
                  formatoX="texto"
                  series={[{ id: "pnt_bt", rotulo: tx("Não técnicas", "Non-technical"), cor: "var(--serie-termica)" }]}
                  unidade={tx("% do mercado de baixa tensão", "% of the low-voltage market")}
                  casas={2}
                  zeroNoEixo
                  altura={240}
                />
              </div>
            ) : erro ? (
              <p className="mt-2 text-carvao">
                {tx(<>A série anual não carregou ({erro}).</>, <>The annual series did not load ({erro}).</>)}{" "}
                <button
                  type="button"
                  className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
                  onClick={() => setTentativa((t) => t + 1)}
                >
                  {tx("Tentar de novo", "Try again")}
                </button>
              </p>
            ) : (
              <p role="status" className="mt-2 text-xs text-carvao-muted">
                {tx("Carregando a série anual.", "Loading the annual series.")}
              </p>
            )}
            {historico && (
              <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                {tx(
                  "Cada componente só aparece no ano em que entra na comparação: técnica publicada nos 12 meses sem a decomposição quebrada; não técnica com a decomposição fechando. Lacuna é ano sem o componente ou fora da comparação, nunca zero.",
                  "Each component appears only in the year it enters the comparison: technical losses published for the 12 months with no broken decomposition; non-technical losses with the decomposition closing. A gap is a year without the component or outside the comparison, never zero.",
                )}
              </p>
            )}
          </>
        )}
      </div>

      <TabelaInterativa
        titulo={tx(`Composição das perdas por distribuidora, ${anoRef}`, `Composition of losses by distribution utility, ${anoRef}`)}
        colunas={colunas(tx)}
        linhas={linhasTabela}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={tx(
          "ANEEL, SAMP Balanço (linhas de valor medido; a técnica é a perda técnica informada no balanço de energia, estimativa da fonte, e a não técnica herda essa estimativa)",
          "ANEEL, SAMP balance (measured-value lines; the technical figure is the technical loss reported in the energy balance, an estimate by the source, and the non-technical figure inherits that estimate)",
        )}
        versao={versao}
        nomeArquivo={`perdas-composicao-${anoRef}`}
        chaveUrl="comp"
        selecionado={naGrafico ? naGrafico.id : null}
        onSelecionar={selecionar}
        ordemInicial={{ coluna: "total", direcao: "desc" }} // i18n: dado
        dicaBusca={tx("Sigla ou nome", "Acronym or name")}
        nota={tx(
          <>
            Técnicas e não técnicas sobre a energia injetada de referência; a soma delas reproduz a taxa total quando a decomposição fecha. A coluna &quot;Total − técnica − não técnica&quot; mostra a
            diferença em MWh no ano, e a coluna &quot;Decomposição&quot;, a regra de fechamento atendida.
          </>,
          <>
            Technical and non-technical losses over the reference injected energy; their sum reproduces the total rate when the decomposition closes. The column &quot;Total − technical −
            non-technical&quot; shows the difference in MWh in the year, and the column &quot;Decomposition&quot;, the closing rule met.
          </>,
        )}
      />
    </div>
  );
}
