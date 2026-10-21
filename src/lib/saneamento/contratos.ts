import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { GoldContratado, ResumoContratado } from "./contratos-base";

export * from "./contratos-base";

/**
 * Capítulo 15 do Saneamento: o que está contratado desde o novo marco legal (Lei 14.026/2020).
 * Lê no servidor a gold de pipeline/saneamento_contratos (public/saneamento/contratos). Arquivo ausente devolve null: a
 * página mostra a indisponibilidade, nunca um número de reserva. Valores em R$ milhões correntes de cada leilão, como a
 * fonte de cada linha; nunca somados entre naturezas (outorga, contraprestação, investimento).
 */

export const DIR_CONTRATOS = join(process.cwd(), "public", "saneamento", "contratos");
export const URL_CONTRATOS = "/saneamento/contratos";
export const ROTA_CONTRATADO = "/saneamento/contratado";

const cache = new Map<string, { mtime: number; dado: unknown }>();

function ler<T>(nome: string): T | null {
  try {
    const caminho = join(DIR_CONTRATOS, nome);
    const mtime = statSync(caminho).mtimeMs;
    const c = cache.get(nome);
    if (c && c.mtime === mtime) return c.dado as T;
    const dado = JSON.parse(readFileSync(caminho, "utf-8")) as T;
    cache.set(nome, { mtime, dado });
    return dado;
  } catch {
    return null;
  }
}

export function goldContratado(): GoldContratado | null {
  return ler<GoldContratado>("contratado.json");
}

export function resumoContratado(): ResumoContratado | null {
  return ler<ResumoContratado>("resumo.json");
}

