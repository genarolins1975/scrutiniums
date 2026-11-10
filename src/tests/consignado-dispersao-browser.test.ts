import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

let servidor: ServidorProducao;
let navegador: Browser;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("cg-dispersao");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

describe.skipIf(!temBuild && !exigirBuild)("Gráficos: identificação sem colisões ou deslocamento dos valores", () => {
  // Teste aposentado em 10/11/2026: "siglas não colidem, ficam no SVG e estados são identificados por teclado e controle de toque" (dispersão
  // #cg-circ .cgdisp da vista antiga do consignado). Motivo: decisão do dono de 10/11/2026; fechada a paridade (docs/familias/PARIDADE.md),
  // /observatorio/payroll-lending-aging redireciona (308) para /divida-das-familias/consignado e a vista antiga não é mais desenhada. A
  // dispersão da página nova não escreve as 27 siglas (o nome aparece no estado consultado e na dica); o seletor "Consultar estado" por
  // teclado e toque, o círculo por estado dentro do desenho nas quatro larguras e o tamanho pela população de 60 anos ou mais são
  // conferidos em src/tests/familias-paridade-browser.test.ts e src/tests/familias-consignado.test.ts.

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
