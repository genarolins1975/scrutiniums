"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LinkSemPrefetch from "@/components/energia/LinkSemPrefetch";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { QualidadeEscala } from "@/components/energia/QualidadeEscala";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { quebrasFixas } from "@/lib/energia/escalas";
import { num } from "@/lib/energia/formato";
import { REGRA_MAPA_QUALIDADE_EN, traduzOuMarca } from "@/lib/energia/i18n/qualidade-perdas";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";
import { URL_GEO } from "@/lib/energia/geo";
import type { EscalaPaineis } from "@/lib/energia/series-temporais";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import {
  CAMPO_DIST,
  CAMPO_MEDIDA,
  CAMPO_MUN,
  CORES_MAPA,
  CORTES_MAPA,
  MEDIDAS_MAPA,
  ROTA_COMPARAR_DISTRIBUIDORAS,
  carregarMunicipios,
  carregarUmaVez,
  colunasMunicipios,
  linhasMunicipios,
  linhasSerieDistribuidoras,
  orientacaoSemDado,
  respostaMunicipio,
  rotulosMedida,
  rotulosRelacao,
  textoCorDoMapa,
  unidadeIndicador,
  valoresMapa,
  type AvisosFec,
  type MedidaMapa,
  type MunicipioQualidade,
} from "@/lib/energia/qualidade";
import type { QualidadeSeriesDistribuidorasGold } from "@/lib/energia/tipos-qualidade";

/**
 * P051, mapa: cada município pintado pelo DEC (ou FEC) dos conjuntos elétricos que o
 * atendem segundo a base IndQual Município da ANEEL. O dado é do conjunto, não do
 * município: com vários conjuntos, o mapa mostra o maior ou o menor deles (a pessoa
 * escolhe), nunca uma média municipal, que exigiria saber quantas unidades de cada
 * conjunto ficam no município (a base não informa; seção 8.3).
 *
 * Seleção sincronizada: clicar no mapa, escolher na busca do mapa ou numa linha da
 * tabela grava `?mun=` na URL; o mapa acende o município, a tabela marca a linha e o
 * quadro ao lado mostra os conjuntos, as distribuidoras e o histórico anual delas diante
 * do limite, em DEC e em FEC, cada um no seu bloco. "Comparar estas distribuidoras" leva a escolha para
 * `?dist=` na página Comparar distribuidoras, lida pelos pequenos múltiplos e pelo painel de limites. Os conjuntos do município, com
 * o limite de cada um, ficam na resposta da busca no alto da página (a mesma escolha `?mun=`), para a tabela não aparecer duas vezes. Voltar e avançar restauram tudo.
 *
 * Peso: a malha municipal (1,3 MB), o CSV de municípios (o mesmo arquivo de download)
 * e as séries por distribuidora só são buscados quando o mapa chega perto da tela ou
 * quando a pessoa pede; até lá a caixa tem altura fixa e o texto diz o que vai aparecer.
 */

const ESQUEMA = { mun: CAMPO_MUN, med: CAMPO_MEDIDA, dist: CAMPO_DIST };

type Carga = { estado: "parado" } | { estado: "carregando" } | { estado: "pronto"; municipios: MunicipioQualidade[] } | { estado: "erro"; erro: string };

const BOTAO =
  "inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

