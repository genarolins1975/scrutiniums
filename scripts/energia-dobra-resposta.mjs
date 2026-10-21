/* Posição da primeira resposta curta visível em Entender (uso próprio, fora da rubrica): para cada página da lista de rotas, a 390x844 px e a
   1440x900 px, o topo e a base do primeiro elemento com atributo data-resposta* visível, em px contados do início da página. Serve para dizer
   se a resposta cabe na primeira tela; não mede se ela é compreensível.

   Uso:
     PW_CORE=/caminho/playwright-core node scripts/energia-dobra-resposta.mjs <saida.json>      (servidor em http://localhost:3100) */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const rotas = readFileSync('docs/observatorios/energia/avaliacao/rotas.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const saida = [];
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'pt-BR' });
  const p = await ctx.newPage();
  for (const rota of rotas) {
    try {
      await p.goto('http://localhost:3100' + rota + '?modo=entender', { waitUntil: 'networkidle', timeout: 60000 });
      await p.waitForTimeout(350);
      const r = await p.evaluate(() => {
        const els = [...document.querySelectorAll('main *')].filter(e => [...e.attributes].some(a => a.name.startsWith('data-resposta')));
        const vis = els.find(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden');
        if (!vis) return null;
        const r = vis.getBoundingClientRect();
        return { topo: Math.round(r.top + scrollY), base: Math.round(r.bottom + scrollY) };
      });
      saida.push({ rota, largura: w, altura_tela: h, ...r });
    } catch (e) { saida.push({ rota, largura: w, erro: String(e).slice(0, 60) }); }
  }
  await ctx.close();
}
await b.close();
writeFileSync(process.argv[2], JSON.stringify(saida));
console.log('ok', saida.length);
