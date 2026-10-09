/* Gráficos e tabelas a 390x844 px (uso próprio, fora da rubrica): para cada página da lista de rotas, em Entender, o que os revisores da r9 mais
   repetiram sobre o celular e que a coleta objetiva não media.

   Gráficos (`[data-grafico]`): rótulos de texto terminados em reticências (truncados), quantos deles são idênticos entre si no mesmo gráfico
   (indistinguíveis), pares de textos que se sobrepõem (marcas de eixo coladas, rótulo sobre rótulo) e textos que passam da borda do gráfico.
   Tabelas visíveis (fora de bloco recolhido): colunas, quantas cabem na largura do contêiner, se há rolagem horizontal, células de número ou
   texto cortadas na borda do contêiner e células com palavra partida no meio (a palavra mais longa da célula, medida com a fonte da célula,
   é mais larga que o conteúdo da célula).

   Uso:
     PW_CORE=/caminho/playwright-core node scripts/energia-graficos-celular.mjs <saida.json> [--modo entender|analisar|auditar]
   (servidor em http://localhost:3100) */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const saidaArq = process.argv[2];
const modo = process.argv.includes('--modo') ? process.argv[process.argv.indexOf('--modo') + 1] : 'entender';
const rotas = readFileSync('docs/observatorios/energia/avaliacao/rotas.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
const saida = [];
for (const rota of rotas) {
  const p = await ctx.newPage();
  try {
    await p.goto('http://localhost:3100' + rota + '?modo=' + modo, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      // dentro de <details> fechado o navegador pode devolver caixas (a camada de conteúdo é só adiada): o que o leitor vê exclui esse conteúdo
      const fechado = e => {
        for (let d = e.closest('details'); d; d = d.parentElement ? d.parentElement.closest('details') : null) {
          const s = d.querySelector(':scope > summary');
          if (!d.open && !(s && s.contains(e))) return true;
        }
        return false;
      };
      const visivel = e => e.getClientRects().length > 0 && !fechado(e);
      const textoVisivel = c => { const k = c.cloneNode(true); k.querySelectorAll('.sr-only').forEach(x => x.remove()); return (k.textContent || '').trim(); };
      const graficos = [...document.querySelectorAll('main [data-grafico]')].filter(visivel).map(g => {
        const gr = g.getBoundingClientRect();
        const textos = [...g.querySelectorAll('svg text')].filter(t => visivel(t) && t.textContent.trim());
        const caixas = textos.map(t => ({ t: t.textContent.trim(), r: t.getBoundingClientRect() }));
        const truncados = caixas.filter(c => c.t.endsWith('…'));
        const cont = {};
        for (const c of truncados) cont[c.t] = (cont[c.t] || 0) + 1;
        const repetidos = truncados.filter(c => cont[c.t] > 1).length;
        let sobrepostos = 0;
        const exemplos = [];
        for (let i = 0; i < caixas.length; i++) {
          for (let j = i + 1; j < caixas.length; j++) {
            const a = caixas[i].r, c = caixas[j].r;
            const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left);
            const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
            if (ox > 1 && oy > 3) { sobrepostos++; if (exemplos.length < 3) exemplos.push(caixas[i].t + ' | ' + caixas[j].t); }
          }
        }
        const foraL = caixas.filter(c => c.r.left < gr.left - 2 || c.r.right > gr.right + 2);
        const fora = foraL.length;
        return { tipo: g.getAttribute('data-grafico'), textos: caixas.length, truncados: truncados.length, repetidos, sobrepostos, fora, exemplos, trunc_exemplos: truncados.slice(0, 3).map(c => c.t), fora_exemplos: foraL.slice(0, 3).map(c => c.t + ' (' + Math.round(c.r.left - gr.left) + ',' + Math.round(c.r.right - gr.right) + ')') };
      });
      const canvas = document.createElement('canvas').getContext('2d');
      const tabelas = [...document.querySelectorAll('main table')].filter(t => visivel(t) && !t.closest('.sr-only') && !t.closest('[data-recolhivel="fechada"]')).map(t => {
        const cont = t.closest('.tabela-scroll, [role="region"]') || t.parentElement;
        const cr = cont.getBoundingClientRect();
        const cab = [...t.querySelectorAll('thead th')];
        const colunas = cab.length || Math.max(0, ...[...t.rows].map(r => r.cells.length));
        const visiveis = cab.filter(c => { const r = c.getBoundingClientRect(); return r.left >= cr.left - 1 && r.right <= cr.right + 1; }).length;
        let partidas = 0, naBorda = 0;
        const exemplos = [];
        for (const c of t.querySelectorAll('th, td')) {
          const rr = c.getBoundingClientRect();
          if (!rr.width) continue;
          if (rr.left < cr.right - 1 && rr.right > cr.right + 1) naBorda++;
          const cs = getComputedStyle(c);
          canvas.font = cs.font;
          const util = rr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
          // trechos entre as oportunidades de quebra (espaço e hífen, que ficam no fim do trecho; a barra não é oportunidade de quebra no Chromium):
          // só o trecho mais largo que a célula obriga a partir a palavra ("Sudeste/Centr o-Oeste")
          const trecho = textoVisivel(c).split(/(?<=[\s\-])/).map(s => s.trim()).sort((a, z) => canvas.measureText(z).width - canvas.measureText(a).width)[0] || '';
          if (trecho.length > 3 && canvas.measureText(trecho).width > util + 1) { partidas++; if (exemplos.length < 3) exemplos.push(trecho); }
        }
        return { colunas, visiveis, rolagem: cont.scrollWidth > cont.clientWidth + 1, na_borda: naBorda, palavras_partidas: partidas, exemplos };
      });
      return { graficos, tabelas };
    });
    saida.push({ rota, ...r });
  } catch (e) { saida.push({ rota, erro: String(e).slice(0, 80) }); }
  await p.close();
}
await b.close();
writeFileSync(saidaArq, JSON.stringify(saida, null, 1));
const ok = saida.filter(o => !o.erro);
const G = ok.flatMap(o => o.graficos.map(g => ({ rota: o.rota, ...g })));
const T = ok.flatMap(o => o.tabelas.map(t => ({ rota: o.rota, ...t })));
const rotasCom = (L, f) => new Set(L.filter(f).map(x => x.rota)).size;
console.log('modo', modo, '| rotas', saida.length, '| erros', saida.length - ok.length);
console.log('gráficos visíveis:', G.length, 'em', rotasCom(G, () => true), 'rotas');
console.log('rótulos truncados:', G.reduce((s, g) => s + g.truncados, 0), 'em', rotasCom(G, g => g.truncados), 'rotas;', 'idênticos entre si:', G.reduce((s, g) => s + g.repetidos, 0), 'em', rotasCom(G, g => g.repetidos), 'rotas');
console.log('pares de textos sobrepostos:', G.reduce((s, g) => s + g.sobrepostos, 0), 'em', rotasCom(G, g => g.sobrepostos), 'rotas; textos fora da borda:', G.reduce((s, g) => s + g.fora, 0), 'em', rotasCom(G, g => g.fora), 'rotas');
console.log('tabelas visíveis:', T.length, 'em', rotasCom(T, () => true), 'rotas; com rolagem horizontal:', T.filter(t => t.rolagem).length, 'em', rotasCom(T, t => t.rolagem), 'rotas; colunas cortadas na borda:', T.reduce((s, t) => s + t.na_borda, 0), 'células em', rotasCom(T, t => t.na_borda), 'rotas');
console.log('células com palavra partida:', T.reduce((s, t) => s + t.palavras_partidas, 0), 'em', T.filter(t => t.palavras_partidas).length, 'tabelas de', rotasCom(T, t => t.palavras_partidas), 'rotas; tabelas com mais de 6 colunas:', T.filter(t => t.colunas > 6).length, 'em', rotasCom(T, t => t.colunas > 6), 'rotas');
