"use client";

import { useMemo, type ReactNode } from "react";
import { CargaEscolha, CargaLista } from "@/components/energia/CargaControles";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COR_REGIAO,
  DO_REGIAO,
  NOME_REGIAO,
  REGIOES,
  TIPOS_COMPARACAO,
  VARIANTES,
  barrasDecomposicao,
  curtoRegiao,
  doRegiao,
  nomeRegiao,
  rotuloGrupo,
  rotuloTipo,
  decomposicaoEscolhida,
  linhasRecenteModelo,
  linhasRespostaTemperatura,
  linhasSensibilidade,
  paraTabela,
  partesDaDiferenca,
  respostaClima,
  respostaDecomposicao,
  respostaUltimoDia,
  textoCoberturaIntervalos,
  textoJanelaCurta,
  vereditoClima,
  textoDefasagemTemperatura,
  type TipoComparacao,
} from "@/lib/energia/carga";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { formatos } from "@/lib/energia/formato";
import { FONTE_INTERVALO_EN, rotuloDaGold, rotuloVarianteModelo } from "@/lib/energia/i18n/agua-carga-rede";
import { porIdioma } from "@/lib/energia/idioma";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { A07, P027, VarianteModelo } from "@/lib/energia/tipos-carga";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";

/**
 * P027, clima e calendário: decomposição estatística (não causal) da carga diária,
 * estimada só com o passado e avaliada fora da amostra. Região (?sm=), variante do
 * modelo (?var=) e tipo de comparação da janela do achado (?cmp=) ficam na URL, assim
 * como busca, filtros, ordem e página de cada tabela (prefixos prev, dec, met, ori, sen
 * e tmp); as datas do achado e as contagens dos títulos vêm da gold. O
 * gráfico real × previsto, o de contribuições e a tabela usam as mesmas linhas; a
 * resposta é refeita pela mesma regra quando a região muda.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(REGIOES), "SIN"),
  var: campo(tiposUrl.opcao(VARIANTES), "principal"),
  cmp: campo(tiposUrl.opcao(TIPOS_COMPARACAO), "equivalente"),
};

const opcoesRegiao = (idioma: Idioma) => REGIOES.map((sm) => ({ id: sm, rotulo: sm === "SE" ? curtoRegiao("SE", idioma) : nomeRegiao(sm, idioma), detalhe: nomeRegiao(sm, idioma) }));
const opcoesTipo = (idioma: Idioma) =>
  TIPOS_COMPARACAO.map((t) => ({
    id: t,
    rotulo: t === "equivalente" ? porIdioma(idioma, { pt: "Mesmos dias da semana", en: "Same weekdays" }) : porIdioma(idioma, { pt: "Mesmas datas", en: "Same dates" }),
    detalhe: rotuloTipo(t, idioma),
  }));

const colunasRecente = (idioma: Idioma): ColunaTabela[] => {
  const mw = porIdioma(idioma, { pt: "MWmed", en: "MWavg" });
  return [
    { id: "d", rotulo: porIdioma(idioma, { pt: "Dia", en: "Day" }), tipo: "data" },
    { id: "real", rotulo: porIdioma(idioma, { pt: "Real", en: "Actual" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "previsto", rotulo: porIdioma(idioma, { pt: "Previsto", en: "Predicted" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "p10", rotulo: porIdioma(idioma, { pt: "Limite inferior de 80%", en: "80% lower bound" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "p90", rotulo: porIdioma(idioma, { pt: "Limite superior de 80%", en: "80% upper bound" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "p025", rotulo: porIdioma(idioma, { pt: "Limite inferior de 95%", en: "95% lower bound" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "p975", rotulo: porIdioma(idioma, { pt: "Limite superior de 95%", en: "95% upper bound" }), tipo: "numero", unidade: mw, casas: 0 },
    { id: "residuo_pct", rotulo: porIdioma(idioma, { pt: "Real contra previsto", en: "Actual against predicted" }), tipo: "percentual", casas: 2 },
    { id: "dentro_80", rotulo: porIdioma(idioma, { pt: "Dentro do intervalo de 80%", en: "Within the 80% interval" }), tipo: "texto", categorica: true },
    { id: "calendario", rotulo: rotuloGrupo("calendario", idioma), tipo: "numero", unidade: "log × 100", casas: 2 },
    { id: "temperatura", rotulo: rotuloGrupo("temperatura", idioma), tipo: "numero", unidade: "log × 100", casas: 2 },
    { id: "sazonalidade", rotulo: rotuloGrupo("sazonalidade", idioma), tipo: "numero", unidade: "log × 100", casas: 2 },
    { id: "nivel_tendencia", rotulo: rotuloGrupo("nivel_tendencia", idioma), tipo: "numero", unidade: "log × 100", casas: 2 },
    { id: "origem", rotulo: porIdioma(idioma, { pt: "Origem do modelo", en: "Model origin" }), tipo: "data" },
  ];
};
const colunasBarras = (idioma: Idioma): ColunaTabela[] => [
  { id: "rotulo", rotulo: porIdioma(idioma, { pt: "Parte", en: "Part" }), tipo: "texto" },
  { id: "valor", rotulo: porIdioma(idioma, { pt: "Valor", en: "Value" }), tipo: "numero", unidade: "log × 100", casas: 2 }, // i18n: dado
];
const colunasOrigens = (idioma: Idioma): ColunaTabela[] => [
  { id: "origem", rotulo: porIdioma(idioma, { pt: "Origem", en: "Origin" }), tipo: "data" },
  { id: "dias_treino", rotulo: porIdioma(idioma, { pt: "Dias de treino", en: "Training days" }), tipo: "numero", casas: 0 },
  { id: "dias", rotulo: porIdioma(idioma, { pt: "Dias previstos", en: "Predicted days" }), tipo: "numero", casas: 0 }, // i18n: dado
  { id: "mape_pct", rotulo: porIdioma(idioma, { pt: "Erro absoluto médio", en: "Mean absolute error" }), tipo: "percentual", casas: 2 },
  { id: "vies_pct", rotulo: porIdioma(idioma, { pt: "Viés", en: "Bias" }), tipo: "percentual", casas: 2 },
  { id: "fonte_intervalo", rotulo: porIdioma(idioma, { pt: "Base do intervalo", en: "Interval basis" }), tipo: "texto", categorica: true },
];
const colunasMetricas = (idioma: Idioma): ColunaTabela[] => [
  { id: "rotulo", rotulo: porIdioma(idioma, { pt: "Variante", en: "Variant" }), tipo: "texto" },
  { id: "dias", rotulo: porIdioma(idioma, { pt: "Dias previstos", en: "Predicted days" }), tipo: "numero", casas: 0 }, // i18n: dado
  { id: "origens", rotulo: porIdioma(idioma, { pt: "Origens", en: "Origins" }), tipo: "numero", casas: 0 },
  { id: "mape_pct", rotulo: porIdioma(idioma, { pt: "Erro absoluto médio", en: "Mean absolute error" }), tipo: "percentual", casas: 2 },
  { id: "mape_principal", rotulo: porIdioma(idioma, { pt: "Erro do modelo principal", en: "Error of the main model" }), tipo: "percentual", casas: 2 },
  { id: "mape_referencia_364d_pct", rotulo: porIdioma(idioma, { pt: "Erro da referência de 364 dias", en: "Error of the 364-day baseline" }), tipo: "percentual", casas: 2 },
  { id: "vies_pct", rotulo: porIdioma(idioma, { pt: "Viés", en: "Bias" }), tipo: "percentual", casas: 2 },
  { id: "mae_mwmed", rotulo: porIdioma(idioma, { pt: "Erro absoluto médio", en: "Mean absolute error" }), tipo: "numero", unidade: porIdioma(idioma, { pt: "MWmed", en: "MWavg" }), casas: 0 },
  { id: "rmse_mwmed", rotulo: porIdioma(idioma, { pt: "Raiz do erro quadrático médio", en: "Root mean squared error" }), tipo: "numero", unidade: porIdioma(idioma, { pt: "MWmed", en: "MWavg" }), casas: 0 },
  { id: "cobertura_80_pct", rotulo: porIdioma(idioma, { pt: "Cobertura do intervalo de 80%", en: "Coverage of the 80% interval" }), tipo: "percentual", casas: 1 },
  { id: "cobertura_95_pct", rotulo: porIdioma(idioma, { pt: "Cobertura do intervalo de 95%", en: "Coverage of the 95% interval" }), tipo: "percentual", casas: 1 },
];
const colunasRegioes = (idioma: Idioma): ColunaTabela[] => [
  { id: "regiao", rotulo: porIdioma(idioma, { pt: "Região", en: "Region" }), tipo: "texto" },
  ...colunasMetricas(idioma).filter((c) => !["rotulo", "mape_principal"].includes(c.id)),
];
const colunasTemperatura = (idioma: Idioma): ColunaTabela[] => [
  { id: "t", rotulo: porIdioma(idioma, { pt: "Temperatura média ponderada", en: "Weighted average temperature" }), tipo: "texto" },
  ...REGIOES.map((sm): ColunaTabela => ({ id: sm, rotulo: curtoRegiao(sm, idioma), tipo: "numero", unidade: "log × 100", casas: 2 })),
];

/**
 * Faixa de métricas da abertura: a diferença real entre as janelas, a parte que calendário, temperatura e estação do ano acompanham, a parte que
 * o modelo não reproduz (o resíduo) e o erro do modelo em dias que ele não viu. Lê da URL a mesma região, base e variante que o painel (por isso é
 * cliente) e as partes publicadas da decomposição (partesDaDiferenca), as mesmas do veredito e do gráfico. É associação estatística, não causa.
 */
