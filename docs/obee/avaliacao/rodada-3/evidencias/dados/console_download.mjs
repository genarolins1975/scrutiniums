import { createRequire } from "node:module";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const B = "http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
async function teste(rota, botao, repouso) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = [];
  p.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 140)); });
  await p.goto(B + rota, { waitUntil: "load" });
  await p.waitForFunction(() => !document.documentElement.hasAttribute("data-recorte"), null, { timeout: 15000 });
  await p.waitForTimeout(repouso);
  const antes = erros.length;
  let baixou = false;
  if (botao) {
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), p.getByRole("button", { name: new RegExp(botao, "i") }).first().click()]);
    baixou = !!dl;
    await p.waitForTimeout(2500);
  }
  const r = { rota, botao, repouso, errosAntesDoClique: antes, errosDepois: erros.length - antes, exemplo: erros[antes] ?? erros[0] ?? null, baixou };
  await ctx.close();
  return r;
}
for (const [rota, botao] of [["/comparar", null], ["/comparar", "Baixar estes valores \\(CSV\\)"], ["/comparar", "Dicion.rio das colunas"], ["/gastos?med=despesa_hab", null], ["/gastos?med=despesa_hab", "Baixar estes valores \\(CSV\\)"]]) {
  for (let i = 0; i < 2; i++) console.log(JSON.stringify(await teste(rota, botao, 3500)));
}
await b.close();
