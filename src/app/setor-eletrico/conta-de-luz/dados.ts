import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { infoDistribuidoras, lerIpcaCsv, type FonteQualidade, type FonteTerritorio, type InfoDistribuidora } from "@/lib/energia/conta";
import { lerGold } from "@/lib/energia/gold";
import type { HistoricoB1 } from "@/lib/energia/tipos-conta";

/**
 * Leituras de servidor das duas páginas da Conta de luz que não são a gold do módulo: as séries publicadas ao lado dela (histórico por
 * distribuidora e IPCA) e as golds de Qualidade e de Território, de onde saem a UF, o tipo e as UCs de cada distribuidora. Rodam no
 * build (as páginas são force-static), e arquivo ausente ou ilegível devolve null: a página diz que o dado falta, nunca o inventa.
 * Não é rota nem módulo de cliente: o que a página entrega aos componentes de cliente é só o resultado pequeno (a comparação, a
 * informação de cada distribuidora e os fatores do IPCA), nunca estes arquivos.
 */

const SERIES = join(process.cwd(), "public", "energia", "series");
const cache = new Map<string, { mtime: number; dado: unknown }>();

function lerSerie<T>(nome: string, converter: (texto: string) => T): T | null {
  try {
    const caminho = join(SERIES, nome);
    const mtime = statSync(caminho).mtimeMs;
    const c = cache.get(nome);
    if (c && c.mtime === mtime) return c.dado as T;
    const dado = converter(readFileSync(caminho, "utf-8"));
    cache.set(nome, { mtime, dado });
    return dado;
  } catch {
    return null;
  }
}

/** Linha do tempo da tarifa B1 de cada distribuidora (`conta_historico_b1.json`). */
export function lerHistoricoB1(): HistoricoB1 | null {
  return lerSerie("conta_historico_b1.json", (t) => JSON.parse(t) as HistoricoB1);
}

/** Índices mensais do IPCA (`conta_ipca.csv`), os mesmos que a gold usa na mediana em reais. */
export function lerIpca(): { mes: string; indice: number }[] | null {
  return lerSerie("conta_ipca.csv", lerIpcaCsv);
}

/** UF, tipo e UCs de cada CNPJ, das golds de Território e de Qualidade; sem a gold, cada campo fica null. */
export function infoDasDistribuidoras(cnpjs: readonly string[]): Record<string, InfoDistribuidora> {
  const q = lerGold<{ distribuidoras?: FonteQualidade[] }>("qualidade.json");
  const t = lerGold<{ distribuidoras?: FonteTerritorio[] }>("territorio.json");
  return infoDistribuidoras(cnpjs, q?.distribuidoras ?? null, t?.distribuidoras ?? null);
}
