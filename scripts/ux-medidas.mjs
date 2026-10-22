// Mede o DOM renderizado de uma lista de rotas a 1440 e 390 px e salva capturas da primeira tela e da página inteira.
// Base do parecer docs/PARECER_UX_2026-10-21.md (seção 5) e dos orçamentos das iniciativas 2, 4 e 10.
//
// Uso: node scripts/ux-medidas.mjs <base> <pasta de saída> <cookie de sessão ou -> <rota> [<rota> ...]
//   node scripts/ux-medidas.mjs http://localhost:3111 /tmp/ux - / /perguntas/familias
//   node scripts/ux-medidas.mjs http://localhost:3111 /tmp/ux "<valor de scrutiniums_session>" /app/observatorios /setor-eletrico
//
// Depende do Playwright do repositório e do Chromium instalado (PLAYWRIGHT_BROWSERS_PATH ou CHROMIUM_PATH).
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const [base, saida, cookie, ...rotas] = process.argv.slice(2);
if (!base || !saida || !cookie || rotas.length === 0) {
  console.error("uso: node scripts/ux-medidas.mjs <base> <saida> <cookie|-> <rota> [...]");
  process.exit(2);
}
mkdirSync(saida, { recursive: true });
// Chromium: CHROMIUM_PATH, senão o binário da pasta PLAYWRIGHT_BROWSERS_PATH (ambiente de nuvem), senão o padrão do Playwright.
const candidato = process.env.CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : null);
const executablePath = candidato && existsSync(candidato) ? candidato : undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const resultados = [];
for (const largura of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 1440 ? 900 : 844 }, deviceScaleFactor: 1 });
  if (cookie !== "-") await ctx.addCookies([{ name: "scrutiniums_session", value: cookie, url: base }]);
  for (const rota of rotas) {
    const page = await ctx.newPage();
    const falhas = [];
    page.on("response", (r) => { if (r.status() >= 400) falhas.push(`${r.status()} ${r.url().replace(base, "")}`); });
    let final = "";
    try {
      const resp = await page.goto(base + rota, { waitUntil: "networkidle", timeout: 90000 });
      final = page.url().replace(base, "");
      await page.waitForTimeout(800);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const h1 = document.querySelector("h1");
        const linhasH1 = h1 ? Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)) : null;
        const todos = Array.from(document.querySelectorAll("body *"));
        const pequenos = todos.filter((e) => {
          const cs = getComputedStyle(e);
          if (cs.display === "none" || cs.visibility === "hidden") return false;
          const temTexto = Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
          return temTexto && parseFloat(cs.fontSize) < 12;
        }).length;
        const fora = todos.filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 1 && r.width > 0; }).length;
        const imgs = Array.from(document.images);
        const quebradas = imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src"));
        const navs = Array.from(document.querySelectorAll("nav")).map((n) => n.getAttribute("aria-label") || "(sem rótulo)");
        const links = document.querySelectorAll("a[href]").length;
        // cromo: do topo até o início do <main> (ou do primeiro h1) e posição do primeiro número tabular
        const main = document.querySelector("main");
        const topoConteudo = (main ?? h1)?.getBoundingClientRect().top ?? null;
        const topoH1 = h1?.getBoundingClientRect().top ?? null;
        // o número da escala do molde (EntradaColecao, data-numero-escala) quando há; senão, a abertura antiga do Setor Elétrico
        // (.energia-abertura-medidas) ou o primeiro número tabular do <main>, para medir o antes das entradas ainda fora do molde
        const numero =
          document.querySelector("[data-numero-escala]") ??
          document.querySelector(".energia-abertura-medidas strong") ??
          document.querySelector("h1 ~ dl dd, h1 ~ * dl dd");
        const primeiroNumero = numero ? Math.round(numero.getBoundingClientRect().top) : null;
        return {
          altura: document.documentElement.scrollHeight,
          scrollX: document.documentElement.scrollWidth > vw + 1,
          h1: h1?.textContent.trim().slice(0, 90) ?? null, linhasH1, pequenos, fora, imgs: imgs.length, quebradas, navs, links,
          topoConteudo, topoH1, primeiroNumero, title: document.title,
        };
      });
      const nome = (rota === "/" ? "home" : rota.replace(/^\//, "").replace(/[\/\[\]?=&]/g, "_")) + `-${largura}`;
      await page.screenshot({ path: `${saida}/${nome}-topo.png`, fullPage: false });
      await page.screenshot({ path: `${saida}/${nome}-inteira.png`, fullPage: true });
      resultados.push({ rota, largura, status: resp?.status(), final, ...m, falhas: falhas.slice(0, 8) });
    } catch (e) {
      resultados.push({ rota, largura, erro: String(e).slice(0, 200), final, falhas: falhas.slice(0, 8) });
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${saida}/medidas.json`, JSON.stringify(resultados, null, 2));
for (const r of resultados) {
  console.log(
    `${r.rota} @${r.largura} → ${r.final || ""} | ${r.status ?? r.erro} | alt ${r.altura ?? "?"} | h1 "${r.h1 ?? ""}" (${r.linhasH1 ?? "?"} linhas, topo ${r.topoH1 ?? "?"}) | 1º número ${r.primeiroNumero ?? "?"} | <12px ${r.pequenos ?? "?"} | fora ${r.fora ?? "?"} | scrollX ${r.scrollX ?? "?"} | imgs ${r.imgs ?? "?"} quebradas ${JSON.stringify(r.quebradas ?? [])} | links ${r.links ?? "?"} | navs ${JSON.stringify(r.navs ?? [])} | falhas ${JSON.stringify(r.falhas)}`,
  );
}
