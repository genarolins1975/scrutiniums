/**
 * Leitura, no servidor, do arquivo de usinas que o explorador de Minha região carrega sob demanda no navegador. A página precisa das mesmas
 * usinas para contar, por UF, as usinas em operação sem os registros de até 10 kW (a regra da contagem municipal) e para dizer quantas
 * usinas estão declaradas em mais de uma UF. O arquivo é o publicado em public/energia/series; nada é recalculado além da contagem das
 * linhas dele. Só a página (servidor) importa este módulo: ele usa `node:fs`.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { usinasDoJson, type UsinaT } from "./territorio";
import type { UsinasTerritorio } from "./tipos-territorio";

const cache = new Map<string, { mtime: number; limiteKw: number; usinas: UsinaT[] }>();

/** As usinas do arquivo publicado (caminho como na gold, "/energia/series/territorio_usinas.json"); null se o arquivo faltar ou não ler. */
export function lerUsinasDoServidor(caminhoPublico: string, limiteKw: number): UsinaT[] | null {
  try {
    const caminho = join(process.cwd(), "public", caminhoPublico.replace(/^\/+/, ""));
    const mtime = statSync(caminho).mtimeMs;
    const c = cache.get(caminho);
    if (c && c.mtime === mtime && c.limiteKw === limiteKw) return c.usinas;
    const usinas = usinasDoJson(JSON.parse(readFileSync(caminho, "utf-8")) as UsinasTerritorio, limiteKw);
    cache.set(caminho, { mtime, limiteKw, usinas });
    return usinas;
  } catch {
    return null;
  }
}
