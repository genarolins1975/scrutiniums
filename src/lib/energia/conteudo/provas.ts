/**
 * Prova de um verbete ou de um passo de trilha: a ficha publicada pelo painel, quando
 * existe, ou o exemplo em texto lido da gold. Uma só regra para o verbete e para a trilha,
 * para o mesmo conceito nunca mostrar dois números diferentes como "o exemplo".
 */
import { exemploDe, type TrechoExemplo } from "./exemplos";
import { evidenciaPublicada, exemploComEvidencia, type ExemploComEvidencia } from "./evidencias-verbetes";
import type { ProvaPasso } from "./trilhas";

export type Prova = { tipo: "evidencia"; dado: ExemploComEvidencia } | { tipo: "texto"; partes: TrechoExemplo[]; href: string };

export function provaDoVerbete(slug: string): Prova | null {
  const ev = exemploComEvidencia(slug);
  if (ev) return { tipo: "evidencia", dado: ev };
  const tx = exemploDe(slug);
  return tx ? { tipo: "texto", partes: tx.partes, href: tx.href } : null;
}

export function provaDoPasso(p: ProvaPasso): Prova | null {
  if (p.tipo === "verbete") return provaDoVerbete(p.slug);
  const ev = evidenciaPublicada(p.arquivo, p.caminho);
  if (!ev) return null;
  const { arquivo, caminho, natureza, painel, leitura } = p;
  return { tipo: "evidencia", dado: { arquivo, caminho, natureza, painel, leitura, evidencia: ev } };
}
