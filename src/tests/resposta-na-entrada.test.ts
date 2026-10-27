import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { aguardarHidratacao, aguardarSessaoResolvida } from "../../scripts/ux-cromo-medida.mjs";
import { subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
import { consultarMunicipio as consultarConectividade, goldConectividade } from "@/lib/conectividade/dados";
import { pct as pctConectividade, mesExtenso } from "@/lib/conectividade/formato";
import { montarRetrato } from "@/lib/eficiencia/entrada";
import { goldInflacao, primeiraTela } from "@/lib/inflacao/dados";
import { pct } from "@/lib/inflacao/formato";
import { numero } from "@/lib/eficiencia/entrada-nucleo";

/** Pedido do dono, 27/10/2026: entregar a resposta específica logo na entrada.
 * O contrato mede a escolha no viewport e a resposta do recorte, não a redação dos títulos. */
const ROTAS = ["/custo-de-vida", "/combustiveis", "/conectividade", "/educacao-municipal", "/eficiencia-estatal"];
const CONSULTA = '[data-fatia="resposta"]';

describe("resposta específica na entrada, no build", () => {
  let servidor: ServidorProducao;
  let navegador: Browser;
  beforeAll(async () => {
    expect(temBuild, "Execute npm run build para medir a página publicada localmente").toBe(true);
    servidor = await subirServidor("resposta-entrada");
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
  }, 120_000);
  afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

  async function abrir(pagina: Page, rota: string) {
    const r = await pagina.goto(servidor.origem + rota, { waitUntil: "networkidle" });
    expect(r?.status()).toBe(200);
    await aguardarSessaoResolvida(pagina, true);
    await aguardarHidratacao(pagina);
    await pagina.evaluate(() => document.fonts.ready);
  }
  async function contexto(largura = 390) {
    const c = await navegador.newContext({ viewport: { width: largura, height: 900 }, reducedMotion: "reduce", hasTouch: largura < 768 });
    await c.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
    return c;
  }

  for (const largura of [320, 390, 768, 1440]) {
    it(`${largura} px: escolha inteira na primeira tela, antes do panorama e sem transbordamento`, async () => {
      const c = await contexto(largura);
      try {
        const p = await c.newPage();
        for (const rota of ROTAS) {
          await abrir(p, rota);
          const consulta = p.locator(CONSULTA);
          expect(await consulta.count(), rota).toBe(1);
          const escolha = consulta.locator("select, input").first();
          const caixa = await escolha.boundingBox();
          expect(caixa, rota).not.toBeNull();
          expect(caixa!.y, rota).toBeGreaterThan(0);
          expect(caixa!.y + caixa!.height, rota).toBeLessThanOrEqual(900);
          expect(caixa!.height, rota).toBeGreaterThanOrEqual(44);
          const valor = consulta.locator("[data-valor-resposta]").first();
          if (await valor.count()) {
            const medida = await valor.boundingBox();
            expect(medida!.y + medida!.height, `${rota}: o primeiro valor inteiro`).toBeLessThanOrEqual(900);
          }
          const ordem = await p.evaluate(() => {
            const resposta = document.querySelector('[data-fatia="resposta"]')!;
            const escala = document.querySelector('[data-fatia="escala"]')!;
            return { antes: !!(resposta.compareDocumentPosition(escala) & Node.DOCUMENT_POSITION_FOLLOWING), largura: document.documentElement.scrollWidth };
          });
          expect(ordem.antes, rota).toBe(true);
          expect(ordem.largura, rota).toBeLessThanOrEqual(largura);
          expect(await consulta.innerText(), rota).not.toMatch(/\b(?:undefined|NaN)\b/);
          await escolha.focus();
          expect(await escolha.evaluate(e => e === document.activeElement), rota).toBe(true);
          await p.evaluate(() => { document.documentElement.style.fontSize = "200%"; window.scrollTo(0, 0); });
          await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          expect(await p.evaluate(() => document.documentElement.scrollWidth), `${rota}: raiz a 200%`).toBeLessThanOrEqual(largura);
          expect((await escolha.boundingBox())!.width, `${rota}: controle a 200%`).toBeLessThanOrEqual(largura);
        }
      } finally { await c.close(); }
    }, 120_000);
  }

  it("capital: os sete valores são os das duas escolhas, com fonte e período, inclusive após voltar e recarregar", async () => {
    const c = await contexto();
    try {
      const p = await c.newPage();
      await abrir(p, "/eficiencia-estatal");
      const selects = p.locator(`${CONSULTA} select`);
      await selects.first().selectOption("3550308");
      const resposta = p.locator('[data-resposta-especifica]');
      const r = montarRetrato();
      expect(await resposta.locator('[data-resultado-capital]').count()).toBe(r.condicoes.length);
      for (const m of r.condicoes) {
        const texto = await resposta.locator(`[data-resultado-capital="${m.id}"]`).innerText();
        expect(texto).toContain(numero(m.valores["3550308"]?.valor ?? null, m.unidade));
        expect(texto).toContain(numero(m.valores["4106902"]?.valor ?? null, m.unidade));
        expect(texto).toContain(m.fonte);
        expect(texto).toContain(m.periodo);
      }
      await selects.first().selectOption("3304557");
      await p.goBack();
      await p.waitForFunction(() => (document.querySelector('[data-fatia="resposta"] select') as HTMLSelectElement)?.value === "3550308");
      await p.reload({ waitUntil: "networkidle" });
      await aguardarHidratacao(p);
      expect(await selects.first().inputValue()).toBe("3550308");
      expect(await p.locator("h1").innerText()).toContain("São Paulo");
    } finally { await c.close(); }
  }, 90_000);

  it("inflação: área e Brasil vêm da gold, grupos permanecem acessíveis e a escolha sobrevive à recarga", async () => {
    const c = await contexto();
    try {
      const p = await c.newPage();
      await abrir(p, "/custo-de-vida");
      const dados = primeiraTela(goldInflacao());
      const area = dados.areas.find(a => a.uf === "PE")!;
      const consulta = p.locator(CONSULTA);
      await consulta.locator("select").selectOption(area.id);
      expect(await consulta.locator('[data-medida="area"]').innerText()).toContain(pct(area.geral.doze));
      expect(await consulta.locator('[data-medida="brasil"]').count()).toBe(1);
      expect(await consulta.innerText()).toContain("IBGE");
      const grupos = consulta.locator("details");
      await grupos.locator("summary").focus();
      await p.keyboard.press("Enter");
      expect(await grupos.locator('[data-grupo]:visible').count()).toBe(dados.grupos.length);
      await p.reload({ waitUntil: "networkidle" });
      await aguardarHidratacao(p);
      expect(await consulta.locator("select").inputValue()).toBe(area.id);
      expect(await consulta.locator('[data-medida="area"]').innerText()).toContain(pct(area.geral.doze));
    } finally { await c.close(); }
  }, 90_000);

  it("combustíveis: o tanque é a média observada vezes os litros, com fonte, período e ausência explícita", async () => {
    const c = await contexto();
    try {
      const p = await c.newPage();
      await abrir(p, "/combustiveis");
      const consulta = p.locator(CONSULTA);
      await consulta.locator("select").selectOption("PE");
      await consulta.locator('input[type="number"]').fill("60");
      const produtos = consulta.locator("[data-combustivel]");
      for (const produto of await produtos.all()) {
        const texto = await produto.innerText();
        if (texto.includes("sem dado")) { expect(texto).toContain("ANP"); continue; }
        const valores = [...texto.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map(m => Number(m[1].replaceAll(".", "").replace(",", ".")));
        // O valor por litro é arredondado a centavos; tolerância máxima do total de 60 litros é R$ 0,30.
        expect(Math.abs(valores[0] - valores[1] * 60)).toBeLessThanOrEqual(0.301);
      }
      expect(await consulta.innerText()).toContain("ANP");
      await consulta.locator('input[type="number"]').fill("");
      expect(await consulta.innerText()).not.toMatch(/NaN|undefined/);
      expect(await consulta.locator('[data-combustivel]').first().innerText()).toContain("por litro");
    } finally { await c.close(); }
  }, 90_000);

  for (const rota of ["/conectividade", "/educacao-municipal"]) {
    it(`${rota}: busca por teclado entrega o município antes do país e mantém o recorte ao atualizar`, async () => {
      const c = await contexto();
      try {
        const p = await c.newPage();
        await abrir(p, rota);
        const busca = p.locator(CONSULTA).getByRole("combobox");
        await busca.fill("Recife");
        await p.getByRole("option").first().waitFor();
        await p.keyboard.press("Escape");
        expect(await p.getByRole("option").count()).toBe(0);
        await busca.fill("Recif");
        await p.getByRole("option").first().waitFor();
        await p.keyboard.press("ArrowDown");
        await p.keyboard.press("Enter");
        await p.waitForURL(`**${rota}?ibge=2611606`);
        await aguardarHidratacao(p);
        const resultado = p.locator(`${CONSULTA} [data-resposta-especifica]`);
        expect(await resultado.innerText()).toContain("Recife");
        if (rota === "/conectividade") {
          const municipio = consultarConectividade("2611606");
          if (municipio.estado !== "ok") throw new Error("Município ausente na gold");
          const texto = await resultado.innerText();
          expect(texto).toContain(pctConectividade(municipio.m.fixa?.fibra_pct));
          const g = goldConectividade();
          expect(texto).toContain(mesExtenso(g.referencia.fixa));
          expect(texto).toContain(mesExtenso(g.referencia.cobertura));
        }
        const local = await resultado.boundingBox();
        const nacional = await p.locator("#contexto-da-entrada").boundingBox();
        expect(local!.y).toBeLessThan(nacional!.y);
        expect(local!.y).toBeLessThan(900);
        await p.reload({ waitUntil: "networkidle" });
        expect(await resultado.innerText()).toContain("Recife");
      } finally { await c.close(); }
    }, 90_000);
  }
});
