import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const B = "http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.goto(B, { waitUntil: "networkidle" });
const out = {};
const sec = async () => (await p.locator("main").innerText());
const recursos = p.locator("section").filter({ hasText: "01 / RECURSOS" }).first();
for (const nome of ["Total", "Por habitante", "Por matrícula"]) {
  await recursos.getByRole("tab", { name: new RegExp("^" + nome) }).click().catch(async () => { await recursos.getByText(nome, { exact: true }).first().click(); });
  await p.waitForTimeout(300);
  out["rec_" + nome] = (await recursos.innerText()).slice(0, 1500);
}
// tabela de recursos
await recursos.getByRole("tab", { name: /Tabela/ }).click().catch(() => {});
await p.waitForTimeout(300);
out.rec_tabela = (await recursos.innerText()).slice(0, 2500);
out.rec_tabelas = await recursos.locator("table").evaluateAll(ts => ts.map(t => [...t.rows].map(r => [...r.cells].map(c => c.innerText.trim()))));
// capital destacada
await p.selectOption("select", { label: "Boa Vista (RR)" }).catch(() => {});
await p.waitForTimeout(400);
out.destacada = (await p.locator("main").innerText()).slice(0, 4000);
fs.writeFileSync("pan_saida.json", JSON.stringify(out, null, 1));
await b.close();
