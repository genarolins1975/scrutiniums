/* Rastreamento das visões de cada página do observatório de energia (uso próprio, fora da rubrica).

   Para cada rota de uma lista e cada nível de profundidade (Entender, Analisar, Auditar), lê no navegador, a 1440 px, o que a página mostra:
   painéis de evidência (id, título, subtítulo, fonte), gráficos (`[data-grafico]`, com tipo e título), tabelas interativas (título, colunas,
   linhas, botões de exportação), tabelas sob demanda (botão "Abrir: ..."), resumos em tabela (`<details>`), mapas e diagramas
   (`svg[role=img]` fora de gráficos), controles (grupos de opções, seleções, buscas, deslizadores, abas), arquivos para baixar e fichas
   "Comprove este número". Junta os três níveis por chave (rota, tipo, painel, título) e registra em que níveis cada visão aparece.

   Serve a duas coisas: o inventário de visões que o redesenho precisa preservar (antes) e a conferência mecânica de que nada sumiu (depois),
   com `scripts/energia_visoes_compara.py`.

   Uso:
     PW_CORE=/caminho/playwright-core node scripts/energia-visoes.mjs --saida <arquivo.json>
        [--base http://localhost:3100] [--rotas docs/observatorios/energia/avaliacao/rotas.txt] [--so /agua-e-clima,/pld] [--larguras 1440] */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
const BASE = (args.base || 'http://localhost:3100').replace(/\/$/, '');
const SAIDA = args.saida || 'visoes.json';
const ROTAS = readFileSync(args.rotas || 'docs/observatorios/energia/avaliacao/rotas.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  .filter(r => !args.so || args.so.split(',').some(x => r === '/setor-eletrico' + x || (x === '' && r === '/setor-eletrico')));
const MODOS = ['entender', 'analisar', 'auditar'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: Number(args.larguras || 1440), height: 900 }, locale: 'pt-BR' });

