// Capturas dos casos de revisão em quatro larguras, com rolagem horizontal, axe-core e console.
// Uso: node casos.mjs <base_url> <pasta_saida>
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
// Playwright não é dependência do projeto: aponte PLAYWRIGHT_DIR para uma instalação local ou global.
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");

const base = process.argv[2];
const out = process.argv[3];
mkdirSync(out, { recursive: true });
const axe = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf-8");
const CASOS = [
  ["padrao", ""],
  ["boa-vista-2024", "?cap=boa-vista&ano=2024"],
  ["campo-grande-2021", "?cap=campo-grande&ano=2021"],
  ["poucos-pares-centro-oeste-2021", "?cap=campo-grande&ano=2021&grupo=regiao"],
  ["ausente-rio-branco-aprovacao", "?cap=rio-branco&etapa=anos_finais&med=aprovacao"],
  ["zero-real-rio-branco-matriculas", "?cap=rio-branco&ano=2021&etapa=anos_finais&med=matriculas"],
  ["ano-par-ideb-recife-2024", "?cap=recife&ano=2024&etapa=anos_finais&med=ideb"],
];
const LARGURAS = [["1440", 1440, 900], ["768", 768, 1024], ["390", 390, 844], ["320", 320, 640]];
const browser = await chromium.launch();
const resultado = {};
for (const [caso, q] of CASOS) {
  for (const [nome, w, h] of LARGURAS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const erros = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") erros.push(m.text().slice(0, 300)); });
    page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
    await page.goto(`${base}/eficiencia-estatal/educacao-municipal-capitais${q}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.locator("[data-cartao]").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${caso}-${nome}-cartoes.png` });
    await page.locator("#comparacao").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector("#comparacao").scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `${out}/${caso}-${nome}-comparacao.png` });
    let violacoes = null;
    if (nome === "1440" || nome === "390") {
      await page.addScriptTag({ content: axe });
      violacoes = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
        return r.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`);
      });
    }
    resultado[`${caso} @${nome}`] = { rolagem_horizontal_px: largura, erros: erros.length, violacoes };
    await page.close();
  }
}
await browser.close();
for (const [k, v] of Object.entries(resultado)) console.log(k.padEnd(48), "rolagem", v.rolagem_horizontal_px, "erros", v.erros, "axe", v.violacoes === null ? "-" : v.violacoes.length ? v.violacoes.join(" | ") : 0);
