"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { PerdasMapa, type EntidadeMapa } from "@/components/energia/PerdasMapa";
import { PerdasDistribuicao } from "@/components/energia/PerdasDistribuicao";
import { Recorte } from "@/components/energia/PerdasPainel";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Comparador, type EntidadeComparavel } from "@/components/energia/Comparador";
import { GraficoLinhas, type SerieLinha } from "@/components/energia/GraficoLinhas";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import LinkSemPrefetch from "@/components/energia/LinkSemPrefetch";
import { Nome } from "@/components/i18n/Nome";
import { marcarNomes } from "@/lib/energia/i18n/qualidade-perdas";
import { porIdioma } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { classeDe } from "@/lib/energia/escalas";
import { mesAno, num } from "@/lib/energia/formato";
import type { Evidencia } from "@/lib/energia/evidencia";
import {
  ORDEM_MEDIDAS,
  ajustaConsulta,
  carregarJson,
  classificacaoMedida,
  colunasDoPeriodo,
  faixaComparacao,
  historicoDistribuidora,
  linhasDistribuidoras,
  medidas as medidasNoIdioma,
  medidasDoPeriodo,
  recortesDoPeriodo,
  respostaDistribuidora,
  respostaMapa,
  vereditoMapa,
  avisoTerritorio,
  rotuloDistribuidora,
  rotulosGrupo,
  serieComparacao,
  valoresDoPeriodo,
  type DistribuidoraLeve,
  type IdMedida,
  type PeriodoPerdas,
} from "@/lib/energia/perdas";
import type { AcumuladoAno, EvidenciasDistribuidoras, LinhaNacional, SerieAnualPerdas } from "@/lib/energia/tipos-perdas";

/**
 * Explorador da abertura de Perdas: período, medida e distribuidora na URL (voltar e avançar refazem a consulta). Uma só consulta
 * move a resposta, a distribuição das distribuidoras por faixa (a figura principal), o mapa das áreas, o painel da distribuidora
 * escolhida com histórico e "Comprove este número", o comparador de até quatro distribuidoras e a tabela de todas, com exportação.
 *
 * Uma só fonte para tudo: figura, mapa, tabela, exportação e texto saem dos mesmos recortes e das mesmas regras
 * (src/lib/energia/perdas.ts). Ano de referência e acumulado vêm da gold, já na página; outro ano, o histórico e o comparador leem a
 * série anual (perdas_anual.json) só quando pedidos, e a evidência por distribuidora (perdas_evidencias.json) só quando uma
 * distribuidora é escolhida.
 *
 * A página (servidor) encaixa o que não depende da consulta: a resposta do agregado das concessionárias (`respostaGeral`), as notas
 * do painel logo depois da figura principal (`notas`), os capítulos para as páginas irmãs (`aposPrincipal`) e a limitação do mapa
 * (`limitacaoMapa`).
 */

export type PerdasExploradorProps = {
  distribuidoras: DistribuidoraLeve[];
  periodos: PeriodoPerdas[];
  anoRef: number;
  nacional: LinhaNacional[];
  acumulado: AcumuladoAno | null;
  urls: { anual: string; municipios: string; evidencias: string };
  versao: string;
  /** Ano da relação conjunto × município que desenha as áreas (gold.mapa.ano_relacao). */
  anoRelacao: number | null;
  /** Resposta curta do agregado das concessionárias no ano de referência (universo próprio, fora da consulta). */
  respostaGeral?: ReactNode;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal. */
  notas?: ReactNode;
  /** Conteúdo depois da figura principal e das notas (os capítulos do módulo), antes do mapa. */
  aposPrincipal?: ReactNode;
  /** Limitação da geometria, logo abaixo do mapa. */
  limitacaoMapa?: ReactNode;
};

