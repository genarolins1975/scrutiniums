import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { numero, SEM_DADO } from "./formato";

/**
 * Capítulo 7.1 do Saneamento: dívida e alavancagem das prestadoras de água e esgoto com demonstrações na CVM.
 * Lê no servidor a gold de pipeline/saneamento_divida (public/saneamento/divida). Arquivo ausente devolve null: a
 * página mostra a indisponibilidade, nunca um número de reserva. Valores em milhares de reais nominais, como a gold.
 */

export const DIR_DIVIDA = join(process.cwd(), "public", "saneamento", "divida");
export const URL_DIVIDA = "/saneamento/divida";
export const ROTA_DIVIDA = "/saneamento/prestadores/divida";

export type Motivo = Partial<Record<"ebitda" | "dl_ebitda" | "dl_pl" | "parcela_cp" | "cobertura", string>>;

export type PontoDivida = {
  data: string;
  periodo: string;
  fonte: "DFP" | "ITR";
  escopo: "con" | "ind";
  versao?: number;
  inicio_resultado?: string | null;
  retido?: string;
  ativo_total: number | null;
  divida_bruta: number | null;
  divida_cp: number | null;
  divida_lp: number | null;
  emprestimos: number | null;
  debentures: number | null;
  arrendamento: number | null;
  sem_abertura: string[];
  caixa: number | null;
  divida_liquida: number | null;
  patrimonio_liquido: number | null;
  ebitda: number | null;
  despesas_financeiras: number | null;
  dl_ebitda: number | null;
  dl_pl: number | null;
  parcela_cp: number | null;
  cobertura: number | null;
  motivos: Motivo;
  documento?: { versao: number; recebido_em: string; link: string } | null;
};

export type CompanhiaDivida = {
  cnpj: string;
  nome: string;
  papel: "operadora" | "holding";
  municipios_declarados: number;
  holdings: { cnpj: string; nome: string }[];
  controladas: { cnpj: string; nome: string }[];
  registro: { denominacao: string | null; cd_cvm: string | null; situacao: string | null; cancelado_em: string | null; setor: string | null };
  primeiro_periodo: string | null;
  ultimo: PontoDivida | null;
  anual: PontoDivida[];
  trimestral: PontoDivida[];
};

export type ArquivoOriginal = { fonte: string; ano: number; url: string; sha256: string; bytes: number; last_modified: string | null };

export type GoldDivida = {
  versao: number;
  unidade: string;
  capturado_em: string;
  hash_dados: string;
  fontes: {
    cadastro: { url: string; sha256: string; bytes: number; last_modified: string | null; pagina: string };
    dfp: { pagina: string; primeiro_ano: number; arquivos: ArquivoOriginal[] };
    itr: { pagina: string; primeiro_ano: number; arquivos: ArquivoOriginal[] };
  };
  criterio: { operadora: string; holding: string };
  referencia_trimestral: string | null;
  ultima_dfp: string | null;
  companhias: CompanhiaDivida[];
  inconsistencias: { cnpj: string; nome: string; fonte: string; data: string; motivo: string }[];
  exclusoes: { cnpj: string; nome: string; fonte: string; data: string; motivo: string }[];
  fora_do_recorte: { cnpj: string; denominacao: string; setor: string; situacao: string; motivo: string }[];
};

export type ResumoDivida = {
  capturado_em: string;
  companhias: number;
  operadoras: number;
  holdings: number;
  primeiro_ano: string | null;
  ultima_dfp: string | null;
  referencia_trimestral: string | null;
  hash_dados: string;
};

const cache = new Map<string, { mtime: number; dado: unknown }>();

function ler<T>(nome: string): T | null {
  try {
    const caminho = join(DIR_DIVIDA, nome);
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

export function goldDivida(): GoldDivida | null {
  return ler<GoldDivida>("divida.json");
}

export function resumoDivida(): ResumoDivida | null {
  return ler<ResumoDivida>("resumo.json");
}

/** Companhias com ao menos um ponto válido (as demais só aparecem no método, com o motivo). */
export function comPonto(g: GoldDivida): CompanhiaDivida[] {
  return g.companhias.filter((c) => c.ultimo);
}

/** "2T2026" → "2º trimestre de 2026"; "2025" → "2025". */
export function periodoPorExtenso(p: string | null | undefined): string {
  const t = /^(\d)T(\d{4})$/.exec(p ?? "");
  return t ? `${t[1]}º trimestre de ${t[2]}` : p ?? SEM_DADO;
}

/** Milhares de reais → "R$ 51,7 bi" ou "R$ 749 mi". */
export function reaisDeMil(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return SEM_DADO;
  const reais = v * 1000;
  const a = Math.abs(reais);
  const s = reais < 0 ? "−" : "";
  if (a >= 1e9) return `${s}R$ ${numero(a / 1e9, 1)} bi`;
  if (a >= 1e6) return `${s}R$ ${numero(a / 1e6, 0)} mi`;
  return `${s}R$ ${numero(a / 1e3, 0)} mil`;
}

/** Milhares de reais → milhões de reais (número para tabelas e gráficos). */
export function milhoes(v: number | null | undefined): number | null {
  return v == null || !Number.isFinite(v) ? null : v / 1000;
}

export function vezes(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return SEM_DADO;
  return `${numero(v, casas).replace(/^-/, "−")} vezes`;
}

export function mediana(vs: number[]): number | null {
  const o = vs.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!o.length) return null;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export const ROTULO_PAPEL: Record<CompanhiaDivida["papel"], string> = {
  operadora: "Prestadora",
  holding: "Holding de grupo",
};

export const ROTULO_ESCOPO: Record<PontoDivida["escopo"], string> = {
  con: "consolidada",
  ind: "individual",
};

/**
 * Fotografia na data de referência: as operadoras com ponto válido exatamente nessa data. Somas e mediana só sobre
 * elas; holdings ficam fora porque consolidam operadoras que já estão na lista.
 */
export function fotografia(g: GoldDivida) {
  const ref = g.referencia_trimestral;
  const operadoras = comPonto(g).filter((c) => c.papel === "operadora" && c.ultimo!.data === ref);
  const soma = (k: "divida_bruta" | "divida_cp" | "divida_liquida" | "ebitda") =>
    operadoras.every((c) => c.ultimo![k] != null) ? operadoras.reduce((s, c) => s + (c.ultimo![k] as number), 0) : null;
  const razoes = operadoras.map((c) => c.ultimo!.dl_ebitda).filter((v): v is number => v != null);
  const bruta = soma("divida_bruta");
  const cp = soma("divida_cp");
  return {
    referencia: ref,
    operadoras,
    semRazao: operadoras.filter((c) => c.ultimo!.dl_ebitda == null),
    dividaBruta: bruta,
    dividaCp: cp,
    parcelaCp: bruta && cp != null ? (cp / bruta) * 100 : null,
    medianaDlEbitda: mediana(razoes),
    comRazao: razoes.length,
  };
}
