import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const B = "http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais";
const rotas = [["Panorama", ""], ["Gastos", "/gastos"], ["Atendimento", "/atendimento"], ["Resultados", "/resultados"], ["Comparar", "/comparar"], ["Comparar tabela", "/comparar?vis=tabela"], ["Metodos", "/metodos"], ["Gastos SP detalhe", "/gastos?cap=sao-paulo&ano=2024&med=despesa_mat&vis=detalhe"]];
const perfis = [["sem estrangulamento", null], ["CPU 4x + 4G (9 Mbps, 170 ms)", { cpu: 4, down: 9e6 / 8, up: 1.5e6 / 8, lat: 170 }]];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const out = [];
for (const [pn, prof] of perfis) {
  for (const [nome, rota] of rotas) {
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await ctx.newPage();
      const cdp = await ctx.newCDPSession(p);
      if (prof) {
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", { offline: false, downloadThroughput: prof.down, uploadThroughput: prof.up, latency: prof.lat });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: prof.cpu });
      }
      await p.addInitScript(() => {
        window.__cls = 0; window.__lcp = 0; window.__long = [];
        new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({ type: "longtask", buffered: true });
      });
      const sizes = { html: 0, js: 0, css: 0, json: 0, csv: 0, font: 0, img: 0, other: 0 }; let n = 0; const urls = [];
      p.on("response", async r => {
        try {
          const ct = (r.headers()["content-type"] || ""); const buf = await r.body().catch(() => null); const len = buf ? buf.length : 0; n++;
          const enc = r.headers()["content-encoding"] || "";
          const k = ct.includes("html") ? "html" : ct.includes("javascript") ? "js" : ct.includes("css") ? "css" : ct.includes("json") ? "json" : ct.includes("csv") ? "csv" : ct.includes("font") ? "font" : ct.includes("image") ? "img" : "other";
          sizes[k] += len; urls.push([r.url().replace("http://localhost:3100", ""), k, len, enc]);
        } catch {}
      });
      const t0 = Date.now();
      await p.goto(B + rota, { waitUntil: "load" });
      // conteúdo principal: h1 visível e primeiro svg/tabela do gráfico
      await p.waitForSelector("main h1", { state: "visible" });
      const tH1 = Date.now() - t0;
      await p.waitForLoadState("networkidle");
      await p.waitForTimeout(500);
      const m = await p.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        return { dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, ttfb: nav.responseStart, fcp: fcp ? fcp.startTime : null, lcp: window.__lcp, cls: window.__cls, tbt: window.__long.reduce((a, d) => a + Math.max(0, d - 50), 0), longtasks: window.__long.length, transfer: nav.transferSize, decoded: nav.decodedBodySize };
      });
      const tr = await p.evaluate(() => performance.getEntriesByType("resource").reduce((a, e) => a + (e.transferSize || 0), 0));
      runs.push({ ...m, tH1, sizes, n, resTransfer: tr, urls });
      await ctx.close();
    }
    const med = k => { const v = runs.map(r => r[k]).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    out.push({ perfil: pn, rota: nome, fcp: med("fcp"), lcp: med("lcp"), tH1: med("tH1"), dcl: med("dcl"), load: med("load"), cls: med("cls"), tbt: med("tbt"), n: med("n"), html: runs[0].sizes.html, js: runs[0].sizes.js, css: runs[0].sizes.css, json: runs[0].sizes.json, csv: runs[0].sizes.csv, font: runs[0].sizes.font, img: runs[0].sizes.img, other: runs[0].sizes.other, maxcls: Math.max(...runs.map(r => r.cls)), urls: runs[0].urls });
    console.log(pn, nome, "LCP", med("lcp")?.toFixed(0), "FCP", med("fcp")?.toFixed(0), "h1", med("tH1"), "CLS", med("cls")?.toFixed(4), "TBT", med("tbt")?.toFixed(0), "bytes html/js/json", runs[0].sizes.html, runs[0].sizes.js, runs[0].sizes.json);
  }
}
await b.close();
fs.writeFileSync("perf_saida.json", JSON.stringify(out, null, 1));
