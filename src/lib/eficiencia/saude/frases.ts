import { inteiro } from "../formato";
import type { MedidaSaude, MedidaSaudeId } from "./medidas";
import { periodoCurto, ROTULO_PERIODO, type PeriodoTipo } from "./medidas";

export const QUANDO: Record<PeriodoTipo, (a: number) => string> = {
  exercicio: (a) => `no exercício de ${a}`,
  dezembro: (a) => `em dezembro de ${a}`,
  processamento: (a) => `no ano de processamento ${a}`,
};
export const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** Primeira letra minúscula, preservando siglas iniciais como UBS e ICSAP e siglas internas como eSF e eAP. */
export const minuscula = (t: string) => (/^[A-ZÀ-Ý]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));

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
  const porNome = (a: ItemFrase, b: ItemFrase) => a.nome.localeCompare(b.nome, "pt-BR");
  const nomesMin = itens.filter((i) => i.valor === min).sort(porNome);
  const nomesMax = itens.filter((i) => i.valor === max).sort(porNome);
  const quando = cap1(QUANDO[m.periodo](ano));
  const med = mediana !== null ? ` A mediana das ${itens.length} capitais na comparação é ${m.formata(mediana)}.` : "";
  if (min === max) return `${quando}, as ${itens.length} capitais na comparação têm o mesmo valor, ${m.formata(min)}.`;
  return `${quando}, ${minuscula(m.rotulo)} ${m.plural ? "vão" : "vai"} de ${m.formata(min)} em ${lista(nomesMin)} a ${m.formata(max)} em ${lista(nomesMax)}.${med}`;
}

/** Frase da capital escolhida: posição numérica diante da mediana do grupo, sem classificação. A medida dita a comparação: relativa para razões, em pontos percentuais para parcelas, nenhuma para totais. */
export function fraseCapital(nome: string, uf: string, valor: number | null, mediana: number | null, n: number, m: MedidaSaude, foraDaComparacao: boolean): string {
  if (valor === null) return `${nome} (${uf}) não tem valor para este recorte.`;
  if (foraDaComparacao) return `${nome} (${uf}): ${m.formata(valor)}. O valor oficial fica fora da comparação e das medianas (motivo no aviso abaixo).`;
  if (mediana === null || !n) return `${nome} (${uf}): ${m.formata(valor)}.`;
  if (valor === mediana) return `${nome} (${uf}): ${m.formata(valor)}, igual à mediana das ${n} capitais.`;
  const base = `${nome} (${uf}): ${m.formata(valor)}; mediana das ${n} capitais: ${m.formata(mediana)}`;
  if (m.tipo === "escala") return `${base}. É um total que depende do porte da capital.`;
  const sentido = valor > mediana ? "acima" : "abaixo";
  if (m.tipo === "percentual") return `${base}, ${m.difAbsoluta(Math.abs(valor - mediana))} ${sentido} da mediana.`;
  const dif = mediana ? Math.abs(valor / mediana - 1) * 100 : null;
  return dif !== null && Number.isFinite(dif) ? `${base}, ${inteiro(Math.round(dif))}% ${sentido} da mediana.` : `${base}.`;
}

/** Posição de um valor diante da mediana do grupo, na unidade da medida: relativa para razões, em pontos percentuais para parcelas, nenhuma para totais. */
export function posicaoNaMediana(valor: number, mediana: number, m: MedidaSaude): string {
  if (valor === mediana) return "igual à mediana das capitais";
  const sentido = valor > mediana ? "acima" : "abaixo";
  if (m.tipo === "escala") return `mediana das capitais: ${m.formata(mediana)}`;
  if (m.tipo === "percentual") return `${m.difAbsoluta(Math.abs(valor - mediana))} ${sentido} da mediana das capitais (${m.formata(mediana)})`;
  const dif = mediana ? Math.abs(valor / mediana - 1) * 100 : null;
  return dif !== null && Number.isFinite(dif) ? `${inteiro(Math.round(dif))}% ${sentido} da mediana das capitais (${m.formata(mediana)})` : `mediana das capitais: ${m.formata(mediana)}`;
}

