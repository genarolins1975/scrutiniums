import { lerGold } from "./gold";
import { tx } from "./idioma";
import type { CatalogoDados, ManifestoGold } from "./tipos-dados";

/**
 * Datasets integrados: slug público → identificador interno do pipeline, golds
 * que consome, páginas que o exibem e downloads. Espelha INTEGRADOS de
 * pipeline/energia/catalogo.py (o teste energia-gold-contrato confere).
 */
export type DatasetIntegrado = {
  slug: string;
  interno: string;
  catalogoId: string;
  paginas: { rotulo: string; href: string }[];
  downloads: string[];
};

/* os rótulos das páginas são os do português (dado); a página inglesa os traduz pela tabela de painéis (PAINEIS_EN) */
const DATASETS_ESTATICOS: DatasetIntegrado[] = [
  // i18n: dado
  { slug: "ccee-pld-horario", interno: "ccee_pld_horario", catalogoId: "ccee:pld_horario", paginas: [{ rotulo: "PLD", href: "/setor-eletrico/pld" }, { rotulo: "Rede", href: "/setor-eletrico/rede" }, { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral" }], downloads: ["/energia/series/pld_horario.csv", "/energia/series/pld_diario.csv"] },
  // i18n: dado
  { slug: "ons-ear-subsistema", interno: "ear_subsistema_di", catalogoId: "ons:ear-diario-por-subsistema", paginas: [{ rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima" }, { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral" }, { rotulo: "PLD (formação)", href: "/setor-eletrico/pld#formacao" }], downloads: ["/energia/series/ear_diario.csv"] },
  // i18n: dado
  { slug: "ons-ena-subsistema", interno: "ena_subsistema_di", catalogoId: "ons:ena-diario-por-subsistema", paginas: [{ rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima" }, { rotulo: "Água e clima: afluência", href: "/setor-eletrico/agua-e-clima/afluencia#p018" }, { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral" }, { rotulo: "PLD (formação)", href: "/setor-eletrico/pld#formacao" }], downloads: ["/energia/series/ena_diario.csv"] },
  // i18n: dado
  { slug: "ons-carga-diaria", interno: "carga_energia_di", catalogoId: "ons:carga-energia", paginas: [{ rotulo: "Carga", href: "/setor-eletrico/carga" }, { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral" }, { rotulo: "PLD (formação)", href: "/setor-eletrico/pld#formacao" }], downloads: ["/energia/series/carga_diaria.csv"] },
  // i18n: dado
  { slug: "ons-balanco-energia", interno: "balanco_energia_subsistema_ho", catalogoId: "ons:balanco-energia-subsistema", paginas: [{ rotulo: "Geração", href: "/setor-eletrico/geracao" }, { rotulo: "Rede", href: "/setor-eletrico/rede" }, { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral" }, { rotulo: "PLD", href: "/setor-eletrico/pld" }], downloads: ["/energia/series/geracao_diaria.csv"] },
  // i18n: dado
  { slug: "ons-intercambio", interno: "intercambio_nacional_ho", catalogoId: "ons:intercambio-nacional", paginas: [{ rotulo: "Rede", href: "/setor-eletrico/rede" }, { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral" }, { rotulo: "PLD", href: "/setor-eletrico/pld" }], downloads: ["/energia/series/intercambio_diario.csv"] },
  // i18n: dado
  { slug: "ons-cmo-semanal", interno: "cmo_se", catalogoId: "ons:cmo-semanal", paginas: [{ rotulo: "PLD (formação)", href: "/setor-eletrico/pld#cmo" }, { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral" }], downloads: ["/energia/series/cmo_semanal.csv"] },
];

const URL_CONJUNTO: Record<string, string> = {
  ONS: "https://dados.ons.org.br/dataset/",
  ANEEL: "https://dadosabertos.aneel.gov.br/dataset/",
  CCEE: "https://dadosabertos.ccee.org.br/dataset/",
};

/**
 * Página oficial de um conjunto do catálogo. Para caber no limite da gold, o catálogo
 * omite a URL quando ela é a do portal seguida do nome (campo `compactacao` do arquivo).
 */
export function urlDoConjunto(e: { id: string; orgao: string; url?: string | null }): string | null {
  if (e.url) return e.url;
  const base = URL_CONJUNTO[e.orgao];
  return base ? base + e.id.slice(e.id.indexOf(":") + 1) : null;
}

/** Catálogo publicado (catalogo.json), lido no build. */
export function catalogoDados(): CatalogoDados | null {
  const c = lerGold<CatalogoDados>("catalogo.json");
  return c && c.disponivel ? c : null;
}

/**
 * Conjuntos integrados pelos módulos temáticos: vêm do catálogo publicado
 * (catalogo.json), que os recebe do REGISTRO de cada módulo do pipeline. A mesma
 * declaração alimenta o catálogo, a página Dados e esta lista; não há cópia à mão.
 */
function integradosDeModulos(): DatasetIntegrado[] {
  const cat = catalogoDados();
  const fixos = new Set(DATASETS_ESTATICOS.map((d) => d.slug));
  return (cat?.entradas ?? [])
    // integrado de fato: a escada chegou pelo menos a INTEGRADO (recurso só verificado não conta)
    .filter((e) => e.slug && e.interno && !fixos.has(e.slug) && ["INTEGRADO", "VALIDADO", "PUBLICADO"].includes(e.estado))
    .map((e) => ({ slug: e.slug!, interno: e.interno!, catalogoId: e.id, paginas: e.paginas ?? [], downloads: e.downloads ?? [] }));
}

export const DATASETS_INTEGRADOS: DatasetIntegrado[] = [...DATASETS_ESTATICOS, ...integradosDeModulos()];

export function datasetPorSlug(slug: string) {
  return DATASETS_INTEGRADOS.find((d) => d.slug === slug);
}

/** Colunas e unidade de cada arquivo publicado pela plataforma (CSV com ";" e ponto decimal; vazio = ausência), no idioma da página. */
const colunasEstaticas = (): Record<string, string> =>
  tx(
    {
      "/energia/series/pld_horario.csv":
        "data_hora_local: data e hora no horário de Brasília (AAAA-MM-DDTHH:MM); SE, S, NE, N: PLD de cada submercado naquela hora, em R$/MWh nominais.",
      "/energia/series/pld_diario.csv":
        "data: dia (AAAA-MM-DD); SE, S, NE, N: média simples das 24 horas do PLD, em R$/MWh nominais, calculada pela Scrutiniums; dias sem as 24 horas ficam de fora.",
      "/energia/series/ear_diario.csv":
        "data: dia; SE, S, NE, N: energia armazenada em % da EAR máxima, como publicada pelo ONS; SIN_calculado: soma das EAR dividida pela soma das máximas, calculada pela Scrutiniums.",
      "/energia/series/ena_diario.csv":
        "data: dia; colunas _pct_mlt: ENA bruta em % da MLT; colunas _mwmed: ENA bruta em energia (o dicionário do ONS descreve a unidade como MWmês); SIN calculado pela Scrutiniums.",
      "/energia/series/carga_diaria.csv":
        "data: dia; SE, S, NE, N: carga em MWmed, como publicada pelo ONS; SIN_calculado: soma dos quatro subsistemas.",
      "/energia/series/geracao_diaria.csv":
        "data: dia; hidraulica, termica, eolica e solar por região (SIN, SE, S, NE, N): média diária da geração verificada horária, em MWmed.",
      "/energia/series/intercambio_diario.csv":
        "data: dia; fluxo_: intercâmbio verificado médio do dia por fronteira, em MWmed, positivo no sentido indicado no nome (N_NE = do Norte para o Nordeste); programado_: valor programado pelo ONS.",
      "/energia/series/cmo_semanal.csv":
        "semana_operativa: data de referência da semana operativa informada pelo ONS; para cada subsistema, CMO semanal e por patamar de carga (leve, média, pesada), em R$/MWh.",
    },
    {
      "/energia/series/pld_horario.csv":
        "data_hora_local: date and time in Brasília time (YYYY-MM-DDTHH:MM); SE, S, NE, N: PLD of each submarket in that hour, in nominal R$/MWh.",
      "/energia/series/pld_diario.csv":
        "data: day (YYYY-MM-DD); SE, S, NE, N: simple average of the 24 hourly PLD values, in nominal R$/MWh, computed by Scrutiniums; days without all 24 hours are left out.",
      "/energia/series/ear_diario.csv":
        "data: day; SE, S, NE, N: stored energy as % of the maximum EAR, as published by the ONS; SIN_calculado: sum of the EAR divided by the sum of the maximums, computed by Scrutiniums.",
      "/energia/series/ena_diario.csv":
        "data: day; _pct_mlt columns: gross ENA as % of the MLT; _mwmed columns: gross ENA in energy (the ONS dictionary describes the unit as MWmês); SIN computed by Scrutiniums.",
      "/energia/series/carga_diaria.csv":
        "data: day; SE, S, NE, N: load in MWavg, as published by the ONS; SIN_calculado: sum of the four subsystems.",
      "/energia/series/geracao_diaria.csv":
        "data: day; hidraulica, termica, eolica and solar by region (SIN, SE, S, NE, N): daily average of verified hourly generation, in MWavg.",
      "/energia/series/intercambio_diario.csv":
        "data: day; fluxo_: average verified interchange of the day by border, in MWavg, positive in the direction shown in the name (N_NE = from the North to the Northeast); programado_: value scheduled by the ONS.",
      "/energia/series/cmo_semanal.csv":
        "semana_operativa: reference date of the operating week reported by the ONS; for each subsystem, weekly CMO and by load level (light, medium, heavy), in R$/MWh.",
    },
  );

/** Dicionário dos arquivos dos módulos temáticos, publicado pelo pipeline (arquivos.json). */
type ArquivosGold = { arquivos: Record<string, { colunas: string; modulo: string; gold: string }> };

/**
 * Colunas de cada arquivo: as dos arquivos fixos acima (lidas na hora, no idioma da página) e as do dicionário publicado pelo
 * pipeline (texto da gold, em português), que prevalece quando descreve o mesmo arquivo.
 */
export const COLUNAS_ARQUIVO: Record<string, string> = (() => {
  const doPipeline = Object.fromEntries(Object.entries(lerGold<ArquivosGold>("arquivos.json")?.arquivos ?? {}).map(([url, a]) => [url, a.colunas]));
  const out: Record<string, string> = {};
  for (const url of Object.keys(colunasEstaticas())) {
    if (url in doPipeline) continue;
    Object.defineProperty(out, url, { get: () => colunasEstaticas()[url], enumerable: true, configurable: true });
  }
  return Object.assign(out, doPipeline);
})();

/* ---------------------------------------------------------------- versão exata no GitHub (P069) */

export const REPOSITORIO = "https://github.com/genarolins1975/scrutiniums";

/**
 * Commit do código que gerou o build: VERCEL_GIT_COMMIT_SHA na Vercel, GITHUB_SHA num
 * build do GitHub Actions. Fora desses ambientes não há commit conhecido (null): a
 * página aponta o histórico do arquivo, e o sha256 do manifesto identifica a versão.
 */
export function commitDoBuild(env: Record<string, string | undefined> = process.env): string | null {
  const sha = env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || "";
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : null;
}

/**
 * Link permanente para um arquivo publicado (/energia/...) na versão exata do build;
 * sem commit conhecido, o histórico do arquivo no ramo principal (exata = false). Nunca
 * um link temporário: o conteúdo do commit não muda.
 */
export function urlVersaoGithub(caminho: string, commit: string | null = commitDoBuild()): { url: string; exata: boolean } {
  const c = caminho.startsWith("/") ? caminho : `/${caminho}`;
  if (commit) return { url: `${REPOSITORIO}/blob/${commit}/public${c}`, exata: true };
  return { url: `${REPOSITORIO}/commits/main/public${c}`, exata: false };
}

/** Manifesto da publicação (sha256 de cada arquivo e id da publicação). */
export function manifestoPublicacao(): ManifestoGold | null {
  const m = lerGold<ManifestoGold>("manifesto.json");
  return m && m.disponivel ? m : null;
}
