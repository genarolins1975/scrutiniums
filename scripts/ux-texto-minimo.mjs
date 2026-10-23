// Lista os textos abaixo de 12 px (scripts/ux-texto-minimo-medida.mjs) numa lista de rotas a 1440 e 390 px, agrupados por
// elemento, corpo e classe, para achar de onde vêm.
//
// Uso: node scripts/ux-texto-minimo.mjs <base> <cookie de sessão ou -> <saida.json> <rota> [<rota> ...]
//   node scripts/ux-texto-minimo.mjs http://localhost:3111 - /tmp/texto.json / /glossario
//
// Depende do Playwright do repositório e do Chromium (CHROMIUM_PATH ou PLAYWRIGHT_BROWSERS_PATH).
import { chromium } from "playwright";
import { existsSync, writeFileSync } from "node:fs";
import { medirTextoMinimo } from "./ux-texto-minimo-medida.mjs";

const [base, cookie, saida, ...rotas] = process.argv.slice(2);
if (!base || !cookie || !saida || rotas.length === 0) {
  console.error("uso: node scripts/ux-texto-minimo.mjs <base> <cookie|-> <saida.json> <rota> [...]");
  process.exit(2);
}
const candidato = process.env.CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : null);
const executablePath = candidato && existsSync(candidato) ? candidato : undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const resultados = [];
for (const largura of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 1440 ? 900 : 844 }, deviceScaleFactor: 1 });
  if (cookie !== "-") await ctx.addCookies([{ name: "scrutiniums_session", value: cookie, url: base }]);
  for (const rota of rotas) {
    const page = await ctx.newPage();
    try {
      await page.goto(base + rota, { waitUntil: "networkidle", timeout: 120000 });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.waitForTimeout(400);
      const m = await page.evaluate(medirTextoMinimo);
      const grupos = {};
      for (const p of m.pequenos) {
        const chave = `${p.tag} ${p.px}px .${p.classe}`;
        (grupos[chave] ??= { n: 0, exemplo: p.texto }).n++;
      }
      resultados.push({ rota, largura, final: page.url().replace(base, ""), total: m.total, grupos });
      console.error(`${largura} ${rota} <12px=${m.total}`);
    } catch (e) {
      resultados.push({ rota, largura, erro: String(e).slice(0, 200) });
      console.error(`${largura} ${rota} ERRO ${String(e).slice(0, 120)}`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync(saida, JSON.stringify(resultados, null, 2));
