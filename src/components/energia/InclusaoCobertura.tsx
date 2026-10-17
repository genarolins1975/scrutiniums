"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { InclusaoOpcoes } from "@/components/energia/InclusaoOpcoes";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { NAO_SE_APLICA, quebrasFixas, type ValorClassificavel } from "@/lib/energia/escalas";
import { URL_GEO, type CamadaGeo } from "@/lib/energia/geo";
import { txEm } from "@/lib/energia/i18n/conta-inclusao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import {
  ESQUEMA_COBERTURA,
  codigoUf,
  colunasCoberturaUf,
  colunasMunicipios,
  dadosSerieCobertura,
  itensFaixaCobertura,
  linhasCoberturaUf,
  mes as mesEm,
  municipiosDoCsv,
  siglaDoCodigo,
  valoresMapaCobertura,
  type Denominador,
  type MunicipioCobertura,
} from "@/lib/energia/inclusao";
import type { CoberturaUf, SerieCoberturaMensal } from "@/lib/energia/tipos-inclusao";

/**
 * P060, cobertura potencial (PROXY): faturas com Tarifa Social por 100 famílias
 * do Cadastro Único com renda por pessoa até meio salário mínimo. O mapa, a faixa
 * por UF (cadastro atualizado e todas as cadastradas) e a tabela compartilham a UF
 * selecionada na URL; o mapa municipal (malha de 1,3 MB e CSV de 450 KB) só é
 * carregado quando alguém pede.
 *
 * Os cortes do mapa (40, 60, 80 e 100 por 100 famílias) são os mesmos nas UF e nos
 * municípios e coincidem com as faixas do histograma publicado na gold: a mesma cor
 * quer dizer a mesma faixa nos dois mapas. Acima de 100 não é erro: o numerador
 * inclui beneficiários fora do critério de renda.
 */

const CORTES = [40, 60, 80, 100];
const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
function opcoesDen(tx: <T>(pt: T, en: T) => T): readonly (readonly [Denominador, string])[] {
  return [
    ["atualizadas", tx("Famílias com cadastro atualizado", "Families with an updated record")],
    ["cadastradas", tx("Todas as famílias cadastradas", "All registered families")],
  ];
}

/** "cadastro atualizado" / "todas as cadastradas", o denominador escolhido no título do mapa. */
function nomeDen(den: Denominador, tx: <T>(pt: T, en: T) => T): string {
  return den === "atualizadas" ? tx("cadastro atualizado", "updated record") : tx("todas as cadastradas", "all registered");
}

