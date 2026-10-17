"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GeracaoAviso, GeracaoEscolha, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { GeracaoMapaUsinas } from "@/components/energia/GeracaoMapaUsinas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Nome } from "@/components/i18n/Nome";
import { carregaJson } from "@/lib/energia/carregaJson";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { URL_GEO, lerCaminho, pontoNaRegiao, type CamadaGeo } from "@/lib/energia/geo";
import {
  COR_RAZAO,
  FONTES_RESTRICAO,
  RAZOES,
  classesTamanho,
  colunasDescricoes,
  colunasRazoes12m,
  colunasRestricaoMensal,
  colunasSubsistemas12m,
  colunasUsinaMes,
  colunasUsinasRestricao,
  curtoRazao,
  gwh,
  instanteBR,
  linhasDescricoes,
  linhasRazoes12m,
  linhasRestricaoDiaria,
  linhasRestricaoMensal,
  linhasSubsistemas12m,
  linhasUsinasRestricao,
  nomeFonteRestricao,
  notaRazoesRestricao,
  notaUniversoRestricoes,
  paraTabela,
  pontosUsinas,
  respostaRestricao,
  serieUsinaCsv,
  usinaRestricaoEscolhida,
  vereditoRestricao,
  type FonteRestricao,
  type LinhaUsinaMes,
} from "@/lib/energia/geracao";
import type { RazaoRestricao, Restricao } from "@/lib/energia/tipos-geracao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P023, renováveis restringidas. O recorte fica na URL: fonte (?f=eolica ou solar) e usina
 * escolhida (?ru=); busca, ordem e filtros de cada tabela também (prefixos rm e ru). Escolher
 * uma usina no mapa ou na tabela seleciona a mesma usina nos dois, e o histórico mensal
 * dela é lido sob demanda do CSV publicado (geracao_restricao_usina_mensal.csv).
 *
 * Energia e potência ficam separadas: as barras somam a energia não gerada estimada por razão
 * oficial do ONS (GWh); o maior corte simultâneo (MW) tem gráfico próprio. A taxa usa o
 * denominador da gold: não gerada ÷ (verificada + não gerada). A malha de UF é lida da
 * camada publicada quando o painel aparece; sem ela, a tabela traz as mesmas usinas.
 *
 * Ordem da página: o veredito e a figura principal (energia não gerada por razão oficial, mês a mês) lado a lado, o recorte como
 * legenda e as notas do painel (`notas`); depois seções visíveis com pergunta própria: a taxa e o maior corte simultâneo (duas
 * medidas, dois gráficos, cada um na sua unidade) e o mapa das usinas com a tabela. As medidas de abertura (12 meses, por fonte)
 * ficam na faixa de métricas da página.
 */
const ESQUEMA = {
  f: campo(tiposUrl.opcao(FONTES_RESTRICAO), "eolica" as FonteRestricao),
  ru: campo(tiposUrl.texto({ max: 40 }), ""),
  // vista do mapa: ampliada nas usinas (padrão) ou Brasil inteiro; entra na URL para o link do painel reproduzir a vista
  vm: campo(tiposUrl.opcao(["usinas", "brasil"] as const), "usinas"), // i18n: dado
};

const URL_USINAS_MES = "/energia/series/geracao_restricao_usina_mensal.csv";

/** O que o painel principal usa de cada fonte (o diário, o detalhamento do ONS e os controles ficam fora). */
export type RestricaoCliente = Pick<Restricao, "fonte" | "primeiro_mes" | "ultimo_mes_completo" | "mensal_sin" | "ultimos_12m" | "usinas_12m" | "usinas_12m_resumo">;
/** O que a análise usa de cada fonte: razões e subsistemas dos 12 meses, os últimos dias e o detalhamento do ONS no último mês. */
export type RestricaoAnaliseCliente = Pick<Restricao, "fonte" | "ultimos_12m" | "diario_recente" | "descricoes_ultimo_mes">;

