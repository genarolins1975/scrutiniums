import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ManifestoLogos } from "./tipos-listadas";

/**
 * Manifesto dos símbolos das companhias listadas (public/energia/logos/manifesto.json, escrito por
 * pipeline/energia/logos_listadas.py), lido no build. Ausente ou ilegível devolve null e as páginas
 * mostram o nome em texto.
 */
export function lerManifestoLogos(): ManifestoLogos | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "energia", "logos", "manifesto.json"), "utf-8")) as ManifestoLogos;
  } catch {
    return null;
  }
}
