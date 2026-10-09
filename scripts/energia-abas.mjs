/* Abas de seção e faixa de módulos a 390x844 px (uso próprio, fora da rubrica): para cada página da lista de rotas, as listas `.nav-faixa`,
   `.nav-faixa-barra` e `#modulos-energia`, com a largura de cada item, o número de linhas do rótulo, se o rótulo ultrapassa a caixa, se a lista
   ganhou respiro inline à direita (`padding-right` no atributo style, que é o rastro do alinhamento de uma faixa que rola) e se a aba atual
   está na coluna da direita. Foi escrito depois da r9, porque a coleta objetiva não media a largura das abas e um erro de alinhamento deixou
   as abas com 80 px sem que nenhum instrumento acusasse.

   Uso:
     PW_CORE=/caminho/playwright-core node scripts/energia-abas.mjs <saida.json>      (servidor em http://localhost:3100) */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const rotas = readFileSync('docs/observatorios/energia/avaliacao/rotas.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
const saida = [];
for (const rota of rotas) {
  const p = await ctx.newPage();
  try {
    await p.goto('http://localhost:3100' + rota, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(300);
    const listas = await p.evaluate(() => [...document.querySelectorAll('.nav-faixa, .nav-faixa-barra, #modulos-energia')].map(ol => {
      const l = ol.getBoundingClientRect();
      const itens = [...ol.children].map(li => {
        const a = li.querySelector('a') || li;
        const cs = getComputedStyle(a);
        const alturaUtil = a.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
        return {
          txt: a.textContent.trim().slice(0, 40),
          largura: Math.round(li.getBoundingClientRect().width),
          linhas: Math.max(1, Math.round(alturaUtil / (parseFloat(cs.lineHeight) || 20))),
          cortado: a.scrollWidth > a.clientWidth + 1,
          atual: a.getAttribute('aria-current') === 'page',
          direita: a.getAttribute('aria-current') === 'page' && a.getBoundingClientRect().right > l.right - 8,
        };
      });
      return {
        lista: ol.id ? '#' + ol.id : '.' + ol.className.split(' ')[0],
        itens: itens.length,
        respiro_inline: ol.style.paddingRight || '',
        largura_minima: Math.min(...itens.map(i => i.largura)),
        linhas_maximas: Math.max(...itens.map(i => i.linhas)),
        cortados: itens.filter(i => i.cortado).map(i => i.txt),
        atual_na_direita: itens.some(i => i.direita),
      };
    }));
    saida.push({ rota, listas });
  } catch (e) { saida.push({ rota, erro: String(e).slice(0, 80) }); }
  await p.close();
}
await b.close();
writeFileSync(process.argv[2], JSON.stringify(saida, null, 1));
const com = saida.filter(o => o.listas && o.listas.length);
const abas = o => o.listas.filter(l => l.lista !== '#modulos-energia' && l.itens > 1);
console.log('rotas', saida.length, '| com abas de seção', com.filter(o => abas(o).length).length, '| erros', saida.filter(o => o.erro).length);
console.log('respiro inline à direita:', com.filter(o => o.listas.some(l => l.respiro_inline)).length);
console.log('aba atual na coluna da direita:', com.filter(o => abas(o).some(l => l.atual_na_direita)).length);
console.log('largura mínima de item abaixo de 150 px:', com.filter(o => abas(o).some(l => l.largura_minima < 150)).length);
console.log('rótulos cortados:', com.filter(o => o.listas.some(l => l.cortados.length)).length);
console.log('linhas máximas por aba:', JSON.stringify(com.reduce((m, o) => { const k = Math.max(...abas(o).map(l => l.linhas_maximas), 0); m[k] = (m[k] || 0) + 1; return m; }, {})));