/** Fonte da URL quando publicada; senão a primeira publicada. */
function fonteValida(pedida: FonteRestricao, disponiveis: readonly FonteRestricao[]): FonteRestricao {
  return disponiveis.includes(pedida) ? pedida : (disponiveis[0] ?? "eolica");
}

export function GeracaoRestricoes({
  restricoes,
  fonte,
  versao,
  notas,
  rotulosRazao,
  potenciaOperacao,
}: {
  restricoes: Partial<Record<FonteRestricao, RestricaoCliente>>;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e do recorte. */
  notas?: ReactNode;
  /** Potência em operação comercial de cada fonte no retrato da Capacidade Instalada: referência do maior corte simultâneo (outra data e outro universo). */
  potenciaOperacao?: { data: string; eolica: number | null; solar: number | null };
  /** Rótulo oficial de cada razão (a gold publica, no idioma da página; vai para a chave sob o gráfico mensal). */
  rotulosRazao?: Partial<Record<RazaoRestricao, string>>;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, mesAno, mesAnoCurto, num } = formatos(idioma);
  const NOME_FONTE_RESTRICAO = nomeFonteRestricao(idioma);
  const CURTO_RAZAO = curtoRazao(idioma);
  const SIM = tx("sim", "yes");
  const disponiveis = FONTES_RESTRICAO.filter((f) => restricoes[f]);
  const f = fonteValida(v.f, disponiveis);
  const r = restricoes[f]!;
  const u = r.ultimos_12m;

  const mensal = useMemo(() => linhasRestricaoMensal(r, idioma), [r, idioma]);
  const barras = useMemo(
    () => mensal.linhas.map((l) => ({ ...l, rotulo: l.parcial === SIM ? tx(`${mesAnoCurto(l.m)} (parcial)`, `${mesAnoCurto(l.m)} (partial)`) : mesAnoCurto(l.m) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tx, SIM e mesAnoCurto mudam só com o idioma
    [mensal, idioma],
  );
  const ultimo = mensal.linhas[mensal.linhas.length - 1];
  const usinas = useMemo(() => linhasUsinasRestricao(r, idioma), [r, idioma]);
  const usina = usinaRestricaoEscolhida(r, v.ru);
  const selecionar = (id: string | null) => definir({ ru: id ?? "" });

  // malha de UF publicada, lida uma vez por página (carregaJson compartilha a promessa)
  const [camada, setCamada] = useState<CamadaGeo | null>(null);
  const [erroMalha, setErroMalha] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    carregaJson<CamadaGeo>(URL_GEO.uf)
      .then((c) => vivo && setCamada(c))
      .catch((x: unknown) => vivo && setErroMalha(x instanceof Error ? x.message : String(x)));
    return () => {
      vivo = false;
    };
  }, []);
  const mapa = useMemo(() => (camada ? pontosUsinas(r.usinas_12m, camada.projecao) : null), [camada, r]);
  const classes = useMemo(() => classesTamanho(r.usinas_12m, idioma), [r, idioma]);
  const ufs = useMemo(() => (camada ? camada.features.map((x) => ({ id: x.id, uf: x.uf, d: x.d })) : []), [camada]);
  // coordenada fora da UF que o ONS informa (subestação coletora de conjunto em UF vizinha): contada e declarada
  const foraDaUf = useMemo(() => {
    if (!camada || !mapa) return [];
    const aneis = new Map(camada.features.map((x) => [x.uf, lerCaminho(x.d)]));
    return mapa.pontos.filter((p) => p.uf && aneis.has(p.uf) && !pontoNaRegiao([p.x, p.y], aneis.get(p.uf)!));
  }, [camada, mapa]);

  // histórico mensal da usina escolhida, do CSV publicado, só quando o leitor pede
  const [csv, setCsv] = useState<string | null>(null);
  const [pedidoCsv, setPedidoCsv] = useState(false);
  const [erroCsv, setErroCsv] = useState<string | null>(null);
  useEffect(() => {
    if (!pedidoCsv || csv !== null) return;
    let vivo = true;
    fetch(URL_USINAS_MES)
      .then((x) => {
        if (!x.ok) throw new Error(`HTTP ${x.status} ${tx("ao ler", "reading")} ${URL_USINAS_MES}`);
        return x.text();
      })
      .then((t) => vivo && setCsv(t))
      .catch((x: unknown) => vivo && setErroCsv(x instanceof Error ? x.message : String(x)));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tx só muda com o idioma, e a leitura é uma por pedido
  }, [pedidoCsv, csv]);
  const historico: LinhaUsinaMes[] = useMemo(() => (csv && usina ? serieUsinaCsv(csv, f, usina.id, idioma) : []), [csv, usina, f, idioma]);
  const razoesUsina = razoesComValor(historico);
  const nomeFonte = NOME_FONTE_RESTRICAO[f];
  const periodo12 = u ? tx(`${mesAno(u.inicio)} a ${mesAno(u.fim)}`, `${mesAno(u.inicio)} to ${mesAno(u.fim)}`) : "";
  const nomeUsina = usina ? (usina.nome ?? usina.id) : "";
  const foraTexto = foraDaUf.map((p) => `${p.nome}, ${p.uf}`).join("; ");
  const referenciaCorte = potenciaOperacao
    ? [
        potenciaOperacao.eolica !== null ? tx(`${num(potenciaOperacao.eolica, 1)} MW nas eólicas`, `${num(potenciaOperacao.eolica, 1)} MW in wind plants`) : null,
        potenciaOperacao.solar !== null ? tx(`${num(potenciaOperacao.solar, 1)} MW na solar centralizada`, `${num(potenciaOperacao.solar, 1)} MW in centralized solar`) : null,
      ]
        .filter((x): x is string => x !== null)
        .join(tx(" e ", " and "))
    : "";

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          {disponiveis.length > 1 && (
            <GeracaoEscolha
              legenda={tx("Fonte", "Source")}
              opcoes={disponiveis.map((x) => ({ id: x, rotulo: NOME_FONTE_RESTRICAO[x] }))}
              valor={f}
              onEscolher={(x) => definir({ f: x, ru: "" })}
            />
          )}
          <RespostaCurta id="p023" veredito={vereditoRestricao(restricoes, idioma) || respostaRestricao(r, idioma)}>
            <span data-fonte={f}>{respostaRestricao(r, idioma)}</span>
          </RespostaCurta>
          {notaUniversoRestricoes(restricoes, idioma) && (
            <p className="text-xs leading-relaxed text-carvao-muted" data-nota="universo-fontes">
              {notaUniversoRestricoes(restricoes, idioma)}
            </p>
          )}
        </div>
        <div id="restricao-mensal" className="scroll-mt-28 space-y-3">
          <GraficoBarras
            titulo={tx(`Energia não gerada estimada por razão, ${nomeFonte.toLowerCase()}, SIN`, `Estimated energy not generated by reason, ${nomeFonte.toLowerCase()}, SIN`)}
            dados={paraTabela(barras, idioma)}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={mensal.razoes.map((z) => ({ id: z, rotulo: CURTO_RAZAO[z], cor: COR_RAZAO[z] }))}
            unidade="GWh"
            casas={1}
            empilhado
            altura={300}
          />
          {ultimo?.parcial === SIM && (
            <GeracaoAviso>
              {tx(
                <>O último mês ({ultimo.mes}) é parcial: soma só os dias já publicados e não se compara com meses completos.</>,
                <>The latest month ({ultimo.mes}) is partial: it adds up only the days already published and is not comparable with complete months.</>,
              )}
            </GeracaoAviso>
          )}
          <p className="text-xs leading-relaxed text-carvao-muted" data-nota="ess-restricao">
            {tx(
              "Compensação: pela norma lida em cópia de 08/01/2025, só a razão elétrica (indisponibilidade externa) dá direito ao ESS, o encargo de serviços do sistema; alterações posteriores indicadas em fontes secundárias não foram verificadas aqui.",
              `Compensation: under the regulation read in a copy dated ${dataBR("2025-01-08")}, only the electrical reason (external unavailability) gives the right to the ESS, the system services charge; later changes indicated in secondary sources were not verified here.`,
            )}
          </p>
          {notaRazoesRestricao(r, rotulosRazao ?? {}, mensal.razoes, idioma) && (
            <p className="text-xs leading-relaxed text-carvao-muted" data-nota="razoes-restricao">
              {notaRazoesRestricao(r, rotulosRazao ?? {}, mensal.razoes, idioma)}
            </p>
          )}
        </div>
      </div>

      <GeracaoRecorte
        periodo={
          u
            ? tx(
                `${mesAno(u.inicio)} a ${mesAno(u.fim)} (12 meses completos); série mensal desde ${mesAno(r.primeiro_mes)}`,
                `${mesAno(u.inicio)} to ${mesAno(u.fim)} (12 complete months); monthly series since ${mesAno(r.primeiro_mes)}`,
              )
            : tx(`série mensal desde ${mesAno(r.primeiro_mes)}, sem 12 meses completos`, `monthly series since ${mesAno(r.primeiro_mes)}, without 12 complete months`)
        }
        universo={
          u
            ? tx(
                <>
                  {NOME_FONTE_RESTRICAO[f]} despachadas ou programadas pelo ONS <span data-nivel="analisar">(Tipo I, II-B e II-C) </span>com limitação registrada: {num(u.usinas_com_restricao, 0)} de {num(u.usinas_no_universo, 0)} usinas e conjuntos no
                  período
                </>,
                <>
                  {NOME_FONTE_RESTRICAO[f]} plants dispatched or scheduled by the ONS <span data-nivel="analisar">(Type I, II-B and II-C) </span>with a recorded limitation: {num(u.usinas_com_restricao, 0)} of {num(u.usinas_no_universo, 0)} plants and plant clusters in the
                  period
                </>,
              )
            : tx(
                <>
                  {NOME_FONTE_RESTRICAO[f]} despachadas ou programadas pelo ONS <span data-nivel="analisar">(Tipo I, II-B e II-C)</span>
                </>,
                <>
                  {NOME_FONTE_RESTRICAO[f]} plants dispatched or scheduled by the ONS <span data-nivel="analisar">(Type I, II-B and II-C)</span>
                </>,
              )
        }
        unidade={tx(
          "GWh (energia não gerada estimada); % de verificada mais não gerada (taxa); MW (maior corte simultâneo numa meia hora)",
          "GWh (estimated energy not generated); % of verified plus not generated (rate); MW (largest simultaneous cut in a half hour)",
        )}
      />

      {notas}

      <SecaoDoPainel
        id="taxa-e-corte"
        titulo={tx("Qual foi a taxa de restrição, e qual o maior corte simultâneo?", "What was the restriction rate, and what was the largest simultaneous cut?")}
        lead={tx(
          "Duas medidas diferentes, cada uma na sua unidade: a taxa é uma parcela da energia (%), e o maior corte é uma potência (MW) numa única meia hora.",
          "Two different measures, each in its own unit: the rate is a share of energy (%), and the largest cut is a capacity (MW) in a single half hour.",
        )}
      >
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          <GraficoLinhas
            titulo={tx("Taxa de restrição: não gerada ÷ (verificada + não gerada)", "Restriction rate: not generated ÷ (verified + not generated)")}
            dados={mensal.linhas.map((l) => ({ m: l.m, taxa: l.taxa_pct }))}
            chaveX="m"
            formatoX="mes"
            series={[{ id: "taxa", rotulo: tx("Taxa de restrição", "Restriction rate"), cor: COR_RAZAO.ENE, espessura: 2.5 }]}
            unidade="%"
            casas={1}
            zeroNoEixo
            altura={220}
          />
          <GraficoLinhas
            titulo={tx("Maior corte simultâneo numa meia hora do mês (potência, não energia)", "Largest simultaneous cut in a half hour of the month (capacity, not energy)")}
            dados={mensal.linhas.map((l) => ({ m: l.m, potencia: l.potencia_mw }))}
            chaveX="m"
            formatoX="mes"
            series={[{ id: "potencia", rotulo: tx("Maior corte simultâneo", "Largest simultaneous cut"), cor: "var(--serie-referencia)", espessura: 2.5 }]}
            unidade="MW"
            casas={0}
            zeroNoEixo
            altura={220}
          />
        </div>
        {potenciaOperacao && (potenciaOperacao.eolica !== null || potenciaOperacao.solar !== null) && (
          <p className="text-xs leading-relaxed text-carvao-muted" data-referencia-corte="">
            {tx(
              <>
                Para ler o maior corte: a potência em operação comercial era de {referenciaCorte} em {dataBR(potenciaOperacao.data)} (retrato da Capacidade Instalada, usinas despachadas pelo ONS). Corte e potência são medidas de datas e universos diferentes: a razão entre elas não é publicada.
              </>,
              <>
                To read the largest cut: the capacity in commercial operation was {referenciaCorte} on {dataBR(potenciaOperacao.data)} (installed capacity snapshot, plants dispatched by the ONS). Cut and capacity are measures from different dates and universes: the ratio between them is not published.
              </>,
            )}
          </p>
        )}
        <TabelaInterativa
          titulo={tx("Tabela equivalente: energia não gerada, taxa e maior corte, mês a mês", "Equivalent table: energy not generated, rate and largest cut, month by month")}
          colunas={colunasRestricaoMensal(mensal.razoes, idioma).map((c) => (c.id === "mes" ? { ...c, id: "m", tipo: "data" as const } : c))}
          linhas={paraTabela(mensal.linhas, idioma)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-restricao-mensal-${f}`}
          chaveUrl="rm"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          nota={tx(
            "Razão sem energia em nenhum mês fica fora das colunas. A potência é o maior corte simultâneo do mês, não a soma dos cortes.",
            "A reason with no energy in any month is left out of the columns. The capacity is the month's largest simultaneous cut, not the sum of the cuts.",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="mapa-usinas"
        titulo={tx(
          `Onde estão as ${num(r.usinas_12m_resumo.publicadas, 0)} usinas e conjuntos com mais energia não gerada (${num(r.usinas_12m_resumo.cobertura_da_energia_pct, 1)}% do total)?`,
          `Where are the ${num(r.usinas_12m_resumo.publicadas, 0)} plants and plant clusters with the most energy not generated (${num(r.usinas_12m_resumo.cobertura_da_energia_pct, 1)}% of the total)?`,
        )}
      >
        {mapa ? (
          <GeracaoMapaUsinas
            titulo={tx(`${nomeFonte} com mais energia não gerada por restrição${u ? `, ${periodo12}` : ""}`, `${nomeFonte} plants with the most energy not generated due to restriction${u ? `, ${periodo12}` : ""}`)}
            ufs={ufs}
            viewBox={camada!.viewBox}
            pontos={mapa.pontos}
            rotulosClasse={classes.rotulos}
            selecionado={usina?.id ?? null}
            onSelecionar={selecionar}
            ampliado={v.vm === "usinas"}
            onAmpliar={(b) => definir({ vm: b ? "usinas" : "brasil" })} // i18n: dado
            semCoordenada={mapa.semCoordenada}
            nota={tx(
              `Cada marca é uma usina ou um conjunto de usinas como o ONS publica; o ponto não indica onde o corte foi decidido.${
                foraDaUf.length ? ` Em ${foraDaUf.length === 1 ? "1 caso" : `${foraDaUf.length} casos`} a coordenada fica fora da UF que o ONS informa (${foraTexto}): a subestação coletora de um conjunto pode ficar em UF vizinha.` : ""
              }`,
              `Each marker is a plant or a plant cluster as the ONS publishes it; the point does not indicate where the cut was decided.${
                foraDaUf.length
                  ? ` In ${foraDaUf.length === 1 ? "1 case" : `${foraDaUf.length} cases`} the coordinate falls outside the state the ONS reports (${foraTexto}): the collector substation of a cluster may be in a neighboring state.`
                  : ""
              }`,
            )}
          />
        ) : (
          <p className="text-sm text-carvao-muted" role="status" aria-live="polite">
            {erroMalha
              ? tx(`A malha de UF não pôde ser lida (${erroMalha}); a tabela abaixo traz as mesmas usinas.`, `The state boundary file could not be read (${erroMalha}); the table below lists the same plants.`)
              : tx("Lendo a malha de UF publicada para desenhar o mapa…", "Reading the published state boundary file to draw the map…")}
          </p>
        )}
        <TabelaInterativa
          titulo={tx(
            `Usinas e conjuntos: energia não gerada, taxa e razão principal, 12 meses (${nomeFonte.toLowerCase()})`,
            `Plants and plant clusters: energy not generated, rate and main reason, 12 months (${nomeFonte.toLowerCase()})`,
          )}
          colunas={colunasUsinasRestricao(idioma)}
          linhas={paraTabela(usinas, idioma)}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-restricao-usinas-${f}`} // i18n: dado
          chaveUrl="tu"
          selecionado={usina?.id ?? null}
          onSelecionar={selecionar}
          ordemInicial={{ coluna: "nao_gerada_gwh", direcao: "desc" }}
          dicaBusca={tx("Nome da usina ou UF", "Plant name or state")}
          nota={tx(
            `Lista completa, mês a mês, no CSV de restrição por usina, no fim do painel. Coordenada publicada pelo ONS no conjunto de fator de capacidade (subestação coletora; sem ela, ponto de conexão).`,
            "Full list, month by month, in the restriction-by-plant CSV at the end of the panel. Coordinate published by the ONS in the capacity factor dataset (collector substation; without it, the connection point).",
          )}
        />
        {usina && (
          <div className="space-y-3 border-l-2 border-energia pl-4" data-usina={usina.id}>
            <p className="text-sm text-carvao">
              <span className="font-medium">
                <Nome>{nomeUsina}</Nome>
              </span>
              {usina.uf ? ` (${usina.uf})` : ""}:{" "}
              {tx(
                <>
                  {num(gwh(usina.energia_nao_gerada_mwh), 1)} GWh não gerados nos 12 meses, taxa de {num(usina.taxa_pct, 1)}%; razão com mais
                  energia: {CURTO_RAZAO[usina.razao_principal].toLowerCase()}.
                </>,
                <>
                  {num(gwh(usina.energia_nao_gerada_mwh), 1)} GWh not generated over the 12 months, rate of {num(usina.taxa_pct, 1)}%; reason with the most
                  energy: {CURTO_RAZAO[usina.razao_principal].toLowerCase()}.
                </>,
              )}
            </p>
            {!csv && (
              <button
                type="button"
                onClick={() => setPedidoCsv(true)}
                disabled={pedidoCsv && !erroCsv}
                className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia disabled:opacity-60"
              >
                {pedidoCsv && !erroCsv ? tx("Lendo o histórico mensal…", "Reading the monthly history…") : tx("Ver o histórico mensal desta usina", "See this plant's monthly history")}
              </button>
            )}
            {erroCsv && <GeracaoAviso>{tx(`O histórico não pôde ser lido: ${erroCsv}.`, `The history could not be read: ${erroCsv}.`)}</GeracaoAviso>}
            {csv && historico.length === 0 && (
              <GeracaoAviso>
                {tx(`O arquivo publicado não tem meses desta usina para ${nomeFonte.toLowerCase()}.`, `The published file has no months for this plant for ${nomeFonte.toLowerCase()}.`)}
              </GeracaoAviso>
            )}
            {historico.length > 0 && (
              <>
                <GraficoBarras
                  titulo={tx(`${nomeUsina}: energia não gerada por razão, mês a mês`, `${nomeUsina}: energy not generated by reason, month by month`)}
                  dados={historico.map((l) => ({ ...l, rotulo: mesAnoCurto(l.m) }))}
                  chaveCategoria="m"
                  chaveRotulo="rotulo"
                  series={razoesUsina.map((z) => ({ id: z, rotulo: CURTO_RAZAO[z], cor: COR_RAZAO[z] }))}
                  unidade="MWh"
                  casas={0}
                  empilhado
                  altura={240}
                />
                <TabelaInterativa
                  chaveUrl="um"
                  titulo={tx(`Tabela equivalente: ${nomeUsina}, mês a mês`, `Equivalent table: ${nomeUsina}, month by month`)}
                  colunas={colunasUsinaMes(razoesUsina, idioma).map((c) => (c.id === "mes" ? { ...c, id: "m", tipo: "data" as const } : c))}
                  linhas={paraTabela(historico, idioma)}
                  chaveLinha="id"
                  colunaRotulo="m"
                  fonte={fonte}
                  versao={versao}
                  nomeArquivo={`geracao-restricao-usina-${usina.id}`} // i18n: dado
                  ordemInicial={{ coluna: "m", direcao: "desc" }}
                />
              </>
            )}
          </div>
        )}
      </SecaoDoPainel>
    </div>
  );
}

