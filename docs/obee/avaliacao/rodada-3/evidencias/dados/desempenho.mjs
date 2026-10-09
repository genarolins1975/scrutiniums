// Medição de desempenho e estabilidade (avaliador de dados, rodada 3). Laboratório, não experiência real.
// Uso: node desempenho.mjs <saida.json> <repeticoes> [perfil: desktop|movel|movel_lento]
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const [,, saida, reps = "5", perfil = "desktop"] = process.argv;
const BASE = "http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais";
const ROTAS = [
  ["panorama", ""],
  ["gastos", "/gastos"],
  ["atendimento", "/atendimento"],
  ["resultados", "/resultados"],
  ["comparar", "/comparar"],
  ["metodos", "/metodos"],
  // links com recorte na URL
  ["gastos_recorte", "/gastos?cap=recife&med=despesa_mat&ano=2024&moeda=real&vis=evolucao"],
  ["comparar_recorte_tabela", "/comparar?vis=tabela&ano=2023&etapa=anos_finais&reg=NE"],
  ["resultados_recorte", "/resultados?med=saeb&ano=2023&etapa=anos_finais&disc=portugues&cap=natal"],
];
const PERFIS = {
  desktop: { viewport: { width: 1440, height: 900 }, cpu: 1, rede: null, mobile: false },
  movel: { viewport: { width: 390, height: 844 }, cpu: 4, rede: null, mobile: true },
  movel_lento: { viewport: { width: 390, height: 844 }, cpu: 4, rede: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }, mobile: true },
};
const P = PERFIS[perfil];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const out = [];
for (const [nome, rota] of ROTAS) {
  for (let r = 0; r < Number(reps); r++) {
    const ctx = await b.newContext({ viewport: P.viewport, isMobile: P.mobile, hasTouch: P.mobile, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (P.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: P.cpu });
    if (P.rede) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: P.rede.latency, downloadThroughput: P.rede.downloadThroughput, uploadThroughput: P.rede.uploadThroughput });
    const recs = new Map();
    cdp.on("Network.responseReceived", (e) => recs.set(e.requestId, { url: e.response.url, tipo: e.type, mime: e.response.mimeType, status: e.response.status, dec: 0, enc: 0 }));
    cdp.on("Network.dataReceived", (e) => { const x = recs.get(e.requestId); if (x) x.dec += e.dataLength; });
    cdp.on("Network.loadingFinished", (e) => { const x = recs.get(e.requestId); if (x) x.enc = e.encodedDataLength; });
    const erros = [];
    p.on("console", (m) => { if (["error", "warning"].includes(m.type())) erros.push(`${m.type()}: ${m.text().slice(0, 160)}`); });
    p.on("pageerror", (e) => erros.push("pageerror " + e.message.slice(0, 160)));
    await p.addInitScript(() => {
      window.__m = { lcp: 0, cls: 0, longtasks: [], fcp: 0, ls: [] };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__m.cls += e.value; window.__m.ls.push([Math.round(e.startTime), +e.value.toFixed(4)]); } }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.longtasks.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__m.fcp = e.startTime; }).observe({ type: "paint", buffered: true });
      // o que o leitor vê antes da hidratação e quando o recorte pedido aparece
      window.__t = { recorteSaiu: null, h2: null, vistoAntes: null };
      const obs = new MutationObserver(() => {
        if (document.documentElement && window.__t.visto === undefined && document.documentElement.hasAttribute("data-recorte")) window.__t.visto = performance.now();
        if (document.documentElement && window.__t.recorteSaiu === null && window.__t.visto !== undefined && !document.documentElement.hasAttribute("data-recorte")) window.__t.recorteSaiu = performance.now();
      });
      obs.observe(document, { attributes: true, subtree: true, attributeFilter: ["data-recorte"] });
      document.addEventListener("DOMContentLoaded", () => {
        window.__t.dcl = performance.now();
        window.__t.temRecorteNoDcl = document.documentElement.hasAttribute("data-recorte");
        window.__t.vistoAntes = (document.querySelector("main")?.innerText ?? "").slice(0, 240);
        window.__t.visAntesLen = (document.querySelector("main")?.innerText ?? "").length;
      });
    });
    const t0 = Date.now();
    await p.goto(BASE + rota, { waitUntil: "load" });
    await p.waitForFunction(() => !document.documentElement.hasAttribute("data-recorte"), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(3500); // janela de repouso para CLS tardio, prefetch e erros de console
    const m = await p.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const lt = window.__m.longtasks;
      const fcp = window.__m.fcp;
      const tbt = lt.filter(([s]) => s >= fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
      return {
        ttfb: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd),
        fcp: Math.round(fcp), lcp: Math.round(window.__m.lcp), cls: +window.__m.cls.toFixed(4), layoutShifts: window.__m.ls.slice(0, 6),
        tbt: Math.round(tbt), longtasks: lt.length, maiorLongtask: Math.round(Math.max(0, ...lt.map(([, d]) => d))),
        recorteSaiuMs: window.__t.recorteSaiu === null ? null : Math.round(window.__t.recorteSaiu), temRecorteNoDcl: window.__t.temRecorteNoDcl,
        vistoAntes: window.__t.vistoAntes, visAntesLen: window.__t.visAntesLen, h1: document.querySelector("h1")?.innerText ?? null,
        rolagemHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    const rs = [...recs.values()];
    const soma = (f, campo) => rs.filter(f).reduce((a, x) => a + x[campo], 0);
    const doc = rs.find((x) => x.tipo === "Document");
    m.htmlEnc = doc?.enc ?? 0; m.htmlDec = doc?.dec ?? 0;
    m.jsEnc = soma((x) => x.tipo === "Script" || /javascript/.test(x.mime), "enc"); m.jsDec = soma((x) => x.tipo === "Script" || /javascript/.test(x.mime), "dec");
    m.nScripts = rs.filter((x) => x.tipo === "Script" || /javascript/.test(x.mime)).length;
    m.cssEnc = soma((x) => x.tipo === "Stylesheet", "enc"); m.fontesEnc = soma((x) => x.tipo === "Font", "enc");
    m.totalEnc = rs.reduce((a, x) => a + x.enc, 0); m.requisicoes = rs.length;
    m.dadosEnc = soma((x) => /\.(json|csv)(\?|$)/.test(x.url) || x.tipo === "Fetch" || x.tipo === "XHR", "enc");
    m.rscPrefetch = rs.filter((x) => /_rsc=/.test(x.url)).length;
    m.erros = erros;
    out.push({ rota: nome, url: rota, rep: r, perfil, ...m, tempoTotalMs: Date.now() - t0 });
    await ctx.close();
  }
}
await b.close();
fs.writeFileSync(saida, JSON.stringify(out, null, 1));
const med = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
for (const [nome] of ROTAS) {
  const rr = out.filter((x) => x.rota === nome);
  console.log(nome.padEnd(24), `html ${(med(rr.map((x) => x.htmlEnc)) / 1024).toFixed(1)}kB(gz) ${(med(rr.map((x) => x.htmlDec)) / 1024).toFixed(0)}kB`,
    `js ${(med(rr.map((x) => x.jsEnc)) / 1024).toFixed(0)}kB(gz) ${(med(rr.map((x) => x.jsDec)) / 1024).toFixed(0)}kB n=${rr[0].nScripts}`,
    `total ${(med(rr.map((x) => x.totalEnc)) / 1024).toFixed(0)}kB`, `FCP ${med(rr.map((x) => x.fcp))}`, `LCP ${med(rr.map((x) => x.lcp))}`, `CLS ${med(rr.map((x) => x.cls))}`,
    `TBT ${med(rr.map((x) => x.tbt))}`, `recorte ${med(rr.map((x) => x.recorteSaiuMs ?? 0))}`, `erros ${rr.reduce((a, x) => a + x.erros.length, 0)}`);
}
