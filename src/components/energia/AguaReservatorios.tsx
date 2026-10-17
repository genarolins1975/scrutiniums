"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaLegenda, comNomes, TextoUnidadeMwmes } from "@/components/energia/AguaLegenda";
import { AguaRestaurar } from "@/components/energia/AguaRestaurar";
import { AguaTabela } from "@/components/energia/AguaTabela";
import { Comparador } from "@/components/energia/Comparador";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Nome } from "@/components/i18n/Nome";
import {
  COR_REGIAO,
  SUBSISTEMAS,
  barrasBalancoDefluencia,
  barrasBalancoResiduo,
  barrasBalancoTotais,
  barrasDecomposicaoComRestante,
  colunasDecomposicao,
  colunasReservatorios,
  doRegiao,
  linhasDecomposicao,
  linhasMultiplosVolume,
  linhasReservatorios,
  motivoSemBalanco,
  nomeProprio,
  nomesProprios,
  nomeRegiao,
  notaVazoesCoincidem,
  reservatorioDaParcela,
  reservatorioPadrao,
  reservatoriosPadraoComparacao,
  respostaBalanco,
  respostaDecomposicao,
  restanteDecomposicao,
  revisoesCapturaUnica,
  rotuloConvencao,
  serieReservatorio,
  textoHidraulicosProvisorios,
  textoOutraJanelaDaEar,
  textoParcelasFaltantes,
  textoPartesDaEar,
  textoVolumeForaDaFaixa,
  vereditoBalancoReservatorio,
  vereditoDecomposicao,
  volumeForaDaFaixa,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { formatos } from "@/lib/energia/formato";
import { porIdioma } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { EntidadeEar } from "@/lib/energia/agua";
import type { AguaDecomposicaoEar, AguaReservatorio, AguaReservatorios45d } from "@/lib/energia/tipos-agua";

/**
 * P020, reservatórios e balanço: subsistema da decomposição (?sm=), reservatório
 * escolhido (?res=) e reservatórios comparados (?cmp=, até quatro) ficam na URL. A
 * barra de uma parcela da decomposição, a linha da tabela e a lista escolhem o mesmo
 * reservatório, ligado pelo código da usina (nunca pelo nome). A resposta, as barras
 * e as tabelas usam as mesmas linhas da gold. As séries diárias (45 dias na publicação
 * atual; o número exibido vem da gold) vêm de agua_reservatorios_45d.json, buscado só
 * quando a seção chega perto da tela.
 *
 * Composição (redesenho): a figura principal (variação da EAR do subsistema por reservatório,
 * com uma barra para a soma dos demais) vem logo depois da resposta e do controle de
 * subsistema, com o recorte como legenda; abaixo dela, a soma das parcelas do gráfico e a dos
 * demais ao lado da variação do subsistema; as notas do painel vêm junto da figura. A conta da
 * água do reservatório escolhido (com a lista de reservatórios ao lado do que ela controla), a
 * qualidade do balanço e a série diária são seções visíveis com pergunta própria; a comparação
 * de até quatro reservatórios fica em Analisar. Os números de cada faixa acompanham a escolha.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBSISTEMAS), "SE"),
  res: campo(tiposUrl.texto({ max: 20 }), ""),
};

/** A comparação abre com os quatro reservatórios de maior volume útil (o padrão vem dos dados); o leitor troca ou esvazia à vontade. */
const esquemaCom = (padraoCmp: string[]) => ({ ...ESQUEMA, cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 20 }), { max: LIMITE_COMPARACAO }), padraoCmp) });

type Series = { estado: "espera" | "carregando" | "pronto" | "erro"; dados: AguaReservatorios45d | null; erro: string };

/**
 * Séries cujo rótulo português fica escrito por extenso no código (os testes do módulo conferem o texto): a forma inglesa vem desta
 * tabela, aplicada na hora do render. Rótulo sem entrada fica como está.
 */
const SERIES_EN: Record<string, string> = {
  "Soma dos demais reservatórios, por diferença (não é um reservatório)": "Sum of the other reservoirs, by difference (not a reservoir)",
  "Defluente (linha grossa)": "Outflow (thick line)",
  "Turbinada (tracejada, por cima)": "Turbined (dashed, on top)",
};
const traduzSeries = <S extends { rotulo: string }>(series: S[], idioma: Idioma): S[] =>
  idioma === "en" ? series.map((s) => ({ ...s, rotulo: SERIES_EN[s.rotulo] ?? s.rotulo })) : series;

/**
 * A variação da EAR do subsistema escolhido, parcela por parcela: a variação, a soma das parcelas do gráfico e a soma dos demais reservatórios
 * (por diferença, porque a gold não publica a variação de cada um dos demais). A outra janela de 30 dias do mesmo subsistema (a da página de
 * armazenamento, quando termina em outro dia) é dita uma vez, no parágrafo sob o bloco, e não também no cartão e na frase. Com todas as
 * parcelas no gráfico, uma frase diz isso.
 */
