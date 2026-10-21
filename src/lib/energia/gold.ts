import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  CargaGold,
  CatalogoGold,
  CmoGold,
  GeracaoGold,
  HidrologiaGold,
  MetaGold,
  ModelosGold,
  PldGold,
  PrevisoesGold,
  RedeGold,
  SinteseGold,
} from "./tipos";

/**
 * Leitura da gold de energia no build (páginas force-static). Arquivo ausente
 * ou ilegível devolve null: a página mostra o estado de indisponibilidade com
 * o motivo, nunca um número de reserva.
 */
const DIR = join(process.cwd(), "public", "energia", "gold");

// Cache por arquivo e mtime: no build, várias páginas leem a mesma gold; na rota
// dinâmica /app/observatorios, evita reprocessar centenas de KB a cada requisição.
// Uma gold nova (mtime diferente) é relida.
const cache = new Map<string, { mtime: number; dado: unknown }>();

function ler<T>(nome: string): T | null {
  try {
    const caminho = join(DIR, nome);
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

/**
 * Leitura genérica de uma gold pelo nome do arquivo, para os módulos temáticos
 * (pipeline/energia/modulos): cada módulo tipa a própria gold em
 * src/lib/energia/tipos-<modulo>.ts sem editar este arquivo.
 */
export function lerGold<T>(nome: string): T | null {
  return ler<T>(nome);
}

export const gold = {
  pld: () => ler<PldGold>("pld.json"),
  hidrologia: () => ler<HidrologiaGold>("hidrologia.json"),
  carga: () => ler<CargaGold>("carga.json"),
  geracao: () => ler<GeracaoGold>("geracao.json"),
  rede: () => ler<RedeGold>("rede.json"),
  cmo: () => ler<CmoGold>("cmo.json"),
  sintese: () => ler<SinteseGold>("sintese.json"),
  modelos: () => ler<ModelosGold>("modelos.json"),
  previsoes: () => ler<PrevisoesGold>("previsoes.json"),
  catalogo: () => ler<CatalogoGold>("catalogo.json"),
  meta: () => ler<MetaGold>("meta.json"),
};

/** true quando a gold existe e está íntegra (disponivel === true). */
export function integra<T extends { disponivel?: boolean }>(g: T | null): g is T & { disponivel: true } {
  return !!g && g.disponivel === true;
}
