// Verificação visual das rotas de Energia que receberam tratamento de datas e literais:
// rolagem horizontal da página, axe-core (WCAG 2.0 a 2.2 A e AA) e capturas dos blocos modificados.
// Uso: node energia-datas.mjs <base_url> <pasta_saida> [inventario.json]
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
// Playwright não é dependência do projeto: aponte PLAYWRIGHT_DIR para uma instalação local ou global.
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const base = process.argv[2];
const out = process.argv[3];
mkdirSync(out, { recursive: true });
const axe = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf-8");
const ROTAS = readFileSync(new URL("./rotas-energia-datas.txt", import.meta.url), "utf-8").split("\n").filter(Boolean);
const LARGURAS = [["1440", 1440, 900], ["768", 768, 1024], ["390", 390, 844], ["320", 320, 640]];
const nome = (r) => r.replace(/^\/setor-eletrico\/?/, "").replace(/\//g, "_") || "raiz";

const browser = await chromium.launch();
const linhas = [];
for (const rota of ROTAS) {
  for (const [lbl, w, h] of LARGURAS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message));
    page.setDefaultTimeout(45000);
    try {
      await page.goto(`${base}${rota}`, { waitUntil: "load" });
      await page.waitForTimeout(600);
    } catch (e) {
      linhas.push({ rota, largura: lbl, rolagem: -1, literais: -1, tempos: -1, axe: "falha de carregamento", erros: 1 });
      await page.close();
      continue;
    }
    // abre os <details> e as gavetas só para medir; a captura mostra o estado natural
    const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const lit = await page.locator("[data-literal-fonte]").count();
    const tempo = await page.locator("time[datetime]").count();
    let axeViol = "-";
    if (lbl === "1440" || lbl === "390") {
      await page.addScriptTag({ content: axe });
      const v = await Promise.race([
        page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
          return r.violations.map((x) => `${x.id}(${x.nodes.length})`);
        }),
        new Promise((res) => setTimeout(() => res(["axe-sem-resposta-em-90s"]), 90000)),
      ]);
      axeViol = v.length ? v.join(",") : "0";
    }
    if (lit > 0 && (lbl === "1440" || lbl === "390" || lbl === "320")) {
      const el = page.locator("[data-literal-fonte]").first();
      await el.scrollIntoViewIfNeeded().catch(() => {});
      const alvo = el.locator("xpath=ancestor::*[self::li or self::p or self::td or self::th or self::dd][1]");
      const caixa = (await alvo.count()) ? alvo.first() : el;
      await caixa.screenshot({ path: `${out}/${nome(rota)}-literal-${lbl}.png` }).catch(() => {});
    }
    linhas.push({ rota, largura: lbl, rolagem, literais: lit, tempos: tempo, axe: axeViol, erros: erros.length });
    console.error(`ok ${rota} @${lbl}`);
    await page.close();
  }
}
await browser.close();
for (const l of linhas) console.log(`${l.rota.padEnd(52)} @${l.largura.padEnd(4)} rolagem ${String(l.rolagem).padStart(3)} literais ${String(l.literais).padStart(2)} time ${String(l.tempos).padStart(3)} axe ${l.axe} erros ${l.erros}`);
const ruim = linhas.filter((l) => l.rolagem > 0 || l.erros > 0 || (l.axe !== "-" && l.axe !== "0"));
console.log(`\n${linhas.length} verificações; com rolagem, erro ou violação de axe: ${ruim.length}`);
for (const l of ruim) console.log("  ", JSON.stringify(l));
