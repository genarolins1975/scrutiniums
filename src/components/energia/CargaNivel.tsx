"use client";

import { useMemo, type ReactNode } from "react";
import { CargaBase, CargaEscolha, CargaLista } from "@/components/energia/CargaControles";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COR_REGIAO,
  CURTO_REGIAO,
  DO_REGIAO,
  JANELAS,
  NOME_REGIAO,
  REGIOES,
  SUBSISTEMAS,
  TIPOS_COMPARACAO,
  baseCurta,
  colunasAcumulado,
  colunasAnual,
  colunasComparacao,
  colunasMensal,
  curtoRegiao,
  doRegiao,
  explicacaoBase,
  linhaDaJanela,
  linhasAcumulado,
  linhasAnual,
  linhasComparacao,
  linhasMensal,
  listaTexto,
  marcosRegimes,
  nomeRegiao,
  paraTabela,
  respostaAcumulado,
  respostaNivel,
  rotuloJanela,
  rotuloTipo,
  serieComReferencia,
  textoCalendarioJanela,
  textoEventosJanela,
  textoJanelasIguais,
  textoMesCorrente,
  textoOutraBase,
  vereditoNivel,
  type SerieColunar,
  type TipoComparacao,
} from "@/lib/energia/carga";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { formatos } from "@/lib/energia/formato";
import { porIdioma } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { JanelaId, P025, Regime } from "@/lib/energia/tipos-carga";

/**
 * P025, nível e crescimento: região, janela e base da comparação ficam na URL
 * (?sm=, ?jan=, ?cmp=), assim como o intervalo do gráfico diário (?de=, ?ate=) e as
 * regiões comparadas mês a mês (?sms=); busca, filtros, ordem e página de cada
 * tabela também (prefixos jan.t, mes.t, acum e ano.t). A faixa de métricas da abertura
 * (CargaMetricas), a resposta, os pontos pareados, a série diária, o calendário, a tabela
 * equivalente e a exportação leem as mesmas linhas (linhasComparacao) e as mesmas três
 * escolhas: trocar a base de "mesmos dias da semana" para "mesmas datas" muda todos eles
 * ao mesmo tempo. O padrão (SIN, 7 dias, mesmos dias da semana) não é gravado na URL.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(REGIOES), "SIN"),
  jan: campo(tiposUrl.opcao(JANELAS), "7d"),
  cmp: campo(tiposUrl.opcao(TIPOS_COMPARACAO), "equivalente"),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(REGIOES), { max: LIMITE_COMPARACAO }), [...SUBSISTEMAS]),
};

/** Dias que o gráfico diário mostra quando o recorte não está na URL. */
const JANELA_PADRAO_DIARIA = 90;

const opcoesRegiao = (idioma: Idioma) =>
  REGIOES.map((sm) => ({ id: sm, rotulo: sm === "SE" ? curtoRegiao("SE", idioma) : nomeRegiao(sm, idioma), detalhe: nomeRegiao(sm, idioma) }));
const opcoesBase = (idioma: Idioma) =>
  TIPOS_COMPARACAO.map((t) => ({
    id: t,
    rotulo: t === "equivalente" ? porIdioma(idioma, { pt: "Mesmos dias da semana", en: "Same days of the week" }) : porIdioma(idioma, { pt: "Mesmas datas", en: "Same dates" }),
    resumo:
      t === "equivalente"
        ? porIdioma(idioma, { pt: "52 semanas antes (364 dias)", en: "52 weeks earlier (364 days)" })
        : porIdioma(idioma, { pt: "mesma data do ano anterior", en: "same date of the previous year" }),
    explicacao: explicacaoBase(t, idioma),
  }));

/**
 * Faixa de métricas da abertura: a carga média da janela escolhida, a média da janela de comparação e a variação, com a base da
 * comparação à mão. Lê da URL a mesma região, janela e base que o painel (por isso é cliente) e as linhas de linhasComparacao, as
 * mesmas do gráfico e da tabela: nenhum número é calculado aqui. A frase sob a faixa diz o que a outra base daria para a mesma
 * janela, para a página nunca abrir com duas taxas sem dizer que as bases são diferentes.
 */
