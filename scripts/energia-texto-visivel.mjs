/* Transcrição do que cada página mostra, por nível de profundidade (uso próprio, fora da rubrica).

   Para cada rota e nível (Entender, Analisar, Auditar) a 1440 px, grava um .txt com o conteúdo na ordem de leitura: títulos (##), parágrafos,
   itens de lista (-), linhas de tabela ( | ), títulos de gráficos e mapas ([gráfico: ...], [mapa: ...]), botões e campos ([botão: ...],
   [campo: ...]) e blocos recolhidos ([recolhido: resumo]). Blocos de nível mais fundo levam a marca ⟦nível: analisar⟧ ou ⟦nível: auditar⟧
   na abertura, para quem avalia saber a partir de que nível o conteúdo aparece. É o insumo dos avaliadores independentes: eles leem o
   que o leitor lê, sem depender do código.

   Uso:
     PW_CORE=/caminho/playwright-core node scripts/energia-texto-visivel.mjs --saida <pasta> [--rotas arquivo] [--base http://localhost:3100]
        [--modos entender,analisar,auditar] [--largura 1440] [--so /pld,/qualidade] [--linhas 12]
   Grava <pasta>/<slug>__<modo>.txt */
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
const BASE = (args.base || 'http://localhost:3100').replace(/\/$/, '');
const SAIDA = args.saida || 'texto-visivel';
const LARGURA = Number(args.largura || 1440);
const MODOS = (args.modos || 'entender,analisar,auditar').split(',');
const LINHAS = Number(args.linhas || 12);
const ROTAS = readFileSync(args.rotas || 'docs/observatorios/energia/avaliacao/rotas.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  .filter(r => !args.so || args.so.split(',').some(x => r === '/setor-eletrico' + x || (x === '' && r === '/setor-eletrico')));
const slug = r => r.replace(/^\/setor-eletrico\/?/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'raiz';
mkdirSync(SAIDA, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: LARGURA, height: 900 }, locale: 'pt-BR' });