export function QualidadeMapa({
  ano,
  urlMunicipios,
  urlSerie,
  distribuidoras,
  regra,
  totalMunicipios,
  fonte,
  versao,
  avisosFec = {},
}: {
  ano: number;
  urlMunicipios: string;
  urlSerie: string;
  /** CNPJ e nome exibido de cada distribuidora da gold (para nomear as do município). */
  distribuidoras: { cnpj: string; rotulo: string }[];
  /** Regra de atribuição publicada pelo pipeline (gold.mapa.regra). */
  regra: string;
  /** Municípios do cadastro do IBGE conferidos pelo pipeline (gold.mapa.correspondencia.cadastro_ibge). */
  totalMunicipios: number | null;
  fonte: string;
  versao: string;
  /** Distribuidoras cujo FEC do ano é de cobertura parcial (nota no histórico do FEC). */
  avisosFec?: AvisosFec;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const ROTULO_MEDIDA = rotulosMedida(idioma);
  const caixa = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(false);
  const [carga, setCarga] = useState<Carga>({ estado: "parado" });
  const [serie, setSerie] = useState<QualidadeSeriesDistribuidorasGold | null>(null);
  const [erroSerie, setErroSerie] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [escala, setEscala] = useState<EscalaPaineis>("compartilhada");

  const nomes = useMemo(() => new Map(distribuidoras.map((d) => [d.cnpj, d.rotulo])), [distribuidoras]);
  const rotuloCnpj = (c: string) => nomes.get(c) ?? `CNPJ ${c}`;

  // liga o mapa quando ele chega perto da tela (ou quando o link já traz um município)
  useEffect(() => {
    if (ativo) return;
    if (v.mun) {
      setAtivo(true);
      return;
    }
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setAtivo(true);
      return;
    }
    const obs = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setAtivo(true);
          obs.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ativo, v.mun]);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    setCarga({ estado: "carregando" });
    carregarMunicipios(urlMunicipios).then(
      (municipios) => vivo && setCarga({ estado: "pronto", municipios }),
      (e: unknown) => vivo && setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [ativo, urlMunicipios, tentativa]);

  const municipios = carga.estado === "pronto" ? carga.municipios : null;
  const selecionado = municipios && v.mun ? (municipios.find((m) => m.cod === v.mun) ?? null) : null;

  // séries das distribuidoras só quando um município é escolhido
  useEffect(() => {
    if (!selecionado || serie) return;
    let vivo = true;
    carregarUmaVez(urlSerie, (r) => r.json() as Promise<QualidadeSeriesDistribuidorasGold>).then(
      (s) => vivo && setSerie(s),
      (e: unknown) => vivo && setErroSerie(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [selecionado, serie, urlSerie]);

  const ind = v.med.startsWith("dec") ? "dec" : "fec";
  const valores = useMemo(() => (municipios ? valoresMapa(municipios, v.med) : {}), [municipios, v.med]);
  const classificacao = useMemo(() => quebrasFixas(CORTES_MAPA[ind], Object.values(valores), { casas: 0 }), [ind, valores]);
  const linhas = useMemo(() => (municipios ? linhasMunicipios(municipios, rotuloCnpj, idioma) : []), [municipios, idioma]); // eslint-disable-line react-hooks/exhaustive-deps
  const med = ROTULO_MEDIDA[v.med];
  const selecionar = (id: string | null) => definir({ mun: id ?? "" });
  // o valor do município é o de um conjunto (o maior ou o menor entre os que o atendem): a dica, a linha Seleção e a tabela dizem entre quantos
  const detalheMunicipio = useMemo(() => {
    if (!municipios) return undefined;
    const porCodigo = new Map(municipios.map((m) => [m.cod, m]));
    const maior = v.med.endsWith("max");
    return (id: string): string | null => {
      const n = porCodigo.get(id)?.conjuntos.length ?? 0;
      if (n === 0) return null;
      if (n === 1) return tx("valor do conjunto que atende o município", "value of the consumer set serving the municipality");
      return tx(
        `${maior ? "maior" : "menor"} valor entre os ${num(n, 0)} conjuntos que atendem o município`,
        `${maior ? "highest" : "lowest"} value among the ${num(n, 0, idioma)} consumer sets serving the municipality`,
      );
    };
  }, [municipios, v.med, idioma]); // eslint-disable-line react-hooks/exhaustive-deps

  // os pequenos múltiplos e a comparação aceitam no máximo LIMITE_COMPARACAO distribuidoras
  const cnpjsSel = selecionado ? selecionado.cnpjs.slice(0, LIMITE_COMPARACAO) : [];
  const foraDaComparacao = selecionado ? Math.max(0, selecionado.cnpjs.length - LIMITE_COMPARACAO) : 0;
  const dadosDec = useMemo(() => (serie && cnpjsSel.length ? linhasSerieDistribuidoras(serie, cnpjsSel, "dec") : []), [serie, cnpjsSel.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const dadosFec = useMemo(() => (serie && cnpjsSel.length ? linhasSerieDistribuidoras(serie, cnpjsSel, "fec") : []), [serie, cnpjsSel.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <legend className="rotulo mb-1 text-mineral">{tx("Cor do mapa", "Map color")}</legend>
        {MEDIDAS_MAPA.map((m: MedidaMapa) => (
          <label key={m} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
            <input type="radio" name="qualidade-medida-mapa" value={m} checked={v.med === m} onChange={() => definir({ med: m })} className="h-4 w-4 accent-energia" />
            {ROTULO_MEDIDA[m].curto}
          </label>
        ))}
      </fieldset>

      <div ref={caixa} className="min-h-[380px] sm:min-h-[520px]">
        {carga.estado === "pronto" ? (
          <MapaCoropletico
            titulo={`${med.rotulo}, ${ano}`}
            fonteGeometria={URL_GEO.municipios}
            valores={valores}
            cores={CORES_MAPA}
            classificacao={classificacao}
            unidade={tx(
              `${med.unidade}, ${v.med.endsWith("max") ? "maior" : "menor"} entre os conjuntos do município`,
              `${med.unidade}, ${v.med.endsWith("max") ? "highest" : "lowest"} among the municipality's consumer sets`,
            )}
            casas={2}
            rotuloRegiao={tx({ singular: "município", plural: "municípios" }, { singular: "municipality", plural: "municipalities" })}
            selecionado={v.mun || null}
            onSelecionar={selecionar}
            detalheRegiao={detalheMunicipio}
            contornos
            periodo={String(ano)}
            nota={tx(
              "Valor do conjunto inteiro que atende o município, não medido no município. Hachura: município sem conjunto com DEC no ano ou não citado na base da ANEEL.",
              "Value of the whole consumer set serving the municipality, not measured in the municipality. Hatching: municipality with no consumer set with DEC in the year or not listed in the ANEEL database.",
            )}
          />
        ) : carga.estado === "erro" ? (
          <div role="alert" className="border border-dashed border-mineral bg-papel p-4 text-sm text-carvao">
            <p>{tx(<>Não foi possível carregar os municípios ({carga.erro}).</>, <>The municipalities could not be loaded ({carga.erro}).</>)}</p>
            <p className="mt-2">
              {tx("A mesma informação está no arquivo", "The same information is in the file")}{" "}
              <a href={urlMunicipios} download className="text-energia-dark underline underline-offset-4">
                {tx("DEC e FEC dos conjuntos por município (CSV)", "DEC and FEC of the consumer sets by municipality (CSV)")}
              </a>
              .{" "}
              <button type="button" className={BOTAO} onClick={() => setTentativa((t) => t + 1)}>
                {tx("Tentar de novo", "Try again")}
              </button>
            </p>
          </div>
        ) : (
          <div className="flex h-[380px] flex-col items-start justify-center gap-3 border border-dashed border-linha bg-papel p-5 text-sm text-carvao-muted sm:h-[520px]">
            <p className="max-w-prose2">
              {tx(
                <>
                  O mapa {totalMunicipios !== null ? `dos ${totalMunicipios.toLocaleString("pt-BR")} municípios do cadastro do IBGE ` : ""}usa a malha municipal do IBGE e o arquivo de
                  municípios deste painel; os dois só são baixados quando o mapa aparece na tela.
                </>,
                <>
                  The map {totalMunicipios !== null ? `of the ${totalMunicipios.toLocaleString("en-US")} municipalities in the IBGE registry ` : ""}uses the IBGE municipal grid and this
                  panel&apos;s municipality file; both are downloaded only when the map appears on screen.
                </>,
              )}
            </p>
            {carga.estado === "carregando" ? (
              <p role="status">{tx("Carregando os municípios…", "Loading the municipalities…")}</p>
            ) : (
              <button type="button" className={BOTAO} onClick={() => setAtivo(true)}>
                {tx("Carregar o mapa", "Load the map")}
              </button>
            )}
          </div>
        )}
      </div>

      {selecionado && (
        <p className="text-sm text-carvao" data-ir-para-ficha="">
          {tx(
            <>
              {selecionado.nome} ({selecionado.uf}) escolhido.
            </>,
            <>
              <Nome>{selecionado.nome}</Nome> ({selecionado.uf}) selected.
            </>,
          )}{" "}
          <a href="#municipio-escolhido" className="text-energia-dark underline underline-offset-4">
            {tx("Ver os conjuntos, o limite de cada um e o histórico, logo abaixo", "See the consumer sets, the limit of each one and the history, just below")}
          </a>
          .
        </p>
      )}

      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{traduzOuMarca(regra, REGRA_MAPA_QUALIDADE_EN, idioma, "regra-mapa-qualidade")}</p>

      <section id="municipio-escolhido" aria-live="polite" aria-label={tx("Município escolhido", "Selected municipality")} className="scroll-mt-28 border-t border-linha pt-4">
        {selecionado ? (
          <div className="space-y-3">
            <h4 className="font-serif text-lg text-carvao">
              <Nome>{selecionado.nome}</Nome> ({selecionado.uf})
            </h4>
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="municipio">
              {respostaMunicipio(selecionado, ano, idioma)}
            </p>
            {orientacaoSemDado(selecionado, idioma) && (
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-orientacao="sem-dado">
                {orientacaoSemDado(selecionado, idioma)}{" "}
                <LinkSemPrefetch href="/setor-eletrico/conta-de-luz" className="text-energia-dark underline underline-offset-4">
                  {tx("Abrir a Conta de luz", "Open the Electricity bill page")}
                </LinkSemPrefetch>
                .
              </p>
            )}
            {textoCorDoMapa(selecionado, v.med, idioma) && (
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-cor-mapa="">
                {textoCorDoMapa(selecionado, v.med, idioma)}
              </p>
            )}
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="rotulo text-mineral">{tx("Relação com os conjuntos", "Relation to the consumer sets")}</dt>
                <dd className="text-carvao-muted">{rotulosRelacao(idioma)[selecionado.relacao]}</dd>
              </div>
              <div>
                <dt className="rotulo text-mineral">{tx("Conjuntos (código ANEEL)", "Consumer sets (ANEEL code)")}</dt>
                <dd className="break-words text-carvao-muted">{selecionado.conjuntos.length ? selecionado.conjuntos.join(", ") : tx("nenhum", "none")}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="rotulo text-mineral">{tx("Distribuidoras", "Distribution utilities")}</dt>
                <dd className="text-carvao-muted">{selecionado.cnpjs.length ? selecionado.cnpjs.map(rotuloCnpj).join(", ") : tx("nenhuma com conjunto ativo no ano", "none with an active consumer set in the year")}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {selecionado.cnpjs.length > 0 && (
                <LinkSemPrefetch href={`${ROTA_COMPARAR_DISTRIBUIDORAS}?dist=${cnpjsSel.join(",")}#comparar-distribuidoras`} className={BOTAO}>
                  {tx(
                    <>Comparar {cnpjsSel.length === 1 ? "esta distribuidora" : "estas distribuidoras"} com o próprio limite</>,
                    <>Compare {cnpjsSel.length === 1 ? "this distribution utility" : "these distribution utilities"} with its own limit</>,
                  )}
                </LinkSemPrefetch>
              )}
              <button type="button" className={BOTAO} onClick={() => selecionar(null)}>
                {tx("Limpar município", "Clear municipality")}
              </button>
            </div>
            {foraDaComparacao > 0 && (
              <p className="text-sm text-carvao-muted">
                {tx(
                  <>
                    A comparação aceita até {LIMITE_COMPARACAO} distribuidoras: entram as {LIMITE_COMPARACAO} primeiras da lista; {foraDaComparacao}{" "}
                    {foraDaComparacao === 1 ? "fica" : "ficam"} só na lista acima.
                  </>,
                  <>
                    The comparison accepts up to {LIMITE_COMPARACAO} distribution utilities: the first {LIMITE_COMPARACAO} in the list are included; {foraDaComparacao}{" "}
                    {foraDaComparacao === 1 ? "stays" : "stay"} only in the list above.
                  </>,
                )}
              </p>
            )}
            {selecionado.conjuntos.length > 0 && (
              <p className="text-sm">
                <a href="#busca-municipio" className="text-energia-dark underline underline-offset-4">
                  {tx(
                    <>Os conjuntos que atendem {selecionado.nome}, com o limite de cada um, estão na resposta do alto da página ↑</>,
                    <>
                      The consumer sets serving <Nome>{selecionado.nome}</Nome>, with the limit of each one, are in the answer at the top of the page ↑
                    </>,
                  )}
                </a>
              </p>
            )}
            {selecionado.cnpjs.length > 1 && serie && <QualidadeEscala valor={escala} onMudar={setEscala} />}
            {selecionado.cnpjs.length > 0 &&
              (serie ? (
                <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2 [&>*]:min-w-0">
                  {(["dec", "fec"] as const).map((ind) => (
                    <PequenosMultiplos
                      key={ind}
                      titulo={tx(
                        `${ind === "dec" ? "DEC" : "FEC"} anual e limite das distribuidoras que atendem ${selecionado.nome}`,
                        `Annual ${ind === "dec" ? "DEC" : "FEC"} and limit of the distribution utilities serving ${selecionado.nome}`,
                      )}
                      dados={ind === "dec" ? dadosDec : dadosFec}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      unidade={unidadeIndicador(ind, idioma)}
                      casas={2}
                      colunas={2}
                      nivelTitulo={4}
                      alturaPainel={130}
                      escala={escala}
                      paineis={cnpjsSel.map((c) => ({
                        id: c,
                        titulo: `${rotuloCnpj(c)}, ${ind === "dec" ? "DEC" : "FEC"}`,
                        series: [
                          { id: `${ind}_${c}`, rotulo: ind === "dec" ? tx("DEC apurado", "Assessed DEC") : tx("FEC apurado", "Assessed FEC"), cor: "var(--cor-energia)" }, // i18n: dado
                          { id: `lim_${c}`, rotulo: tx("Limite", "Limit"), cor: "var(--serie-referencia)", tracejada: true },
                        ],
                        nota:
                          [
                            serie.distribuidoras[c]?.quebras.length
                              ? tx(`perímetro mudou em ${serie.distribuidoras[c].quebras.join(", ")}`, `perimeter changed in ${serie.distribuidoras[c].quebras.join(", ")}`)
                              : null,
                            ind === "fec" && avisosFec[c] ? tx(`${avisosFec[c].ano}: FEC de cobertura parcial`, `${avisosFec[c].ano}: FEC with partial coverage`) : null,
                          ]
                            .filter(Boolean)
                            .join("; ") || undefined,
                      }))}
                    />
                  ))}
                </div>
              ) : erroSerie ? (
                <p role="alert" className="text-sm text-carvao">
                  {tx(
                    <>Histórico indisponível ({erroSerie}); a série anual por distribuidora está no CSV da lista de downloads do painel.</>,
                    <>History unavailable ({erroSerie}); the annual series by distribution utility is in the CSV in the panel&apos;s download list.</>,
                  )}
                </p>
              ) : (
                <p role="status" className="text-sm text-carvao-muted">
                  {tx("Carregando o histórico das distribuidoras…", "Loading the history of the distribution utilities…")}
                </p>
              ))}
            {cnpjsSel.filter((c) => avisosFec[c]).map((c) => (
              <p key={c} role="note" data-aviso="fec-cobertura-parcial" className="max-w-prose2 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao">
                {avisosFec[c].frase}
              </p>
            ))}
            <p className="text-sm text-carvao-muted">
              {tx(
                "O histórico é da distribuidora inteira (todos os seus conjuntos), não do município: a fonte não publica série municipal.",
                "The history is that of the whole distribution utility (all its consumer sets), not of the municipality: the source does not publish a municipal series.",
              )}
            </p>
          </div>
        ) : (
          <p className="text-sm text-carvao-muted">
            {tx(
              "Escolha um município no mapa, na busca do mapa ou na tabela para ver os conjuntos que o atendem e o histórico das distribuidoras.",
              "Choose a municipality on the map, in the map search or in the table to see the consumer sets serving it and the history of the distribution utilities.",
            )}
          </p>
        )}
      </section>

      {municipios && (
        <TabelaInterativa
          titulo={tx(`Municípios e conjuntos que os atendem, ${ano}`, `Municipalities and the consumer sets serving them, ${ano}`)}
          colunas={colunasMunicipios(idioma)}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="municipio"
          fonte={fonte}
          versao={versao}
          nomeArquivo="qualidade-municipios"
          chaveUrl="tmun"
          ordemInicial={{ coluna: v.med, direcao: "desc" }}
          selecionado={v.mun || null}
          onSelecionar={selecionar}
          dicaBusca={tx("Município, UF, distribuidora ou código IBGE", "Municipality, state (UF), distribution utility or IBGE code")}
          nota={tx("DEC e FEC dos conjuntos inteiros; nenhuma média municipal é calculada.", "DEC and FEC of the whole consumer sets; no municipal average is calculated.")}
        />
      )}
    </div>
  );
}
