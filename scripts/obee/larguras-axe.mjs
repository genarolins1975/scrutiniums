// Estouro horizontal da página, violações axe (WCAG 2.2 AA) e alvos de toque, por largura e recorte.
// Uso: node larguras-axe.mjs <base_url>
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const axe = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf-8");
const base = process.argv[2];
const URL0 = `${base}/eficiencia-estatal/educacao-municipal-capitais`;
const LARGURAS = [320, 390, 768, 1440];
const RECORTES = [
  "",
  "?med=despesa_hab&cap=sao-paulo",
  "?med=despesa_mat&cap=curitiba",
  "?med=despesa_mat&cap=boa-vista&ano=2024",
  "?med=despesa_hab&cap=campo-grande&ano=2021",
  "?med=despesa_hab&cap=manaus&ano=2023",
  "?med=atu&etapa=anos_iniciais&cap=fortaleza",
  "?med=ideb&etapa=anos_finais&cap=recife",
];
let falhas = 0;
const browser = await chromium.launch();
for (const w of LARGURAS) {
  for (const q of RECORTES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, hasTouch: w < 768, isMobile: w < 500 });
    const p = await ctx.newPage();
    const erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    await p.goto(URL0 + q, { waitUntil: "networkidle" });
    // abre as áreas recolhíveis para que o axe as leia
    await p.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await p.waitForTimeout(300);
    const estouro = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    await p.addScriptTag({ content: axe });
    const viol = await p.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0].target.join(" ")})`);
    });
    const alvos = w < 768
      ? await p.evaluate(() =>
          [...document.querySelectorAll("button, select, input, summary")]
            .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" && (r.height < 40 || r.width < 40) && !(r.width <= 1 && r.height <= 1) && !e.closest("[aria-hidden=true]"); })
            .slice(0, 5)
            .map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
        )
      : [];
    const ok = estouro.sw <= estouro.cw && viol.length === 0 && erros.length === 0;
    if (!ok) falhas++;
    console.log(`${ok ? "OK  " : "FALHA"} ${w}px ${q || "(padrão)"} scrollWidth=${estouro.sw}/${estouro.cw} axe=${viol.length}${viol.length ? " " + viol.join("; ") : ""}${erros.length ? " erros=" + erros.join("|") : ""}${alvos.length ? " | alvos pequenos: " + alvos.join("; ") : ""}`);
    await ctx.close();
  }
}
await browser.close();
console.log(falhas === 0 ? "todas as combinações aprovadas" : `${falhas} combinações com falha`);
process.exit(falhas === 0 ? 0 : 1);
