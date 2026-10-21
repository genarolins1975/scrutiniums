// Uso: node visit.mjs entrada.json saida.json  -- entrada: [{name,url,csv:true|false, width}]
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const [,, inp, outp] = process.argv;
const jobs = JSON.parse(fs.readFileSync(inp, "utf8"));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const out = [];
for (const j of jobs) {
  const ctx = await b.newContext({ viewport: { width: j.width || 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const logs = [];
  p.on("console", m => { if (["error", "warning"].includes(m.type())) logs.push(m.type() + ": " + m.text()); });
  p.on("pageerror", e => logs.push("pageerror: " + e.message));
  p.on("response", r => { if (r.status() >= 400) logs.push("http" + r.status() + " " + r.url()); });
  p.on("requestfailed", r => logs.push("reqfail " + r.url()));
  const res = { name: j.name, url: j.url, logs };
  try {
    await p.goto(j.url, { waitUntil: "networkidle" });
    await p.waitForTimeout(400);
    res.main = await p.evaluate(() => (document.querySelector("main") || document.body).innerText);
    res.tables = await p.evaluate(() => [...document.querySelectorAll("main table")].map(t => ({ caption: t.querySelector("caption")?.innerText || "", rows: [...t.rows].map(r => [...r.cells].map(c => c.innerText.trim())) })));
    res.finalUrl = p.url();
    res.selects = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll("main select")].map(s => [s.id, s.value])));
    if (j.csv) {
      const btns = p.getByRole("button", { name: /Baixar/i });
      const n = await btns.count();
      res.csvButtons = n;
      res.csvs = [];
      for (let i = 0; i < n; i++) {
        const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), btns.nth(i).click()]);
        const path = await dl.path();
        res.csvs.push({ nome: dl.suggestedFilename(), texto: fs.readFileSync(path, "utf8") });
      }
    }
  } catch (e) { res.erro = String(e).slice(0, 400); }
  out.push(res);
  await ctx.close();
}
await b.close();
fs.writeFileSync(outp, JSON.stringify(out, null, 1));
console.log("ok", out.length);
