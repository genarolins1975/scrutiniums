// Capturas do painel Educação municipal nas capitais, por recorte e largura. Uso: node capturas-comparacoes.mjs <base_url> <pasta> [prefixo] [lista]
// Cada captura recorta a seção pelo id (clip de página, sem screenshot de elemento, que trava em contêineres com rolagem).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const base = process.argv[2];
const out = process.argv[3];
const prefixo = process.argv[4] ?? "";
const so = process.argv[5] ? process.argv[5].split(",") : null;
mkdirSync(out, { recursive: true });
const URL0 = `${base}/eficiencia-estatal/educacao-municipal-capitais`;

// [nome, query, largura, seletor, altura máxima do recorte]
const CAPTURAS = [
  ["topo-1440", "", 1440, "#titulo-painel", 900],
  ["orientacao-1440", "", 1440, "#orientacao-titulo", 1100],
  ["comparacao-despesa-sp-1440", "?med=despesa&cap=sao-paulo", 1440, "#comparacao", 1500],
  ["comparacao-despesa-sp-390", "?med=despesa&cap=sao-paulo", 390, "#comparacao", 1500],
  ["comparacao-habitante-1440", "?med=despesa_hab&cap=sao-paulo", 1440, "#comparacao", 1500],
  ["comparacao-habitante-390", "?med=despesa_hab&cap=sao-paulo", 390, "#comparacao", 1500],
  ["comparacao-matricula-1440", "?med=despesa_mat&cap=curitiba", 1440, "#comparacao", 1500],
  ["tabela-comparativa-1440", "?med=despesa_hab&cap=recife", 1440, "#tabela-comparativa", 1700],
  ["tabela-comparativa-390", "?med=despesa_hab&cap=recife", 390, "#tabela-comparativa", 1700],
  ["tabela-comparativa-320", "?med=despesa_hab&cap=recife", 320, "#tabela-comparativa", 1700],
  ["tabela-comparativa-768", "?med=despesa_hab&cap=recife", 768, "#tabela-comparativa", 1700],
  ["referencias-turma-1440", "?med=atu&etapa=anos_iniciais&cap=fortaleza", 1440, "#referencias", 1700],
  ["referencias-turma-390", "?med=atu&etapa=anos_iniciais&cap=fortaleza", 390, "#referencias", 1700],
  ["ponte-matricula-1440", "?med=despesa_mat&cap=sao-paulo", 1440, "#decomposicao", 1700],
  ["ponte-matricula-390", "?med=despesa_mat&cap=sao-paulo", 390, "#decomposicao", 1700],
  ["campo-grande-2021-1440", "?med=despesa_hab&cap=campo-grande&ano=2021", 1440, "#comparacao", 1500],
  ["boa-vista-2024-1440", "?med=despesa_mat&cap=boa-vista&ano=2024", 1440, "#comparacao", 1500],
  ["sem-habitante-2023-1440", "?med=despesa_hab&cap=manaus&ano=2023", 1440, "#comparacao", 900],
  ["series-1440", "?cap=belo-horizonte", 1440, "#serie", 1700],
];

const browser = await chromium.launch();
for (const [nome, q, largura, seletor, altMax] of CAPTURAS) {
  if (so && !so.includes(nome)) continue;
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura < 500 ? 844 : 900 }, hasTouch: largura < 768, isMobile: largura < 500 });
  const p = await ctx.newPage();
  try {
    await p.goto(URL0 + q, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(seletor, { timeout: 20000 });
    await p.waitForTimeout(600);
    const alvo = await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const sec = el.closest("section") ?? el;
      const r = sec.getBoundingClientRect();
      return { y: r.top + window.scrollY, h: r.height };
    }, seletor);
    if (!alvo) { console.log(`${nome}: seletor ${seletor} ausente`); await ctx.close(); continue; }
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), alvo.y);
    await p.waitForTimeout(300);
    const altura = Math.min(Math.ceil(alvo.h), altMax);
    await p.screenshot({ path: `${out}/${prefixo}${nome}.png`, fullPage: true, clip: { x: 0, y: alvo.y, width: largura, height: altura }, animations: "disabled" });
    console.log(`${nome}: capturado (${altura} px)`);
  } catch (e) {
    console.log(`${nome}: ${String(e).slice(0, 160)}`);
  }
  await ctx.close();
}
await browser.close();
