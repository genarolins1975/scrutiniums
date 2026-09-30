/* Inspeção automatizada do Observatório do Setor Elétrico num servidor já no ar
   (next start ou produção). Percorre as páginas a partir de /setor-eletrico seguindo
   os links internos do domínio e, em cada página e largura de tela:

     - captura de tela (primeira dobra e página inteira nas larguras escolhidas);
     - rolagem horizontal da página (scrollWidth maior que a janela);
     - erros de console e respostas HTTP com erro (inclusive dados em /energia/);
     - varredura axe-core (WCAG 2.0/2.1/2.2 A e AA);
     - links internos quebrados (status HTTP de cada href do domínio).

   Uso:
     PW_CORE=/caminho/node_modules/playwright-core node scripts/energia-inspecao.mjs \
       --base http://localhost:3000 --saida /tmp/inspecao [--larguras 360,390,768,1440] [--max 200]

   Não é dependência do build: playwright-core é resolvido pelo caminho em PW_CORE
   (ou por node_modules, se instalado) e o navegador por CHROMIUM (padrão: o Chromium
   pré-instalado do ambiente). O relatório (relatorio.json) registra dispositivo
   emulado, largura, data e limites: é inspeção de laboratório, não medida de campo. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const BASE = (args.base || "http://localhost:3000").replace(/\/$/, "");
const SAIDA = args.saida || "inspecao-energia";
const LARGURAS = (args.larguras || "360,390,768,1440").split(",").map(Number);
const MAX = Number(args.max || 250);
const CHROMIUM = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || "playwright-core");
const AXE = await readFile(join(import.meta.dirname, "..", "node_modules", "axe-core", "axe.min.js"), "utf-8");

const nomeArquivo = (url, w, sufixo) => `${url.replace(BASE, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "raiz"}__${w}${sufixo}.png`;

await mkdir(SAIDA, { recursive: true });
const navegador = await chromium.launch({ executablePath: CHROMIUM });
const fila = ["/setor-eletrico"];
const vistos = new Set();
const status = new Map();
const relatorio = { base: BASE, iniciado_em: new Date().toISOString(), navegador: "Chromium (headless)", larguras: LARGURAS, paginas: [] };

async function checaStatus(caminho) {
  if (status.has(caminho)) return status.get(caminho);
  try {
    const r = await fetch(BASE + caminho, { redirect: "follow" });
    status.set(caminho, r.status);
  } catch (e) {
    status.set(caminho, `erro: ${e.message}`);
  }
  return status.get(caminho);
}

while (fila.length && vistos.size < MAX) {
  const caminho = fila.shift();
  if (vistos.has(caminho)) continue;
  vistos.add(caminho);
  const pagina = { caminho, larguras: {} };
  for (const w of LARGURAS) {
    const ctx = await navegador.newContext({ viewport: { width: w, height: w < 800 ? 780 : 900 }, deviceScaleFactor: 1, isMobile: w < 800, hasTouch: w < 800 });
    const p = await ctx.newPage();
    const console_ = [];
    const falhasRede = [];
    p.on("console", (m) => m.type() === "error" && console_.push(m.text().slice(0, 300)));
    p.on("pageerror", (e) => console_.push(`pageerror: ${e.message.slice(0, 300)}`));
    p.on("response", (r) => r.status() >= 400 && falhasRede.push(`${r.status()} ${r.url().replace(BASE, "")}`));
    const t0 = Date.now();
    const resp = await p.goto(BASE + caminho, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => ({ status: () => `erro: ${e.message}` }));
    const carga_ms = Date.now() - t0;
    await p.waitForTimeout(400);
    const medidas = await p.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      altura: document.documentElement.scrollHeight,
      titulo: document.title,
      h1: Array.from(document.querySelectorAll("h1")).map((h) => h.textContent?.trim()),
      links: Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")),
      largosDemais: Array.from(document.querySelectorAll("body *"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > window.innerWidth + 1 && getComputedStyle(el).position !== "fixed" && !el.closest(".tabela-scroll, [data-rolagem-contida]");
        })
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)}`),
    }));
    await p.addScriptTag({ content: AXE });
    const axe = await p.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return r.violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, exemplo: v.nodes[0]?.target?.join(" ") }));
    });
    await p.screenshot({ path: join(SAIDA, nomeArquivo(BASE + caminho, w, "_dobra")) });
    if (w === 390 || w === 1440) await p.screenshot({ path: join(SAIDA, nomeArquivo(BASE + caminho, w, "_inteira")), fullPage: true });
    pagina.larguras[w] = {
      status: resp?.status?.() ?? null,
      carga_ms,
      rolagem_horizontal: medidas.scrollWidth > medidas.innerWidth + 1,
      elementos_transbordando: medidas.largosDemais,
      erros_console: console_,
      falhas_rede: falhasRede,
      axe,
      titulo: medidas.titulo,
      h1: medidas.h1,
    };
    if (w === LARGURAS[0]) {
      for (const href of medidas.links) {
        if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) continue;
        const semHash = href.split("#")[0];
        const alvo = semHash.split("?")[0];
        if (!alvo.startsWith("/")) continue;
        const st = await checaStatus(alvo);
        if (st !== 200) (pagina.links_quebrados ??= []).push(`${href} → ${st}`);
        if (alvo.startsWith("/setor-eletrico") && !vistos.has(alvo) && !fila.includes(alvo) && !/\.(csv|json|xlsx|parquet|zip)$/.test(alvo)) fila.push(alvo);
      }
    }
    await ctx.close();
  }
  relatorio.paginas.push(pagina);
  const r = pagina.larguras[LARGURAS[0]];
  console.log(`${caminho} · ${r.status} · axe ${r.axe.length} · rolagem ${Object.values(pagina.larguras).some((x) => x.rolagem_horizontal) ? "SIM" : "não"} · console ${r.erros_console.length} · links quebrados ${(pagina.links_quebrados ?? []).length}`);
}
relatorio.concluido_em = new Date().toISOString();
relatorio.limites = "Chromium headless em laboratório, sem limitação de rede ou CPU; tempos de carga não representam desempenho de campo (LCP/INP/CLS de usuários reais).";
await writeFile(join(SAIDA, "relatorio.json"), JSON.stringify(relatorio, null, 1));
await navegador.close();
console.log(`${relatorio.paginas.length} páginas inspecionadas; relatório em ${join(SAIDA, "relatorio.json")}`);
