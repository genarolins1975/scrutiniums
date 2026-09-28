import { readFileSync } from "node:fs";
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

function ler<T>(nome: string): T | null {
  try {
    return JSON.parse(readFileSync(join(DIR, nome), "utf-8")) as T;
  } catch {
    return null;
  }
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
