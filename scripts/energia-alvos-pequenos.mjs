/* Classificação dos alvos de toque abaixo de 44 px do observatório de energia (uso próprio, fora da rubrica).

   O instrumento `scripts/energia-avaliacao.mjs` conta como alvo pequeno todo controle visível com lado menor que 44 px, fora link no meio de
   uma frase. Este script abre as rotas pedidas numa largura e separa esse total em dois grupos:
     - caixa de seleção ou botão de opção nativo cujo rótulo (`label`) tem 44 px ou mais de altura: a área tocável é o rótulo, o campo mede 24 px;
     - todo o resto (botão ou link de 44 px de altura e menos de 44 px de largura, por exemplo "UF ↑", "CSV" ou um atalho de uma palavra).
   Um alvo abaixo de 24 px (WCAG 2.5.8, nível AA) não deve existir em nenhum dos dois.

   Uso:
     PW_CORE=<caminho de playwright-core> node scripts/energia-alvos-pequenos.mjs <base> <rotas.txt> <largura> <saida.json>
   A última linha impressa traz os totais; o JSON traz, por rota, exemplos do segundo grupo. */
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || 'playwright-core');
const [base, arquivo, largura, saida] = process.argv.slice(2);
if (!base || !arquivo || !largura || !saida) {
  console.error('uso: node scripts/energia-alvos-pequenos.mjs <base> <rotas.txt> <largura> <saida.json>');
  process.exit(2);
}
const rotas = fs.readFileSync(arquivo, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: Number(largura), height: 800 }, locale: 'pt-BR', hasTouch: true });
const tot = { total: 0, entrada_em_rotulo_de_44: 0, entrada_sem_rotulo_de_44: 0, outros: 0, menores_que_24: 0, rotas_com_outros: [] };
const exemplos = [];
for (const rota of rotas) {
  const p = await ctx.newPage();
  try {
    await p.goto(base + rota, { waitUntil: 'load', timeout: 240000 });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const principal = document.querySelector('main') || document.body;
      const visivel = (el) => {
        const rc = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return rc.width > 0 && rc.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const alvos = Array.from(principal.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=tab], [role=radio]')).filter(
        (el) => visivel(el) && !el.closest('.sr-only') && !el.classList.contains('sr-only'),
      );
      const res = { total: 0, emRotulo: 0, semRotulo: 0, outros: 0, menores24: 0, ex: [] };
      for (const el of alvos) {
        const rc = el.getBoundingClientRect();
        let hosp = el.parentElement;
        while (hosp && hosp.parentElement && getComputedStyle(hosp).display === 'inline') hosp = hosp.parentElement;
        const comTexto = !!hosp && Array.from(hosp.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
        const emLinha = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && (el.closest('p, li, td, dd') || comTexto);
        if (emLinha || (rc.height >= 44 && rc.width >= 44)) continue;
        res.total++;
        if (rc.height < 24 || rc.width < 24) res.menores24++;
        if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type)) {
          const lab = el.closest('label');
          const lr = lab ? lab.getBoundingClientRect() : null;
          if (lr && lr.height >= 44) res.emRotulo++;
          else res.semRotulo++;
        } else {
          res.outros++;
          if (res.ex.length < 4) res.ex.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30)}" ${Math.round(rc.width)}x${Math.round(rc.height)}`);
        }
      }
      return res;
    });
    tot.total += r.total;
    tot.entrada_em_rotulo_de_44 += r.emRotulo;
    tot.entrada_sem_rotulo_de_44 += r.semRotulo;
    tot.outros += r.outros;
    tot.menores_que_24 += r.menores24;
    if (r.outros) {
      tot.rotas_com_outros.push(rota.replace('/setor-eletrico', '') || '/');
      exemplos.push((rota.replace('/setor-eletrico', '') || '/') + ': ' + r.ex.join('; '));
    }
  } catch (e) {
    exemplos.push(rota + ' ERRO ' + String(e).slice(0, 80));
  }
  await p.close();
}
await b.close();
fs.writeFileSync(saida, JSON.stringify({ tot, exemplos }, null, 1));
console.log(JSON.stringify(tot));
