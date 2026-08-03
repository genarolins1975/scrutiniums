/* Prepara a auditoria WCAG: serve a SPA estática, publica o axe-core ao lado
   dela e imprime o procedimento. Uso:

     node scripts/auditoria-wcag.mjs

   Não baixa navegador nem adiciona dependência de build — usa o axe-core que já
   está em node_modules e o navegador que você já tem. O guarda automático de
   contraste (esse sim roda a cada commit) está em src/tests/wcag-contraste.test.ts. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const RAIZ = join(import.meta.dirname, "..", "public");
const AXE = join(import.meta.dirname, "..", "node_modules", "axe-core", "axe.min.js");
const PORTA = Number(process.env.PORTA || 8791);

if (!existsSync(AXE)) {
  console.error("axe-core não encontrado em node_modules. Rode: npm install");
  process.exit(1);
}

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  const caminho = decodeURIComponent((req.url || "/").split("?")[0]);
  try {
    // o axe é servido da mesma origem: a página tem CSP e não carrega CDN
    const arquivo = caminho === "/_axe.js" ? AXE : join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ""));
    const dados = await readFile(arquivo);
    res.writeHead(200, { "content-type": TIPOS[extname(arquivo)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(dados);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("não encontrado: " + caminho);
  }
}).listen(PORTA, () => {
  const url = `http://localhost:${PORTA}/obs/index.html#overview`;
  console.log(`
Auditoria WCAG 2.1 AA — Observatório Brasileiro de Crédito

  1. abra   ${url}
  2. espere os dados carregarem
  3. cole no console o conteúdo de   scripts/wcag-sweep.js
  4. a varredura percorre todas as páginas nos temas claro e escuro (~1 min)
  5. registre o resultado em   docs/AUDITORIA_WCAG.md

O que esta varredura cobre e o que não cobre está declarado no documento.
Ctrl+C encerra o servidor.`);
});