export function InclusaoCoberturaUf({
  ufs,
  mes: mesRef,
  fonte,
  resposta,
  recorte,
  notas,
}: {
  ufs: CoberturaUf[];
  mes: string;
  fonte: string;
  /** Resposta curta do painel, ao lado do denominador do mapa (a figura vem primeiro, e a ressalva fica junto dela). */
  resposta?: ReactNode;
  recorte?: ReactNode;
  notas?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const mes = (m: string | null | undefined) => mesEm(m, idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_COBERTURA);
  const sel = ufs.some((u) => u.uf === v.uf) ? v.uf : null;
  const valores = useMemo(() => valoresMapaCobertura(ufs, v.den), [ufs, v.den]);
  const classes = useMemo(() => quebrasFixas(CORTES, Object.values(valores), { casas: 0 }), [valores]);
  const linhas = useMemo(() => linhasCoberturaUf(ufs, idioma), [ufs, idioma]);
  const itens = useMemo(() => itensFaixaCobertura(ufs, idioma), [ufs, idioma]);
  const selecionar = (uf: string | null) => definir({ uf: uf ?? "" });
  const porCem = tx("faturas por 100 famílias", "bills per 100 families");
  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {resposta}
        <InclusaoOpcoes rotulo={tx("Denominador do mapa", "Map denominator")} nome="inclusao-cob-den" opcoes={opcoesDen(tx)} valor={v.den} onMudar={(den) => definir({ den })} />
      </div>
      <MapaCoropletico
        titulo={tx(
          `Faturas com Tarifa Social por 100 famílias até ½ salário mínimo (${nomeDen(v.den, tx)}), por UF, ${mes(mesRef)}`,
          `Bills with Tarifa Social per 100 families with up to ½ minimum wage (${nomeDen(v.den, tx)}), by state, ${mes(mesRef)}`,
        )}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES}
        classificacao={classes}
        unidade={porCem}
        casas={1}
        rotuloRegiao={tx({ singular: "UF", plural: "UF" }, { singular: "state", plural: "states" })}
        selecionado={sel ? codigoUf(sel) : null}
        onSelecionar={(id) => selecionar(siglaDoCodigo(id))}
        rotulos
        periodo={mes(mesRef)}
        nota={tx(
          `Proxy, não taxa de cobertura: fatura não é família. Cortes fixos em ${CORTES.join(", ")}, os mesmos do mapa municipal.`,
          `Proxy, not a coverage rate: a bill is not a family. Fixed cuts at ${CORTES.join(", ")}, the same as the municipal map.`,
        )}
      />
      <GraficoPontos
        titulo={tx(`Faixa de sensibilidade ao denominador por UF, ${mes(mesRef)}`, `Sensitivity band to the denominator by state, ${mes(mesRef)}`)}
        itens={itens}
        unidade={porCem}
        unidadeDiferenca={tx("pontos", "points")}
        casas={1}
        rotuloValor={tx("Por 100 famílias com cadastro atualizado", "Per 100 families with an updated record")}
        rotuloReferencia={tx("Por 100 famílias cadastradas (todas)", "Per 100 registered families (all)")}
        corValor="var(--cor-energia)" // i18n: dado
        corReferencia="var(--serie-referencia)"
        zeroNoEixo
        ordemInicial={{ por: "valor", direcao: "desc" }} // i18n: dado
        selecionado={sel}
        onSelecionar={selecionar}
      />
      <TabelaInterativa
        titulo={tx(`Faturas e famílias por UF, ${mes(mesRef)} (proxy)`, `Bills and families by state, ${mes(mesRef)} (proxy)`)}
        colunas={colunasCoberturaUf(idioma)}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={mesRef}
        nomeArquivo="inclusao-cobertura-proxy-uf"
        chaveUrl="cob.tab"
        ordemInicial={{ coluna: "razao_atualizadas", direcao: "desc" }}
        selecionado={sel}
        onSelecionar={selecionar}
        dicaBusca={tx("Nome ou sigla da UF", "State name or abbreviation")}
        nota={tx(
          "Numerador e denominador do mesmo mês. Famílias atualizadas: cadastro dentro do prazo de atualização exigido para a concessão (requisitos na regra de elegibilidade, modo Auditar).",
          "Numerator and denominator from the same month. Updated families: record within the update deadline required for granting (requirements in the eligibility rule, Audit mode).",
        )}
      />
      {recorte}
      {notas}
    </div>
  );
}

