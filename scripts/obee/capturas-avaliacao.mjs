// Capturas "depois" das correções da avaliação independente, nos mesmos recortes das capturas "antes" da rodada 1
// (docs/obee/avaliacao/rodada-1/evidencias/experiencia). Uso: node capturas-avaliacao.mjs <base_url> <pasta>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const [base, pasta] = process.argv.slice(2);
mkdirSync(pasta, { recursive: true });
const R = `${base}/eficiencia-estatal/educacao-municipal-capitais`;
// [nome, rota, largura, seletor do recorte (null = topo da página)]
const CASOS = [
  ["panorama-padrao-1440", "", 1440, null],
  ["panorama-topo-320", "", 320, null],
  ["panorama-capital-curitiba-390", "?cap=curitiba", 390, null],
  ["panorama-total-escala-log-natal-1440", "?med=despesa&cap=natal", 1440, 'section[id^="capitulo-"]'],
  ["gastos-padrao-1440", "/gastos", 1440, null],
  ["gastos-2021-capital-excluida-1440", "/gastos?med=despesa_mat&ano=2021", 1440, "#visao"],
  ["gastos-grafico-eixo-sobreposto-390", "/gastos?med=despesa_mat&ano=2022", 390, "#visao"],
  ["gastos-rotulos-cortados-320", "/gastos?med=despesa_mat&ano=2022", 320, "#visao"],
  ["gastos-evolucao-ruptura-sem-marca-1440", "/gastos?med=despesa_hab&vis=evolucao", 1440, "#visao"],
  ["atendimento-padrao-1440", "/atendimento", 1440, null],
  ["resultados-padrao-1440", "/resultados", 1440, null],
  ["resultados-aprovacao-finais-2021-excluidas-1440", "/resultados?med=aprovacao&etapa=anos_finais&ano=2021", 1440, "#visao"],
  ["comparar-padrao-1440", "/comparar", 1440, null],
  ["comparar-tabela-390", "/comparar?vis=tabela", 390, '[role="region"][aria-label^="Tabela comparativa"]'],
  ["comparar-tabela-320", "/comparar?vis=tabela", 320, '[role="region"][aria-label^="Tabela comparativa"]'],
  ["metodos-topo-1440", "/metodos", 1440, null],
  ["metodos-topo-390", "/metodos", 390, null],
  ["metodos-exemplos-reproducao-1440", "/metodos#exemplos", 1440, "#exemplos >> xpath=.."],
];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const [nome, rota, w, sel] of CASOS) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(R + rota, { waitUntil: "load" });
  await p.waitForTimeout(900);
  if (sel) {
    const el = p.locator(sel).first();
    if (nome.includes("exemplos")) {
      const resumos = p.locator("#exemplos >> xpath=.. >> details > summary");
      for (const i of [3, 4]) await resumos.nth(i).click().catch(() => {});
    }
    const alt = await el.evaluate((e) => e.getBoundingClientRect().height);
    const y = await el.evaluate((e) => e.getBoundingClientRect().top + scrollY);
    await p.screenshot({ path: `${pasta}/${nome}.png`, fullPage: true, clip: { x: 0, y, width: w, height: Math.min(alt, 1800) } });
  } else {
    await p.screenshot({ path: `${pasta}/${nome}.png` });
  }
  await p.close();
}
await b.close();
console.log(`${CASOS.length} capturas em ${pasta}`);
