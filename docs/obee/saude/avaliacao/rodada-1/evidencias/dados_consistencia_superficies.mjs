import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const base = "http://localhost:3111/eficiencia-estatal/saude-capitais";
const casos = [
  ["/gastos", "despesa_hab", 2021, "nominal"], ["/gastos", "despesa_hab", 2025, "nominal"], ["/gastos", "despesa_hab", 2025, "real"], ["/gastos", "despesa", 2025, "nominal"], ["/gastos", "asps_pct", 2025, "nominal"], ["/gastos", "asps_pct", 2021, "nominal"],
  ["/rede-e-atencao-primaria", "esf_10mil", 2021, "nominal"], ["/rede-e-atencao-primaria", "esf_10mil", 2025, "nominal"], ["/rede-e-atencao-primaria", "ubs_10mil", 2025, "nominal"], ["/rede-e-atencao-primaria", "cobertura_aps", 2021, "nominal"], ["/rede-e-atencao-primaria", "cobertura_aps", 2022, "nominal"],
  ["/atendimento-e-resultados", "icsap_taxa", 2021, "nominal"], ["/atendimento-e-resultados", "icsap_taxa", 2024, "nominal"], ["/atendimento-e-resultados", "icsap_n", 2024, "nominal"], ["/atendimento-e-resultados", "icsap_part", 2024, "nominal"],
];
const b = await chromium.launch();
const out = [];
for (const [rota, med, ano, moeda] of casos) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const q = `?med=${med}&ano=${ano}&moeda=${moeda}`;
  const r = { rota, med, ano, moeda };
  await p.goto(`${base}${rota}${q}&vis=grafico`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  r.h2 = (await p.locator("h2").first().innerText()).trim();
  r.circulos = await p.locator("figure svg circle").count();
  r.svgMediana = await p.locator("figure svg text", { hasText: /^Mediana/ }).allInnerTexts();
  r.foraSvg = await p.locator("figure svg [data-fora-da-comparacao]").count();
  const body = await p.evaluate(() => document.body.innerText);
  r.refGrupo = (body.match(/REFERÊNCIAS DO GRUPO:[^\n]*/i) || [""])[0];
  r.mediana_ref = (body.match(/MEDIANA\n([^\n]+)/) || ["", ""])[1];
  r.razao = (body.match(/Razão agregada[^\n]*/) || [""])[0].slice(0, 130);
  r.legenda = (body.match(/(\d+) CAPITAL(?:IS)? FORA[^\n]*/i) || [""])[0];
  r.nCapitaisForaListadas = (body.match(/Fora da comparação\n/g) || []).length;
  // tabela
  await p.goto(`${base}${rota}${q}&vis=tabela`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  const linhas = await p.locator("table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.innerText.trim())));
  r.tabela = linhas;
  // CSV do explorador
  await p.goto(`${base}${rota}${q}&vis=grafico`, { waitUntil: "networkidle" });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /Baixar CSV/ }).first().click()]);
  const path = `dl_${rota.replace(/\W/g, "")}_${med}_${ano}_${moeda}.csv`;
  await dl.saveAs(path);
  r.csv = path; r.csv_nome = dl.suggestedFilename();
  out.push(r);
  await ctx.close();
}
await b.close();
fs.writeFileSync("consist.json", JSON.stringify(out, null, 1));
console.log("ok", out.length);
