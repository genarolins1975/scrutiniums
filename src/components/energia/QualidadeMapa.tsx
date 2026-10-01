"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { quebrasFixas } from "@/lib/energia/escalas";
import { URL_GEO } from "@/lib/energia/geo";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import {
  CAMPO_DIST,
  CAMPO_MEDIDA,
  CAMPO_MUN,
  COLUNAS_MUNICIPIOS,
  CORES_MAPA,
  CORTES_MAPA,
  MEDIDAS_MAPA,
  ROTULO_MEDIDA,
  ROTULO_RELACAO,
  carregarUmaVez,
  linhasMunicipios,
  linhasSerieDistribuidoras,
  municipiosDoCsv,
  respostaMunicipio,
  valoresMapa,
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
 * do limite. "Comparar estas distribuidoras" leva a escolha para `?dist=`, lida pelos
 * pequenos múltiplos e pelo painel de limites. Voltar e avançar restauram tudo.
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
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const caixa = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(false);
  const [carga, setCarga] = useState<Carga>({ estado: "parado" });
  const [serie, setSerie] = useState<QualidadeSeriesDistribuidorasGold | null>(null);
  const [erroSerie, setErroSerie] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

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
    carregarUmaVez(urlMunicipios, (r) => r.text()).then(
      (t) => vivo && setCarga({ estado: "pronto", municipios: municipiosDoCsv(t) }),
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
  const linhas = useMemo(() => (municipios ? linhasMunicipios(municipios, rotuloCnpj) : []), [municipios]); // eslint-disable-line react-hooks/exhaustive-deps
  const med = ROTULO_MEDIDA[v.med];
  const selecionar = (id: string | null) => definir({ mun: id ?? "" });

  // os pequenos múltiplos e a comparação aceitam no máximo LIMITE_COMPARACAO distribuidoras
  const cnpjsSel = selecionado ? selecionado.cnpjs.slice(0, LIMITE_COMPARACAO) : [];
  const foraDaComparacao = selecionado ? Math.max(0, selecionado.cnpjs.length - LIMITE_COMPARACAO) : 0;
  const dadosDec = useMemo(() => (serie && cnpjsSel.length ? linhasSerieDistribuidoras(serie, cnpjsSel, "dec") : []), [serie, cnpjsSel.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <legend className="rotulo mb-1 text-mineral">Cor do mapa</legend>
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
            unidade={med.unidade}
            casas={2}
            rotuloRegiao={{ singular: "município", plural: "municípios" }}
            selecionado={v.mun || null}
            onSelecionar={selecionar}
            contornos
            periodo={String(ano)}
            nota="Valor do conjunto inteiro que atende o município, não medido no município. Hachura: município sem conjunto com DEC no ano ou não citado na base da ANEEL."
          />
        ) : carga.estado === "erro" ? (
          <div role="alert" className="border border-dashed border-mineral bg-papel p-4 text-sm text-carvao">
            <p>Não foi possível carregar os municípios ({carga.erro}).</p>
            <p className="mt-2">
              A mesma informação está no arquivo{" "}
              <a href={urlMunicipios} download className="text-energia-dark underline underline-offset-4">
                qualidade_municipios.csv
              </a>
              .{" "}
              <button type="button" className={BOTAO} onClick={() => setTentativa((t) => t + 1)}>
                Tentar de novo
              </button>
            </p>
          </div>
        ) : (
          <div className="flex h-[380px] flex-col items-start justify-center gap-3 border border-dashed border-linha bg-papel p-5 text-sm text-carvao-muted sm:h-[520px]">
            <p className="max-w-prose2">
              O mapa {totalMunicipios !== null ? `dos ${totalMunicipios.toLocaleString("pt-BR")} municípios do cadastro do IBGE ` : ""}usa a malha municipal do IBGE e o arquivo de
              municípios deste painel; os dois só são baixados quando o mapa aparece na tela.
            </p>
            {carga.estado === "carregando" ? (
              <p role="status">Carregando os municípios…</p>
            ) : (
              <button type="button" className={BOTAO} onClick={() => setAtivo(true)}>
                Carregar o mapa agora
              </button>
            )}
          </div>
        )}
      </div>

      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">{regra}</p>

      <section aria-live="polite" aria-label="Município escolhido" className="border-t border-linha pt-4">
        {selecionado ? (
          <div className="space-y-3">
            <h4 className="font-serif text-lg text-carvao">
              {selecionado.nome} ({selecionado.uf})
            </h4>
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="municipio">
              {respostaMunicipio(selecionado, ano)}
            </p>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="rotulo text-mineral">Relação com os conjuntos</dt>
                <dd className="text-carvao-muted">{ROTULO_RELACAO[selecionado.relacao]}</dd>
              </div>
              <div>
                <dt className="rotulo text-mineral">Conjuntos (código ANEEL)</dt>
                <dd className="break-words text-carvao-muted">{selecionado.conjuntos.length ? selecionado.conjuntos.join(", ") : "nenhum"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="rotulo text-mineral">Distribuidoras</dt>
                <dd className="text-carvao-muted">{selecionado.cnpjs.length ? selecionado.cnpjs.map(rotuloCnpj).join(", ") : "nenhuma com conjunto ativo no ano"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {selecionado.cnpjs.length > 0 && (
                <button type="button" className={BOTAO} onClick={() => definir({ dist: cnpjsSel })}>
                  Comparar {cnpjsSel.length === 1 ? "esta distribuidora" : "estas distribuidoras"} nos pequenos múltiplos
                </button>
              )}
              <button type="button" className={BOTAO} onClick={() => selecionar(null)}>
                Limpar município
              </button>
            </div>
            {foraDaComparacao > 0 && (
              <p className="text-xs text-carvao-muted">
                A comparação aceita até {LIMITE_COMPARACAO} distribuidoras: entram as {LIMITE_COMPARACAO} primeiras da lista; {foraDaComparacao}{" "}
                {foraDaComparacao === 1 ? "fica" : "ficam"} só na lista acima.
              </p>
            )}
            {selecionado.cnpjs.length > 0 &&
              (serie ? (
                <PequenosMultiplos
                  titulo={`DEC anual e limite das distribuidoras que atendem ${selecionado.nome}`}
                  dados={dadosDec}
                  chaveX="ano"
                  formatoX="texto"
                  unidade="h"
                  casas={2}
                  colunas={2}
                  nivelTitulo={4}
                  alturaPainel={130}
                  paineis={cnpjsSel.map((c) => ({
                    id: c,
                    titulo: rotuloCnpj(c),
                    series: [
                      { id: `dec_${c}`, rotulo: "DEC apurado", cor: "var(--cor-energia)" },
                      { id: `lim_${c}`, rotulo: "Limite", cor: "var(--serie-referencia)", tracejada: true },
                    ],
                    nota: serie.distribuidoras[c]?.quebras.length ? `perímetro mudou em ${serie.distribuidoras[c].quebras.join(", ")}` : undefined,
                  }))}
                />
              ) : erroSerie ? (
                <p role="alert" className="text-sm text-carvao">
                  Histórico indisponível ({erroSerie}); a série está em qualidade_distribuidoras_anual.csv.
                </p>
              ) : (
                <p role="status" className="text-sm text-carvao-muted">
                  Carregando o histórico das distribuidoras…
                </p>
              ))}
            <p className="text-xs text-carvao-muted">
              O histórico é da distribuidora inteira (todos os seus conjuntos), não do município: a fonte não publica série municipal.
            </p>
          </div>
        ) : (
          <p className="text-sm text-carvao-muted">Escolha um município no mapa, na busca do mapa ou na tabela para ver os conjuntos que o atendem e o histórico das distribuidoras.</p>
        )}
      </section>

      {municipios && (
        <TabelaInterativa
          titulo={`Municípios e conjuntos que os atendem, ${ano}`}
          colunas={COLUNAS_MUNICIPIOS}
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
          dicaBusca="Município, UF, distribuidora ou código IBGE"
          nota="DEC e FEC dos conjuntos inteiros; nenhuma média municipal é calculada."
        />
      )}
    </div>
  );
}
