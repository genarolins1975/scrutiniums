/* Medida do texto dentro dos gráficos SVG do observatório de energia (uso próprio, fora da rubrica).

   Para cada rota de uma lista e cada largura, abre a página no nível padrão (Entender), como o leitor a vê, e mede em cada SVG com texto:
   o tamanho efetivo de cada texto em px de tela (tamanho em unidades do SVG vezes a escala do viewBox), o texto que passa da caixa do SVG
   (a borda de ±1 px não conta) e o texto que se sobrepõe a outro (mais de 25% da área do menor). SVG com menos de 120 por 60 px (ícones) fica fora.

   Serve a duas coisas: a linha de base antes do redesenho (texto de 10 e 11 px, rótulos de eixo cortados no celular) e a conferência do estado
   final. Resultado em docs/energia/redesign/VALIDACAO.md, seção 2.

   Uso:
     PW_CORE=<caminho de playwright-core> node scripts/energia-svg-texto.mjs <base> <arquivo com uma rota por linha> <saida.json> [larguras separadas por vírgula]
   Padrão de larguras: 1440 e 390. A última linha impressa soma os contadores de todas as medições. */
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || 'playwright-core');
const [base, arquivoRotas, saida, ...larguras] = process.argv.slice(2);
if (!base || !arquivoRotas || !saida) {
  console.error('uso: node scripts/energia-svg-texto.mjs <base> <rotas.txt> <saida.json> [larguras]');
  process.exit(2);
}
const rotas = fs.readFileSync(arquivoRotas, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const LARGS = larguras.length ? larguras.join(',').split(',').map(Number) : [1440, 390];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const out = {};
try {
  for (const rota of rotas) {
    for (const w of LARGS) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 }, locale: 'pt-BR' });
      const p = await ctx.newPage();
      try {
        await p.goto(base + rota, { waitUntil: 'load', timeout: 240000 });
        await p.waitForTimeout(2200);
        const r = await p.evaluate(() => {
          const res = { svgs: 0, textos: 0, abaixo12: 0, minimo: null, cortados: 0, sobrepostos: 0, exemplos: [] };
          for (const svg of document.querySelectorAll('svg')) {
            const sr = svg.getBoundingClientRect();
            if (sr.width < 120 || sr.height < 60) continue;
            const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null;
            const escala = vb ? sr.width / vb.width : 1;
            const ts = [...svg.querySelectorAll('text')].filter((t) => (t.textContent || '').trim().length > 0 && t.getBoundingClientRect().width > 0);
            if (!ts.length) continue;
            res.svgs++;
            const caixas = [];
            for (const t of ts) {
              const fs = parseFloat(getComputedStyle(t).fontSize) * escala;
              res.textos++;
              if (res.minimo === null || fs < res.minimo) res.minimo = Math.round(fs * 10) / 10;
              if (fs < 11.95) res.abaixo12++;
              const rc = t.getBoundingClientRect();
              if (rc.left < sr.left - 1 || rc.right > sr.right + 1) {
                res.cortados++;
                if (res.exemplos.length < 4) res.exemplos.push('corte:' + (t.textContent || '').trim().slice(0, 24));
              }
              caixas.push({ r: rc, txt: (t.textContent || '').trim() });
            }
            for (let i = 0; i < caixas.length; i++) {
              for (let j = i + 1; j < caixas.length; j++) {
                const a = caixas[i].r;
                const c = caixas[j].r;
                const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left);
                const iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
                if (ix > 1 && iy > 1) {
                  const menor = Math.min(a.width * a.height, c.width * c.height);
                  if (ix * iy > 0.25 * menor) {
                    res.sobrepostos++;
                    if (res.exemplos.length < 6) res.exemplos.push('sobrepõe:' + caixas[i].txt.slice(0, 14) + '|' + caixas[j].txt.slice(0, 14));
                  }
                }
              }
            }
          }
          return res;
        });
        out[rota + '@' + w] = r;
      } catch (e) {
        out[rota + '@' + w] = { erro: String(e).slice(0, 120) };
      }
      await ctx.close();
    }
  }
} finally {
  await b.close();
}
fs.writeFileSync(saida, JSON.stringify(out, null, 1));
const t = { svgs: 0, textos: 0, abaixo12: 0, cortados: 0, sobrepostos: 0 };
for (const v of Object.values(out)) for (const k of Object.keys(t)) t[k] += v[k] || 0;
console.log(JSON.stringify(t));