const transcreve = (maxLinhas) => {
  const linhas = [];
  const txt = e => e.textContent.replace(/\s+/g, ' ').trim();
  const oculto = e => { const c = getComputedStyle(e); return c.display === 'none' || c.visibility === 'hidden'; };
  const nivelDe = e => e.getAttribute && e.getAttribute('data-nivel');
  const visita = (el, prof) => {
    if (!(el instanceof Element)) return;
    const tag = el.tagName;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'DIALOG'].includes(tag)) return;
    if (el.classList.contains('sr-only') && !['H1', 'H2', 'H3', 'CAPTION'].includes(tag) && !el.closest('table')) {
      const t = txt(el); if (t) linhas.push(`(somente leitor de tela) ${t}`); return;
    }
    if (oculto(el)) return;
    const nivel = nivelDe(el);
    if (nivel === 'analisar' || nivel === 'auditar') linhas.push(`⟦nível: ${nivel}⟧`);
    if (tag === 'DETAILS') {
      const s = el.querySelector(':scope > summary');
      if (!el.open) { linhas.push(`[recolhido: ${s ? txt(s) : 'detalhes'}]`); return; }
      if (s) linhas.push(`[bloco aberto: ${txt(s)}]`);
      for (const c of el.children) if (c !== s) visita(c, prof + 1);
      return;
    }
    if (/^H[1-6]$/.test(tag)) { linhas.push(`${'#'.repeat(Number(tag[1]))} ${txt(el)}`); return; }
    if (tag === 'TABLE') {
      const cap = el.querySelector('caption');
      const cab = [...el.querySelectorAll('thead th')].map(txt);
      linhas.push(`[tabela${cap ? ': ' + txt(cap) : ''}] colunas: ${cab.join(' | ')}`);
      const rs = [...el.querySelectorAll('tbody tr')];
      rs.slice(0, maxLinhas).forEach(r => linhas.push('  | ' + [...r.children].map(txt).join(' | ')));
      if (rs.length > maxLinhas) linhas.push(`  … mais ${rs.length - maxLinhas} linhas na página`);
      return;
    }
    if (tag === 'svg') {
      const t = el.querySelector('title');
      const rot = (t && txt(t)) || el.getAttribute('aria-label') || '';
      const tipo = /mapa/i.test(rot) ? 'mapa' : 'gráfico';
      const textos = [...el.querySelectorAll('text')].map(txt).filter(Boolean);
      if (rot || textos.length) linhas.push(`[${tipo}: ${rot}] rótulos: ${textos.slice(0, 60).join(' ; ')}`);
      return;
    }
    if (tag === 'BUTTON') { const t = txt(el); if (t) linhas.push(`[botão: ${t}${el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true' ? ' (selecionado)' : ''}]`); return; }
    if (tag === 'SELECT') { const l = el.labels && el.labels[0] ? txt(el.labels[0]) : el.getAttribute('aria-label') || ''; linhas.push(`[campo: ${l}; opção atual: ${el.options[el.selectedIndex] ? txt(el.options[el.selectedIndex]) : ''}; ${el.options.length} opções]`); return; }
    if (tag === 'INPUT') { const l = (el.labels && el.labels[0] && txt(el.labels[0])) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''; linhas.push(`[campo ${el.type}: ${l}]`); return; }
    if (tag === 'A' && el.getAttribute('download') !== null) { linhas.push(`[arquivo para baixar: ${txt(el)}] ${el.getAttribute('href')}`); return; }
    if (tag === 'LI') {
      const filhosBloco = [...el.children].some(c => ['UL', 'OL', 'DIV', 'P', 'TABLE', 'DETAILS', 'SECTION'].includes(c.tagName));
      if (!filhosBloco) { linhas.push(`- ${txt(el)}`); return; }
    }
    if (tag === 'P' || (tag === 'DT') || (tag === 'DD') || tag === 'FIGCAPTION' || tag === 'CAPTION') {
      const t = txt(el); if (t) linhas.push(t); return;
    }
    let temBloco = false;
    for (const c of el.children) { if (!oculto(c)) { temBloco = true; break; } }
    if (!el.children.length) { const t = txt(el); if (t && !['SPAN', 'A', 'LABEL'].includes(tag)) linhas.push(t); else if (t) linhas.push(t); return; }
    // texto solto entre filhos
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) linhas.push(t); }
      else visita(n, prof + 1);
    }
  };
  const alvo = document.querySelector('header') && document.querySelector('header').closest('body') ? document.body : document.body;
  // cabeçalho do site: só o rótulo da página atual; o resto é navegação comum a todas as páginas
  const nav = document.querySelector('nav[aria-label^="Navegação do Observatório"]');
  const atual = nav ? nav.querySelector('[aria-current="page"]') : null;
  linhas.push(`[navegação do site; página atual: ${atual ? txt(atual) : 'não marcada'}]`);
  visita(document.querySelector('main'), 0);
  const rod = document.querySelector('aside[aria-label^="Observatório Brasileiro"]');
  if (rod) { linhas.push('[rodapé do observatório]'); visita(rod, 0); }
  return linhas.join('\n');
};

for (const rota of ROTAS) {
  for (const modo of MODOS) {
    const p = await ctx.newPage();
    try {
      await p.goto(BASE + rota + '?modo=' + modo, { waitUntil: 'networkidle', timeout: 90000 });
      await p.waitForTimeout(modo === 'auditar' ? 900 : 500);
      await p.evaluate(async () => {
        const espera = ms => new Promise(r => setTimeout(r, ms));
        for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); await espera(90); }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      });
      await p.waitForTimeout(350);
      const t = await p.evaluate(transcreve, LINHAS);
      writeFileSync(join(SAIDA, `${slug(rota)}__${modo}.txt`), `ROTA ${rota}  NÍVEL ${modo}  LARGURA ${LARGURA}\n\n${t}\n`);
    } catch (e) {
      writeFileSync(join(SAIDA, `${slug(rota)}__${modo}.txt`), `ERRO ${String(e).slice(0, 200)}\n`);
    }
    await p.close();
  }
  console.log(rota.replace('/setor-eletrico', '') || '/');
}
await b.close();
console.log('transcrições em', SAIDA);
