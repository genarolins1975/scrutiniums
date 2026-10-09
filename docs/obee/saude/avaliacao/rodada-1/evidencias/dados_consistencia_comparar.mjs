import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const b = await chromium.launch();
const casos = [["asps_pct",2021],["asps_pct",2025],["icsap_taxa",2021],["icsap_taxa",2024],["ubs_10mil",2021],["ubs_10mil",2025],["despesa_hab",2021],["despesa_hab",2025],["cobertura_aps",2022],["esf_10mil",2025]];
const out = [];
for (const [m, a] of casos) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3111/eficiencia-estatal/saude-capitais/comparar?med=${m}&ano=${a}`, { waitUntil: "networkidle" });
  const t = await p.evaluate(() => document.querySelector("main").innerText);
  const painel = (t.match(/(\d+) de (\d+) capitais na comparação/) || [])[0];
  const med = (t.match(/Mediana\n?([^\n]*)\n/) || [])[0];
  const [d1] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /Baixar CSV da medida/ }).click()]);
  await d1.saveAs(`cmp_med_${m}_${a}.csv`);
  const [d2] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /Baixar CSV da tabela/ }).click()]);
  await d2.saveAs(`cmp_tab_${m}_${a}.csv`);
  out.push({ m, a, painel, med: (t.match(/Mediana [^\n]+/) || [""])[0] });
  await ctx.close();
}
await b.close();
fs.writeFileSync("comparar_check.json", JSON.stringify(out, null, 1));
console.log("ok");
