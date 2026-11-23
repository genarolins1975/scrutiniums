/**
 * Leitura da gold do painel "Sanções e reclamações" (Observatório das Famílias, coleção Dívida e crédito das famílias):
 * public/obs/data/gold/conduta.json, com três réguas que não se somam: decisões de processos sancionadores do Banco Central (por
 * apenado), processos sancionadores da CVM (por fase) e o índice do ranking trimestral de reclamações. Só servidor.
 *
 * Regra editorial herdada da vista de origem: nenhuma lista ordenada por instituição, multa ou nome; o que é nominal aparece em
 * ordem cronológica, como a fonte publica. Nada é calculado aqui: janelas de 12 meses, medianas e tempos de rito já vêm da gold.
 */
import { lerPublico, dataBr, num } from "@/lib/perguntas/leitura";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import { limpar, provCurada } from "./apostas";

export const ROTA_SANCOES = "/divida-das-familias/sancoes-e-reclamacoes";
export const TITULO_SANCOES = "Sanções e reclamações";
export const PERGUNTA_SANCOES = "Como o supervisor pune, e o que isso diz do sistema?";
export const DESCRICAO_SANCOES =
  "O que o Banco Central e a CVM decidiram nos processos sancionadores, em quanto tempo, com que penalidade e se a multa foi paga, e o índice do ranking de reclamações, sem ranking por instituição.";
export const SECAO_SANCOES = "familias:sancoes-e-reclamacoes";
/** O índice de cada instituição está na ficha dela, na aplicação do Crédito. */
export const PAINEL_INSTITUICOES = "/observatorio/institutions";

/** "2026-3" → "3º trimestre de 2026". */
export function trimestre(periodo: unknown): string {
  const m = /^(\d{4})-(\d)$/.exec(String(periodo ?? ""));
  return m ? `${m[2]}º trimestre de ${m[1]}` : limpar(periodo);
}
/** "2026-3" → "3º tri/2026", para eixo e tabela. */
export function trimestreCurto(periodo: unknown): string {
  const m = /^(\d{4})-(\d)$/.exec(String(periodo ?? ""));
  return m ? `${m[2]}º tri/${m[1]}` : limpar(periodo);
}
/** Valor em reais, em milhões com uma casa: "R$ 72,3 mi". */
export function milhoes(v: number | null | undefined): string | null {
  return typeof v === "number" && Number.isFinite(v) ? `R$ ${num(v / 1e6, 1)} mi` : null;
}
/** Texto da base em caixa alta ("MULTA PAGA") na forma de frase ("Multa paga"). */
export function frase(texto: unknown): string {
  const t = limpar(texto).toLowerCase();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}
export const dataOuVazio = (iso: unknown): string | null => (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso) ? dataBr(iso) : null);

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
export function dadosSancoes(): { D: any; B: any; C: any; R: any } {
  const D = lerPublico("obs", "data", "gold", "conduta.json");
  return { D, B: D.bcb ?? {}, C: D.cvm ?? {}, R: D.reclamacoes ?? {} };
}

/** Proveniência de uma das três réguas, com o nome, o catálogo e a licença que a gold registra para a fonte. */
export function provSancoes(
  D: any,
  regua: "bcb" | "cvm" | "reclamacoes",
  b: { indicador: string; natureza: Natureza; unidade: string; frequencia: string; inicio: string; fim: string; formula?: string | null; limitacoes?: string[] },
): Proveniencia {
  const f = D.fontes?.[regua] ?? {};
  const orgao = regua === "cvm" ? "CVM" : "Banco Central";
  const dataset = limpar(String(f.nome ?? "")).replace(/^(BCB|CVM),\s*/, "");
  return provCurada({
    ...b,
    orgao,
    dataset,
    recurso: limpar(f.nivel ?? dataset),
    url: String(f.catalogo ?? f.url ?? ""),
    geradoEm: String(D.gerado_em),
    licenca: f.licenca ? limpar(f.licenca) : undefined,
    pipeline: "Pipeline do Observatório do Crédito, gold conduta.json",
    curada: false,
    transformacoes: [limpar(D.metodo)],
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