export function CargaMetricas({
  comparacoes,
  evidencias,
}: {
  comparacoes: P025["comparacoes"];
  /** Fichas "Comprove este número" da variação do SIN em 7 dias, uma por base (a ficha só existe para esse recorte). */
  evidencias: { equivalente: Evidencia | null; mesmasDatas: Evidencia | null };
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Regiao;
  const tipo = v.cmp as TipoComparacao;
  const janela = v.jan as JanelaId;
  const j = comparacoes.janelas.find((x) => x.id === janela) ?? comparacoes.janelas[0];
  const l = linhaDaJanela({ comparacoes }, sm, j?.id ?? janela, tipo, idioma);
  const ficha = sm === "SIN" && j?.id === "7d" ? (tipo === "equivalente" ? evidencias.equivalente : evidencias.mesmasDatas) : null;
  const nomeJanela = j ? rotuloJanela(j.rotulo, idioma) : tx("janela", "window");
  const periodoAtual = l ? tx(`${f.dataBR(l.inicio)} a ${f.dataBR(l.fim)}`, `${f.dataBR(l.inicio)} to ${f.dataBR(l.fim)}`) : undefined;
  const periodoComparacao = l?.inicio_ant && l.fim_ant ? tx(`${f.dataBR(l.inicio_ant)} a ${f.dataBR(l.fim_ant)}`, `${f.dataBR(l.inicio_ant)} to ${f.dataBR(l.fim_ant)}`) : undefined;
  const semComparacao = tx(
    "Sem comparação: falta dia aceito pela validação física numa das janelas, e a média não é calculada com dia ausente.",
    "No comparison: a day accepted by physical validation is missing in one of the windows, and the average is not calculated with a missing day.",
  );
  const mw = tx("MWmed", "MWavg");

  return (
    <FaixaMetricas
      colunas={4}
      rotulo={tx("Carga média, janela de comparação e variação", "Average load, comparison window and change")}
      nota={j ? textoOutraBase({ comparacoes }, sm, j.id, tipo, idioma) : undefined}
    >
      <Numero
        variante="faixa"
        rotulo={tx(`Carga média ${DO_REGIAO[sm]}, ${nomeJanela}`, `Average load ${doRegiao(sm, "en")}, ${nomeJanela}`)}
        natureza="CALCULADO"
        valor={l?.media ?? null}
        formato="num"
        casas={0}
        unidade={mw}
        periodo={periodoAtual}
        cor={COR_REGIAO[sm]}
        motivoAusencia={semComparacao}
      />
      <Numero
        variante="faixa"
        rotulo={
          tipo === "equivalente"
            ? tx("Mesmos dias da semana, 52 semanas antes", "Same days of the week, 52 weeks earlier")
            : tx("Mesmas datas do ano anterior", "Same dates of the previous year")
        }
        natureza="CALCULADO"
        valor={l?.media_ant ?? null}
        formato="num"
        casas={0}
        unidade={mw}
        periodo={periodoComparacao}
        cor="var(--serie-referencia)"
        motivoAusencia={semComparacao}
      />
      <Numero
        variante="faixa"
        rotulo={tx("Variação da carga média sobre a janela de comparação", "Change in average load over the comparison window")}
        natureza="CALCULADO"
        valor={l?.variacao_pct ?? null}
        formato="variacao_pct"
        casas={2}
        periodo={baseCurta(tipo, idioma)}
        evidencia={ficha}
        // a ficha de prova mostra o valor com uma casa; o cartão, com duas: dito aqui para os dois não parecerem divergir
        nota={ficha ? tx(`Na ficha de prova: ${ficha.valor_exibido}, com uma casa.`, `In the evidence card: ${ficha.valor_exibido}, with one decimal place.`) : undefined}

        endereco={ficha ? (tipo === "equivalente" ? "/setor-eletrico/carga#p025" : "/setor-eletrico/carga#a07") : undefined}
        motivoAusencia={
          l?.media === null || l === null
            ? semComparacao
            : tx(
                "A comparação está em outro regime metodológico do ONS, e por isso a diferença não é publicada como variação.",
                "The comparison is in another ONS methodological regime, so the difference is not published as a change.",
              )
        }
      />
      <CargaBase legenda={tx("Comparar com", "Compare with")} opcoes={opcoesBase(idioma)} valor={tipo} onEscolher={(x) => definir({ cmp: x })} />
    </FaixaMetricas>
  );
}

export function CargaNivel({
  p025,
  serie,
  regimes,
  fonte,
  versao,
  notas,
  aposPrincipal,
  historia,
}: {
  p025: Pick<P025, "comparacoes" | "mensal" | "anual" | "acumulado_ano">;
  /** Série diária dos últimos três anos (carga.json), já validada no pipeline, em colunas. */
  serie: SerieColunar;
  regimes: (Regime & { observado_nos_dados?: string })[];
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Conteúdo depois da figura principal e das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
  /** Seção da série longa, com as mudanças de regime marcadas (montada no servidor), antes da comparação mês a mês. */
  historia?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const mw = tx("MWmed", "MWavg");
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const p = p025;
  const sm = v.sm as Regiao;
  const tipo = v.cmp as TipoComparacao;
  const janela = v.jan as JanelaId;
  const j = p.comparacoes.janelas.find((x) => x.id === janela) ?? p.comparacoes.janelas[0];
  const linhas = useMemo(() => linhasComparacao(p, sm, tipo, idioma), [p, sm, tipo, idioma]);
  const itens = linhas.map((l) => ({
    id: l.janela,
    rotulo: l.rotulo,
    valor: l.media,
    referencia: l.media_ant,
    detalhe:
      l.variacao_pct === null
        ? l.media === null
          ? tx("sem comparação: falta dia numa das janelas", "no comparison: a day is missing in one of the windows")
          : tx("sem variação: janelas em regimes diferentes do ONS", "no change: windows in different ONS regimes")
        : tx(
            `variação ${f.sinal(l.variacao_pct, 2)}%; ${f.dataBR(l.inicio)} a ${f.dataBR(l.fim)} contra ${f.dataBR(l.inicio_ant)} a ${f.dataBR(l.fim_ant)}`,
            `change ${f.sinal(l.variacao_pct, 2)}%; ${f.dataBR(l.inicio)} to ${f.dataBR(l.fim)} against ${f.dataBR(l.inicio_ant)} to ${f.dataBR(l.fim_ant)}`,
          ),
  }));
  const diaria = useMemo(() => serieComReferencia(serie, sm), [serie, sm]);
  const inicioSerie = serie.d[0] ?? "";
  const fimSerie = serie.d[serie.d.length - 1] ?? "";
  // sem recorte na URL, o gráfico diário abre nos últimos 90 dias: com os 1.096 dias a oscilação semanal domina e a janela de 7 dias não
  // aparece. "Restaurar intervalo" grava a série inteira (início e fim explícitos), porque a série inteira não é mais o padrão.
  const nSerie = serie.d.length;
  const padrao = nSerie > JANELA_PADRAO_DIARIA ? { inicio: serie.d[nSerie - JANELA_PADRAO_DIARIA], fim: serie.d[nSerie - 1] } : null;
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : padrao;
  const marcosDiarios = [
    ...marcosRegimes(regimes, inicioSerie, fimSerie, "dia", idioma), // i18n: dado
    ...(j && j.inicio >= inicioSerie
      ? [{ x: j.inicio, rotulo: tx(`início da janela de ${j.rotulo}`, `start of the window of the ${rotuloJanela(j.rotulo, "en")}`) }]
      : []),
  ];
  const mensal = useMemo(() => linhasMensal(p, idioma), [p, idioma]);
  const anual = useMemo(() => linhasAnual(p, idioma), [p, idioma]);
  // as mesmas linhas planas no gráfico de barras e na tabela equivalente
  const anualTabela = useMemo(() => paraTabela(anual, idioma), [anual, idioma]);
  const anosMisturados = anual.filter((a) => a.regimes.includes(tx(" e ", " and "))).map((a) => a.ano);
  const escolhidas = (v.sms as Regiao[]).length ? (v.sms as Regiao[]) : [];
  const janelasIguais = textoJanelasIguais(p.comparacoes.janelas, idioma);
  const refChave = tipo === "equivalente" ? "ref364" : "refDatas";
  const de = doRegiao(sm, idioma);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p025" vivo veredito={vereditoNivel(p, sm, janela, tipo, idioma)}>
          {respostaNivel(p, sm, janela, tipo, idioma)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CargaEscolha legenda={tx("Região", "Region")} opcoes={opcoesRegiao(idioma)} valor={sm} onEscolher={(x) => definir({ sm: x })} />
          <CargaLista
            rotulo={tx("Janela", "Window")}
            opcoes={p.comparacoes.janelas.map((x) => ({
              id: x.id,
              rotulo: tx(`${x.rotulo} (${f.dataBR(x.inicio)} a ${f.dataBR(x.fim)})`, `${rotuloJanela(x.rotulo, "en")} (${f.dataBR(x.inicio)} to ${f.dataBR(x.fim)})`),
            }))}
            valor={janela}
            onEscolher={(x) => definir({ jan: x })}
          />
        </div>
      </div>

      <GraficoPontos
        titulo={tx(
          `Carga média ${DO_REGIAO[sm]} em cada janela e na janela de comparação (${baseCurta(tipo, "pt")})`,
          `Average load ${doRegiao(sm, "en")} in each window and in the comparison window (${baseCurta(tipo, "en")})`,
        )}
        itens={itens}
        unidade={mw}
        casas={0}
        rotuloValor={tx("Média da janela", "Window average")}
        rotuloReferencia={
          tipo === "equivalente"
            ? tx("Mesmos dias da semana, 52 semanas antes", "Same days of the week, 52 weeks earlier")
            : tx("Mesmas datas do ano anterior", "Same dates of the previous year")
        }
        corValor={COR_REGIAO[sm]}
        corReferencia="var(--serie-referencia)"
        selecionado={janela}
        onSelecionar={(id) => id && definir({ jan: id as JanelaId })}
      />
      {j && (
        <div data-calendario-janelas="" className="max-w-prose2 space-y-1 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao-muted">
          <p className="rotulo text-mineral">{tx("Calendário das duas janelas", "Calendar of the two windows")}</p>
          <p>
            {textoCalendarioJanela(j, tipo, idioma)} {textoEventosJanela(j, tipo, idioma)}
          </p>
          {janelasIguais && <p>{janelasIguais}</p>}
        </div>
      )}

      <GraficoLinhas
        titulo={tx(
          `Carga diária ${DO_REGIAO[sm]} e ${tipo === "equivalente" ? "o mesmo dia da semana 52 semanas antes" : "a mesma data do ano anterior"}`,
          `Daily load ${doRegiao(sm, "en")} and ${tipo === "equivalente" ? "the same day of the week 52 weeks earlier" : "the same date of the previous year"}`,
        )}
        dados={diaria}
        chaveX="d"
        series={[
          { id: "atual", rotulo: nomeRegiao(sm, idioma), sigla: curtoRegiao(sm, idioma), cor: COR_REGIAO[sm] },
          tipo === "equivalente"
            ? {
                id: refChave,
                rotulo: tx("Mesmo dia da semana, 364 dias antes", "Same day of the week, 364 days earlier"),
                sigla: tx("364 dias antes", "364 days earlier"),
                cor: "var(--serie-referencia)",
                tracejada: true,
              }
            : {
                id: refChave,
                rotulo: tx("Mesma data do ano anterior", "Same date of the previous year"),
                sigla: tx("ano anterior", "previous year"),
                cor: "var(--serie-referencia)",
                tracejada: true,
              },
        ]}
        unidade={mw}
        casas={0}
        marcos={marcosDiarios}
        zoom
        intervalo={intervalo}
        onIntervalo={(i) => definir({ de: i?.inicio ?? inicioSerie, ate: i?.fim ?? fimSerie })}
        legendaInterativa
      />

      <dl className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3" data-recorte-painel="">
        <div>
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {j ? tx(`${f.dataBR(j.inicio)} a ${f.dataBR(j.fim)}`, `${f.dataBR(j.inicio)} to ${f.dataBR(j.fim)}`) : tx("sem janela", "no window")}
            {tx("; comparação: ", "; comparison: ")}
            {rotuloTipo(tipo, idioma)}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {sm === "SIN" ? tx("SIN, soma dos quatro subsistemas no dia", "SIN, sum of the four subsystems on the day") : tx(`Subsistema ${NOME_REGIAO[sm]}`, `${nomeRegiao(sm, "en")} subsystem`)}
            {tx("; dias aceitos pela validação física", "; days accepted by physical validation")}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {tx(
              "MWmed, a potência média do dia (1 MWmed durante um dia equivale a 24 MWh); variação em %",
              "MWavg (average megawatts), the average power over the day (1 MWavg over a day equals 24 MWh); change in %",
            )}
          </dd>
        </div>
      </dl>

      <TabelaInterativa
        titulo={tx(`Tabela equivalente: janelas de ${NOME_REGIAO[sm]}, ${rotuloTipo(tipo, "pt")}`, `Equivalent table: windows for the ${nomeRegiao(sm, "en")}, ${rotuloTipo(tipo, "en")}`)}
        colunas={colunasComparacao(idioma)}
        linhas={paraTabela(linhas.map((l) => ({ ...l, id: l.janela })), idioma)}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`carga-comparacoes-${sm}-${tipo}`}
        chaveUrl="jan.t"
        selecionado={janela}
        onSelecionar={(id) => id && definir({ jan: id as JanelaId })}
        nota={tx(
          "Variação nula: janela incompleta ou em outro regime do ONS. A média nunca é calculada com dia ausente.",
          "No change: incomplete window or in another ONS regime. The average is never calculated with a missing day.",
        )}
      />

      {notas}

      {aposPrincipal}

      {historia}

      <SecaoDoPainel
        id="mensal"
        titulo={tx("Como cada mês se compara com o mesmo mês do ano anterior?", "How does each month compare with the same month of the previous year?")}
        lead={tx(
          "Mês contra mês, sem ajuste de calendário: os meses comparados podem ter números diferentes de dias úteis, que estão na tabela.",
          "Month against month, without calendar adjustment: the months compared may have different numbers of working days, which are in the table.",
        )}
      >
        <Comparador
          rotulo={tx(`Regiões no gráfico (até ${LIMITE_COMPARACAO})`, `Regions in the chart (up to ${LIMITE_COMPARACAO})`)}
          entidades={REGIOES.map((r) => ({
            id: r,
            rotulo: nomeRegiao(r, idioma),
            sinonimos: idioma === "en" ? [curtoRegiao(r, "en"), NOME_REGIAO[r], CURTO_REGIAO[r]] : [CURTO_REGIAO[r]],
          }))}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ sms: ids as Regiao[] })}
          dicaBusca={tx("Buscar, por exemplo SIN, Sul, Nordeste", "Search, for example SIN, South, Northeast")}
          vazio={tx("Nenhuma região escolhida. Escolha até quatro para ver a variação mensal na mesma escala.", "No region chosen. Choose up to four to see the monthly change on the same scale.")}
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <GraficoLinhas
            titulo={tx("Variação da carga média mensal contra o mesmo mês do ano anterior", "Change in average monthly load against the same month of the previous year")}
            dados={mensal}
            chaveX="m"
            formatoX="mes"
            series={escolhidas.map((r) => ({ id: `var_${r}`, rotulo: nomeRegiao(r, idioma), sigla: curtoRegiao(r, idioma), cor: COR_REGIAO[r] }))}
            unidade="%"
            casas={2}
            zeroNoEixo
          />
        )}
        <p className="text-sm text-carvao-muted">
          {tx("A variação mensal não é ajustada por calendário. ", "The monthly change is not adjusted for calendar. ")}
          {textoMesCorrente(p.mensal, p.comparacoes.janelas, idioma)}
        </p>
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: carga média mensal e variação, últimos ${f.num(mensal.length, 0)} meses`, `Equivalent table: average monthly load and change, last ${f.num(mensal.length, 0)} months`)}
          colunas={colunasMensal(idioma)}
          linhas={paraTabela(mensal, idioma)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-mensal"
          chaveUrl="mes.t"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="anual"
        titulo={tx("E no ano, a carga média muda?", "And over the year, does the average load change?")}
        lead={tx(
          "Média de cada ano e acumulado do ano até o último dia publicado, contra o mesmo período 52 semanas antes (mesmos dias da semana).",
          "Average of each year and the year to date up to the last published day, against the same period 52 weeks earlier (same days of the week).",
        )}
      >
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p025-acumulado" data-resposta-depois="">
          {respostaAcumulado(p.acumulado_ano, sm, idioma)}
        </p>
        <GraficoBarras
          titulo={tx(`Carga média anual ${DO_REGIAO[sm]}`, `Average annual load ${doRegiao(sm, "en")}`)}
          dados={anualTabela}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[{ id: sm, rotulo: nomeRegiao(sm, idioma), cor: COR_REGIAO[sm] }]}
          unidade={mw}
          casas={0}
        />
        <p className="text-sm text-carvao-muted">
          {tx(
            <>
              Ano com menos dias que o calendário aparece com a contagem no rótulo. A variação anual só existe entre anos completos no mesmo regime do ONS
              {anosMisturados.length ? `; ${listaTexto(anosMisturados, "pt")} misturam regimes e não entram em variação` : ""}. Níveis de regimes diferentes não medem crescimento.
            </>,
            <>
              A year with fewer days than the calendar appears with the count in its label. The annual change only exists between complete years in the same ONS regime
              {anosMisturados.length ? `; ${listaTexto(anosMisturados, "en")} mix regimes and do not enter the change` : ""}. Levels from different regimes do not measure growth.
            </>,
          )}
        </p>
        <TabelaInterativa
          titulo={tx("Acumulado do ano por região", "Year to date by region")}
          colunas={colunasAcumulado(idioma)}
          linhas={paraTabela(linhasAcumulado(p.acumulado_ano, idioma), idioma)}
          chaveLinha="id"
          colunaRotulo="regiao"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-acumulado-ano"
          chaveUrl="acum"
          selecionado={sm}
          onSelecionar={(id) => id && definir({ sm: id as Regiao })}
        />
        <TabelaInterativa
          titulo={tx("Tabela equivalente: carga média anual por região", "Equivalent table: average annual load by region")}
          colunas={colunasAnual(idioma)}
          linhas={anualTabela}
          chaveLinha="id"
          colunaRotulo="ano" // i18n: dado
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-anual"
          chaveUrl="ano.t" // i18n: dado
          ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
        />
        <p className="text-xs text-carvao-muted">
          {tx(
            `Médias de ${f.num(anual.length, 0)} anos; a tabela traz as cinco regiões, o gráfico a região escolhida.`,
            `Averages for ${f.num(anual.length, 0)} years; the table shows the five regions, the chart the chosen region.`,
          )}
        </p>
      </SecaoDoPainel>
    </div>
  );
}
