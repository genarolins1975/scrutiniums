import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  Agregado,
  CompanhiaAberta,
  ControleSocietario,
  Ete,
  EteCatalogo,
  FichaMunicipio,
  JmpPaises,
  MetaSaneamento,
  Municipio,
  Prestador,
  ReguladorCatalogo,
  TabelaMunicipios,
} from "./tipos";
import { juntarComplemento, paraMunicipios } from "./municipios";

/**
 * Leitura da gold do Saneamento no servidor (build das páginas estáticas e
 * rotas dinâmicas de ficha). Arquivo ausente devolve null: a página mostra a
 * indisponibilidade, nunca um número de reserva.
 */
export const DIR_GOLD = join(process.cwd(), "public", "saneamento", "gold");
export const URL_GOLD = "/saneamento/gold";

const cache = new Map<string, { mtime: number; dado: unknown }>();

function ler<T>(nome: string): T | null {
  try {
    const caminho = join(DIR_GOLD, nome);
    const mtime = statSync(caminho).mtimeMs;
    const c = cache.get(nome);
    if (c && c.mtime === mtime) return c.dado as T;
    const dado = JSON.parse(readFileSync(caminho, "utf-8")) as T;
    cache.set(nome, { mtime, dado });
    return dado;
  } catch {
    return null;
  }
}

export function meta(): MetaSaneamento | null {
  return ler<MetaSaneamento>("meta.json");
}

export function agregados(): Agregado[] {
  return ler<Agregado[]>("agregados.json") ?? [];
}

export function agregado(id: string): Agregado | null {
  return agregados().find((a) => a.id === id) ?? null;
}

export function tabelaMunicipios(): TabelaMunicipios | null {
  return ler<TabelaMunicipios>("municipios.json");
}

let municipiosCache: { fonte: TabelaMunicipios; lista: Municipio[] } | null = null;
export function municipios(): Municipio[] {
  const t = tabelaMunicipios();
  if (!t) return [];
  if (municipiosCache?.fonte === t) return municipiosCache.lista;
  const lista = paraMunicipios(t);
  municipiosCache = { fonte: t, lista };
  return lista;
}

/** Tabela do capítulo 2 (Censo 2022 por grupo), em arquivo próprio para não pesar municipios.json. */
export const URL_DESIGUALDADES_MUNICIPIOS = `${URL_GOLD}/desigualdades_municipios.json`;

let desigualdadesCache: { fonte: TabelaMunicipios; lista: Municipio[] } | null = null;
export function municipiosComDesigualdades(): Municipio[] {
  const extra = ler<TabelaMunicipios>("desigualdades_municipios.json");
  if (!extra) return municipios();
  if (desigualdadesCache?.fonte === extra) return desigualdadesCache.lista;
  const lista = juntarComplemento(municipios(), extra);
  desigualdadesCache = { fonte: extra, lista };
  return lista;
}

/** Tabela do capítulo 3 (SISAGUA, qualidade da água), também em arquivo próprio. */
export const URL_QUALIDADE_MUNICIPIOS = `${URL_GOLD}/qualidade_municipios.json`;

let qualidadeCache: { fonte: TabelaMunicipios; lista: Municipio[] } | null = null;
export function municipiosComQualidade(): Municipio[] {
  const extra = ler<TabelaMunicipios>("qualidade_municipios.json");
  if (!extra) return municipios();
  if (qualidadeCache?.fonte === extra) return qualidadeCache.lista;
  const lista = juntarComplemento(municipios(), extra);
  qualidadeCache = { fonte: extra, lista };
  return lista;
}

/** Tabela do capítulo 13 (SIH e SIM, saúde e ambiente), em arquivo próprio. */
export const URL_SAUDE_MUNICIPIOS = `${URL_GOLD}/saude_municipios.json`;

let saudeCache: { fonte: TabelaMunicipios; lista: Municipio[] } | null = null;
export function municipiosComSaude(): Municipio[] {
  const extra = ler<TabelaMunicipios>("saude_municipios.json");
  if (!extra) return municipios();
  if (saudeCache?.fonte === extra) return saudeCache.lista;
  const lista = juntarComplemento(municipios(), extra);
  saudeCache = { fonte: extra, lista };
  return lista;
}

export function municipio(id: string): Municipio | null {
  return municipios().find((m) => m.id === id) ?? null;
}

export function fichaMunicipio(id: string): FichaMunicipio | null {
  const m = municipio(id);
  if (!m) return null;
  const uf = ler<Record<string, FichaMunicipio>>(`uf/${m.uf}.json`);
  return uf?.[id] ?? null;
}

export function prestadores(): Prestador[] {
  return ler<Prestador[]>("prestadores.json") ?? [];
}

export function prestador(id: string): Prestador | null {
  return prestadores().find((p) => p.id === id) ?? null;
}

export function jmpPaises(): JmpPaises {
  return ler<JmpPaises>("jmp_paises.json") ?? { paises: [], brasil: [] };
}

export function controleSocietario(): CompanhiaAberta[] {
  return ler<ControleSocietario>("controle_societario.json")?.companhias ?? [];
}

export function controleDoPrestador(id: string): CompanhiaAberta | null {
  return controleSocietario().find((c) => c.prestador === id) ?? null;
}

export function reguladores(): ReguladorCatalogo[] {
  return ler<ReguladorCatalogo[]>("reguladores.json") ?? [];
}

export function etes(): EteCatalogo[] {
  return ler<EteCatalogo[]>("etes.json") ?? [];
}

/** 1 l/s durante um ano = 31,536 mil m³: a mesma conversão com que a gold calcula a utilização (pipeline/observatorio_saneamento/gold.py). */
const MIL_M3_ANO_POR_LS = 31.536;

/**
 * Volume tratado acima da capacidade nominal anual, comparado sem arredondar: `utilizacao_pct` é publicado com uma casa e leva
 * 100,0127% e 100,0012% a "100,0", que um teste `> 100` deixaria de contar. Nulo quando falta volume ou capacidade.
 */
export function acimaDaCapacidade(e: Pick<Ete, "capacidade_nominal_ls" | "volume_tratado_mil_m3">): boolean | null {
  const { capacidade_nominal_ls: cap, volume_tratado_mil_m3: vol } = e;
  if (cap == null || cap <= 0 || vol == null) return null;
  return vol > cap * MIL_M3_ANO_POR_LS;
}

/** Todas as fichas municipais, lidas UF a UF (só no build das páginas que precisam do detalhe técnico). */
export function fichas(): FichaMunicipio[] {
  const ufs = [...new Set(municipios().map((m) => m.uf))].sort();
  return ufs.flatMap((uf) => Object.values(ler<Record<string, FichaMunicipio>>(`uf/${uf}.json`) ?? {}));
}
