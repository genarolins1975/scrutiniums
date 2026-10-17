import type { PortaId } from "./tipos";

/** Prefixo aberto das páginas por pergunta (src/lib/rotasPublicas.ts). */
export const ROTA_PERGUNTAS = "/perguntas";

export const IDS_PORTAS: readonly PortaId[] = ["bolso", "servicos", "dinheiro-publico", "energia", "economia", "territorio"];

export function rotaPorta(id: PortaId): string {
  return `${ROTA_PERGUNTAS}/${id}`;
}
