/**
 * Leitura da gold de queimadas do Território e Clima (public/territorio/gold/queimadas.json),
 * gerada por pipeline/territorio/run.py. Focos de calor do satélite de referência do
 * INPE (AQUA_M-T) e área queimada AQ1km (provisória). Lida no build; nenhum número é
 * recalculado aqui além de ordenações e somas que o próprio arquivo confere.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GoldQueimadasMunicipios } from "./queimadasMunicipios";

export { CORTES_FOCOS_AREA, municipiosDeFocos, municipiosParaMetade, PISO_FOCOS_DENSIDADE, URL_QUEIMADAS_MUNICIPIOS } from "./queimadasMunicipios";
export type { FocosMunicipio, GoldQueimadasMunicipios, PeriodoMunicipal } from "./queimadasMunicipios";

export type Recorte = {
  rotulo: "ultimoAnoCompleto" | "acumuladoAnoCorrente" | "mesmoPeriodoAnoAnterior";
  periodo: { inicio: string; fim: string };
  focos: number | null;
  porUF?: { id: string; focos: number }[];
  porBioma?: { id: string; focos: number }[];
  motivo?: string;
};

export type GoldQueimadas = {
  capturadoEm: string;
  dataReferencia: string;
  fonte: { nome: string; url: string; portal: string; licenca: string };
  sateliteReferencia: { id: string; sensor: string; desde: string; antes: string };
  unidade: string;
  /** preliminar: ano encerrado montado dos arquivos mensais, antes do consolidado anual do INPE. */
  anual: { ano: number; focos: number | null; parcial: boolean; preliminar?: boolean; primeiroDia: string; ultimoDia: string | null; nota?: string }[];
  mensal: Record<string, { mes: string; focos: number | null; parcial: boolean; ultimoDiaComFoco?: string; motivo?: string }[] | null>;
  recortes: Recorte[];
  originais: Record<string, { sha256: string; bytes: number; lastModified: string | null }>;
  ressalvas: string[];
  areaQueimada?: {
    url: string;
    unidade: string;
    maturidade: string;
    mensal: { mes: string; km2: Record<string, number>; totalKm2: number }[];
    anual: { ano: number; km2: Record<string, number>; totalKm2: number; parcial: boolean; meses: number }[];
    ressalvas: string[];
  };
  comparacao: {
    periodoAtual: { inicio: string; fim: string };
    periodoAnterior: { inicio: string; fim: string };
    focosAtual: number;
    focosAnterior: number;
    variacaoPct: number;
    nota: string;
  } | null;
};

let cache: GoldQueimadas | null = null;

export function lerQueimadas(): GoldQueimadas {
  cache ??= JSON.parse(readFileSync(join(process.cwd(), "public", "territorio", "gold", "queimadas.json"), "utf-8")) as GoldQueimadas;
  return cache;
}

export function recorte(g: GoldQueimadas, rotulo: Recorte["rotulo"]): Recorte | undefined {
  return g.recortes.find((r) => r.rotulo === rotulo);
}

/** Siglas das UFs com o nome por extenso, para tabelas e rótulos acessíveis. */
export const NOME_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

let cacheMunicipios: GoldQueimadasMunicipios | null | undefined;

/** Gold municipal, lida no build; null quando o seed ainda não tem a contagem por município. */
export function lerQueimadasMunicipios(): GoldQueimadasMunicipios | null {
  if (cacheMunicipios === undefined) {
    const caminho = join(process.cwd(), "public", "territorio", "gold", "queimadas_municipios.json");
    cacheMunicipios = existsSync(caminho) ? (JSON.parse(readFileSync(caminho, "utf-8")) as GoldQueimadasMunicipios) : null;
  }
  return cacheMunicipios;
}

/** Área territorial do Censo 2022 por município (pipeline/territorio/referencia), a mesma que a gold municipal usa. */
export type ReferenciaAreas = {
  fonte: string;
  unidade: string;
  url: string;
  sha256: string;
  capturadoEm: string;
  /** Soma das áreas dos municípios de cada UF, em km², pela sigla. */
  porUf: Record<string, number>;
  /** Municípios da lista atual sem área nesta referência (instalados depois do Censo 2022). */
  semArea: { id: string; nome: string; uf: string }[];
};

let cacheAreas: ReferenciaAreas | undefined;

/** Área de cada UF somada das áreas municipais do Censo 2022. Lida no build; o navegador não recebe a lista municipal. */
export function lerAreasUf(): ReferenciaAreas {
  if (!cacheAreas) {
    const r = JSON.parse(readFileSync(join(process.cwd(), "pipeline", "territorio", "referencia", "municipios_ibge_2022.json"), "utf-8")) as {
      fonte: string; unidade: string; url: string; sha256: string; capturadoEm: string; campos: string[]; linhas: (string | number | null)[][];
    };
    const [iId, iNome, iUf, iArea] = ["id", "nome", "uf", "areaKm2"].map((c) => r.campos.indexOf(c));
    const porUf: Record<string, number> = {};
    const semArea: ReferenciaAreas["semArea"] = [];
    for (const l of r.linhas) {
      const uf = l[iUf] as string;
      const area = l[iArea];
      if (typeof area === "number" && area > 0) porUf[uf] = (porUf[uf] ?? 0) + area;
      else semArea.push({ id: l[iId] as string, nome: l[iNome] as string, uf });
    }
    cacheAreas = { fonte: r.fonte, unidade: r.unidade, url: r.url, sha256: r.sha256, capturadoEm: r.capturadoEm, porUf, semArea };
  }
  return cacheAreas;
}

export type DensidadeUf = { uf: string; nome: string; focos: number; areaKm2: number; porMilKm2: number };

/**
 * Focos por 1.000 km² em cada UF num recorte da gold (padrão: o último ano completo): focos da UF divididos pela área somada dos
 * seus municípios no Censo 2022, vezes 1.000. Ordenado da maior densidade para a menor. Focos sem UF reconhecida ficam fora da
 * lista e voltam em `semUf`, para a página dizer quantos são.
 */
export function densidadePorUf(g: GoldQueimadas, rotulo: Recorte["rotulo"] = "ultimoAnoCompleto"): { recorte: Recorte; itens: DensidadeUf[]; semUf: number } | null {
  const r = recorte(g, rotulo);
  if (!r?.porUF || r.focos === null) return null;
  const areas = lerAreasUf().porUf;
  const itens: DensidadeUf[] = [];
  let semUf = 0;
  for (const u of r.porUF) {
    const area = areas[u.id];
    if (!NOME_UF[u.id] || !(area > 0)) {
      semUf += u.focos;
      continue;
    }
    itens.push({ uf: u.id, nome: NOME_UF[u.id], focos: u.focos, areaKm2: area, porMilKm2: (1000 * u.focos) / area });
  }
  // a gold lista só UFs com foco e reconcilia com o total do recorte: UF ausente teve zero focos detectados (zero é valor)
  for (const uf of Object.keys(NOME_UF)) {
    if (!itens.some((x) => x.uf === uf) && areas[uf] > 0) itens.push({ uf, nome: NOME_UF[uf], focos: 0, areaKm2: areas[uf], porMilKm2: 0 });
  }
  itens.sort((a, b) => b.porMilKm2 - a.porMilKm2);
  return { recorte: r, itens, semUf };
}
