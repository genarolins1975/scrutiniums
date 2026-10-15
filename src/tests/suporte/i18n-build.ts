import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "parse5";
import type { No } from "./i18n-dom";

export function modoDaPagina(caminho: string, build = join(process.cwd(), ".next")): "estatico" | "dinamico" {
  const manifestoApp = join(build, "server", "app-paths-manifest.json");
  const manifestoPrerender = join(build, "prerender-manifest.json");
  for (const arquivo of [manifestoApp, manifestoPrerender]) {
    if (!existsSync(arquivo)) throw new Error(`Build incompleto para ${caminho}: falta ${arquivo}`);
  }
  const app: Record<string, string> = JSON.parse(readFileSync(manifestoApp, "utf8"));
  const prerender: { routes?: Record<string, unknown> } = JSON.parse(readFileSync(manifestoPrerender, "utf8"));
  const segmento = caminho === "/" ? "" : caminho;
  const modulo = app[`${segmento}/page`];
  if (!modulo) {
    if (app[`${segmento}/route`]) throw new Error(`Handler fora do adaptador de HTML de páginas: ${caminho}`);
    throw new Error(`Página compilada ausente do manifesto: ${caminho}`);
  }
  const compilado = join(build, "server", modulo);
  if (!existsSync(compilado) || !statSync(compilado).isFile()) throw new Error(`Página compilada ausente: ${caminho}`);
  return prerender.routes?.[caminho] ? "estatico" : "dinamico";
}

/** Cada irmã precisa de evidência do build; HTML solto não comprova prerender. */
export function documentoEstatico(caminho: string, build = join(process.cwd(), ".next")): No {
  const manifestoApp = join(build, "server", "app-paths-manifest.json");
  const manifestoPrerender = join(build, "prerender-manifest.json");
  for (const arquivo of [manifestoApp, manifestoPrerender]) {
    if (!existsSync(arquivo)) throw new Error(`Build incompleto para ${caminho}: falta ${arquivo}`);
  }
  const app: Record<string, string> = JSON.parse(readFileSync(manifestoApp, "utf8"));
  const prerender: { routes?: Record<string, unknown> } = JSON.parse(readFileSync(manifestoPrerender, "utf8"));
  const segmento = caminho === "/" ? "" : caminho;
  const modulo = app[`${segmento}/page`];
  if (!modulo) {
    if (app[`${segmento}/route`]) throw new Error(`Handler fora do adaptador de HTML de páginas: ${caminho}`);
    throw new Error(`Página compilada ausente do manifesto: ${caminho}`);
  }
  const compilado = join(build, "server", modulo);
  if (!existsSync(compilado) || !statSync(compilado).isFile()) throw new Error(`Página compilada ausente: ${caminho}`);
  if (!prerender.routes?.[caminho]) {
    throw new Error(`Página ${caminho} compilada sem prerender; integrar verificação HTTP antes de declarar sua cobertura HTML.`);
  }
  const arquivo = join(build, "server", "app", caminho === "/" ? "index.html" : `${caminho.slice(1)}.html`);
  if (!existsSync(arquivo) || !statSync(arquivo).isFile()) throw new Error(`HTML ausente: ${caminho}; gere um build completo.`);
  return parse(readFileSync(arquivo, "utf8"));
}
