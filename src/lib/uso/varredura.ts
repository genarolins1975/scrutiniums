import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Lista fechada das páginas do app, lida do sistema de arquivos (src/app).
 * Só roda no Node: no gerador (scripts/rotas-do-app.mjs) e no teste que
 * reprova a lista versionada (rotas-do-app.json) quando ela difere das pastas.
 *
 * Regras do App Router aplicadas:
 * - cada pasta com page.tsx (ou .ts, .jsx, .js, .mdx) é uma página;
 * - grupos "(nome)" não entram no endereço;
 * - pastas privadas "_nome", slots paralelos "@nome" e rotas interceptadas
 *   "(.)nome" ficam fora (não são endereços próprios);
 * - a pasta /api de primeiro nível só tem rotas de servidor, nunca páginas.
 * Rotas de servidor (route.ts) não são páginas e ficam fora: entre elas a
 * aplicação de página única do Crédito (/observatorio), que não usa o layout raiz.
 */
const ARQUIVO_PAGINA = /^page\.(tsx|ts|jsx|js|mdx)$/;

export function rotasDoSistemaDeArquivos(dirApp: string): string[] {
  const rotas = new Set<string>();
  const visitar = (dir: string, segmentos: string[]) => {
    const entradas = readdirSync(dir, { withFileTypes: true });
    if (entradas.some((e) => e.isFile() && ARQUIVO_PAGINA.test(e.name))) {
      rotas.add(segmentos.length ? `/${segmentos.join("/")}` : "/");
    }
    for (const e of entradas) {
      if (!e.isDirectory()) continue;
      const nome = e.name;
      if (nome.startsWith("_") || nome.startsWith("@") || /^\(\.+\)/.test(nome)) continue;
      if (segmentos.length === 0 && nome === "api") continue;
      const grupo = /^\(.+\)$/.test(nome);
      visitar(join(dir, nome), grupo ? segmentos : [...segmentos, nome]);
    }
  };
  visitar(dirApp, []);
  return Array.from(rotas).sort();
}
