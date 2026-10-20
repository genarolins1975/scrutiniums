/**
 * Formatação do painel Segurança pública (servidor e navegador). Nada aqui calcula indicador: só escreve números da
 * gold no padrão brasileiro e monta os rótulos de unidade a partir do contrato de cada indicador.
 */
import type { Denominador, Indicador, Situacao } from "./tipos";

export function numero(n: number, casas = 0): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function inteiro(n: number): string {
  return numero(n, 0);
}

export function sinal(n: number, casas = 1): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${numero(Math.abs(n), casas)}`;
}

export function percentualVariacao(n: number): string {
  return `${sinal(n, 1)}%`;
}

export function reais(n: number, casas = 2): string {
  return `R$ ${numero(n, casas)}`;
}

/** "por 100 mil habitantes", "por 100 mil mulheres" ou "por habitante". */
export function porDenominador(den: Denominador, escala: number): string {
  if (!den) return "";
  if (escala === 1) return den === "mulheres" ? "por mulher" : "por habitante";
  return den === "mulheres" ? "por 100 mil mulheres" : "por 100 mil habitantes";
}

/** Valor da taxa com a unidade: "12,3 por 100 mil habitantes" ou "R$ 345,67 por habitante". */
export function taxaComUnidade(i: Indicador, v: number): string {
  if (i.escala === 1) return `${reais(v)} ${porDenominador(i.denominador, i.escala)}`;
  return `${numero(v, 1)} ${porDenominador(i.denominador, i.escala)}`;
}

export function taxaCurta(i: Indicador, v: number): string {
  return i.escala === 1 ? reais(v, 0) : numero(v, 1);
}

/** Contagem com a unidade do indicador ("31.518 vítimas"; despesa em reais). */
export function contagemComUnidade(i: Indicador, n: number): string {
  if (i.fonte === "siconfi") return n >= 1e9 ? `R$ ${numero(n / 1e9, 2)} bilhões` : `R$ ${numero(n / 1e6, 1)} milhões`;
  return `${inteiro(n)} ${i.unidade}`;
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  ok: "Publicado",
  incompleto: "Ano incompleto",
  sem_registro: "Sem registro no ano",
  fora: "Fora da fonte",
  parcial: "Soma parcial",
};

export const MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10-20T08:00:00Z" ou "2026-10-20" vira "20/10/2026". */
export function dataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function listaNatural(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
}

export const ROTULO_FONTE: Record<string, string> = {
  sinesp: "Sinesp VDE, Ministério da Justiça",
  sim: "SIM, Ministério da Saúde",
  siconfi: "Siconfi, Tesouro Nacional",
};

export const ROTULO_BASE: Record<string, string> = {
  ocorrencia: "UF onde o fato foi registrado",
  residencia: "UF de residência da vítima",
  governo_estadual: "governo do estado ou do DF",
};
