/**
 * Índice Brasileiro de Condições de Crédito (IBCC) para a página estável
 * /dados/ibcc: valor, percentil, série, componentes e a nota mensal.
 *
 * A nota é montada por regras determinísticas, no mesmo padrão do diagnóstico
 * do resumo (pipeline/overview.py): nenhuma frase é escrita livremente, cada uma
 * sai de uma regra publicada em REGRAS_NOTA, aplicada aos números do gold.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fmtPercentil, fmtRefMes, fmtSinal } from "./dadosPublicos";

/** Rótulos dos componentes, iguais a config/config.json (ibcc.components.*.label). */
export const ROTULOS_COMPONENTES: Record<string, string> = {
  preco: "Preço do crédito",
  qualidade: "Qualidade da carteira",
  capacidade: "Capacidade de pagamento",
  atividade: "Atividade econômica",
  oferta: "Oferta de crédito",
  antecedentes: "Indicadores antecedentes",
};

/** Variação abaixo deste módulo, em pontos do índice, é lida como estabilidade. */
export const LIMIAR_ESTAVEL = 0.5;

export const REGRAS_NOTA = [
  "Nível: acima de 100, condições melhores que a média histórica; abaixo de 100, piores. O percentil é a posição do valor atual na série desde o início.",
  `Variação: módulo menor que ${LIMIAR_ESTAVEL.toLocaleString("pt-BR")} ponto é "praticamente estável"; acima disso, "subiu" ou "caiu" com o valor em pontos. Vale para o mês e para 12 meses.`,
  "Componentes: aponta o componente cuja contribuição mais subiu e o que mais caiu em relação ao mês anterior, e o componente com a contribuição mais negativa no nível atual.",
  "Fase do ciclo: a classificação publicada pelo pipeline no próprio gold, sem reinterpretação.",
];

export type PontoIbcc = { ref: string; valor: number; contribuicoes: Record<string, number> };

export type IbccPublico = {
  atual: PontoIbcc;
  anterior: PontoIbcc | null;
  ha12: PontoIbcc | null;
  percentil: number;
  fase: string;
  serie: PontoIbcc[];
  metodo: string;
  limitacoes: string;
  tipo: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
function lerGold(nome: string): any {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", `${nome}.json`), "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Percentil do valor na série, com a mesma fórmula de pipeline/overview.py
 * (build_ibcc_position): valores estritamente menores sobre n − 1.
 */
export function percentilNaSerie(serie: { valor: number }[], v: number): number {
  if (!serie.length) return NaN;
  return (100 * serie.filter((p) => p.valor < v).length) / Math.max(serie.length - 1, 1);
}

export function ibccPublico(): IbccPublico | null {
  const g = lerGold("ibcc");
  if (!g?.ok || !Array.isArray(g.serie) || g.serie.length < 2) return null;
  const serie = g.serie as PontoIbcc[];
  const atual = serie[serie.length - 1];
  const ov = lerGold("overview")?.ibcc_posicao;
  return {
    atual,
    anterior: serie[serie.length - 2] ?? null,
    ha12: serie.length > 12 ? serie[serie.length - 13] : null,
    percentil: typeof ov?.percentil_historico === "number" && ov.ref === atual.ref ? ov.percentil_historico : percentilNaSerie(serie, atual.valor),
    fase: String(g.fase_ciclo ?? "não classificada"),
    serie,
    metodo: String(g.metodo ?? ""),
    limitacoes: String(g.limitacoes ?? ""),
    tipo: String(g.tipo ?? "DADO CALCULADO"),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const n1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function variacao(delta: number, janela: string): string {
  if (Math.abs(delta) < LIMIAR_ESTAVEL) return `ficou praticamente estável ${janela} (${delta >= 0 ? "+" : "−"}${n2(Math.abs(delta))} ponto)`;
  return `${delta > 0 ? "subiu" : "caiu"} ${n2(Math.abs(delta))} pontos ${janela}`;
}

/** Nota mensal de uma página: quatro parágrafos, um por regra, sobre os números do gold. */
export function notaMensalIbcc(d: IbccPublico): { titulo: string; paragrafos: string[] } {
  const { atual, anterior, ha12 } = d;
  const mes = fmtRefMes(atual.ref);
  const p: string[] = [];

  p.push(
    `Em ${mes}, o IBCC ficou em ${n1(atual.valor)}, ${atual.valor >= 100 ? "acima" : "abaixo"} da média histórica (100), ` +
      `no percentil ${fmtPercentil(d.percentil)} da série iniciada em ${fmtRefMes(d.serie[0].ref)}: ` +
      `as condições de crédito estão ${atual.valor >= 100 ? "melhores" : "piores"} que a média do período.`,
  );

  const partes: string[] = [];
  if (anterior) partes.push(`${variacao(atual.valor - anterior.valor, "no mês")}`);
  if (ha12) partes.push(`${variacao(atual.valor - ha12.valor, "em 12 meses")}`);
  if (partes.length) p.push(`O índice ${partes.join(" e ")}.`);

  if (anterior) {
    const deltas = Object.keys(atual.contribuicoes)
      .filter((k) => typeof anterior.contribuicoes[k] === "number")
      .map((k) => ({ k, d: atual.contribuicoes[k] - anterior.contribuicoes[k] }))
      .sort((a, b) => b.d - a.d);
    const sobe = deltas[0];
    const desce = deltas[deltas.length - 1];
    const pior = Object.entries(atual.contribuicoes).sort((a, b) => a[1] - b[1])[0];
    const r = (k: string) => ROTULOS_COMPONENTES[k] ?? k;
    const frases: string[] = [];
    if (sobe && sobe.d > 0) frases.push(`a contribuição que mais subiu no mês foi a de ${r(sobe.k)} (+${n2(sobe.d)})`);
    if (desce && desce.d < 0) frases.push(`a que mais caiu foi a de ${r(desce.k)} (−${n2(Math.abs(desce.d))})`);
    let t = frases.length ? `Entre os componentes, ${frases.join(", e ")}. ` : "";
    if (pior) t += `No nível, o componente que mais puxa o índice para baixo é ${r(pior[0])} (${fmtSinal(pior[1])}).`;
    p.push(t.trim());
  }

  p.push(`Fase do ciclo publicada pelo pipeline: ${d.fase}.`);
  return { titulo: `Nota mensal do IBCC: ${mes}`, paragrafos: p };
}
