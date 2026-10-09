/* Capturas e medidas das 22 aberturas do observatório de energia, para o redesenho (uso próprio, fora da rubrica).

   Para cada abertura de `docs/energia/redesign/aberturas.json` e cada largura, em Entender (padrão): primeira tela e página inteira em PNG
   (a conversão para WebP versionado é de `scripts/energia_capturas_redesenho_webp.py`) e medidas do que a primeira tela mostra.

   Medidas por página e largura:
     altura_total, h1 (topo, palavras, texto), topo e base do primeiro gráfico visível (`[data-grafico]`, mapa ou tabela), palavras de texto
     antes dele, quantas faixas de navegação (`nav`) ficam acima do primeiro gráfico, número de botões e links acima dele, rolagem horizontal da
     página e se há elemento com texto cortado fora da largura.

   Uso:
     PW_CORE=/caminho/playwright-core node scripts/energia-capturas-redesenho.mjs --rotulo antes --saida <pasta>
        [--base http://localhost:3100] [--larguras 1440,390] [--so agua,pld] [--modo entender|analisar|auditar]
   Grava <pasta>/png/<slug>__<largura>_dobra.png, <slug>__<largura>_inteira.png e <pasta>/medidas_<rotulo>.json. */
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
const BASE = (args.base || 'http://localhost:3100').replace(/\/$/, '');
const ROTULO = args.rotulo || 'antes';
const SAIDA = args.saida || 'capturas-redesenho';
const MODO = args.modo || 'entender';
const LARGURAS = (args.larguras || '1440,390').split(',').map(Number);
const ALTURAS = { 1440: 900, 768: 1024, 390: 844, 320: 640 };
const SO = args.so ? args.so.split(',') : null;
const aberturas = JSON.parse(readFileSync('docs/energia/redesign/aberturas.json', 'utf8')).filter(a => !SO || SO.includes(a.slug));
mkdirSync(join(SAIDA, 'png'), { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const medidas = [];
for (const w of LARGURAS) {
  const ctx = await b.newContext({ viewport: { width: w, height: ALTURAS[w] || 800 }, locale: 'pt-BR', deviceScaleFactor: 1 });
  for (const a of aberturas) {
    const p = await ctx.newPage();
    try {
      const resp = await p.goto(BASE + a.rota + '?modo=' + MODO, { waitUntil: 'networkidle', timeout: 90000 });
      await p.waitForTimeout(500);
      // rola como quem lê, para o conteúdo carregado sob demanda aparecer, e volta ao topo
      await p.evaluate(async () => {
        const espera = ms => new Promise(r => setTimeout(r, ms));
        for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); await espera(120); }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      });
      await p.waitForTimeout(600);
      const m = await p.evaluate(() => {
        const visivel = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        const main = document.querySelector('main') || document.body;
        const h1 = document.querySelector('h1');
        const alvo = [...document.querySelectorAll('main [data-grafico], main svg[role="img"], main svg[role="group"], main table, main [data-mapa]')].find(e => visivel(e) && e.getBoundingClientRect().height > 80 && !e.closest('details:not([open])'));
        const r = alvo ? alvo.getBoundingClientRect() : null;
        let palavras = null, navs = 0, controles = 0;
        if (alvo) {
          const rg = document.createRange();
          rg.setStart(main, 0);
          rg.setEndBefore(alvo);
          palavras = rg.toString().trim().split(/\s+/).filter(Boolean).length;
          const fr = rg.cloneContents();
          navs = fr.querySelectorAll('nav').length;
          controles = fr.querySelectorAll('button, a[href], summary').length;
        }
        const hr = h1 ? h1.getBoundingClientRect() : null;
        return {
          altura_total: document.documentElement.scrollHeight,
          rolagem_horizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
          h1: h1 ? { topo: Math.round(hr.top + scrollY), palavras: h1.textContent.trim().split(/\s+/).length, texto: h1.textContent.trim(), linhas: Math.round(hr.height / parseFloat(getComputedStyle(h1).lineHeight || 24)) } : null,
          primeiro_grafico: r ? { tipo: alvo.getAttribute('data-grafico') || alvo.tagName.toLowerCase(), topo: Math.round(r.top + scrollY), base: Math.round(r.bottom + scrollY) } : null,
          palavras_antes_do_primeiro_grafico: palavras,
          navegacoes_antes_do_primeiro_grafico: navs,
          controles_antes_do_primeiro_grafico: controles,
          paineis: document.querySelectorAll('main [data-resposta], main section[data-painel], main [data-painel]').length,
          graficos: [...document.querySelectorAll('main [data-grafico]')].filter(visivel).length,
          tabelas_visiveis: [...document.querySelectorAll('main table')].filter(t => visivel(t) && !t.closest('.sr-only') && !t.closest('details:not([open])') && !t.closest('[data-recolhivel="fechada"]')).length,
        };
      });
      const base = join(SAIDA, 'png', `${a.slug}__${w}`);
      await p.screenshot({ path: `${base}_dobra.png` });
      await p.screenshot({ path: `${base}_inteira.png`, fullPage: true });
      medidas.push({ id: a.id, slug: a.slug, rota: a.rota, largura: w, status: resp.status(), ...m });
      console.log(a.id, a.slug, w, 'h', m.altura_total, 'h1', m.h1 && m.h1.palavras + 'p', 'graf', m.primeiro_grafico ? m.primeiro_grafico.topo : '-');
    } catch (e) {
      medidas.push({ id: a.id, slug: a.slug, rota: a.rota, largura: w, erro: String(e).slice(0, 120) });
      console.log(a.id, a.slug, w, 'ERRO', String(e).slice(0, 80));
    }
    await p.close();
  }
  await ctx.close();
}
await b.close();
writeFileSync(join(SAIDA, `medidas_${ROTULO}.json`), JSON.stringify({ rotulo: ROTULO, modo: MODO, base: BASE, gerado_em: new Date().toISOString(), medidas }, null, 1));
console.log('medidas em', join(SAIDA, `medidas_${ROTULO}.json`));