export function CargaClimaMetricas({
  p027,
  a07,
  evidencia,
}: {
  p027: Pick<NonNullable<P027>, "metricas" | "periodo_avaliacao">;
  a07: Pick<A07, "decomposicao">;
  /** Ficha "Comprove este número" do erro do modelo no SIN (a ficha só existe para esse recorte). */
  evidencia: Evidencia | null;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const { num, dataBR } = formatos(idioma);
  const [v] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Regiao;
  const d = decomposicaoEscolhida(a07, sm, v.var as VarianteModelo, v.cmp as TipoComparacao);
  const partes = d ? partesDaDiferenca(d) : null;
  const m = p027.metricas[sm];
  const periodoJanela = d
    ? tx(
        `${dataBR(d.inicio)} a ${dataBR(d.fim)} contra ${dataBR(d.inicio_ant)} a ${dataBR(d.fim_ant)}`,
        `${dataBR(d.inicio)} to ${dataBR(d.fim)} against ${dataBR(d.inicio_ant)} to ${dataBR(d.fim_ant)}`,
      )
    : undefined;
  const semDecomposicao = tx(
    "Esta combinação de região, variante e comparação não tem decomposição publicada.",
    "This combination of region, variant and comparison has no published breakdown.",
  );
  const porCento = (x: number | null) =>
    x === null ? undefined : tx(`${num(Math.round(x * 100), 0)}% da diferença entre as janelas`, `${num(Math.round(x * 100), 0)}% of the difference between the windows`);
  const pct = (x: number) => `${num(Math.round(x * 100), 0)}%`;
  // as três partes fecham a diferença: a frase da resposta cita duas, e a terceira (nível e tendência) fica à vista aqui, em Entender
  const fechamento =
    partes && partes.proporcaoClima !== null && partes.proporcaoNivel !== null && partes.proporcaoResto !== null
      ? tx(
          ` Da diferença, calendário, temperatura e estação do ano acompanham ${pct(partes.proporcaoClima)}, nível e tendência ${pct(partes.proporcaoNivel)} e o resíduo ${pct(partes.proporcaoResto)} (arredondados).`,
          ` Of the difference, calendar, temperature and season account for ${pct(partes.proporcaoClima)}, level and trend for ${pct(partes.proporcaoNivel)} and the residual for ${pct(partes.proporcaoResto)} (rounded).`,
        )
      : "";
  const pontos = tx("pontos", "points");
  return (
    <FaixaMetricas
      colunas={4}
      rotulo={tx("Diferença entre as janelas, partes do modelo e erro fora da amostra", "Difference between the windows, model parts and out-of-sample error")}
      nota={tx(
        `Associação estatística, não causa: cada parte é a mudança da previsão associada a um grupo de variáveis, e o resíduo é o que o modelo não reproduz.${fechamento}`,
        `Statistical association, not cause: each part is the change in the prediction associated with a group of variables, and the residual is what the model does not reproduce.${fechamento}`,
      )}
    >
      <Numero
        variante="faixa"
        rotulo={tx(`Diferença entre as janelas ${DO_REGIAO[sm]}`, `Difference between the windows ${doRegiao(sm, "en")}`)}
        natureza="CALCULADO"
        valor={partes?.diferenca ?? null}
        formato="num"
        casas={2}
        unidade={pontos}
        periodo={periodoJanela}
        cor={COR_REGIAO[sm]}
        nota={tx("Em log × 100, que se lê, aproximadamente, como pontos percentuais.", "In log × 100, which reads approximately as percentage points.")}
        motivoAusencia={semDecomposicao}
      />
      <Numero
        variante="faixa"
        rotulo={tx("Acompanham calendário, temperatura e estação do ano", "Accounted for by calendar, temperature and season")}
        natureza="ESTIMADO"
        valor={partes?.clima ?? null}
        formato="num"
        casas={2}
        unidade={pontos}
        periodo={partes ? porCento(partes.proporcaoClima) : undefined}
        cor="var(--serie-termica)"
        motivoAusencia={semDecomposicao}
      />
      <Numero
        variante="faixa"
        rotulo={tx("O modelo não reproduz (resíduo)", "Not reproduced by the model (residual)")}
        natureza="ESTIMADO"
        valor={partes?.residuo ?? null}
        formato="num"
        casas={2}
        unidade={pontos}
        periodo={partes ? porCento(partes.proporcaoResto) : undefined}
        cor="var(--serie-referencia)"
        motivoAusencia={semDecomposicao}
      />
      <Numero
        variante="faixa"
        rotulo={tx(`Erro absoluto médio do modelo em dias que não viu, ${NOME_REGIAO[sm]}`, `Mean absolute error of the model on days it did not see, ${nomeRegiao(sm, "en")}`)}
        natureza="ESTIMADO"
        valor={m?.mape_pct ?? null}
        formato="pct"
        casas={2}
        periodo={tx(`${dataBR(p027.periodo_avaliacao.inicio)} a ${dataBR(p027.periodo_avaliacao.fim)}`, `${dataBR(p027.periodo_avaliacao.inicio)} to ${dataBR(p027.periodo_avaliacao.fim)}`)}
        evidencia={sm === "SIN" ? evidencia : null}
        endereco={sm === "SIN" ? "/setor-eletrico/carga/clima-e-calendario#p027" : undefined}
        nota={
          m?.mape_referencia_364d_pct != null
            ? tx(`Referência ingênua de 364 dias: ${num(m.mape_referencia_364d_pct, 2)}% nos mesmos dias.`, `Naive 364-day baseline: ${num(m.mape_referencia_364d_pct, 2)}% on the same days.`)
            : tx("Sem erro da referência ingênua de 364 dias nesta publicação.", "No error for the naive 364-day baseline in this release.")
        }
        motivoAusencia={tx("Sem métricas fora da amostra para esta região nesta publicação.", "No out-of-sample metrics for this region in this release.")}
      />
    </FaixaMetricas>
  );
}

export function CargaClima({
  p027,
  a07,
  achado,
  diaReferencia,
  fonte,
  versao,
  notas,
}: {
  p027: Pick<NonNullable<P027>, "metricas" | "periodo_avaliacao" | "sensibilidade" | "por_origem_sin" | "recente_sin" | "resposta_temperatura">;
  a07: Pick<A07, "decomposicao" | "comparacoes">;
  /** Janela do achado A07 (a07.referencia), os dias dela e o motivo publicado quando o modelo cobre menos dias (a07.janela_modelo). */
  achado: { inicio: string; fim: string; dias_janela: number; motivo: string | null };
  diaReferencia: string;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const { num, dataBR, mesAno, plural } = formatos(idioma);
  const mw = tx("MWmed", "MWavg");
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const p = p027;
  const sm = v.sm as Regiao;
  const variante = v.var as VarianteModelo;
  const tipo = v.cmp as TipoComparacao;
  const recente = useMemo(() => paraTabela(linhasRecenteModelo(p), idioma), [p, idioma]);
  const d = decomposicaoEscolhida(a07, sm, variante, tipo);
  const barras = useMemo(() => (d ? barrasDecomposicao(d, idioma) : []), [d, idioma]);
  const barrasTabela = useMemo(() => barras.map((b) => ({ ...b })), [barras]);
  const sens = useMemo(() => linhasSensibilidade(p, sm).map((s) => ({ ...s, rotulo: rotuloVarianteModelo(s.rotulo, idioma) })), [p, sm, idioma]);
  const sensTabela = useMemo(() => paraTabela(sens, idioma), [sens, idioma]);
  const origens = useMemo(
    () => p.por_origem_sin.map((o) => ({ ...o, fonte_intervalo: rotuloDaGold(FONTE_INTERVALO_EN, o.fonte_intervalo, idioma), id: o.origem, mes: mesAno(o.origem.slice(0, 7)) })),
    [p, idioma], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const temperatura = useMemo(() => linhasRespostaTemperatura(p, idioma), [p, idioma]);
  const metricasRegioes = REGIOES.map((r) => ({ id: r, regiao: nomeRegiao(r, idioma), ...p.metricas[r] }));
  const janelaCurta = textoJanelaCurta(d, { fim: achado.fim, dias_janela: achado.dias_janela }, a07.comparacoes, idioma);
  const variantesDisponiveis = VARIANTES.filter((x) => a07.decomposicao.some((y) => y.sm === sm && y.variante === x && y.comparacao === tipo));
  const rotuloVariante = (x: VarianteModelo) => {
    const r = p.sensibilidade.find((s) => s.variante === x)?.rotulo;
    return r ? rotuloVarianteModelo(r, idioma) : x;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-y-4">
        <RespostaCurta id="p027" vivo veredito={vereditoClima(d, p, sm, idioma)}>
          {respostaClima(p, sm, idioma)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CargaEscolha legenda={tx("Região", "Region")} opcoes={opcoesRegiao(idioma)} valor={sm} onEscolher={(x) => definir({ sm: x })} />
          <CargaEscolha legenda={tx("Comparar com", "Compare with")} opcoes={opcoesTipo(idioma)} valor={tipo} onEscolher={(x) => definir({ cmp: x })} />
          <CargaLista
            rotulo={tx("Variante do modelo", "Model variant")}
            opcoes={variantesDisponiveis.map((x) => ({ id: x, rotulo: rotuloVariante(x) }))}
            valor={variante}
            onEscolher={(x) => definir({ var: x })}
          />
        </div>
      </div>

      <div className="space-y-4" id="decomposicao-a07">
        {d ? (
          <>
            <div data-nivel="analisar" data-resposta="p027-decomposicao" aria-live="polite" className="max-w-prose2 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted">
              <p className="rotulo mb-1 text-mineral">{tx("Os números por trás da resposta", "The numbers behind the answer")}</p>
              <p>{respostaDecomposicao(d, idioma)}</p>
            </div>
            {d.fim < achado.fim && (
              <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
                {tx(
                  <>
                    Esta variante cobre {plural(d.dias, "dia", "dias")}, até {dataBR(d.fim)}, e não a janela inteira ({dataBR(achado.inicio)} a {dataBR(achado.fim)})
                    {achado.motivo ? `: ${achado.motivo}` : ": dia sem temperatura não entra no modelo"}.
                  </>,
                  <>
                    This variant covers {plural(d.dias, "day", "days")}, through {dataBR(d.fim)}, and not the whole window ({dataBR(achado.inicio)} to {dataBR(achado.fim)})
                    {achado.motivo ? (
                      <>
                        : <TrechoPortugues regiao="motivo da janela do modelo">{achado.motivo}</TrechoPortugues>
                      </>
                    ) : (
                      ": a day without temperature does not enter the model"
                    )}
                    .
                  </>,
                )}
              </p>
            )}
            <GraficoBarras
              titulo={tx(`Diferença entre as janelas ${DO_REGIAO[sm]}, por parte do modelo (log × 100)`, `Difference between the windows ${doRegiao(sm, "en")}, by model part (log × 100)`)}
              dados={barrasTabela}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "valor", rotulo: tx("Parte da diferença", "Part of the difference"), cor: COR_REGIAO[sm] }]} // i18n: dado
              unidade="log × 100"
              casas={2}
              orientacao="horizontal"
              referencias={[{ valor: d.real_log100, rotulo: tx("Diferença real", "Actual difference") }]}
            />
            <TabelaInterativa
              titulo={tx("Tabela equivalente: partes da diferença", "Equivalent table: parts of the difference")}
              colunas={colunasBarras(idioma)}
              linhas={barrasTabela}
              chaveLinha="id"
              colunaRotulo="rotulo"
              fonte={fonte}
              versao={d.origem_modelo}
              nomeArquivo={`carga-decomposicao-a07-${sm}-${variante}-${tipo}`}
              chaveUrl="dec"
              nota={tx(
                `As quatro partes do modelo somam a diferença prevista (${num(d.previsto_log100, 2)}); com o resíduo (${num(d.residuo_log100, 2)}), a diferença real (${num(d.real_log100, 2)}). Valores publicados, com duas casas.`,
                `The four model parts add up to the predicted difference (${num(d.previsto_log100, 2)}); with the residual (${num(d.residuo_log100, 2)}), to the actual difference (${num(d.real_log100, 2)}). Published values, with two decimal places.`,
              )}
            />
          </>
        ) : (
          <p className="text-sm text-carvao-muted">
            {tx(
              "Esta combinação de região, variante e comparação não foi publicada: a janela não tem todos os dias com temperatura ou a variante não foi estimada para ela.",
              "This combination of region, variant and comparison was not published: the window does not have every day with temperature or the variant was not estimated for it.",
            )}
          </p>
        )}
        <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
          {textoDefasagemTemperatura(p, diaReferencia, idioma)}
          {janelaCurta ? ` ${janelaCurta}` : ""}
        </p>
      </div>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                Avaliação fora da amostra de {dataBR(p.periodo_avaliacao.inicio)} a {dataBR(p.periodo_avaliacao.fim)} ({num(p.periodo_avaliacao.dias, 0)} dias)
              </>,
              <>
                Out-of-sample evaluation from {dataBR(p.periodo_avaliacao.inicio)} to {dataBR(p.periodo_avaliacao.fim)} ({num(p.periodo_avaliacao.dias, 0)} days)
              </>,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>Carga diária {DO_REGIAO[sm]}; temperatura média das capitais ponderada pela população</>,
              <>Daily load {doRegiao(sm, "en")}; average temperature of the state capitals weighted by population</>,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                MWmed; erro em %; contribuições em log × 100: o modelo trabalha com o logaritmo natural da carga, e a diferença entre duas cargas nessa escala se lê, aproximadamente,
                como pontos percentuais
              </>,
              <>
                MWavg; error in %; contributions in log × 100: the model works with the natural logarithm of the load, and the difference between two loads on that scale reads
                approximately as percentage points
              </>,
            )}
          </dd>
        </div>
      </dl>

      {notas}

      <SecaoDoPainel
        id="validacao"
        titulo={tx(
          `Últimos ${plural(recente.length, "dia previsto", "dias previstos")}: real, previsto e intervalo (SIN)`,
          `Last ${plural(recente.length, "predicted day", "predicted days")}: actual, predicted and interval (SIN)`,
        )}
        lead={tx(
          "O modelo acerta dias que não viu? A carga real contra a prevista com os dados anteriores a cada origem mensal (todo mês o modelo é reestimado só com o passado), e o que cada grupo de variáveis contribuiu à previsão.",
          "Does the model get right days it did not see? The actual load against the one predicted with the data before each monthly origin (every month the model is re-estimated with the past only), and what each group of variables contributed to the prediction.",
        )}
      >
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{respostaUltimoDia(p, idioma)}</p>
        {/* a ressalva do intervalo vai com ele: sem ela, a faixa de 80% parece valer mais do que cobriu fora da amostra */}
        <p className="max-w-prose2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao" data-aviso="cobertura-do-intervalo">
          {textoCoberturaIntervalos(p, "SIN", idioma)}{" "}
          {tx("O intervalo de 80% é a faixa em que o modelo esperava a carga em 80% dos dias.", "The 80% interval is the range in which the model expected the load on 80% of the days.")}
        </p>
        <CursorSincronizado>
          <GraficoLinhas
            titulo={tx("Carga diária do SIN e previsão fora da amostra, com o intervalo de 80%", "SIN daily load and out-of-sample prediction, with the 80% interval")}
            dados={recente}
            chaveX="d"
            series={[
              { id: "real", rotulo: tx("Real", "Actual"), cor: "var(--cor-energia)" }, // i18n: dado
              { id: "previsto", rotulo: tx("Previsto pelo modelo", "Predicted by the model"), sigla: tx("Previsto", "Predicted"), cor: "var(--serie-referencia)", tracejada: true },
            ]}
            banda={{
              inferior: "p10",
              superior: "p90",
              rotulo: tx("intervalo de 80% (quantis dos erros fora da amostra)", "80% interval (quantiles of the out-of-sample errors)"),
            }}
            unidade={mw}
            casas={0}
            altura={280}
          />
          <GraficoLinhas
            titulo={tx(
              "Contribuição de cada grupo de variáveis à previsão, em relação à média do treino",
              "Contribution of each group of variables to the prediction, relative to the training average",
            )}
            dados={recente}
            chaveX="d"
            series={[
              { id: "calendario", rotulo: rotuloGrupo("calendario", idioma), cor: "var(--serie-1)" },
              { id: "temperatura", rotulo: rotuloGrupo("temperatura", idioma), cor: "var(--serie-termica)" },
              { id: "sazonalidade", rotulo: rotuloGrupo("sazonalidade", idioma), cor: "var(--serie-hidraulica)" },
              { id: "nivel_tendencia", rotulo: rotuloGrupo("nivel_tendencia", idioma), sigla: tx("Tendência", "Trend"), cor: "var(--serie-referencia)", tracejada: true },
            ]}
            unidade="log × 100"
            casas={1}
            altura={240}
            legendaInterativa
          />
        </CursorSincronizado>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {tx(
            <>
              No primeiro gráfico, a linha contínua é a carga real e a tracejada, a prevista pelo modelo; a faixa é o intervalo de 80%, com a cobertura medida dita acima. No segundo, cada linha é a contribuição de um
              grupo de variáveis. A do calendário sobe e desce ao longo da semana: dia útil, sábado e domingo ou feriado entram no modelo como grupos diferentes.
            </>,
            <>
              In the first chart, the solid line is the actual load and the dashed one, the load predicted by the model; the band is the 80% interval, with the measured coverage stated above. In the
              second, each line is the contribution of a group of variables. The calendar line rises and falls over the week: working day, Saturday and Sunday or holiday enter the model as different
              groups.
            </>,
          )}
        </p>
        <TabelaInterativa
          titulo={tx("Tabela equivalente: os mesmos dias dos dois gráficos", "Equivalent table: the same days as the two charts")}
          colunas={colunasRecente(idioma)}
          linhas={recente}
          chaveLinha="id"
          colunaRotulo="d"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-decomposicao-recente-sin"
          chaveUrl="prev"
          ordemInicial={{ coluna: "d", direcao: "desc" }}
          nota={tx(
            "Contribuição: mudança da previsão associada ao grupo, com o resto fixo. Não é efeito causal nem parcela explicada.",
            "Contribution: change in the prediction associated with the group, with the rest held fixed. It is neither a causal effect nor an explained share.",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="sensibilidade"
        titulo={tx("Sensibilidade: o resultado depende das escolhas do modelo?", "Sensitivity: does the result depend on the model choices?")}
        lead={tx(
          "O erro de cada variante do modelo ao lado do erro do modelo principal, na mesma região.",
          "The error of each model variant next to the error of the main model, in the same region.",
        )}
      >
        <GraficoPontos
          titulo={tx(
            `Erro absoluto médio de cada variante e do modelo principal, ${NOME_REGIAO[sm]}`,
            `Mean absolute error of each variant and of the main model, ${nomeRegiao(sm, "en")}`,
          )}
          itens={sens.map((s) => ({
            id: s.id,
            rotulo: s.rotulo,
            valor: s.mape_pct,
            referencia: s.mape_principal,
            detalhe: tx(`${num(s.dias, 0)} dias; cobertura de 80%: ${num(s.cobertura_80_pct, 1)}%`, `${num(s.dias, 0)} days; 80% coverage: ${num(s.cobertura_80_pct, 1)}%`),
          }))}
          unidade="%"
          casas={2}
          rotuloValor={tx("Erro da variante", "Variant error")}
          rotuloReferencia={tx("Erro do modelo principal", "Error of the main model")}
          corValor={COR_REGIAO[sm]}
          corReferencia="var(--serie-referencia)"
          selecionado={variante}
          onSelecionar={(id) => id && definir({ var: id as VarianteModelo })}
        />
        <TabelaInterativa
          titulo={tx("Tabela equivalente: variantes do modelo", "Equivalent table: model variants")}
          colunas={colunasMetricas(idioma)}
          linhas={sensTabela}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`carga-decomposicao-sensibilidade-${sm}`}
          chaveUrl="sen"
          selecionado={variante}
          onSelecionar={(id) => id && definir({ var: id as VarianteModelo })}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="temperatura-resposta" titulo={tx("Como a previsão responde à temperatura?", "How does the prediction respond to temperature?")}>
        <GraficoLinhas
          titulo={tx(
            "Contribuição da temperatura à previsão, por grau, em relação à média do treino",
            "Contribution of temperature to the prediction, by degree, relative to the training average",
          )}
          dados={temperatura}
          chaveX="t"
          formatoX="texto"
          series={REGIOES.map((r) => ({ id: r, rotulo: nomeRegiao(r, idioma), sigla: curtoRegiao(r, idioma), cor: COR_REGIAO[r] }))}
          unidade="log × 100"
          casas={1}
          legendaInterativa
          altura={280}
        />
        <p className="text-sm text-carvao-muted">
          {tx(
            <>
              Cada curva cobre só a faixa de temperatura observada no treino da região; fora dela, a célula fica sem dado. É a resposta do modelo, não uma relação física
              medida.
            </>,
            <>
              Each curve covers only the temperature range observed in the region&apos;s training; outside it, the cell has no data. It is the model&apos;s response, not a measured physical
              relationship.
            </>,
          )}
        </p>
        <TabelaInterativa
          titulo={tx("Tabela equivalente: resposta à temperatura", "Equivalent table: response to temperature")}
          colunas={colunasTemperatura(idioma)}
          linhas={temperatura}
          chaveLinha="id"
          colunaRotulo="t"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-resposta-temperatura"
          chaveUrl="tmp"
        />
      </SecaoDoPainel>

      <SecaoDoPainel nivel="analisar" titulo={tx("Quão bem o modelo reproduz dias que não viu", "How well the model reproduces days it did not see")}>
        <TabelaInterativa
          titulo={tx("Erro fora da amostra por região (modelo principal)", "Out-of-sample error by region (main model)")}
          colunas={colunasRegioes(idioma)}
          linhas={metricasRegioes}
          chaveLinha="id"
          colunaRotulo="regiao"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-decomposicao-metricas"
          chaveUrl="met"
          selecionado={sm}
          onSelecionar={(id) => id && definir({ sm: id as Regiao })}
          nota={tx(
            "Cobertura abaixo da nominal (80% e 95%) indica intervalos mais estreitos que a incerteza real.",
            "Coverage below nominal (80% and 95%) indicates intervals narrower than the real uncertainty.",
          )}
        />
        <GraficoBarras
          titulo={tx("SIN: erro absoluto médio de cada mês previsto (origem mensal)", "SIN: mean absolute error of each predicted month (monthly origin)")}
          dados={origens}
          chaveCategoria="id"
          chaveRotulo="mes"
          series={[{ id: "mape_pct", rotulo: tx("Erro absoluto médio do mês", "Mean absolute error of the month"), cor: "var(--cor-energia)" }]} // i18n: dado
          unidade="%"
          casas={2}
          referencias={[{ valor: p.metricas.SIN.mape_pct, rotulo: tx("Erro médio em todos os dias", "Average error over all days") }]}
        />
        <TabelaInterativa
          titulo={tx("Tabela equivalente: erro por origem (SIN)", "Equivalent table: error by origin (SIN)")}
          colunas={colunasOrigens(idioma)}
          linhas={origens}
          chaveLinha="id"
          colunaRotulo="origem"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-decomposicao-origens-sin"
          chaveUrl="ori"
        />
      </SecaoDoPainel>
    </div>
  );
}