const extrair = () => {
  const visivel = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const main = document.querySelector('main') || document.body;
  const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const painelDe = el => { const s = el.closest('section[aria-labelledby$="-titulo"]'); return s ? s.id : null; };
  const fechado = e => { for (let d = e.closest('details'); d; d = d.parentElement ? d.parentElement.closest('details') : null) { const s = d.querySelector(':scope > summary'); if (!d.open && !(s && s.contains(e))) return true; } return false; };
  const ok = e => visivel(e) && !e.closest('.sr-only');
  const itens = [];
  const add = (tipo, titulo, el, extra = {}) => itens.push({ tipo, titulo: titulo || '', painel: el ? painelDe(el) : null, ...extra });

  for (const s of main.querySelectorAll('section[aria-labelledby$="-titulo"]')) {
    if (!visivel(s)) continue;
    const h = s.querySelector('h2, h3');
    const sub = s.querySelector('header p');
    const foot = s.querySelector('footer p');
    add('painel', txt(h), s, { id: s.id, subtitulo: txt(sub), fonte: txt(foot).slice(0, 220), nivel: s.getAttribute('data-nivel') || '', download: !!s.querySelector('footer a[download]') });
  }
  for (const g of main.querySelectorAll('[data-grafico]')) {
    if (!visivel(g)) continue;
    const t = g.querySelector('[data-titulo-grafico]') || g.querySelector('svg title');
    const grade = g.querySelector('ul[aria-label]:not([aria-label="Legenda"])');
    add('grafico', txt(t) || g.getAttribute('aria-label') || (grade && grade.getAttribute('aria-label')) || '', g, { forma: g.getAttribute('data-grafico'), orientacao: g.getAttribute('data-orientacao') || '', referencias: [...g.querySelectorAll('[data-referencia]')].map(r => r.getAttribute('data-referencia')).filter(Boolean).slice(0, 6) });
  }
  for (const t of main.querySelectorAll('[data-componente="tabela-interativa"]')) {
    if (!visivel(t) && !t.closest('[data-recolhivel="fechada"]')) continue;
    const reg = t.querySelector('[role="region"]');
    const cap = t.querySelector('caption');
    const ths = t.querySelectorAll('thead th');
    const status = txt(t.querySelector('[role="status"]'));
    add('tabela', txt(cap) || (reg && reg.getAttribute('aria-label')) || '', t, { colunas: ths.length, linhas: (status.match(/de ([\d.]+) linhas?/) || [])[1] || '', exportacao: [...t.querySelectorAll('button')].map(x => txt(x)).filter(x => /CSV|XLSX/i.test(x)).slice(0, 3), busca: !!t.querySelector('input[type="search"]') });
  }
  for (const d of main.querySelectorAll('details > summary')) {
    const s = txt(d);
    if (/tabela|dados do gráfico|resumo em tabela/i.test(s) && ok(d)) add('tabela-recolhida', s, d);
  }
  for (const bt of main.querySelectorAll('button')) {
    const s = txt(bt);
    if (/^(Tabela\s*)?Abrir:/.test(s) && ok(bt)) add('tabela-sob-demanda', s.replace(/^Tabela\s*/, ''), bt);
    if (/^(Mostrar|Carregar|Ver) (o )?(mapa|gráfico|detalhe)/i.test(s) && ok(bt)) add('visao-sob-demanda', s, bt);
  }
  for (const sv of main.querySelectorAll('svg[role="img"], svg[role="group"], div[role="img"]')) {
    if (sv.closest('[data-grafico]') || !visivel(sv) || sv.closest('.sr-only')) continue;
    const r = sv.getBoundingClientRect();
    if (r.width < 120 || r.height < 60) continue;
    const t = sv.querySelector('title');
    const titulo = txt(t) || sv.getAttribute('aria-label') || '';
    // as séries do gráfico de linhas e os histogramas são svg com rótulo; mapas e diagramas, também
    if (/percorrer os pontos|use as setas/i.test(titulo)) add('grafico', titulo.replace(/\.?\s*Use as setas.*$/i, ''), sv, { forma: 'linhas' });
    else if (/histograma/i.test(titulo)) add('grafico', titulo, sv, { forma: 'histograma' });
    else if (/mapa/i.test(titulo)) add('mapa', titulo, sv);
    else add('diagrama', titulo, sv);
  }
  for (const g of main.querySelectorAll('[role="radiogroup"], [role="tablist"], fieldset')) {
    if (!ok(g)) continue;
    const porId = (g.getAttribute('aria-labelledby') || '').split(/\s+/).map(i => i && document.getElementById(i)).filter(Boolean).map(x => txt(x)).join(' ');
    const rotulo = g.getAttribute('aria-label') || porId || txt(g.querySelector('legend')) || '';
    const opcoes = [...g.querySelectorAll('[role="radio"], [role="tab"], input[type="radio"], input[type="checkbox"], button[aria-pressed]')].map(o => txt(o) || (o.labels && o.labels[0] ? txt(o.labels[0]) : '')).filter(Boolean).slice(0, 12);
    if (opcoes.length) add('controle', rotulo, g, { opcoes });
  }
  for (const s of main.querySelectorAll('select, input[type="search"], input[type="range"], input[type="number"], input[type="date"], input[type="text"]')) {
    if (!ok(s) || s.closest('[data-componente="tabela-interativa"]')) continue;
    // o texto do rótulo sem as opções de uma seleção aninhada no próprio rótulo
    const semOpcoes = (l) => { const c = l.cloneNode(true); c.querySelectorAll('select, option, input, textarea').forEach(x => x.remove()); return txt(c); };
    const rot = (s.labels && s.labels[0] && (semOpcoes(s.labels[0]) || txt(s.labels[0]))) || s.getAttribute('aria-label') || s.getAttribute('placeholder') || '';
    add('controle', rot, s, { campo: s.tagName.toLowerCase() + (s.type ? ':' + s.type : '') });
  }
  for (const a of main.querySelectorAll('a[download], a[href$=".csv"], a[href$=".xlsx"], a[href$=".json"], a[href$=".zip"], a[href$=".parquet"]')) {
    if (!ok(a)) continue;
    add('arquivo', txt(a).replace(/\s*\([\d,.]+ [KM]B\)$/, '') || a.getAttribute('aria-label') || a.getAttribute('href'), a, { href: a.getAttribute('href') });
  }
  const comprove = [...main.querySelectorAll('button')].filter(x => /Comprove este número/i.test(txt(x)) && ok(x));
  if (comprove.length) add('comprove', `${comprove.length} ficha(s) Comprove este número`, null, { n: comprove.length });
  for (const f of main.querySelectorAll('[data-estado]')) {
    if (!ok(f)) continue;
  }
  const estados = {};
  for (const f of main.querySelectorAll('[data-estado]')) if (ok(f)) estados[f.getAttribute('data-estado')] = (estados[f.getAttribute('data-estado')] || 0) + 1;
  const h1 = document.querySelector('h1');
  const abas = [...document.querySelectorAll('main nav ol a, main nav ul a')].filter(a => ok(a)).map(a => txt(a)).slice(0, 12);
  const h2 = [...main.querySelectorAll('h2, h3')].filter(h => ok(h) && !h.closest('section[aria-labelledby$="-titulo"]')).map(h => txt(h)).slice(0, 40);
  return { h1: txt(h1), estados, abas_da_pagina: abas, titulos_fora_de_painel: h2, itens, altura: document.documentElement.scrollHeight };
};

const saida = { gerado_em: new Date().toISOString(), base: BASE, rotas: [] };
for (const rota of ROTAS) {
  const reg = { rota, modos: {} };
  for (const modo of MODOS) {
    const p = await ctx.newPage();
    try {
      const resp = await p.goto(BASE + rota + '?modo=' + modo, { waitUntil: 'networkidle', timeout: 90000 });
      await p.waitForTimeout(modo === 'auditar' ? 900 : 500);
      await p.evaluate(async () => {
        const espera = ms => new Promise(r => setTimeout(r, ms));
        for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); await espera(100); }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      });
      await p.waitForTimeout(400);
      const r = await p.evaluate(extrair);
      reg.modos[modo] = { status: resp.status(), ...r };
    } catch (e) {
      reg.modos[modo] = { erro: String(e).slice(0, 120) };
    }
    await p.close();
  }
  // junta os três níveis por chave
  const mapa = new Map();
  for (const modo of MODOS) {
    for (const it of (reg.modos[modo].itens || [])) {
      const k = [it.tipo, it.painel || '', it.titulo.toLowerCase(), it.tipo === 'painel' ? it.id : '', (it.href || '').split('/').pop()].join('|');
      const e = mapa.get(k) || { ...it, niveis: [] };
      e.niveis.push(modo);
      mapa.set(k, e);
    }
  }
  reg.visoes = [...mapa.values()];
  for (const modo of MODOS) { if (reg.modos[modo].itens) delete reg.modos[modo].itens; }
  saida.rotas.push(reg);
  console.log(rota.replace('/setor-eletrico', '') || '/', 'visões', reg.visoes.length);
}
await b.close();
writeFileSync(SAIDA, JSON.stringify(saida, null, 1));
console.log('rotas', saida.rotas.length, 'visões', saida.rotas.reduce((s, r) => s + r.visoes.length, 0), '→', SAIDA);