/** Ressalva que muda a leitura das barras de uma medida, dita junto da figura (a definição da gold diz que a não técnica pode ser negativa). */
function observacaoMedida(idioma: Idioma): Partial<Record<IdMedida, string>> {
  return porIdioma(idioma, {
    pt: {
      pnt_bt: "A perda não técnica pode ser negativa quando a estimativa técnica supera a perda total medida; ela inclui furto, fraude e erros de medição, leitura e faturamento, que a fonte não separa.",
    },
    en: {
      pnt_bt: "The non-technical loss can be negative when the technical estimate exceeds the measured total loss; it includes theft, fraud and metering, reading and billing errors, which the source does not separate.",
    },
  });
}

const SELECT =
  "h-11 w-full border border-linha bg-superficie px-2 text-sm text-carvao focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

type Carga<T> = { estado: "ocioso" | "carregando" } | { estado: "pronto"; dado: T } | { estado: "erro"; erro: string };

function useJsonSobDemanda<T>(url: string, pedir: boolean): [Carga<T>, () => void] {
  const [carga, setCarga] = useState<Carga<T>>({ estado: "ocioso" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!pedir) return;
    let vivo = true;
    setCarga((c) => (c.estado === "pronto" ? c : { estado: "carregando" }));
    carregarJson<T>(url).then(
      (dado) => vivo && setCarga({ estado: "pronto", dado }),
      (e: unknown) => vivo && setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [url, pedir, tentativa]);
  return [carga, () => setTentativa((t) => t + 1)];
}

export function PerdasExplorador({ distribuidoras, periodos, anoRef, nacional, acumulado, urls, versao, anoRelacao, respostaGeral, notas, aposPrincipal, limitacaoMapa }: PerdasExploradorProps) {
  const idioma = useIdioma();
  const tx = useTx();
  const MEDIDAS = medidasNoIdioma(idioma);
  const ROTULO_GRUPO = rotulosGrupo(idioma);
  const ids = useMemo(() => distribuidoras.map((d) => d.cnpj), [distribuidoras]);
  const chaveIds = ids.join(",");
  const chavePeriodos = periodos.map((p) => p.id).join(",");
  const esquema = useMemo(
    () => ({
      periodo: campo(tiposUrl.opcao(periodos.map((p) => p.id)), String(anoRef), { param: "periodo" }),
      medida: campo(tiposUrl.opcao(ORDEM_MEDIDAS), "taxa" as IdMedida, { param: "medida" }),
      d: campo(tiposUrl.opcao(ids), "", { param: "d" }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as chaves resumem as listas
    [chaveIds, chavePeriodos, anoRef],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const { periodo, medida } = ajustaConsulta(periodos, v.periodo, v.medida, idioma);
  const sel = v.d ? distribuidoras.find((d) => d.cnpj === v.d) ?? null : null;

  /* comparador: a seleção vem do próprio componente (URL ?cmp=) */
  const [comparadas, setComparadas] = useState<string[]>([]);

  /* série anual sob demanda: outro ano, histórico da escolhida ou comparação */
  const precisaAnual = (periodo.tipo === "ano" && !periodo.referencia) || !!sel || comparadas.length > 0;
  const [cargaAnual, tentarAnual] = useJsonSobDemanda<SerieAnualPerdas>(urls.anual, precisaAnual);
  const anual = cargaAnual.estado === "pronto" ? cargaAnual.dado : null;
  const [cargaEvid, tentarEvid] = useJsonSobDemanda<EvidenciasDistribuidoras>(urls.evidencias, !!sel);
  const evidSel = sel && cargaEvid.estado === "pronto" ? (cargaEvid.dado.evidencias[sel.cnpj] as Evidencia | undefined) ?? null : null;

  /* recortes, valores, classes e linhas: a mesma origem para figura, mapa, tabela, texto e arquivo */
  const recortes = useMemo(() => recortesDoPeriodo(distribuidoras, periodo, anual), [distribuidoras, periodo, anual]);
  const valores = useMemo(
    () => (recortes ? valoresDoPeriodo(distribuidoras, recortes, medida.id, periodo, idioma) : null),
    [distribuidoras, recortes, medida.id, periodo, idioma],
  );
  const classes = useMemo(() => (valores ? classificacaoMedida(medida, valores, idioma) : null), [medida, valores, idioma]);
  const linhas = useMemo(
    () => (recortes && valores && classes ? linhasDistribuidoras(distribuidoras, recortes, periodo, { valores, classes }, idioma) : null),
    [distribuidoras, recortes, periodo, valores, classes, idioma],
  );
  const colunas = useMemo(() => colunasDoPeriodo(periodo, medida, idioma), [periodo, medida, idioma]);
  const rotulos = useMemo(() => Object.fromEntries(distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)])), [distribuidoras]);
  const grupos = useMemo(() => Object.fromEntries(distribuidoras.map((d) => [d.cnpj, d.grupo])), [distribuidoras]);
  const faixa = useMemo(() => (valores ? faixaComparacao(valores, rotulos, grupos) : null), [valores, rotulos, grupos]);
  const linhaNac = nacional.find((l) => l.ano === periodo.ano && l.universo === "concessionarias") ?? null;
  const resposta = valores ? respostaMapa({ periodo, medida, valores, rotulos, nacional: linhaNac, acumulado }, idioma) : null;
  const veredito = valores ? vereditoMapa({ periodo, medida, valores, rotulos, acumulado }, idioma) : null;
  // concessionárias que somam o agregado nacional do período (51 em 2025; as comparáveis nos dois períodos no acumulado)
  // a soma da técnica e a da não técnica usam só as concessionárias que publicam a separação (18 em 2025): cada medida tem a sua contagem, lida da série nacional
  const nSoma =
    periodo.tipo === "acumulado"
      ? acumulado?.agregados.find((x) => x.universo === "concessionarias")?.n_distribuidoras ?? null
      : linhaNac && !linhaNac.parcial
        ? medida.id === "tecnica"
          ? linhaNac.n_com_tecnica
          : medida.id === "pnt_bt"
            ? linhaNac.n_com_pnt_bt
            : linhaNac.n_distribuidoras
        : null;
  const entidadesMapa = useMemo<EntidadeMapa[]>(
    () => distribuidoras.map((d) => ({ id: d.cnpj, rotulo: rotuloDistribuidora(d), nome: d.nome, ufs: d.territorio?.ufs.join("/") ?? "" })),
    [distribuidoras],
  );
  const entidadesComp = useMemo<EntidadeComparavel[]>(
    () =>
      distribuidoras.map((d) => ({
        id: d.cnpj,
        rotulo: rotuloDistribuidora(d),
        detalhe: `${d.nome}${d.territorio?.ufs.length ? `, ${d.territorio.ufs.join("/")}` : ""}${d.ativa ? "" : porIdioma(idioma, { pt: " (série encerrada)", en: " (series ended)" })}`,
        sinonimos: [d.nome, d.cnpj, d.cnpj_formatado, ...(d.territorio?.ufs ?? [])],
      })),
    [distribuidoras, idioma],
  );
  const nComparaveis = faixa ? faixa.n : null;
  // quantas têm algum valor publicado no período (comparável ou fora): o universo do período, não o da série inteira
  const nComDado = faixa ? faixa.n + faixa.fora : null;
  const disponiveis = medidasDoPeriodo(periodo);
  const consultaPadrao = periodo.id === String(anoRef) && medida.id === "taxa" && !sel;
  // a distribuidora escolhida na figura: o valor dela, a faixa em que cai ou o estado que a deixa fora das faixas
  const escolhida = useMemo(() => {
    if (!sel || !valores || !classes) return null;
    const valor = valores[sel.cnpj];
    if (!valor) return null;
    const k = valor.estado === "valor" ? classeDe(valor.v, classes) : null;
    return { rotulo: rotuloDistribuidora(sel), valor, classe: typeof k === "number" ? k : null };
  }, [sel, valores, classes]);

  const selecionar = (id: string | null) => definir({ d: id ?? "" });

  /* histórico da distribuidora escolhida, com a taxa das concessionárias como referência */
  const historico = useMemo(() => {
    if (!sel || !anual) return null;
    const h = historicoDistribuidora(anual.distribuidoras[sel.cnpj] ?? [], idioma);
    const nac = new Map(nacional.filter((l) => !l.parcial && l.universo === "concessionarias").map((l) => [String(l.ano), l.taxa_total_pct]));
    return { ...h, dados: h.pontos.map((p) => ({ ano: p.ano, taxa: p.taxa, brasil: nac.get(p.ano) ?? null })) };
  }, [sel, anual, nacional, idioma]);

  return (
    <div className="space-y-8">
      {/* consulta e respostas: o agregado das concessionárias (universo próprio) e a faixa entre distribuidoras da consulta */}
      <div className="grid gap-x-10 gap-y-4 xl:grid-cols-[minmax(0,1fr)_42rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {resposta && veredito ? (
            <RespostaCurta id="mapa" vivo veredito={marcarNomes(veredito, Object.values(rotulos), idioma)}>
              {marcarNomes(resposta, Object.values(rotulos), idioma)}
            </RespostaCurta>
          ) : cargaAnual.estado === "erro" ? (
            <p className="text-sm text-carvao">
              {tx(<>Não foi possível carregar a série anual ({cargaAnual.erro}).</>, <>Could not load the annual series ({cargaAnual.erro}).</>)}{" "}
              <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia" onClick={tentarAnual}>
                {tx("Tentar de novo", "Try again")}
              </button>
            </p>
          ) : (
            <p role="status" className="text-sm text-carvao-muted">
              {tx(<>Carregando a série anual de {periodo.ano}.</>, <>Loading the annual series for {periodo.ano}.</>)}
            </p>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-[16.5rem_minmax(0,1fr)]">
          <div>
            <label htmlFor="perdas-periodo" className="rotulo mb-1 block text-mineral">
              {tx("Período", "Period")}
            </label>
            <select id="perdas-periodo" className={SELECT} value={periodo.id} onChange={(e) => definir({ periodo: e.target.value })}>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="perdas-medida" className="rotulo mb-1 block text-mineral">
              {tx("Medida", "Measure")}
            </label>
            <select id="perdas-medida" className={SELECT} value={medida.id} onChange={(e) => definir({ medida: e.target.value as IdMedida })}>
              {ORDEM_MEDIDAS.map((m) => (
                <option key={m} value={m} disabled={!disponiveis.includes(m)}>
                  {MEDIDAS[m].rotulo} ({MEDIDAS[m].unidade}){disponiveis.includes(m) ? "" : MEDIDAS[m].soReferencia ? tx(", só no ano de referência", ", reference year only") : tx(", não existe no acumulado", ", not available in the year to date")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {(sel || !consultaPadrao) && (
        <div role="group" className="flex flex-wrap items-center gap-x-4 gap-y-0 text-xs text-carvao-muted" aria-label={tx("Consulta aplicada", "Applied query")}>
          {sel && (
            <span>
              {tx("Distribuidora escolhida: ", "Chosen distribution utility: ")}
              <span className="text-carvao">{tx(<>{rotuloDistribuidora(sel)}</>, <Nome>{rotuloDistribuidora(sel)}</Nome>)}</span>
            </span>
          )}
          {!consultaPadrao && (
            <button
              type="button"
              onClick={() => definir({ periodo: String(anoRef), medida: "taxa", d: "" })} // i18n: dado
              className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
            >
              {tx("Restaurar a consulta padrão", "Restore the default query")}
            </button>
          )}
        </div>
      )}

      {/* figura principal: as distribuidoras por faixa da medida, com a faixa observada e o que fica de fora */}
      {classes && faixa ? (
        <PerdasDistribuicao
          titulo={tx(`${medida.rotulo} (${medida.unidade}): distribuidoras por faixa, ${periodo.rotulo}`, `${medida.rotulo} (${medida.unidade}): distribution utilities by range, ${periodo.rotulo}`)}
          medida={medida}
          classes={classes}
          faixa={faixa}
          periodo={periodo.rotulo}
          escolhida={escolhida}
          observacao={observacaoMedida(idioma)[medida.id]}
        />
      ) : (
        <div role="status" className="flex min-h-[14rem] items-center justify-center border border-linha bg-superficie px-6 text-center text-sm text-carvao-muted">
          {tx(<>A distribuição de {periodo.ano} aparece quando a série anual terminar de carregar.</>, <>The {periodo.ano} distribution appears when the annual series finishes loading.</>)}
        </div>
      )}
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-medida={medida.id}>
        {medida.explicacao}
      </p>
      <Recorte
        periodo={periodo.rotulo}
        universo={tx(
          `${distribuidoras.length} distribuidoras com balanço no SAMP em algum ano${
            nComDado !== null && nComparaveis !== null
              ? `; ${nComDado} com valor publicado neste período, ${nComparaveis} delas comparáveis nesta medida${nSoma !== null && medida.id !== "variacao" ? `; a soma nacional usa só as ${nSoma} concessionárias ${medida.id === "tecnica" || medida.id === "pnt_bt" ? "que publicam a separação e entram na soma" : "comparáveis"}` : ""}`
              : ""
          }.`,
          `${distribuidoras.length} distribution utilities with a balance in SAMP in some year${
            nComDado !== null && nComparaveis !== null
              ? `; ${nComDado} with a published value in this period, ${nComparaveis} of them comparable in this measure${nSoma !== null && medida.id !== "variacao" ? `; the national sum uses only the ${nSoma} ${medida.id === "tecnica" || medida.id === "pnt_bt" ? "concession holders that publish the separation and enter the sum" : "comparable concession holders"}` : ""}`
              : ""
          }.`,
        )}
        unidade={medida.unidade}
      />

      {/* o agregado das concessionárias, em texto: a faixa de métricas do alto já traz os mesmos números, por isso a resposta vem depois da figura */}
      {respostaGeral}

      {notas}
      {aposPrincipal}

      {/* território: o mapa das áreas de atuação, na mesma consulta */}
      <SecaoDoPainel id="perdas-territorio" titulo={tx("Onde ficam as áreas de cada faixa?", "Where are the areas of each range?")}>
        {valores ? (
          <PerdasMapa
            titulo={tx("Perdas de energia por área de distribuidora", "Energy losses by distribution utility area")}
            entidades={entidadesMapa}
            valores={valores}
            medida={medida}
            periodo={periodo.rotulo}
            selecionado={sel?.cnpj ?? null}
            onSelecionar={selecionar}
            urlMunicipios={urls.municipios}
            avisoTerritorio={avisoTerritorio(distribuidoras, periodo, anoRelacao, idioma)}
          />
        ) : (
          <div className="flex h-[380px] items-center justify-center border border-linha bg-superficie px-6 text-center text-sm text-carvao-muted sm:h-[540px]">
            {tx(<>O mapa de {periodo.ano} aparece quando a série anual terminar de carregar.</>, <>The {periodo.ano} map appears when the annual series finishes loading.</>)}
          </div>
        )}
        {limitacaoMapa}
      </SecaoDoPainel>

      {/* distribuidora escolhida: nome, resposta, prova e histórico */}
      <SecaoDoPainel id="perdas-selecao" titulo={tx("Qual é a situação da distribuidora escolhida?", "What is the situation of the chosen distribution utility?")}>
        <div data-selecao={sel?.cnpj ?? ""}>
          {!sel ? (
            <p className="text-sm text-carvao-muted">
              {tx(
                "Nenhuma. Escolha uma área no mapa, uma linha da tabela ou busque pelo nome; a escolha vai para o endereço da página e segue para os outros painéis de perdas.",
                "None. Choose an area on the map, a table row or search by name; the choice goes into the page address and carries over to the other loss panels.",
              )}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="font-serif text-lg text-carvao">
                {tx(
                  <>
                    {sel.sigla ? `${sel.sigla} · ` : ""}
                    {sel.nome}
                  </>,
                  <>
                    {sel.sigla ? <Nome>{sel.sigla}</Nome> : null}
                    {sel.sigla ? " · " : ""}
                    <Nome>{sel.nome}</Nome>
                  </>,
                )}
              </p>
              <p className="text-xs text-mineral">
                {tx(
                  <>
                    CNPJ {sel.cnpj_formatado} · {ROTULO_GRUPO[sel.grupo]} · série no SAMP de {mesAno(sel.primeira_competencia)} a {mesAno(sel.ultima_competencia)}
                    {sel.ativa ? "" : " (encerrada)"}
                    {sel.territorio
                      ? ` · área: ${num(sel.territorio.municipios, 0)} municípios (${num(sel.territorio.exclusivos, 0)} só dela, ${num(sel.territorio.compartilhados, 0)} compartilhados, ${num(sel.territorio.nao_confirmados, 0)} sem confirmação)`
                      : " · sem área na relação de municípios"}
                  </>,
                  <>
                    CNPJ {sel.cnpj_formatado} · {ROTULO_GRUPO[sel.grupo]} · SAMP series from {mesAno(sel.primeira_competencia, idioma)} to {mesAno(sel.ultima_competencia, idioma)}
                    {sel.ativa ? "" : " (ended)"}
                    {sel.territorio
                      ? ` · area: ${num(sel.territorio.municipios, 0, idioma)} municipalities (${num(sel.territorio.exclusivos, 0, idioma)} served only by it, ${num(sel.territorio.compartilhados, 0, idioma)} shared, ${num(sel.territorio.nao_confirmados, 0, idioma)} unconfirmed)`
                      : " · no area in the municipality relation"}
                  </>,
                )}
              </p>
              <p className="text-sm leading-relaxed text-carvao" data-resposta="distribuidora">
                {marcarNomes(respostaDistribuidora(sel, anoRef, idioma), [rotuloDistribuidora(sel), sel.nome, sel.sigla], idioma)}
              </p>
              <div className="flex flex-wrap items-center gap-x-6">
                {evidSel ? (
                  <ComproveNumero evidencia={evidSel} rotulo={tx(`Comprove a taxa de ${anoRef}`, `Verify the ${anoRef} rate`)} endereco={`https://scrutiniums.com/setor-eletrico/perdas?d=${sel.cnpj}#mapa`} />
                ) : cargaEvid.estado === "carregando" ? (
                  <span role="status" className="text-xs text-carvao-muted">
                    {tx(<>Carregando a evidência da taxa de {anoRef}.</>, <>Loading the evidence for the {anoRef} rate.</>)}
                  </span>
                ) : cargaEvid.estado === "erro" ? (
                  <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4" onClick={tentarEvid}>
                    {tx(<>Evidência não carregou ({cargaEvid.erro}); tentar de novo</>, <>The evidence did not load ({cargaEvid.erro}); try again</>)}
                  </button>
                ) : cargaEvid.estado === "pronto" ? (
                  <span className="text-xs text-carvao-muted">
                    {tx(
                      <>Sem evidência da taxa de {anoRef}: a distribuidora não tem taxa anual nesse ano.</>,
                      <>No evidence for the {anoRef} rate: the distribution utility has no annual rate in that year.</>,
                    )}
                  </span>
                ) : null}
                <LinkSemPrefetch href={`/setor-eletrico/perdas/composicao?d=${sel.cnpj}#composicao`} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {tx("Técnicas e não técnicas", "Technical and non-technical")}
                </LinkSemPrefetch>
                <LinkSemPrefetch href={`/setor-eletrico/perdas/regulatorio?d=${sel.cnpj}#regulatorio`} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {tx("Percentual técnico regulatório", "Regulatory technical percentage")}
                </LinkSemPrefetch>
                <LinkSemPrefetch href={`/setor-eletrico/perdas/custo-e-contexto?d=${sel.cnpj}#custo`} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {tx("Custo na tarifa e contexto", "Cost in the tariff and context")}
                </LinkSemPrefetch>
              </div>
              {historico ? (
                <div>
                  <GraficoLinhas
                    titulo={tx(`Taxa de perdas totais de ${rotuloDistribuidora(sel)} por ano`, `Total loss rate of ${rotuloDistribuidora(sel)} by year`)}
                    dados={historico.dados}
                    chaveX="ano" // i18n: dado
                    formatoX="texto"
                    series={[
                      { id: "taxa", rotulo: rotuloDistribuidora(sel), cor: "var(--cor-energia)", espessura: 2.5 }, // i18n: dado
                      { id: "brasil", rotulo: tx("Concessionárias (agregado)", "Concession holders (aggregate)"), sigla: tx("Agregado", "Aggregate"), cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="%"
                    casas={2}
                    zeroNoEixo
                    marcos={historico.mudancas.map((a) => ({ x: String(a), rotulo: tx(`${a}: quebra de escala ou absorção`, `${a}: scale break or absorption`) }))}
                    altura={260}
                  />
                  <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                    {tx("Só anos completos e sem alerta entram na linha (lacuna é ano fora, nunca zero).", "Only complete years with no alert enter the line (a gap is an excluded year, never zero).")}
                    {historico.fora.length
                      ? tx(` Fora: ${historico.fora.map((f) => `${f.ano} (${f.motivo})`).join("; ")}.`, ` Excluded: ${historico.fora.map((f) => `${f.ano} (${f.motivo})`).join("; ")}.`)
                      : tx(" Nenhum ano da série ficou fora.", " No year of the series was excluded.")}
                    {historico.mudancas.length
                      ? tx(
                          " As marcas verticais indicam anos com quebra de escala ou absorção provável: a taxa antes e depois descreve áreas diferentes.",
                          " The vertical marks indicate years with a scale break or probable absorption: the rate before and after describes different areas.",
                        )
                      : ""}
                  </p>
                </div>
              ) : cargaAnual.estado === "erro" ? (
                <p className="text-sm text-carvao">
                  {tx(<>O histórico não carregou ({cargaAnual.erro}).</>, <>The history did not load ({cargaAnual.erro}).</>)}{" "}
                  <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia" onClick={tentarAnual}>
                    {tx("Tentar de novo", "Try again")}
                  </button>
                </p>
              ) : (
                <p role="status" className="text-xs text-carvao-muted">
                  {tx("Carregando o histórico anual.", "Loading the annual history.")}
                </p>
              )}
              <button
                type="button"
                onClick={() => selecionar(null)}
                className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
              >
                {tx("Limpar a escolha", "Clear the choice")}
              </button>
            </div>
          )}
        </div>
      </SecaoDoPainel>

      {/* comparação de até quatro distribuidoras na mesma escala */}
      <SecaoDoPainel id="perdas-comparar" titulo={tx("Como cada distribuidora evoluiu? Compare até quatro", "How has each distribution utility evolved? Compare up to four")}>
        <Comparador
          rotulo={tx("Distribuidoras para comparar", "Distribution utilities to compare")}
          entidades={entidadesComp}
          chaveUrl="cmp"
          onMudar={setComparadas}
          dicaBusca={tx("Sigla, nome, CNPJ ou UF", "Acronym, name, CNPJ or state")}
          vazio={
            <p className="text-sm text-carvao-muted">
              {tx(
                "Escolha até quatro distribuidoras para ver a taxa de perdas totais de cada ano na mesma escala, com o agregado das concessionárias como referência.",
                "Choose up to four distribution utilities to see the total loss rate of each year on the same scale, with the aggregate of the concession holders as a reference.",
              )}
            </p>
          }
        >
          {(ctx) =>
            ctx.selecionadas.length === 0 ? null : anual ? (
              <div>
                <GraficoLinhas
                  titulo={tx(`Taxa de perdas totais: ${ctx.selecionadas.map((e) => e.rotulo).join(", ")}`, `Total loss rate: ${ctx.selecionadas.map((e) => e.rotulo).join(", ")}`)}
                  dados={serieComparacao(
                    ctx.selecionadas.map((e) => e.id),
                    anual,
                    nacional.filter((l) => l.universo === "concessionarias"),
                  )}
                  chaveX="ano" // i18n: dado
                  formatoX="texto"
                  series={[
                    ...ctx.selecionadas.map<SerieLinha>((e, i) => ({ id: e.id, rotulo: e.rotulo, cor: `var(--serie-comp-${i + 1})` })),
                    { id: "brasil", rotulo: tx("Concessionárias (agregado)", "Concession holders (aggregate)"), sigla: tx("Agregado", "Aggregate"), cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  unidade="%"
                  casas={2}
                  zeroNoEixo
                  legendaInterativa
                  escalaAoOcultar="manter"
                  altura={300}
                />
                <p className="mt-2 text-xs text-carvao-muted">
                  {tx(
                    "Mesma escala para todas. Cada linha só tem os anos completos e sem alerta da distribuidora; anos com quebra de escala ou absorção aparecem no histórico de cada uma, ao escolhê-la.",
                    "Same scale for all. Each line has only the distribution utility's complete years with no alert; years with a scale break or absorption appear in the history of each one when it is chosen.",
                  )}
                </p>
              </div>
            ) : (
              <p role="status" className="text-sm text-carvao-muted">
                {cargaAnual.estado === "erro"
                  ? tx(`A série anual não carregou (${cargaAnual.erro}).`, `The annual series did not load (${cargaAnual.erro}).`)
                  : tx("Carregando a série anual.", "Loading the annual series.")}
              </p>
            )
          }
        </Comparador>
      </SecaoDoPainel>

      {/* tabela de todas as distribuidoras: as mesmas linhas e classes do mapa */}
      <SecaoDoPainel id="perdas-tabela" titulo={tx("Qual é o valor de cada distribuidora?", "What is the value of each distribution utility?")}>
        {linhas ? (
          <TabelaInterativa
            key={`${periodo.id}-${medida.id}`}
            titulo={tx(`Distribuidoras, ${periodo.rotulo}`, `Distribution utilities, ${periodo.rotulo}`)}
            colunas={colunas}
            linhas={linhas}
            chaveLinha="id"
            colunaRotulo="distribuidora"
            fonte={tx(
              "ANEEL, SAMP Balanço (perdas totais, técnicas e não técnicas, energia injetada e mercado de baixa tensão)",
              "ANEEL, SAMP balance (total, technical and non-technical losses, injected energy and low-voltage market)",
            )}
            versao={versao}
            nomeArquivo={`perdas-distribuidoras-${periodo.id}-${medida.id}`}
            chaveUrl="tab"
            selecionado={sel?.cnpj ?? null}
            onSelecionar={selecionar}
            ordemInicial={{ coluna: "valor_mapa", direcao: "desc" }}
            dicaBusca={tx("Sigla, nome, CNPJ ou UF", "Acronym, name, CNPJ or state")}
            nota={tx(
              <>
                As colunas &quot;Classe no mapa&quot; e &quot;Valor no mapa&quot; são a tabela equivalente da figura e do mapa ({medida.rotulo.toLowerCase()}, {medida.unidade}). Valor fora da comparação
                aparece com o número da fonte e o motivo; célula vazia é ausência, nunca zero. A ordem inicial é o valor da medida, do maior para o menor.
              </>,
              <>
                The columns &quot;Class on the map&quot; and &quot;Value on the map&quot; are the equivalent table of the figure and the map ({medida.rotulo.toLowerCase()}, {medida.unidade}). A value excluded
                from the comparison appears with the source number and the reason; an empty cell is absence, never zero. The initial order is the value of the measure, from largest to smallest.
              </>,
            )}
          />
        ) : (
          <p role="status" className="text-sm text-carvao-muted">
            {tx(<>A tabela de {periodo.ano} aparece com a série anual.</>, <>The {periodo.ano} table appears with the annual series.</>)}
          </p>
        )}
      </SecaoDoPainel>
    </div>
  );
}
