// Capturas de exemplos de prosa com datas, competências e instantes formatados (Energia), em 1440 e 390 px.
// Uso: node energia-datas-prosa.mjs <base_url> <pasta_saida>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
// Playwright não é dependência do projeto: aponte PLAYWRIGHT_DIR para uma instalação local ou global.
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const base = process.argv[2];
const out = process.argv[3];
mkdirSync(out, { recursive: true });
const EXEMPLOS = [
  { arquivo: "instante-utc-pld", rota: "/setor-eletrico/pld", modo: "Auditar", texto: /busca de .*UTC/ },
  { arquivo: "competencia-regulacao", rota: "/setor-eletrico/regulacao/linha-do-tempo", modo: "Entender", texto: /acionada a R\$ 50,00\/MWh em novembro de 2017/ },
  { arquivo: "competencia-territorio-tabela", rota: "/setor-eletrico/territorio", modo: "Auditar", texto: /última competência publicada: out\/2005/ },
  { arquivo: "periodo-carga", rota: "/setor-eletrico/carga", modo: "Auditar", texto: /período: 01\/01\/2000 a / },
];
const browser = await chromium.launch();
for (const [lbl, w, h] of [["1440", 1440, 900], ["390", 390, 844]]) {
  for (const ex of EXEMPLOS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(base + ex.rota, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const alvo = page.getByText(ex.texto).first();
    const abre = () => alvo.evaluate((e) => { for (let n = e; n; n = n.parentElement) if (n.tagName === "DETAILS") n.open = true; }).catch(() => {});
    const visivel = () => alvo.evaluate((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).catch(() => false);
    await abre();
    for (const modo of [ex.modo, "Auditar", "Analisar", "Entender"]) {
      if (await visivel()) break;
      await page.getByRole("radio", { name: new RegExp(`^${modo}$`, "i") }).first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      await abre();
    }
    await alvo.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
    await page.waitForTimeout(250);
    const bloco = alvo.locator("xpath=ancestor-or-self::*[self::tr or self::li or self::p or self::dd][1]").first();
    const c = await bloco.boundingBox().catch(() => null);
    if (c) {
      const m = 10, x = Math.max(0, c.x - m), y = Math.max(0, c.y - m);
      await page.screenshot({ path: `${out}/${ex.arquivo}-${lbl}.png`, clip: { x, y, width: Math.min(w - x, c.width + 2 * m), height: Math.min(h - y, c.height + 2 * m) } }).catch(() => {});
    }
    console.log(`${ex.arquivo} @${lbl}: ${c ? "capturado" : "não encontrado"}`);
    await page.close();
  }
}
await browser.close();
