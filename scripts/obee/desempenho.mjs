// Métricas de carregamento no build de produção local (Chromium headless, sem limitação de rede/CPU
// e com limitação 4x CPU + rede "Fast 3G" aproximada via CDP). Uso: node desempenho.mjs <url>
import { createRequire } from "node:module";
// Playwright não é dependência do projeto: aponte PLAYWRIGHT_DIR para uma instalação local ou global.
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const url = process.argv[2];
const browser = await chromium.launch();
async function medir(nome, limitar) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  if (limitar) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0; window.__tbt = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__tbt += Math.max(0, e.duration - 50); }).observe({ type: "longtask", buffered: true });
  });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return { ttfb: Math.round(nav.responseStart), fcp: Math.round(fcp?.startTime ?? 0), lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(4), tbt: Math.round(window.__tbt), domInteractive: Math.round(nav.domInteractive), load: Math.round(nav.loadEventEnd), transfer: nav.transferSize };
  });
  console.log(nome, JSON.stringify({ ...m, total_ms: Date.now() - t0 }));
  await ctx.close();
}
await medir("sem_limitacao", false);
await medir("cpu4x_rede_lenta", true);
await browser.close();
