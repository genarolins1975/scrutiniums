// Verificação do redesenho editorial do painel Educação nas capitais, por rota e largura (1440, 1024, 768, 390 e 320 px).
// Mede: rolagem horizontal da página, violações axe (WCAG 2.2 AA), alvos de toque abaixo de 44 x 44 px, estrutura de títulos,
// foco visível por teclado, movimento reduzido e erros de página. Uso: node redesenho-verificacao.mjs <base_url> [pasta_de_capturas]
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const axe = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf-8");
const base = process.argv[2];
const pasta = process.argv[3];
if (pasta) mkdirSync(pasta, { recursive: true });
const RAIZ = `${base}/eficiencia-estatal/educacao-municipal-capitais`;
const LARGURAS = [1440, 1024, 768, 390, 320];
const ROTAS = [
  ["panorama", ""],
  ["panorama-capital", "?cap=recife"],
  ["panorama-total", "?med=despesa&cap=sao-paulo"],
  ["panorama-matricula", "?med=despesa_mat"],
  ["gastos", "/gastos"],
  ["gastos-capital-tabela", "/gastos?cap=recife&vis=tabela"],
  ["gastos-razao-ponte", "/gastos?cap=recife&med=despesa_mat&vis=detalhe"],
  ["gastos-evolucao", "/gastos?cap=recife&vis=evolucao"],
  ["atendimento", "/atendimento?cap=manaus"],
  ["atendimento-etapas", "/atendimento?cap=manaus&med=matriculas&vis=detalhe"],
  ["resultados", "/resultados"],
  ["resultados-saeb", "/resultados?med=saeb&etapa=anos_finais&disc=portugues"],
  ["ano-sem-dado", "/gastos?med=despesa_hab&ano=2023&cap=manaus"],
  ["comparar", "/comparar?dest=recife,manaus"],
  ["comparar-tabela", "/comparar?vis=tabela"],
  ["metodos", "/metodos"],
];
let falhas = 0;
const resumo = { combinacoes: 0, controles: 0 };
const browser = await chromium.launch();
for (const w of LARGURAS) {
  for (const [nome, q] of ROTAS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, hasTouch: w < 768, isMobile: w < 500, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    const erros = [];
    p.on("pageerror", (e) => erros.push(String(e).slice(0, 160)));
    p.on("console", (m) => m.type() === "error" && erros.push(m.text().slice(0, 160)));
    await p.goto(RAIZ + q, { waitUntil: "networkidle", timeout: 90000 });
    await p.waitForTimeout(500);
    const medida = await p.evaluate(() => {
      const doc = document.documentElement;
      const alvos = [];
      let n = 0;
      for (const el of document.querySelectorAll("main a[href], main button, main summary, main select, header a, main nav a, main label:has(input[type=radio]), main label:has(input[type=checkbox])")) {
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue;
        // link em texto corrido é exceção de alvo em linha (WCAG 2.5.8); links isolados e demais controles entram
        const emTexto = el.tagName === "A" && el.closest("p, li, dd, figcaption") && getComputedStyle(el).display === "inline" && !el.closest("nav");
        if (emTexto) continue;
        n++;
        if (r.height < 43.5 || r.width < 43.5) alvos.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} ${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 36)}`);
      }
      const h = [...document.querySelectorAll("h1,h2,h3,h4")].map((e) => +e.tagName[1]);
      const pulos = h.some((v, i) => i > 0 && v - h[i - 1] > 1);
      return { sw: doc.scrollWidth, cw: doc.clientWidth, alvos, n, h1: h.filter((v) => v === 1).length, pulos, landmarks: { main: document.querySelectorAll("main").length, nav: document.querySelectorAll("nav").length }, animacoes: document.getAnimations().length };
    });
    await p.addScriptTag({ content: axe });
    const res = await p.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
      return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
    });
    // teclado: os primeiros controles recebem foco visível
    let focoRuim = 0;
    await p.evaluate(() => document.body.focus());
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press("Tab");
      await p.waitForTimeout(120);
      const visivel = await p.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return true;
        const s = getComputedStyle(e);
        return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none" || e.matches(":has(:focus-visible)") || !!e.closest("label:focus-within");
      });
      if (!visivel) focoRuim++;
    }
    resumo.combinacoes++;
    resumo.controles += medida.n;
    const problemas = [];
    if (medida.sw > medida.cw) problemas.push(`rolagem horizontal ${medida.sw}/${medida.cw}`);
    if (res.length) problemas.push(`axe: ${res.join(", ")}`);
    if (medida.alvos.length) problemas.push(`alvos < 44 px: ${medida.alvos.slice(0, 4).join("; ")}${medida.alvos.length > 4 ? ` (+${medida.alvos.length - 4})` : ""}`);
    if (medida.h1 !== 1) problemas.push(`h1 = ${medida.h1}`);
    if (medida.pulos) problemas.push("salto de nível de título");
    if (medida.landmarks.main !== 1) problemas.push(`main = ${medida.landmarks.main}`);
    if (focoRuim) problemas.push(`${focoRuim} foco(s) sem indicação visível`);
    if (medida.animacoes > 0) problemas.push(`${medida.animacoes} animação(ões) com movimento reduzido`);
    if (erros.length) problemas.push(`erros de página: ${erros.join(" | ")}`);
    if (pasta && (nome === "panorama" || nome === "gastos-capital-tabela" || nome === "comparar" || nome === "gastos-razao-ponte")) {
      await p.screenshot({ path: `${pasta}/depois-${nome}-${w}.png`, fullPage: false });
    }
    if (problemas.length) {
      falhas++;
      console.log(`FALHA ${w}px ${nome}: ${problemas.join(" || ")}`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`${resumo.combinacoes} combinações (${ROTAS.length} rotas × ${LARGURAS.length} larguras); ${resumo.controles} controles medidos; ${falhas ? falhas + " com falha" : "todas aprovadas"}`);
process.exit(falhas ? 1 : 0);
