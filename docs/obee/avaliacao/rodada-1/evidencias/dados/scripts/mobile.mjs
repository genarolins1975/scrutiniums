import { createRequire } from "node:module";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const B = "http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais";
const rotas = ["", "/gastos?cap=sao-paulo", "/atendimento", "/resultados?cap=recife&med=ideb", "/comparar", "/comparar?vis=tabela", "/metodos"];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const w of [320, 390, 768, 1440]) {
  for (const r of rotas) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
    const p = await ctx.newPage();
    await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
    const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/favicon|404/.test(m.text())) errs.push(m.text()); });
    await p.goto(B + r, { waitUntil: "networkidle" }); await p.waitForTimeout(400);
    // interação: rolar até o fim para disparar lazy
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => ({ cls: window.__cls, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log(w, r || "/", "CLS", m.cls.toFixed(4), "overflowX", m.sw > m.cw ? `SIM (${m.sw}>${m.cw})` : "não", errs.length ? "ERROS " + errs.join("|") : "");
    await ctx.close();
  }
}
await b.close();
