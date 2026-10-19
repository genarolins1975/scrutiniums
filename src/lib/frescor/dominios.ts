/**
 * Leitura, no build, das datas que cada domínio publica (somente servidor).
 * A regra e os caminhos dos campos estão em regras.ts e limiares.json.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extrairFrescor, type DadosFrescor, type DominioFrescorId } from "./regras";

const lidos = new Map<DominioFrescorId, DadosFrescor>();

function lerArquivo(arquivo: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), arquivo), "utf-8"));
}

/** Datas de cada domínio, na ordem pedida. Arquivo ausente vira "data não informada", não erro de build. */
export function dadosFrescor(ids: readonly DominioFrescorId[]): DadosFrescor[] {
  return ids.map((id) => {
    if (!lidos.has(id)) lidos.set(id, extrairFrescor(id, lerArquivo));
    return lidos.get(id)!;
  });
}
