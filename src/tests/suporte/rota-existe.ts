import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";

const raiz = process.cwd();

/**
 * Uma rota existe se houver page.tsx (ou route.ts) no caminho literal, num segmento dinâmico ([x]) ou num catch-all
 * ([[...x]]) do App Router; na aplicação do Crédito (/observatorio/*), se a vista estiver em ABAS_OBSERVATORIO. Mesma
 * regra de para-voce.test.ts, estendida aos segmentos dinâmicos de qualquer nome (verbetes, entidades, modelos).
 */
export function rotaExiste(href: string): boolean {
  const c = href.split(/[?#]/)[0] || "/";
  if (c === "/observatorio" || c.startsWith("/observatorio/")) {
    const vista = c.slice("/observatorio".length) || "/";
    return vista === "/" || ABAS_OBSERVATORIO.some((a) => a.caminho === vista || vista.startsWith(`${a.caminho}/`));
  }
  const partes = c.split("/").filter(Boolean);
  const dinamicos = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((d) => /^\[[^.[\]]+\]$/.test(d)) : []);
  const busca = (dir: string, i: number): boolean => {
    if (existsSync(dir) && readdirSync(dir).some((d) => /^\[\[?\.\.\./.test(d) && (existsSync(join(dir, d, "page.tsx")) || existsSync(join(dir, d, "route.ts"))))) return true;
    if (i === partes.length) return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "route.ts"));
    if (existsSync(join(dir, partes[i])) && busca(join(dir, partes[i]), i + 1)) return true;
    return dinamicos(dir).some((d) => busca(join(dir, d), i + 1));
  };
  return busca(join(raiz, "src", "app"), 0);
}
