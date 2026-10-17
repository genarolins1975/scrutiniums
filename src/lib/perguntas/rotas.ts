import { OBSERVATORIOS, type ObservatorioId } from "@/lib/observatorios/lista";

/** Prefixo aberto das páginas por pergunta (src/lib/rotasPublicas.ts). */
export const ROTA_PERGUNTAS = "/perguntas";

/** Uma pergunta por observatório, na ordem do registro. */
export const IDS_PORTAS: readonly ObservatorioId[] = OBSERVATORIOS.map((o) => o.id);

export function rotaPorta(id: ObservatorioId): string {
  return `${ROTA_PERGUNTAS}/${id}`;
}
