/**
 * Leitura da gold de queimadas do Território e Clima (public/territorio/gold/queimadas.json),
 * gerada por pipeline/territorio/run.py. Focos de calor do satélite de referência do
 * INPE (AQUA_M-T) e área queimada AQ1km (provisória). Lida no build; nenhum número é
 * recalculado aqui além de ordenações e somas que o próprio arquivo confere.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  anual: { ano: number; focos: number | null; parcial: boolean; primeiroDia: string; ultimoDia: string | null; nota?: string }[];
  mensal: Record<string, { mes: string; focos: number | null; parcial: boolean; ultimoDiaComFoco?: string; motivo?: string }[] | null>;
  recortes: Recorte[];
  originais: Record<string, { sha256: string; bytes: number; lastModified: string | null }>;
  ressalvas: string[];
  areaQueimada?: {
    url: string;
    unidade: string;
    maturidade: string;
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