/** Diferença entre duas capitais na mesma medida e no mesmo período, na unidade da medida. */
export function fraseDiferenca(a: { nome: string; valor: number }, b: { nome: string; valor: number }, m: MedidaSaude, ano: number): string {
  const d = a.valor - b.valor;
  const quando = QUANDO[m.periodo](ano);
  if (d === 0) return `${a.nome} e ${b.nome} têm o mesmo valor ${quando}: ${m.formata(a.valor)}.`;
  const sentido = d > 0 ? "a mais" : "a menos";
  const abs = `${a.nome} tem ${m.difAbsoluta(Math.abs(d))} ${sentido} que ${b.nome} ${quando}`;
  if (m.tipo !== "razao" || !b.valor) return `${abs}.`;
  const rel = (a.valor / b.valor - 1) * 100;
  return Number.isFinite(rel) ? `${abs} (${inteiro(Math.round(Math.abs(rel)))}% ${d > 0 ? "maior" : "menor"} em valor relativo).` : `${abs}.`;
}

type PontoFrase = { ano: number; valor: number | null; elegivel: boolean; quebraSerie: boolean };

/**
 * Frase da evolução. A variação direta só existe entre anos consecutivos da mesma base: a frase usa o último trecho assim, com pelo menos dois
 * anos, e diz que os demais anos usam outra base. Sem trecho, não há variação direta e a frase diz isso em vez de um salto bruto.
 */
export function fraseEvolucao(pontos: PontoFrase[], m: MedidaSaude, sujeito: string, motivoQuebra: string): string {
  const com = pontos.filter((p) => p.valor !== null && p.elegivel);
  if (com.length === 0) return `${sujeito} não tem valor comparável em nenhum ano da série.`;
  const quando = (p: PontoFrase) => periodoCurto(m, p.ano);
  if (com.length === 1) return `${sujeito} tem valor comparável só em ${quando(com[0])}: ${m.formata(com[0].valor!)}.`;
  const trechos: PontoFrase[][] = [];
  let atual: PontoFrase[] = [];
  let anterior = -2;
  pontos.forEach((p, i) => {
    const ok = p.valor !== null && p.elegivel;
    if (!ok) {
      if (atual.length) trechos.push(atual);
      atual = [];
    } else {
      if (atual.length && (anterior !== i - 1 || atual[atual.length - 1].quebraSerie !== p.quebraSerie)) {
        trechos.push(atual);
        atual = [];
      }
      atual.push(p);
      anterior = i;
    }
  });
  if (atual.length) trechos.push(atual);
  const ultimo = [...trechos].reverse().find((t) => t.length >= 2);
  if (!ultimo) return `${sujeito}: cada ano usa uma base diferente da do vizinho, então a série mostra os valores sem variação direta entre eles (${motivoQuebra}).`;
  const a = ultimo[0];
  const b = ultimo[ultimo.length - 1];
  const base = `${sujeito}: de ${m.formata(a.valor!)} em ${quando(a)} para ${m.formata(b.valor!)} em ${quando(b)}.`;
  const fora = com.filter((p) => !ultimo.includes(p));
  return fora.length ? `${base} Os valores de ${fora.map(quando).join(", ")} usam outra base e não entram nesta variação: ${motivoQuebra}.` : base;
}

const ROTULO_RESUMO: Record<MedidaSaudeId, string> = {
  despesa: "Despesa total",
  despesa_hab: "Despesa por habitante",
  asps_pct: "Aplicado em ASPS (%)",
  ubs_10mil: "UBS por 10 mil habitantes",
  esf_10mil: "eSF por 10 mil habitantes",
  eap_10mil: "eAP por 10 mil habitantes",
  cobertura_aps: "Cobertura potencial da APS",
  icsap_taxa: "Taxa de ICSAP por 100 mil habitantes",
  icsap_n: "Internações ICSAP (número)",
  icsap_part: "ICSAP nas internações SUS (%)",
};

/**
 * Resumo do recorte para o painel recolhido no celular: medida, período, moeda, denominador quando não é o padrão, capital e grupo de comparação.
 * O leitor vê o que está escolhido sem abrir os controles.
 */
export function resumoDoRecorte(p: { medida: MedidaSaudeId; periodo: string; real: boolean; denominadorIbge: boolean; capital: string | null; regiao: string | null; semCapital?: string; ordem?: string | null }): string {
  return [
    ROTULO_RESUMO[p.medida],
    p.periodo,
    p.real ? "reais de 2025" : null,
    p.denominadorIbge ? "população do IBGE" : null,
    p.capital ? `${p.capital}${p.regiao ? `, comparada à região ${p.regiao}` : ""}` : p.semCapital ?? "todas as capitais",
    p.ordem ? `ordem ${p.ordem}` : null,
  ].filter(Boolean).join(" · ");
}
