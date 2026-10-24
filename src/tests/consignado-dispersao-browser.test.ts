import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

type Estado = { uf: string; nome: string; outras_censo: number | null; cons_por_60: number | null; a60: number };
const fonte = JSON.parse(readFileSync("public/obs/data/gold/consignado.json", "utf8"));
const estados = (fonte.estados as Estado[]).filter((e): e is Estado & { outras_censo: number; cons_por_60: number } => e.outras_censo != null && e.cons_por_60 != null);
const xs = estados.map(e => e.outras_censo), ys = estados.map(e => e.cons_por_60);
const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
// A margem visual acomoda ticks; a posição normalizada no domínio e o raio continuam iguais aos dados.
const pontosOriginais = estados.map(e => ({ uf: e.uf,
  x: (e.outras_censo - x0) / Math.max(x1 - x0, 1e-9),
  y: (e.cons_por_60 - y0) / Math.max(y1 - y0, 1e-9),
  r: +(4 + 9 * Math.sqrt(e.a60 / 4e6)).toFixed(1),
}));
let servidor: ServidorProducao;
let navegador: Browser;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("cg-dispersao");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

describe.skipIf(!temBuild && !exigirBuild)("Gráficos: identificação sem colisões ou deslocamento dos valores", () => {
  it("siglas não colidem, ficam no SVG e estados são identificados por teclado e controle de toque", async () => {
    const contexto = await navegador.newContext({ viewport: { width: 320, height: 900 }, hasTouch: true });
    await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
    const page = await contexto.newPage();
    const erros: string[] = [];
    page.on("pageerror", e => erros.push(e.message));
    try {
      await page.goto(servidor.origem + "/observatorio/payroll-lending-aging");
      // O nome acessível exclui as opções; getByLabel exato inclui o texto do select aninhado.
      const seletor = page.getByRole("combobox", { name: "Consultar estado", exact: true });
      await seletor.waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const resultado = await page.locator("#cg-circ .cgdisp").evaluate(svg => {
          const limite = svg.getBoundingClientRect();
          const grupos = [...svg.querySelectorAll<SVGGElement>(".cgdisp-uf")];
          const caixas = grupos.map(g => { const r = g.querySelector("text")!.getBoundingClientRect(); return { uf: g.dataset.uf, x: r.x, y: r.y, w: r.width, h: r.height }; });
          const colisoes: Array<Array<string | undefined>> = [];
          for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
            const a = caixas[i], b = caixas[j];
            if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) colisoes.push([a.uf, b.uf]);
          }
          const fora = caixas.filter(b => b.x < limite.left - .5 || b.x + b.w > limite.right + .5 || b.y < limite.top - .5 || b.y + b.h > limite.bottom + .5).map(b => b.uf);
          const [horizontal, vertical] = [...svg.querySelectorAll<SVGLineElement>(":scope > line")];
          const esquerda = horizontal.x1.baseVal.value, direita = horizontal.x2.baseVal.value;
          const baixo = horizontal.y1.baseVal.value, topo = vertical.y1.baseVal.value;
          const pontos = grupos.map(g => { const c = g.querySelector("circle")!; return { uf: g.dataset.uf, x: (+c.getAttribute("cx")! - esquerda) / (direita - esquerda), y: (baixo - +c.getAttribute("cy")!) / (baixo - topo), r: +c.getAttribute("r")! }; });
          return { colisoes, fora, pontos, guias: svg.querySelectorAll(".cgdisp-guia").length };
        });
        expect(resultado.colisoes, `rótulos sobrepostos em ${width}px`).toEqual([]);
        expect(resultado.fora, `rótulos fora do SVG em ${width}px`).toEqual([]);
        expect(resultado.pontos.map(p => p.uf)).toEqual(pontosOriginais.map(p => p.uf));
        resultado.pontos.forEach((p, i) => {
          expect(p.x).toBeCloseTo(pontosOriginais[i].x, 3);
          expect(p.y).toBeCloseTo(pontosOriginais[i].y, 3);
          expect(p.r).toBe(pontosOriginais[i].r);
        });
        expect(resultado.guias).toBe(estados.length);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      const tabela = page.locator("#cg-circ .cgdisp-wrap + details");
      expect(await tabela.locator("tbody tr").count()).toBe(estados.length);
      await seletor.focus();
      await page.keyboard.press("Home"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
      const primeiro = estados[0];
      expect(await seletor.inputValue()).toBe(primeiro.uf);
      expect(await page.locator(".cgdisp-uf.is-active").getAttribute("data-uf")).toBe(primeiro.uf);
      expect(await page.locator(".cgdisp-leitura").innerText()).toContain(primeiro.nome);
      await page.setViewportSize({ width: 390, height: 900 });
      expect(await seletor.evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await seletor.tap(); await page.keyboard.press("Escape");
      const extremo = estados.reduce((a, b) => a.outras_censo > b.outras_censo ? a : b);
      await seletor.selectOption(extremo.uf);
      expect(await page.locator(".cgdisp-leitura").innerText()).toContain(extremo.nome);
      expect(await page.locator(".cgdisp-uf.is-active").getAttribute("data-uf")).toBe(extremo.uf);
      expect(await page.locator(".cgdisp-uf.is-active text").evaluate(t => {
        const r = t.getBoundingClientRect(), cont = t.closest(".cgdisp-wrap")!.getBoundingClientRect();
        return r.left >= cont.left && r.right <= cont.right;
      })).toBe(true);
      expect(erros).toEqual([]);
    } finally { await contexto.close(); }
  }, 90_000);

  it("datas do Pulso mantêm intervalos livres e piso de 12px também nas figuras em duas colunas", async () => {
    const contexto = await navegador.newContext({ viewport: { width: 320, height: 900 } });
    await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/credit");
      await page.locator("#view-pulse .line-chart svg.chart").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      let dados: string | undefined;
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.locator("#view-pulse .line-chart").evaluateAll(nos => nos.every(n =>
          !n.getBoundingClientRect().width || Math.abs(n.getBoundingClientRect().width - Number((n as HTMLElement).dataset.lineWidth)) < 2,
        ))).toBe(true);
        const medir = () => page.locator("#view-pulse .line-chart svg.chart").evaluateAll(svgs => svgs.filter(svg => svg.getBoundingClientRect().width > 0).map(svg => {
          const limite = svg.getBoundingClientRect();
          const escala = limite.width / (svg as SVGSVGElement).viewBox.baseVal.width;
          const ticks = [...svg.querySelectorAll<SVGTextElement>("text.xl")].map(t => {
            const b = t.getBoundingClientRect();
            return { texto: t.textContent, inicio: b.left, fim: b.right, largura: b.width, tamanho: parseFloat(getComputedStyle(t).fontSize) * escala };
          }).filter(t => t.largura > 0);
          return { largura: limite.width, ticks: ticks.length, problemas: ticks.flatMap((t, i) => {
            const problemas: string[] = [];
            if (t.inicio < limite.left - .5 || t.fim > limite.right + .5) problemas.push(`fora: ${t.texto}`);
            if (t.tamanho < 11.9) problemas.push(`fonte: ${t.texto}`);
            if (i && t.inicio < ticks[i - 1].fim + 10) problemas.push(`colisão: ${ticks[i - 1].texto} / ${t.texto}`);
            return problemas;
          }) };
        }));
        await expect.poll(async () => (await medir()).flatMap(g => g.problemas), { message: `Pulso em ${width}px` }).toEqual([]);
        const figuras = await medir();
        expect(figuras.length).toBeGreaterThan(5);
        expect(figuras.every(g => g.ticks > 0)).toBe(true);
        if (width === 768) expect(figuras.some(g => g.largura < width / 2)).toBe(true);
        const atuais = await page.locator("#view-pulse svg[data-chart]").evaluateAll(nos => JSON.stringify(nos.map(n => {
          const d = JSON.parse(decodeURIComponent(n.getAttribute("data-chart")!));
          return { xs: d.xs, series: d.series, band: d.band };
        })));
        if (dados === undefined) dados = atuais;
        else expect(atuais).toBe(dados);
      }
    } finally { await contexto.close(); }
  }, 90_000);
});
