// Capturas reais do painel em quatro larguras, verificação de rolagem horizontal,
// axe-core e console. Uso: node capturas.mjs <base_url> <pasta_saida> [query]
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
// Playwright não é dependência do projeto: aponte PLAYWRIGHT_DIR para uma instalação local ou global.
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");

const base = process.argv[2];
const out = process.argv[3];
const query = process.argv[4] || "";
mkdirSync(out, { recursive: true });
const axe = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf-8");
const url = `${base}/eficiencia-estatal/educacao-municipal-capitais${query}`;

const browser = await chromium.launch();
const resultado = {};
for (const [nome, w, h] of [["desktop", 1440, 900], ["tablet", 768, 1024], ["celular", 390, 844], ["estreito", 320, 640]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") erros.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const largura = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  await page.screenshot({ path: `${out}/${nome}-topo.png`, fullPage: false });
  await page.screenshot({ path: `${out}/${nome}-inteira.png`, fullPage: true });
  let violacoes = null;
  if (nome === "desktop" || nome === "celular") {
    await page.addScriptTag({ content: axe });
    violacoes = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return r.violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, exemplo: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
    });
  }
  resultado[nome] = { largura, erros, violacoes };
  await page.close();
}
await browser.close();
console.log(JSON.stringify(resultado, null, 1));
