import { inteiro } from "../formato";
import type { MedidaSaude } from "./medidas";
import { ROTULO_PERIODO, type PeriodoTipo } from "./medidas";

export const QUANDO: Record<PeriodoTipo, (a: number) => string> = {
  exercicio: (a) => `no exercício de ${a}`,
  dezembro: (a) => `em dezembro de ${a}`,
  processamento: (a) => `no ano de processamento ${a}`,
};
export const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** Primeira letra minúscula, preservando siglas como eSF e eAP no restante do texto. */
export const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export type ItemFrase = { nome: string; uf: string; valor: number };

const lista = (itens: { nome: string; uf: string }[], max = 2) => {
  const nomes = itens.slice(0, max).map((i) => `${i.nome} (${i.uf})`);
  const resto = itens.length - max;
  return resto > 0 ? `${nomes.join(", ")} e mais ${resto}` : nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
};

/** Frase factual do recorte: amplitude e mediana das capitais na comparação, calculada dos mesmos dados do gráfico. Sem adjetivo, sem juízo. */
export function fraseAmplitude(itens: ItemFrase[], m: MedidaSaude, ano: number, mediana: number | null): string {
  if (!itens.length) return `Nenhuma capital tem valor comparável para ${ROTULO_PERIODO[m.periodo](ano).toLowerCase()}.`;
  const min = Math.min(...itens.map((i) => i.valor));
  const max = Math.max(...itens.map((i) => i.valor));
  const nomesMin = itens.filter((i) => i.valor === min);
  const nomesMax = itens.filter((i) => i.valor === max);
  const quando = cap1(QUANDO[m.periodo](ano));
  const med = mediana !== null ? ` A mediana das ${itens.length} capitais na comparação é ${m.formata(mediana)}.` : "";
  if (min === max) return `${quando}, as ${itens.length} capitais na comparação têm o mesmo valor, ${m.formata(min)}.`;
  return `${quando}, ${minuscula(m.rotulo)} vai de ${m.formata(min)} em ${lista(nomesMin)} a ${m.formata(max)} em ${lista(nomesMax)}.${med}`;
}

/** Frase da capital escolhida: posição numérica diante da mediana do grupo, sem classificação. */
export function fraseCapital(nome: string, uf: string, valor: number | null, mediana: number | null, n: number, m: MedidaSaude, foraDaComparacao: boolean): string {
  if (valor === null) return `${nome} (${uf}) não tem valor para este recorte.`;
  if (foraDaComparacao) return `${nome} (${uf}): ${m.formata(valor)}. O valor oficial fica fora da comparação e das medianas (motivo no aviso abaixo).`;
  if (mediana === null || !n) return `${nome} (${uf}): ${m.formata(valor)}.`;
  if (valor === mediana) return `${nome} (${uf}): ${m.formata(valor)}, igual à mediana das ${n} capitais.`;
  const dif = mediana ? Math.abs(valor / mediana - 1) * 100 : null;
  const rel = dif !== null && Number.isFinite(dif) ? `, ${inteiro(Math.round(dif))}% ${valor > mediana ? "acima" : "abaixo"} da mediana` : "";
  return `${nome} (${uf}): ${m.formata(valor)}; mediana das ${n} capitais: ${m.formata(mediana)}${rel}.`;
}

/** Frase da evolução: o primeiro e o último valor comparáveis da série e o que bloqueia a variação. */
export function fraseEvolucao(pontos: { ano: number; valor: number | null; elegivel: boolean; quebraSerie: boolean }[], m: MedidaSaude, sujeito: string, motivoQuebra: string): string {
  const com = pontos.filter((p) => p.valor !== null && p.elegivel);
  if (com.length === 0) return `${sujeito} não tem valor comparável em nenhum ano da série.`;
  const a = com[0];
  const b = com[com.length - 1];
  const quebras = new Set(com.map((p) => p.quebraSerie));
  if (com.length === 1) return `${sujeito} tem valor comparável só em ${a.ano}: ${m.formata(a.valor!)}.`;
  const base = `${sujeito}: de ${m.formata(a.valor!)} em ${a.ano} para ${m.formata(b.valor!)} em ${b.ano}.`;
  return quebras.size > 1 ? `${base} A variação entre esses anos não é uma medida direta: ${motivoQuebra}.` : base;
}
