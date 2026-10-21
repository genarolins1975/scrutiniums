// Linha de base estrutural (uso próprio, fora do rubric): resposta frente à dobra, aderência da legenda Siglas ao texto visível,
// tabelas largas e altura da página, em Entender, a 390 e 1440 px.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const BASE = process.env.BASE || "http://localhost:3100";
const SAIDA = process.argv[2];
if (!SAIDA || !process.env.PW_CORE) { console.error("uso: PW_CORE=<playwright-core> BASE=http://localhost:3100 [MODO=entender] node scripts/energia-estrutura.mjs <saida.json>"); process.exit(2); }
const MODO = process.env.MODO || "entender";
const rotas = readFileSync("docs/observatorios/energia/avaliacao/rotas.txt", "utf-8").split("\n").map((s) => s.trim()).filter(Boolean);
const fonte = readFileSync("src/lib/energia/siglas.ts", "utf-8");
const SIGLAS = {};
for (const m of fonte.matchAll(/^  (\w+): "(.*)",$/gm)) SIGLAS[m[1]] = m[2];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const alturas = { 390: 844, 1440: 900 };
async function medir(larg, rota) {
  const ctx = await b.newContext({ viewport: { width: larg, height: alturas[larg] }, locale: "pt-BR" });
  const p = await ctx.newPage();
  try {
    await p.goto(`${BASE}${rota}${rota.includes("?") ? "&" : "?"}modo=${MODO}`, { waitUntil: "networkidle", timeout: 60000 });
    await p.waitForFunction(() => { const e = document.querySelector(".modo-profundidade"); return !e || e.getAttribute("data-modo") !== "todos"; }, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(600);
    return await p.evaluate(({ SIGLAS }) => {
      const main = document.querySelector("main");
      const vh = innerHeight;
      const visivel = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      const doc = (e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) }; };
      const resp = [...main.querySelectorAll("[data-resposta]")].find(visivel);
      const cab = main.querySelector("header");
      const leg = main.querySelector("[data-siglas]");
      const legTxt = leg ? [...leg.querySelectorAll("p, summary")].map((e) => e.textContent).join(" ").replace(/^Siglas:\s*/, "") : "";
      const dis = leg ? leg.style.display : "";
      if (leg) leg.style.display = "none";
      const texto = main.innerText;
      if (leg) leg.style.display = dis;
      const re = (s) => new RegExp(`(?<![\\p{L}\\p{N}_])${s}(?![\\p{L}\\p{N}_])`, "u");
      const noTexto = [], expandidas = [];
      for (const [s, nome] of Object.entries(SIGLAS)) {
        if (!re(s).test(texto)) continue;
        if (texto.toLowerCase().includes(nome.toLowerCase().split(",")[0])) { expandidas.push(s); continue; }
        noTexto.push(s);
      }
      const naLegenda = Object.keys(SIGLAS).filter((s) => re(s).test(legTxt));
      const faltam = noTexto.filter((s) => !naLegenda.includes(s));
      const sobram = naLegenda.filter((s) => !noTexto.includes(s));
      const tabelas = [...main.querySelectorAll("table")].filter(visivel).map((t) => {
        const linha = t.querySelector("thead tr") || t.querySelector("tr");
        const cols = linha ? linha.children.length : 0;
        const linhas = t.querySelectorAll("tbody tr").length;
        return { cols, linhas };
      });
      return {
        vh,
        altura: document.documentElement.scrollHeight,
        resposta: resp ? { ...doc(resp), id: resp.getAttribute("data-resposta") } : null,
        cabecalho: cab ? doc(cab) : null,
        legenda: legTxt.slice(0, 200),
        n_legenda: naLegenda.length,
        faltam, sobram, expandidas: expandidas.length,
        tabelas, largas: tabelas.filter((t) => t.cols > 6).length,
        texto_chars: texto.length,
        figuras: main.querySelectorAll("svg[role=img], img, canvas, figure").length,
        figuras_sem_ficha: main.querySelectorAll("svg[role=img], img, canvas, figure").length - [...main.querySelectorAll("svg[role=img], img, canvas, figure")].filter((e) => e.matches("figure[data-prova]") || e.closest("figure[data-prova]") && !e.matches("figure")).length,
        fichas: main.querySelectorAll("figure[data-prova]").length,
        tabelas_dom: main.querySelectorAll("table").length,
      };
    }, { SIGLAS });
  } catch (e) {
    return { erro: String(e).slice(0, 200) };
  } finally {
    await ctx.close();
  }
}
const saida = [];
const fila = rotas.flatMap((r) => [390, 1440].map((w) => [r, w]));
let i = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < fila.length) {
    const [r, w] = fila[i++];
    const m = await medir(w, r);
    saida.push({ rota: r, largura: w, ...m });
  }
}));
saida.sort((a, b) => a.rota.localeCompare(b.rota) || a.largura - b.largura);
writeFileSync(SAIDA, JSON.stringify({ gerado_em: new Date().toISOString(), modo: MODO, medicoes: saida }, null, 1));
await b.close();
console.log("medidas:", saida.length, "erros:", saida.filter((x) => x.erro).length);
