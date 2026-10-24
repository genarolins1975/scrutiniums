import { it } from "vitest";

/**
 * Teste de retrato: confere números de um retrato datado da fonte, não o comportamento do código. Decisão do dono de
 * 24/10/2026 (mesma regra de pipeline/tests/retrato.py): retrato não barra a publicação da gold nem o CI. Com
 * TESTES_SEM_RETRATO=1 fica de fora, pulado; roda à parte em `npm run testes:retrato`, que relata a divergência.
 * O título leva a marca [retrato], que o executor usa para escolher só estes testes.
 */
export const MARCA_RETRATO = "[retrato]";

export function itRetrato(deQue: string, nome: string, fn: () => unknown, timeout?: number) {
  it.skipIf(process.env.TESTES_SEM_RETRATO === "1")(`${MARCA_RETRATO} ${nome} (retrato: ${deQue})`, fn, timeout);
}