// requisições sob demanda, compartilhadas pelas instâncias; falha não fica em cache
const cache = new Map<string, Promise<unknown>>();
function carregar<T>(url: string, tipo: "json" | "texto"): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (tipo === "json" ? r.json() : r.text()) as Promise<T>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export function InclusaoSerieCobertura({ url, unidade }: { url: string; unidade: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const mes = (m: string | null | undefined) => mesEm(m, idioma);
  const [serie, setSerie] = useState<SerieCoberturaMensal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    carregar<SerieCoberturaMensal>(url, "json").then(
      (j) => vivo && setSerie(j),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [url]);
  const dados = useMemo(() => (serie ? dadosSerieCobertura(serie.serie) : []), [serie]);
  if (erro) {
    return (
      <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
        {tx(`Não foi possível carregar a série mensal (${erro}). O mesmo dado está em`, `The monthly series could not be loaded (${erro}). The same data is in the`)}{" "}
        <a href="/energia/series/inclusao_cobertura_mensal.csv" download className="text-energia-dark underline underline-offset-4">
          {tx("série mensal da cobertura (CSV)", "monthly coverage series (CSV)")}
        </a>
        .
      </p>
    );
  }
  if (!serie) {
    return (
      <p role="status" className="text-sm text-carvao-muted">
        {tx("Carregando a série mensal nacional (JSON publicado com a gold)…", "Loading the national monthly series (JSON published with the gold file)…")}
      </p>
    );
  }
  return (
    <GraficoLinhas
      titulo={tx(
        `UC com Tarifa Social por 100 famílias até ½ salário mínimo, Brasil, ${mes(serie.serie[0]?.m)} a ${mes(serie.serie.at(-1)?.m)} (proxy)`,
        `Consumer units with Tarifa Social per 100 families with up to ½ minimum wage, Brazil, ${mes(serie.serie[0]?.m)} to ${mes(serie.serie.at(-1)?.m)} (proxy)`,
      )}
      dados={dados}
      chaveX="m"
      formatoX="mes"
      series={[
        {
          id: "atualizadas",
          rotulo: tx("Por 100 famílias com cadastro atualizado", "Per 100 families with an updated record"),
          sigla: tx("Atualizadas", "Updated"),
          cor: "var(--cor-energia)", // i18n: dado
        },
        {
          id: "cadastradas",
          rotulo: tx("Por 100 famílias cadastradas (todas)", "Per 100 registered families (all)"),
          sigla: tx("Cadastradas", "Registered"),
          cor: "var(--serie-referencia)",
          tracejada: true,
        },
      ]}
      banda={{
        inferior: "cadastradas", // i18n: dado
        superior: "atualizadas", // i18n: dado
        rotulo: tx("Faixa de sensibilidade ao denominador (não é margem de erro)", "Sensitivity band to the denominator (not a margin of error)"),
      }}
      unidade={unidade}
      casas={1}
      zeroNoEixo
      zoom
      altura={300}
    />
  );
}

/** Código de 7 dígitos da malha a partir dos 6 dígitos do Cadastro Único (prefixo; nenhuma regra de dígito verificador). */
function mapaCodigos(geo: CamadaGeo): Map<string, string> {
  return new Map(geo.features.map((f) => [f.id.slice(0, 6), f.id]));
}

export function InclusaoMunicipiosCobertura({ csvUrl, mes: mesRef, fonte }: { csvUrl: string; mes: string; fonte: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const mes = (m: string | null | undefined) => mesEm(m, idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_COBERTURA);
  const [dados, setDados] = useState<{ geo: CamadaGeo; mun: MunicipioCobertura[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = v.mun;
  // seleção municipal na URL (cob.msel), como a da UF: o link copiado e o voltar do navegador trazem o mesmo município
  const selecionar = (id: string | null) => definir({ msel: id ?? "" });

  useEffect(() => {
    if (!ativo || dados) return;
    let vivo = true;
    setErro(null);
    Promise.all([carregar<CamadaGeo>(URL_GEO.municipios, "json"), carregar<string>(csvUrl, "texto")]).then(
      ([geo, txt]) => vivo && setDados({ geo, mun: municipiosDoCsv(txt) }),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [ativo, dados, csvUrl]);

  const montado = useMemo(() => {
    const tx = txEm(idioma);
    if (!dados) return null;
    const cod7 = mapaCodigos(dados.geo);
    const valores: Record<string, ValorClassificavel> = {};
    const linhas = dados.mun.map((m) => {
      const id = cod7.get(m.cod6) ?? m.cod6;
      valores[id] = m.base_pequena ? NAO_SE_APLICA : v.den === "atualizadas" ? m.razao_atualizadas : m.razao_cadastradas;
      return {
        id,
        municipio: m.municipio,
        uf: m.uf,
        faturas: m.faturas,
        atualizadas: m.atualizadas,
        razao_atualizadas: m.razao_atualizadas,
        razao_cadastradas: m.razao_cadastradas,
        base: m.base_pequena ? tx("base pequena (fora da distribuição)", "small base (outside the distribution)") : tx("base suficiente", "sufficient base"),
      };
    });
    const semGeometria = dados.mun.filter((m) => !cod7.has(m.cod6)).length;
    return { valores, linhas, semGeometria, classes: quebrasFixas(CORTES, Object.values(valores), { casas: 0 }) };
  }, [dados, v.den, idioma]);
  const sel = montado && v.msel && montado.linhas.some((l) => l.id === v.msel) ? v.msel : null;

  if (!ativo) {
    return (
      <div className="flex flex-wrap items-center gap-3 border border-dashed border-linha px-4 py-3">
        <p className="max-w-prose2 text-sm text-carvao-muted">
          {tx(
            "O mapa municipal usa a malha de municípios do IBGE e o CSV de municípios, os dois arquivos mais pesados do módulo; eles só são baixados quando pedidos.",
            "The municipal map uses IBGE's municipal boundaries and the municipalities CSV, the two heaviest files of the module; they are only downloaded when requested.",
          )}
        </p>
        <button
          type="button"
          onClick={() => definir({ mun: true })}
          className="rotulo inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-carvao hover:bg-energia-fundo"
        >
          {tx("Carregar o mapa por município", "Load the map by municipality")}
        </button>
      </div>
    );
  }
  if (erro) {
    return (
      <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
        {tx(`Não foi possível carregar o mapa municipal (${erro}). Os mesmos números estão em`, `The municipal map could not be loaded (${erro}). The same numbers are in`)}{" "}
        <a href={csvUrl} download className="text-energia-dark underline underline-offset-4">
          {tx("famílias e faturas por município (CSV)", "families and bills by municipality (CSV)")}
        </a>
        .
      </p>
    );
  }
  if (!dados || !montado) {
    return (
      <p role="status" className="text-sm text-carvao-muted">
        {tx("Carregando a malha municipal e o CSV de municípios…", "Loading the municipal boundaries and the municipalities CSV…")}
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <MapaCoropletico
        titulo={tx(
          `Faturas com Tarifa Social por 100 famílias até ½ salário mínimo (${nomeDen(v.den, tx)}), por município, ${mes(mesRef)}`,
          `Bills with Tarifa Social per 100 families with up to ½ minimum wage (${nomeDen(v.den, tx)}), by municipality, ${mes(mesRef)}`,
        )}
        geometria={dados.geo}
        valores={montado.valores}
        cores={CORES}
        classificacao={montado.classes}
        unidade={tx("faturas por 100 famílias", "bills per 100 families")}
        casas={1}
        rotuloRegiao={tx({ singular: "município", plural: "municípios" }, { singular: "municipality", plural: "municipalities" })}
        selecionado={sel}
        onSelecionar={selecionar}
        corNaoSeAplica="var(--mapa-nao-se-aplica)"
        periodo={mes(mesRef)}
        nota={tx(
          `Cinza liso: base pequena no denominador, fora da distribuição (o limite está nas limitações de \u201cSobre este dado\u201d). Município da fatura é o da unidade consumidora; o do cadastro é o da residência declarada.${montado.semGeometria ? ` ${montado.semGeometria} municípios do CSV sem polígono na malha ficam só na tabela.` : ""}`,
          `Plain gray: small base in the denominator, outside the distribution (the limit is in the limitations of \u201cAbout this data\u201d). The municipality of the bill is that of the consumer unit; that of the registry is the declared residence.${montado.semGeometria ? ` ${montado.semGeometria} municipalities in the CSV without a polygon in the boundaries appear only in the table.` : ""}`,
        )}
      />
      <TabelaInterativa
        titulo={tx(`Municípios: faturas e famílias, ${mes(mesRef)} (proxy)`, `Municipalities: bills and families, ${mes(mesRef)} (proxy)`)}
        colunas={colunasMunicipios(idioma)}
        linhas={montado.linhas}
        chaveLinha="id"
        colunaRotulo="municipio"
        fonte={fonte}
        versao={mesRef}
        nomeArquivo="inclusao-cobertura-proxy-municipios"
        chaveUrl="cob.mtab"
        ordemInicial={{ coluna: "razao_atualizadas", direcao: "asc" }}
        selecionado={sel}
        onSelecionar={selecionar}
        dicaBusca={tx("Nome do município", "Municipality name")}
        nota={tx(
          "Ordem inicial: menor razão primeiro. Razão baixa não prova exclusão: famílias não titulares da conta e sem ligação à rede contam no denominador.",
          "Initial order: lowest ratio first. A low ratio does not prove exclusion: families that do not hold the account and without a grid connection count in the denominator.",
        )}
      />
    </div>
  );
}
