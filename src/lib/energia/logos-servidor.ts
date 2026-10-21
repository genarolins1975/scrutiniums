import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizaManifestoLogos, type EntradaLogo } from "./leiloes";

/**
 * Manifesto de logotipos oficiais (public/energia/logos/manifesto.json), lido no build. Sem o arquivo, ou com ele ilegível,
 * a lista é vazia e as páginas mostram só o nome do grupo. Item cujo arquivo não está publicado em public/ também sai, para
 * a página nunca apontar para imagem inexistente.
 */
export function lerManifestoLogos(raiz: string = process.cwd()): EntradaLogo[] {
  const pub = join(raiz, "public");
  try {
    const bruto = JSON.parse(readFileSync(join(pub, "energia", "logos", "manifesto.json"), "utf-8"));
    return normalizaManifestoLogos(bruto).filter((e) => existsSync(join(pub, e.arquivo.replace(/^\/+/, ""))));
  } catch {
    return [];
  }
}
