/**
 * Formatação da coleção Varejo, no padrão brasileiro. Ausência é sempre texto ("sem dado"), nunca zero; variação leva sinal
 * tipográfico; pontos percentuais e variação percentual têm escritas diferentes.
 */

export const SEM_DADO = "sem dado";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function num(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "−");
}

/** "+1,7%", "−0,8%", "0,0%". */
export function variacao(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  const arred = Number(v.toFixed(casas));
  return `${arred > 0 ? "+" : ""}${num(arred, casas)}%`;
}

/** "+4,9 p.p.": diferença entre duas variações, em pontos percentuais. */
export function pontos(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  const arred = Number(v.toFixed(casas));
  return `${arred > 0 ? "+" : ""}${num(arred, casas)} p.p.`;
}

export function pct(v: number | null | undefined, casas = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? SEM_DADO : `${num(v, casas)}%`;
}

/** "2026-09" → "setembro de 2026". */
export function mesExtenso(mes: string): string {
  const [a, m] = mes.split("-");
  const nome = MESES[Number(m) - 1];
  return nome ? `${nome} de ${a}` : mes;
}

/** "2026-09" → "set/2026". */
export function mesCurto(mes: string): string {
  const [a, m] = mes.split("-");
  const nome = MESES_CURTOS[Number(m) - 1];
  return nome ? `${nome}/${a}` : mes;
}

/** Data de captura "2026-11-23T20:05:03Z" → "23/11/2026" (calendário de Brasília). */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "data não informada";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
}

/** Valor da PAC, que vem em mil reais, em R$ trilhões ou bilhões. */
export const trilhoes = (milReais: number | null | undefined, casas = 2) => (milReais == null ? SEM_DADO : num(milReais / 1e9, casas));
export const bilhoes = (milReais: number | null | undefined, casas = 1) => (milReais == null ? SEM_DADO : num(milReais / 1e6, casas));
export const milhoesDe = (v: number | null | undefined, casas = 1) => (v == null ? SEM_DADO : num(v / 1e6, casas));

/** Verbo do achado, decidido sobre o valor já arredondado (0,04 com uma casa é estabilidade, não alta). */
export function direcao(v: number | null | undefined, casas = 1): "alta" | "queda" | "estavel" | "ausente" {
  if (v === null || v === undefined || !Number.isFinite(v)) return "ausente";
  const arred = Number(v.toFixed(casas));
  return arred > 0 ? "alta" : arred < 0 ? "queda" : "estavel";
}

export const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/* ------------------------------------------------------------------ companhias e grupos (reais, períodos e texto da curadoria) */

/** Valor em reais por extenso na ordem de grandeza certa: "R$ 84,7 bilhões", "R$ 1,2 bilhão", "R$ 497 milhões", "−R$ 2,1 bilhões". */
export function reais(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  const abs = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  if (abs >= 1e9) {
    const x = Number((abs / 1e9).toFixed(casas));
    return `${sinal}R$ ${num(x, casas)} ${x < 2 ? "bilhão" : "bilhões"}`;
  }
  if (abs >= 1e6) {
    const x = Math.round(abs / 1e6);
    return `${sinal}R$ ${num(x)} ${x < 2 ? "milhão" : "milhões"}`;
  }
  return `${sinal}R$ ${num(Math.round(abs / 1e3))} mil`;
}

/** Valor que a fonte publica em R$ milhões, escrito em bilhões: "R$ 123,6 bilhões". */
export const reaisDeMilhoes = (milhoes: number | null | undefined, casas = 1) => (milhoes == null ? SEM_DADO : reais(milhoes * 1e6, casas));

/** Em bilhões, só o número (para eixos e colunas de tabela que já dizem a unidade). */
export const emBilhoes = (v: number | null | undefined): number | null => (v === null || v === undefined || !Number.isFinite(v) ? null : v / 1e9);

/** Parcela de R$ 100 de receita líquida: "R$ 70,15"; negativa, "−R$ 0,85". */
export function por100(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  return `${v < 0 ? "−" : ""}R$ ${num(Math.abs(v), 2)}`;
}

/** "1º", "20º". */
export const ordinal = (n: number) => `${n}º`;

/** Data-base "2026-09-30" → "set/2026"; "2026-08" → "ago/2026". */
export const mesDaData = (iso: string | null | undefined): string => (iso && /^\d{4}-\d{2}/.test(iso) ? mesCurto(iso.slice(0, 7)) : "data não informada");

/** Dia de consulta ou de entrega "2026-11-23" → "23/11/2026", sem passar por fuso. */
export function diaBr(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "data não informada";
}

/**
 * Texto escrito à mão na curadoria, pronto para a tela: datas no formato da máquina ("2026-02-11", "2025-05") viram datas
 * brasileiras, travessão vira vírgula, e o jargão interno da curadoria (o nome do arquivo e da "gold" de demonstrações) vira o
 * nome que o leitor reconhece. Nenhum número e nenhuma afirmação mudam: o texto é da curadoria.
 */
export function textoCurado(v: unknown): string {
  if (typeof v !== "string") return "";
  const BASE = "base de demonstrações da CVM desta coleção";
  return v
    .replace(/\s*São os mesmos valores do campo \S+ da gold\./g, "")
    .replace(/,?\s*extraíd[oa]s? em public\/varejo\/gold\/empresas\.json/g, "")
    .replace(/base da gold( public\/varejo\/gold\/empresas\.json)?/g, BASE)
    .replace(/public\/varejo\/gold\/empresas\.json/g, BASE)
    .replace(/\s*\((?:setor\.json|fórmula )[^)]*\)/g, "")
    .replace(/;\s*em empresas\.json,[^.;]*/g, "")
    .replace(/\bem empresas\.json\b/g, "na " + BASE)
    .replace(/\b(?:de |nem de )?empresas\.json\b/g, (t) => t.replace("empresas.json", "a " + BASE).replace("de a ", "da "))
    .replace(/\bpela gold\b/g, "por esta coleção")
    .replace(/\b([NnDd]?[Aa]) gold\b/g, `$1 ${BASE}`)
    .replace(/\bgold\b/g, BASE)
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$3/$2/$1")
    .replace(/\b(\d{4})-(0[1-9]|1[0-2])\b(?!\/)/g, (_t, a: string, m: string) => `${MESES_CURTOS[Number(m) - 1]}/${a}`)
    .replace(/\s*[—–]\s*/g, ", ")
    .trim();
}