export function MedidasDecomposicao({ dec }: { dec: AguaDecomposicaoEar }) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const uMw = tx("MWmês", "MWmonth");
  const restante = restanteDecomposicao(dec);
  const periodo = tx(`${f.dataBR(dec.inicio)} a ${f.dataBR(dec.fim)}`, `${f.dataBR(dec.inicio)} to ${f.dataBR(dec.fim)}`);
  const de = doRegiao(dec.sm, idioma);
  if (!restante) {
    return (
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="parcelas-completas">
        {tx(
          `Todas as ${dec.n_reservatorios} parcelas estão no gráfico e somam a variação da EAR do subsistema.`,
          `All ${dec.n_reservatorios} parts are in the chart and add up to the change in the subsystem's EAR.`,
        )}
      </p>
    );
  }
  return (
    <div data-medidas-recorte="" className="space-y-2">
      <p className="rotulo text-mineral">{tx(`Variação da EAR ${de}, parcela por parcela`, `Change in EAR ${de}, part by part`)}</p>
      <FaixaMetricas
        colunas={3}
        rotulo={tx(`Variação da EAR ${de} e a soma das parcelas`, `Change in EAR ${de} and the sum of the parts`)}
        nota={<p className="text-sm">{textoParcelasFaltantes(dec, idioma)}</p>}
      >
        <Numero
          variante="faixa"
          rotulo={tx("Variação da EAR do subsistema", "Change in the subsystem's EAR")}
          natureza="CALCULADO"
          valor={dec.delta_ear_mwmes}
          formato="num"
          casas={1}
          unidade={uMw}
          periodo={periodo}
          cor={COR_REGIAO[dec.sm]}
          motivoAusencia={tx("Sem variação da EAR nesta publicação.", "No change in EAR in this release.")}
        />
        <Numero
          variante="faixa"
          rotulo={tx(`Soma das ${restante.nListadas} parcelas do gráfico`, `Sum of the ${restante.nListadas} parts in the chart`)}
          natureza="CALCULADO"
          valor={restante.somaListadas}
          formato="num"
          casas={1}
          unidade={uMw}
          periodo={periodo}
          nota={tx("As maiores quedas e altas publicadas.", "The largest published falls and rises.")}
        />
        <Numero
          variante="faixa"
          rotulo={tx(`Soma dos demais ${f.plural(restante.nRestantes, "reservatório", "reservatórios")}`, `Sum of the other ${f.plural(restante.nRestantes, "reservoir", "reservoirs")}`)}
          natureza="CALCULADO"
          valor={restante.somaRestantes}
          formato="num"
          casas={1}
          unidade={uMw}
          periodo={periodo}
          nota={tx("Por diferença; as variações de cada um não estão publicadas.", "By difference; the change of each one is not published.")}
        />
      </FaixaMetricas>
    </div>
  );
}

/**
 * A conta da água do reservatório escolhido em quatro números (variação do volume, afluência, defluência e resíduo), todos campos do próprio
 * reservatório. Sem balanço, os números ausentes dizem o motivo exato. A ficha de prova do resíduo é a do reservatório de maior volume útil,
 * a única que a gold publica, e diz que ainda não é possível detectar revisões, porque há uma única captura.
 */