/**
 * Análise do P023 para a fonte escolhida na URL (o mesmo ?f= do painel): razões e origem dos 12
 * meses, subsistemas, energia não gerada e maior corte de cada um dos últimos dias e o
 * detalhamento publicado pelo ONS no último mês. Só a fonte escolhida é desenhada.
 */
export function GeracaoRestricoesAnalise({ restricoes, fonte, versao }: { restricoes: Partial<Record<FonteRestricao, RestricaoAnaliseCliente>>; fonte: string; versao: string }) {
  const [v] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, dataCurta, mesAno, num } = formatos(idioma);
  const CURTO_RAZAO = curtoRazao(idioma);
  const disponiveis = FONTES_RESTRICAO.filter((x) => restricoes[x]);
  const f = fonteValida(v.f, disponiveis);
  const r = restricoes[f];
  const diario = useMemo(() => (r ? linhasRestricaoDiaria(r) : []), [r]);
  if (!r) return null;
  const u = r.ultimos_12m;
  const razoesDia = RAZOES.filter((z) => diario.some((l) => (l[z] ?? 0) > 0));
  const periodo12 = u ? tx(`${mesAno(u.inicio)} a ${mesAno(u.fim)}`, `${mesAno(u.inicio)} to ${mesAno(u.fim)}`) : "";
  return (
    <div className="space-y-4" data-fonte={f}>
      <p className="rotulo text-mineral">{tx(`${nomeFonteRestricao(idioma)[f]} (fonte escolhida no painel)`, `${nomeFonteRestricao(idioma)[f]} (source chosen in the panel)`)}</p>
      {u && (
        <>
          <p className="text-sm leading-relaxed text-carvao-muted">
            {tx(
              <>
                De {mesAno(u.inicio)} a {mesAno(u.fim)}, o maior corte simultâneo foi de {num(u.potencia_max_cortada_mw, 1)} MW em {instanteBR(u.quando_potencia_max, idioma)}. A origem (local ou
                sistêmica) é a que o ONS registra em cada limitação; o observatório não a reclassifica.
              </>,
              <>
                From {mesAno(u.inicio)} to {mesAno(u.fim)}, the largest simultaneous cut was {num(u.potencia_max_cortada_mw, 1)} MW on {instanteBR(u.quando_potencia_max, idioma)}. The origin (local or
                systemic) is the one the ONS records for each limitation; the observatory does not reclassify it.
              </>,
            )}
          </p>
          <TabelaInterativa
            chaveUrl="rz"
            titulo={tx(`Energia não gerada por razão e origem, ${periodo12}`, `Energy not generated by reason and origin, ${periodo12}`)}
            colunas={colunasRazoes12m(idioma)}
            linhas={paraTabela(linhasRazoes12m(r, idioma), idioma)}
            chaveLinha="id"
            colunaRotulo="razao"
            fonte={fonte}
            versao={versao}
            nomeArquivo={`geracao-restricao-razoes-${f}`}
          />
          <TabelaInterativa
            chaveUrl="ss"
            titulo={tx(`Energia não gerada e taxa por subsistema, ${periodo12}`, `Energy not generated and rate by subsystem, ${periodo12}`)}
            colunas={colunasSubsistemas12m(idioma)}
            linhas={paraTabela(linhasSubsistemas12m(r, idioma), idioma)}
            chaveLinha="id"
            colunaRotulo="sm"
            fonte={fonte}
            versao={versao}
            nomeArquivo={`geracao-restricao-subsistemas-${f}`}
            nota={tx(
              "Subsistema com pouca geração verificada tem taxa sobre base pequena: a taxa de poucos GWh se move mais que a do Nordeste. Leia a taxa junto da energia verificada.",
              "A subsystem with little verified generation has a rate over a small base: the rate on a few GWh moves more than the Northeast's. Read the rate together with the verified energy.",
            )}
          />
        </>
      )}
      {diario.length > 0 && (
        <>
          <GraficoBarras
            titulo={tx(
              `Energia não gerada por dia e razão, ${dataBR(diario[0].d)} a ${dataBR(diario[diario.length - 1].d)}`,
              `Energy not generated by day and reason, ${dataBR(diario[0].d)} to ${dataBR(diario[diario.length - 1].d)}`,
            )}
            dados={diario.map((l) => ({ ...l, rotulo: dataCurta(l.d) }))}
            chaveCategoria="d"
            chaveRotulo="rotulo"
            series={razoesDia.map((z) => ({ id: z, rotulo: CURTO_RAZAO[z], cor: COR_RAZAO[z] }))}
            unidade="MWh"
            casas={0}
            empilhado
            altura={260}
          />
          <GraficoLinhas
            titulo={tx("Maior corte simultâneo de cada dia (potência)", "Largest simultaneous cut on each day (capacity)")}
            dados={diario.map((l) => ({ d: l.d, potencia: l.potencia_mw }))}
            chaveX="d"
            series={[{ id: "potencia", rotulo: tx("Maior corte simultâneo", "Largest simultaneous cut"), cor: "var(--serie-referencia)", espessura: 2 }]}
            unidade="MW"
            casas={0}
            zeroNoEixo
            altura={200}
          />
        </>
      )}
      {r.descricoes_ultimo_mes && r.descricoes_ultimo_mes.itens.length > 0 && (
        <TabelaInterativa
          chaveUrl="ds"
          titulo={tx(
            `Detalhamento publicado pelo ONS em ${mesAno(r.descricoes_ultimo_mes.mes)} (${num(r.descricoes_ultimo_mes.n_descricoes, 0)} descrições)`,
            `Detail published by the ONS in ${mesAno(r.descricoes_ultimo_mes.mes)} (${num(r.descricoes_ultimo_mes.n_descricoes, 0)} descriptions)`,
          )}
          colunas={colunasDescricoes(idioma)}
          linhas={paraTabela(linhasDescricoes(r), idioma)}
          chaveLinha="id"
          colunaRotulo="descricao"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-restricao-detalhamento-${f}`}
          ordemInicial={{ coluna: "gwh", direcao: "desc" }}
          nota={tx(
            "Texto da descrição como o ONS publica; o observatório não o reclassifica.",
            "Description text as the ONS publishes it (in Portuguese); the observatory does not reclassify it.",
          )}
        />
      )}
    </div>
  );
}

/** Razões com algum valor positivo no histórico da usina (as demais não viram série vazia). */
function razoesComValor(linhas: readonly LinhaUsinaMes[]): RazaoRestricao[] {
  return RAZOES.filter((z) => linhas.some((l) => (l[z] ?? 0) > 0));
}
