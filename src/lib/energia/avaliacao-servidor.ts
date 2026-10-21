import { lerGold } from "./gold";
import { provenienciaLegivel } from "./mercado";
import type { Proveniencia } from "./tipos";
import type { AvaliacaoGold } from "./tipos-avaliacao";

/** Leitura de disco da gold de avaliação (P071), só no servidor (build). Sem arquivo, sem nota. */
export function avaliacaoPublicada(): AvaliacaoGold | null {
  const g = lerGold<AvaliacaoGold>("avaliacao.json");
  return g && g.disponivel ? g : null;
}

export const provenienciaAvaliacao = (p: Proveniencia): Proveniencia => provenienciaLegivel(p);