export function MedidasBalanco({
  res,
  periodo,
  semCadastro,
  ehPadrao,
  evidenciaResiduo,
  endereco,
}: {
  res: AguaReservatorio;
  periodo: string;
  semCadastro?: readonly string[];
  ehPadrao: boolean;
  evidenciaResiduo?: Evidencia | null;
  endereco?: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const nomeRes = nomeProprio(res.nome, idioma);
  const motivo = !res.balanco_calculado ? motivoSemBalanco(res, semCadastro, idioma) : "";
  const textoMotivo = motivo ? `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}.` : undefined;
  return (
    <FaixaMetricas colunas={4} rotulo={tx(`Conta da água de ${nomeRes}`, `Water balance of ${nomeRes}`)} nota={<p className="text-sm">{textoHidraulicosProvisorios(idioma)}</p>}>
      <Numero
        variante="faixa"
        rotulo={tx("Variação observada do volume", "Observed change in volume")}
        natureza="CALCULADO"
        valor={res.dv_obs_hm3}
        formato="num"
        casas={2}
        unidade="hm³"
        periodo={periodo}
        motivoAusencia={textoMotivo}
      />
      <Numero
        variante="faixa"
        rotulo={tx("Afluência", "Inflow")}
        natureza="OBSERVADO"
        valor={res.afluencia_hm3}
        formato="num"
        casas={2}
        unidade="hm³"
        periodo={periodo}
        cor="var(--serie-hidraulica)"
        nota={tx(
          "Derivada pelo ONS, na maioria dos reservatórios a partir do próprio balanço: não é medição direta, e por isso um resíduo perto de zero não confirma a vazão.",
          "Derived by ONS, in most reservoirs from the balance itself: it is not a direct measurement, so a residual close to zero does not confirm the flow.",
        )}
        motivoAusencia={tx("Sem afluência na janela nesta publicação.", "No inflow in the window in this release.")}
      />
      <Numero
        variante="faixa"
        rotulo={tx("Defluência", "Outflow")}
        natureza="OBSERVADO"
        valor={res.defluencia_hm3}
        formato="num"
        casas={2}
        unidade="hm³"
        periodo={periodo}
        cor="var(--cor-carvao)"
        nota={tx(
          "Derivada pelo ONS a partir das vazões turbinada, vertida e das outras estruturas: não é medição direta.",
          "Derived by ONS from the turbined, spilled and other-structure flows: it is not a direct measurement.",
        )}
        motivoAusencia={tx("Sem defluência na janela nesta publicação.", "No outflow in the window in this release.")}
      />
      <Numero
        variante="faixa"
        rotulo={tx("Resíduo do balanço", "Balance residual")}
        natureza="CALCULADO"
        evidencia={ehPadrao ? evidenciaResiduo : undefined}
        revisoes={ehPadrao ? revisoesCapturaUnica(idioma) : undefined}
        valor={res.residuo_hm3}
        formato="num"
        casas={2}
        unidade="hm³"
        periodo={periodo}
        nota={tx<ReactNode>(
          `reservatório ${nomeRes}: variação observada menos afluência mais defluência.`,
          <>
            <Nome>{nomeRes}</Nome> reservoir: observed change minus inflow plus outflow.
          </>,
        )}
        motivoAusencia={textoMotivo}
        endereco={endereco}
      />
    </FaixaMetricas>
  );
}

export function AguaReservatorios({
  lista,
  decomposicao,
  janela,
  armazenamento,
  urlSeries,
  diasSeries,
  fonte,
  versao,
  notas,
  qualidade,
  semCadastro,
  evidenciaResiduo,
  enderecoBalanco,
}: {
  lista: AguaReservatorio[];
  decomposicao: AguaDecomposicaoEar[];
  janela: { inicio: string; fim: string; periodo_fecham_por_construcao: { inicio: string; fim: string } | null };
  /** Variação de 30 dias de cada subsistema na página de armazenamento (para dizer por que o número difere da decomposição). */
  armazenamento: Pick<EntidadeEar, "id" | "tipo" | "dia" | "variacao_30d_mwmes">[];
  urlSeries: string;
  /** Dias de cada série diária do arquivo sob demanda (gold: reservatorios.series_45d.dias). */
  diasSeries: number;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou, como interpretar e o que não é possível concluir), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Seção da qualidade do balanço (fechamento por construção), que vem logo depois da conta da água. */
  qualidade?: ReactNode;
  /** Identificadores dos reservatórios sem correspondência no cadastro do ONS (gold: sem_cadastro): o motivo exato de não terem balanço. */
  semCadastro?: string[];
  /** Ficha de prova do resíduo do reservatório de maior volume útil: aparece só quando é ele o reservatório escolhido. */
  evidenciaResiduo?: Evidencia | null;
  /** Página e âncora dos números da conta da água, repassadas à citação da ficha. */
  enderecoBalanco?: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const uMw = tx("MWmês", "MWmonth");
  const padraoCmp = useMemo(() => reservatoriosPadraoComparacao(lista), [lista]);
  const esquema = useMemo(() => esquemaCom(padraoCmp), [padraoCmp]);
  const [v, definir] = useEstadoUrl(esquema);
  const sm = v.sm as Submercado;
  const dec = decomposicao.find((d) => d.sm === sm) ?? decomposicao[0] ?? null;
  const padrao = useMemo(() => reservatorioPadrao(lista), [lista]);
  const res = lista.find((r) => r.id === v.res) ?? lista.find((r) => r.id === padrao) ?? null;
  const barrasDec = useMemo(() => (dec ? barrasDecomposicaoComRestante(dec, idioma) : []), [dec, idioma]);
  const barraSel = res ? (barrasDec.find((b) => b.cod === res.cod)?.id ?? null) : null;
  const linhasDec = useMemo(() => (dec ? linhasDecomposicao(dec, idioma) : []), [dec, idioma]);
  const linhasRes = useMemo(() => linhasReservatorios(lista, semCadastro, idioma), [lista, semCadastro, idioma]);
  const selecionar = (id: string | null) => id && definir({ res: id === padrao ? "" : id });
  const selecionarParcela = (id: string | null) => {
    const b = barrasDec.find((x) => x.id === id);
    const r = b && b.cod ? reservatorioDaParcela(lista, b.cod) : null;
    if (r) selecionar(r.id);
  };
  const escolhidos = (v.cmp as string[]).filter((id) => lista.some((r) => r.id === id));
  const outraJanela = textoOutraJanelaDaEar(dec, armazenamento, idioma);
  // nomes próprios dos reservatórios, para marcar em <Nome> nas frases montadas em agua.ts (página inglesa)
  const nomesRes = useMemo(
    () => nomesProprios(lista.map((r) => r.nome), decomposicao.flatMap((d) => [...d.maiores_quedas, ...d.maiores_altas].map((x) => x.nome ?? x.cod))),
    [lista, decomposicao],
  );
  const foraDaFaixa = res ? volumeForaDaFaixa(res.vol_util_pct_fim) : null;
  const opcoesRes = useMemo(
    () =>
      [...lista]
        .sort((a, b) => {
          const ia = SUBSISTEMAS.indexOf((a.subsistema ?? "") as Submercado);
          const ib = SUBSISTEMAS.indexOf((b.subsistema ?? "") as Submercado);
          return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || nomeProprio(a.nome).localeCompare(nomeProprio(b.nome), "pt-BR");
        })
        .map((r) => ({
          id: r.id,
          rotulo: `${nomeProprio(r.nome, idioma)}${r.balanco_calculado ? "" : porIdioma(idioma, { pt: " (sem balanço)", en: " (no balance)" })}`,
          nome: true,
          grupo: r.subsistema && (SUBSISTEMAS as readonly string[]).includes(r.subsistema) ? nomeRegiao(r.subsistema as Submercado, idioma) : undefined,
        })),
    [lista, idioma],
  );

  // séries de 45 dias: buscadas quando a seção chega perto da tela (carregamento progressivo)
  const alvo = useRef<HTMLDivElement>(null);
  const [series, setSeries] = useState<Series>({ estado: "espera", dados: null, erro: "" });
  const [pedir, setPedir] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (pedir) return;
    const el = alvo.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setPedir(true);
      return;
    }
    const obs = new IntersectionObserver((ents) => ents.some((e) => e.isIntersecting) && setPedir(true), { rootMargin: "600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [pedir]);
  useEffect(() => {
    if (!pedir) return;
    let vivo = true;
    setSeries((s) => ({ ...s, estado: "carregando" }));
    fetch(urlSeries)
      .then(async (r) => {
        if (!r.ok) throw new Error(`resposta ${r.status}`); // i18n: dado (mensagem técnica, mostrada entre parênteses)
        const j = (await r.json()) as AguaReservatorios45d;
        if (!Array.isArray(j.reservatorios)) throw new Error("arquivo sem a lista de reservatórios"); // i18n: dado (mensagem técnica)
        if (vivo) setSeries({ estado: "pronto", dados: j, erro: "" });
      })
      .catch((e: unknown) => vivo && setSeries({ estado: "erro", dados: null, erro: e instanceof Error ? e.message : String(e) }));
    return () => {
      vivo = false;
    };
  }, [pedir, urlSeries, tentativa]);

  const serieSel = useMemo(() => serieReservatorio(series.dados?.reservatorios.find((s) => s.id === res?.id)), [series.dados, res]);
  const seriesComp = useMemo(
    () => escolhidos.map((id) => series.dados?.reservatorios.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s),
    [escolhidos, series.dados],
  );
  const multiplos = useMemo(() => linhasMultiplosVolume(seriesComp), [seriesComp]);
  const nomeRes = res ? nomeProprio(res.nome, idioma) : "";
  const dias = f.plural(diasSeries, tx("dia", "day"), tx("dias", "days"));
  const periodoJanela = tx(`${f.dataBR(janela.inicio)} a ${f.dataBR(janela.fim)}`, `${f.dataBR(janela.inicio)} to ${f.dataBR(janela.fim)}`);
  const ehPadrao = !!res && res.id === padrao;
  const coincidem = serieSel.length ? notaVazoesCoincidem(serieSel, idioma) : "";
  const semDec = tx("Sem decomposição da EAR nesta publicação.", "No EAR breakdown in this release.");
  const inicioJanela = tx("início da janela do balanço", "start of the balance window");
  const hmJanela = tx("hm³ na janela", "hm³ in the window");

  const estadoSeries =
    series.estado === "erro" ? (
      <div role="alert" className="space-y-2 border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao">
        <p>
          {tx(
            `Não foi possível carregar as séries diárias (${series.erro}). O balanço de 30 dias acima vem da publicação e continua válido.`,
            `The daily series could not be loaded (${series.erro}). The 30-day balance above comes from the release and remains valid.`,
          )}
        </p>
        <button
          type="button"
          onClick={() => setTentativa((t) => t + 1)}
          className="rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-4 text-energia-dark hover:border-carvao"
        >
          {tx("Tentar de novo", "Try again")}
        </button>
      </div>
    ) : series.estado !== "pronto" ? (
      <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
        {tx(
          `Carregando as séries diárias de ${dias} (arquivo à parte, para não pesar na abertura da página).`,
          `Loading the daily series of ${dias} (a separate file, so as not to weigh on the page opening).`,
        )}
      </p>
    ) : null;

  const de = dec ? doRegiao(dec.sm, idioma) : "";
  const periodoDec = dec ? tx(`${f.dataBR(dec.inicio)} a ${f.dataBR(dec.fim)}`, `${f.dataBR(dec.inicio)} to ${f.dataBR(dec.fim)}`) : "";

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p020" vivo veredito={dec ? vereditoDecomposicao(dec, idioma) : semDec}>
          {dec ? comNomes(respostaDecomposicao(dec, idioma), nomesRes, idioma) : semDec}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <AguaEscolha
            legenda={tx("Subsistema da decomposição", "Subsystem of the breakdown")}
            opcoes={SUBSISTEMAS.map((s) => ({ id: s, rotulo: nomeRegiao(s, idioma) }))}
            valor={sm}
            onEscolher={(x) => definir({ sm: x })}
          />
          <AguaRestaurar />
        </div>
      </div>

      {dec && (
        <>
          <GraficoBarras
            titulo={tx(`Variação da EAR ${de} por reservatório, ${periodoDec}: maiores quedas e maiores altas`, `Change in EAR ${de} by reservoir, ${periodoDec}: largest falls and largest rises`)}
            // a soma dos demais não é um reservatório: vai em série própria (cor diferente e entrada na legenda). Cada categoria tem um só
            // valor, então empilhar não soma nada; é o jeito de dar à barra agregada outra cor na mesma régua
            dados={barrasDec.map((b) => ({ id: b.id, rotulo: b.rotulo, delta: b.parte === "restante" ? null : b.delta, demais: b.parte === "restante" ? b.delta : null }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            rotulosSaoNomes
            series={traduzSeries(
              [
                { id: "delta", rotulo: tx("Variação da EAR no reservatório", "Change in EAR in the reservoir"), cor: COR_REGIAO[dec.sm], opcional: true },
                ...(barrasDec.some((b) => b.parte === "restante")
                  ? // i18n: dado (a forma inglesa vem de SERIES_EN)
                    [{ id: "demais", rotulo: "Soma dos demais reservatórios, por diferença (não é um reservatório)", cor: "var(--serie-referencia)", opcional: true }]
                  : []),
              ],
              idioma,
            )}
            empilhado
            unidade={uMw}
            casas={1}
            orientacao="horizontal"
            selecionado={barraSel}
            onSelecionar={selecionarParcela}
          />
          <AguaLegenda
            periodo={tx(
              `${periodoDec}, o último dia da EAR por reservatório. A EAR dos últimos dias é provisória: o ONS a revisa depois de publicá-la.`,
              `${periodoDec}, the last day of EAR by reservoir. The EAR for the last few days is provisional: ONS revises it after publishing it.`,
            )}
            universo={tx(
              `${dec.n_reservatorios} reservatórios que contam na EAR ${de}. ${textoPartesDaEar(decomposicao, lista, "pt")}`,
              comNomes(`${dec.n_reservatorios} reservoirs that count in the EAR ${de}. ${textoPartesDaEar(decomposicao, lista, "en")}`, nomesRes, "en"),
            )}
            unidade={
              <TextoUnidadeMwmes
                idioma={idioma}
                sufixo={tx("; a EAR e a variação dos reservatórios usam esta unidade", "; the EAR and the change of the reservoirs use this unit")}
              />
            }
          />
          <p className="text-sm text-carvao-muted">
            {tx("Escolher uma barra troca o reservatório da conta da água, mais abaixo (", "Choosing a bar changes the reservoir of the water balance, further down (")}
            <a href="#balanco" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              {tx("ir para a conta da água", "go to the water balance")}
            </a>
            ).
          </p>
          <MedidasDecomposicao dec={dec} />
          {outraJanela && <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">{outraJanela}</p>}
          <AguaTabela
            titulo={tx(`Tabela equivalente: parcelas da variação da EAR ${de}`, `Equivalent table: parts of the change in EAR ${de}`)}
            colunas={colunasDecomposicao(idioma)}
            linhas={linhasDec}
            chaveLinha="id"
            colunaRotulo="rotulo"
            fonte={tx("ONS, EAR Diário por Reservatório", "ONS, daily EAR by reservoir")}
            versao={dec.fim}
            nomeArquivo={`agua-decomposicao-ear-${dec.sm}`}
            selecionado={barraSel}
            onSelecionar={selecionarParcela}
            recolher
            nota={tx(
              `O gráfico mostra as maiores quedas e altas publicadas e a soma dos demais; a soma de todos os ${dec.n_reservatorios} reservatórios e o resíduo estão na resposta completa (modo Analisar) e na tabela dos subsistemas.`,
              `The chart shows the largest published falls and rises and the sum of the others; the sum of all ${dec.n_reservatorios} reservoirs and the residual are in the full answer (Analyze mode) and in the subsystems table.`,
            )}
          />
        </>
      )}

      {notas}

      {res && (
        <SecaoDoPainel
          id="balanco"
          titulo={tx<ReactNode>(
            `Como foi a conta da água em ${nomeRes}?`,
            <>
              How did the water balance of <Nome>{nomeRes}</Nome> turn out?
            </>,
          )}
          lead={tx(
            "A conta de 30 dias, em hm³ (milhões de metros cúbicos): o que entrou (afluência), o que saiu (defluência, pelas turbinas, pelos vertedouros e por outras estruturas) e o resíduo, a diferença que sobra quando a conta não fecha.",
            "The 30-day balance, in hm³ (millions of cubic meters): what came in (inflow), what went out (outflow, through the turbines, the spillways and other structures) and the residual, the difference left over when the balance does not close.",
          )}
        >
          <AguaLista
            rotulo={tx("Reservatório da conta da água", "Reservoir for the water balance")}
            opcoes={opcoesRes}
            valor={res.id}
            onEscolher={(x) => selecionar(x)}
            dica={tx("Troca a conta da água e as séries diárias abaixo, em qualquer subsistema.", "Changes the water balance and the daily series below, in any subsystem.")}
          />
          {/* depois: a resposta fica na ordem do documento, abaixo do título e da lista, e não antes do título da seção */}
          <RespostaCurta id="p020-balanco" vivo depois veredito={vereditoBalancoReservatorio(res, janela, semCadastro, idioma)}>
            {comNomes(respostaBalanco(res, janela, semCadastro, idioma), nomesRes, idioma)}
          </RespostaCurta>
          {foraDaFaixa && (
            <p data-aviso="volume-fora-da-faixa" className="max-w-prose2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao-muted">
              {tx(
                <>
                  O volume no fim da janela é {f.pct(res.vol_util_pct_fim, 2)} do volume útil: valor da fonte, {foraDaFaixa === "acima" ? "acima do volume máximo normal do reservatório" : "abaixo de zero"}. A conta
                  da água o usa como veio.
                </>,
                <>
                  The volume at the end of the window is {f.pct(res.vol_util_pct_fim, 2)} of useful volume: source value,{" "}
                  {foraDaFaixa === "acima" ? "above the reservoir's normal maximum volume" : "below zero"}. The water balance uses it as received.
                </>,
              )}
            </p>
          )}
          {/* o glossário vem antes dos números e dos gráficos que usam os termos */}
          <dl className="grid gap-x-6 gap-y-2 text-sm leading-relaxed text-carvao-muted sm:grid-cols-2" data-termos="balanco">
            <div>
              <dt className="inline font-medium text-carvao">{tx("Afluência: ", "Inflow: ")}</dt>
              <dd className="inline">{tx("a água que entra no reservatório.", "the water that enters the reservoir.")}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-carvao">{tx("Defluência: ", "Outflow: ")}</dt>
              <dd className="inline">
                {tx(
                  "a água que sai, pelas turbinas (turbinado, que gera energia), pelos vertedouros (vertido, que não gera) ou por outras estruturas.",
                  "the water that goes out, through the turbines (turbined, which generates energy), through the spillways (spilled, which does not) or through other structures.",
                )}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-carvao">{tx("Resíduo: ", "Residual: ")}</dt>
              <dd className="inline">
                {tx(
                  "a diferença que sobra quando a conta não fecha: variação observada menos afluência mais defluência.",
                  "the difference left over when the balance does not close: observed change minus inflow plus outflow.",
                )}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-carvao">{tx("Transferência: ", "Transfer: ")}</dt>
              <dd className="inline">{tx("volume que o ONS publica à parte; a convenção do sinal dele não está documentada.", "volume that ONS publishes separately; its sign convention is not documented.")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline font-medium text-carvao">{tx("Defluência com ou sem as outras estruturas: ", "Outflow with or without the other structures: ")}</dt>
              <dd className="inline">
                {tx(
                  "o ONS não diz se o número publicado de defluência inclui as outras estruturas; o observatório deduz isso dos dados de cada reservatório (ver o título do gráfico).",
                  "ONS does not say whether the published outflow figure includes the other structures; the observatory infers this from each reservoir's data (see the chart title).",
                )}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-carvao-muted">
            {tx(
              <>
                A conta da água: variação observada = afluência − defluência + resíduo. Turbinado, vertido, outras estruturas e defluência não discriminada são partes da defluência
                conforme esse critério; a vazão natural é reconstituída e não entra na conta. Componente sem dado aparece como &ldquo;sem dado&rdquo;, nunca como zero.
              </>,
              <>
                The water balance: observed change = inflow − outflow + residual. Turbined, spilled, other structures and unspecified outflow are parts of the outflow according to that
                criterion; the natural flow is reconstructed and does not enter the balance. A component without data appears as &ldquo;no data&rdquo;, never as zero.
              </>,
            )}
          </p>
          <MedidasBalanco res={res} periodo={periodoJanela} semCadastro={semCadastro} ehPadrao={ehPadrao} evidenciaResiduo={evidenciaResiduo} endereco={enderecoBalanco} />
          <GraficoBarras
            titulo={tx(
              `Balanço hídrico de ${nomeRes}, ${periodoJanela} (${rotuloConvencao(res.convencao_defluencia, "pt")})`,
              `Water balance of ${nomeRes}, ${periodoJanela} (${rotuloConvencao(res.convencao_defluencia, "en")})`,
            )}
            dados={barrasBalancoTotais(res, idioma).map((b) => ({ id: b.id, rotulo: b.rotulo, v: b.v }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: hmJanela, cor: "var(--serie-hidraulica)" }]}
            unidade="hm³"
            casas={2}
            orientacao="horizontal"
          />
          <GraficoBarras
            titulo={tx(`Como a defluência de ${nomeRes} se divide, ${periodoJanela} (régua própria)`, `How the outflow of ${nomeRes} breaks down, ${periodoJanela} (own scale)`)}
            dados={barrasBalancoDefluencia(res, idioma).map((b) => ({ id: b.id, rotulo: b.rotulo, v: b.v }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: hmJanela, cor: "var(--cor-carvao)" }]}
            unidade="hm³"
            casas={2}
            orientacao="horizontal"
          />
          <GraficoBarras
            titulo={tx(
              `Resíduo e transferência de ${nomeRes}, ${periodoJanela} (régua própria, porque são pequenos)`,
              `Residual and transfer of ${nomeRes}, ${periodoJanela} (own scale, because they are small)`,
            )}
            dados={barrasBalancoResiduo(res, idioma).map((b) => ({ id: b.id, rotulo: b.rotulo, v: b.v }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: hmJanela, cor: "var(--cor-mineral)" }]}
            unidade="hm³"
            casas={2}
            orientacao="horizontal"
          />
          <AguaLegenda
            periodo={tx(`${periodoJanela}, com as vazões do dia e o volume inicial do dia anterior`, `${periodoJanela}, with the day's flows and the initial volume of the previous day`)}
            universo={tx(
              `${lista.length} reservatórios com EAR máxima positiva (todos os do ONS estão no CSV)`,
              `${lista.length} reservoirs with a positive maximum EAR (all ONS reservoirs are in the CSV)`,
            )}
            unidade={tx(
              "hm³: hectômetro cúbico, um milhão de metros cúbicos, com a vazão do dia convertida por m³/s × 86.400 s ÷ 10⁶; m³/s e % do volume útil nas séries diárias",
              "hm³: cubic hectometer, one million cubic meters, with the day's flow converted by m³/s × 86,400 s ÷ 10⁶; m³/s and % of useful volume in the daily series",
            )}
          />
          <AguaTabela
            titulo={tx(`Balanço de 30 dias dos ${lista.length} reservatórios com EAR máxima positiva`, `30-day balance of the ${lista.length} reservoirs with a positive maximum EAR`)}
            colunas={colunasReservatorios(idioma)}
            linhas={linhasRes}
            chaveLinha="id"
            colunaRotulo="rotulo"
            fonte={fonte}
            versao={versao}
            nomeArquivo="agua-reservatorios-balanco"
            selecionado={res.id}
            onSelecionar={selecionar}
            chaveUrl="res"
            dicaBusca={tx("Nome, bacia ou identificador", "Name, basin or identifier")}
            recolher
            nota={tx<ReactNode>(
              `Sem balanço: ${f.plural(lista.filter((r) => !r.balanco_calculado).length, "reservatório", "reservatórios")} nesta lista, com o motivo exato na coluna Observação (modo Analisar) e no CSV. Nada é preenchido; o resíduo nunca é zerado por ajuste. ${textoVolumeForaDaFaixa(lista, "pt")}`,
              comNomes(
                `Without a balance: ${f.plural(lista.filter((r) => !r.balanco_calculado).length, "reservoir", "reservoirs")} in this list, with the exact reason in the Note column (Analyze mode) and in the CSV. Nothing is filled in; the residual is never zeroed by adjustment. ${textoVolumeForaDaFaixa(lista, "en")}`,
                nomesRes,
                "en",
              ),
            )}
          />
        </SecaoDoPainel>
      )}

      {qualidade}

      <div ref={alvo} data-series={series.estado}>
        <SecaoDoPainel
          id="serie-diaria"
          titulo={
            nomeRes
              ? tx<ReactNode>(
                  `Como o volume e as vazões variaram dia a dia em ${nomeRes}?`,
                  <>
                    How did the volume and flows of <Nome>{nomeRes}</Nome> vary day by day?
                  </>,
                )
              : tx("Como o volume e as vazões variaram dia a dia?", "How did the volume and flows vary day by day?")
          }
          lead={tx(
            `Últimos ${dias}, em % do volume útil e em m³/s; o balanço de 30 dias começa na marca da janela.`,
            `Last ${dias}, in % of useful volume and in m³/s; the 30-day balance starts at the window mark.`,
          )}
        >
          {/* espaço reservado até as séries chegarem: as duas figuras ocupam a mesma altura que o aviso, e a página não salta */}
          <div className={series.estado === "pronto" ? undefined : "min-h-[640px]"}>
            {estadoSeries}
            {series.estado === "pronto" &&
              (serieSel.length ? (
                <div className="space-y-4">
                  <CursorSincronizado>
                    <GraficoLinhas
                      titulo={tx(`Volume útil de ${nomeRes}`, `Useful volume of ${nomeRes}`)}
                      dados={serieSel}
                      chaveX="d"
                      series={[{ id: "vol", rotulo: tx("Volume útil", "Useful volume"), cor: "var(--serie-hidraulica)", espessura: 2.5 }]}
                      unidade={tx("% do volume útil", "% of useful volume")}
                      casas={2}
                      marcos={[{ x: janela.inicio, rotulo: inicioJanela }]}
                      altura={220}
                    />
                    <GraficoLinhas
                      titulo={tx(`Vazões de ${nomeRes}`, `Flows of ${nomeRes}`)}
                      dados={serieSel}
                      chaveX="d"
                      series={traduzSeries(
                        [
                          { id: "afl", rotulo: tx("Afluente", "Inflow"), cor: "var(--serie-hidraulica)", espessura: 2 },
                          // i18n: dado (as formas inglesas destes dois rótulos vêm de SERIES_EN)
                          { id: "defl", rotulo: "Defluente (linha grossa)", cor: "var(--cor-carvao)", espessura: 5 },
                          // i18n: dado
                          { id: "turb", rotulo: "Turbinada (tracejada, por cima)", cor: "var(--serie-eolica)", tracejada: true, espessura: 1.5 },
                          { id: "vert", rotulo: tx("Vertida", "Spilled"), cor: "var(--serie-termica)", tracejada: true },
                        ],
                        idioma,
                      )}
                      unidade="m³/s"
                      casas={0}
                      marcos={[{ x: janela.inicio, rotulo: inicioJanela }]}
                      legendaInterativa
                    />
                  </CursorSincronizado>
                  {coincidem && (
                    <p className="text-sm text-carvao-muted" data-nota="vazoes-coincidem">
                      {coincidem}
                    </p>
                  )}
                </div>
              ) : (
                <p role="status" className="text-sm text-carvao-muted">
                  {tx("Sem série diária publicada para este reservatório.", "No daily series published for this reservoir.")}
                </p>
              ))}
          </div>
        </SecaoDoPainel>
      </div>

      <SecaoDoPainel id="comparar" nivel="analisar" titulo={tx("Até quatro reservatórios na mesma escala", "Up to four reservoirs on the same scale")}>
        <Comparador
          rotulo={tx(`Reservatórios comparados (até ${LIMITE_COMPARACAO})`, `Reservoirs compared (up to ${LIMITE_COMPARACAO})`)}
          entidades={lista.map((r) => ({ id: r.id, rotulo: nomeProprio(r.nome, idioma), detalhe: r.subsistema ?? undefined, sinonimos: [r.nome, r.id] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca={tx("Buscar, por exemplo Serra da Mesa, Furnas, Sobradinho", "Search, for example Serra da Mesa, Furnas, Sobradinho")}
          vazio={tx(
            `Nenhum reservatório escolhido. Escolha até ${LIMITE_COMPARACAO} para ver o volume útil dos últimos ${dias} na mesma escala.`,
            `No reservoir chosen. Choose up to ${LIMITE_COMPARACAO} to see the useful volume over the last ${dias} on the same scale.`,
          )}
        >
          {() => null}
        </Comparador>
        {escolhidos.length > 0 && series.estado === "pronto" && (
          <PequenosMultiplos
            titulo={tx(`Volume útil nos últimos ${dias} (% do volume útil de cada reservatório)`, `Useful volume over the last ${dias} (% of each reservoir's useful volume)`)}
            dados={multiplos}
            chaveX="d"
            unidade="%"
            casas={2}
            nivelTitulo={4}
            colunas={escolhidos.length >= 4 ? 4 : escolhidos.length >= 3 ? 3 : 2}
            // a mesma grandeza (volume útil) tem a mesma cor em todos os painéis e na série do reservatório escolhido; o nome do reservatório é o do painel
            paineis={seriesComp.map((s) => ({
              id: s.id,
              titulo: nomeProprio(s.nome, idioma),
              series: [{ id: s.id, rotulo: tx("Volume útil", "Useful volume"), cor: "var(--serie-hidraulica)", espessura: 2 }],
            }))}
          />
        )}
        {escolhidos.length > 0 && series.estado !== "pronto" && estadoSeries}
      </SecaoDoPainel>
    </div>
  );
}
