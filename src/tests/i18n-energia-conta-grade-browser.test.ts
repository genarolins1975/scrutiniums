import type { Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Idioma } from "@/lib/idioma";
import { criarNavegadorGrade, INSTRUCAO_GRADE, type JanelaGrade, type NavegadorGrade } from "./suporte/i18n-energia-conta-grade-browser";

const TEXTOS = {
  pt: {
    a: "janeiro de 2025: Amarela, 1.234,56 R$/MWh (1,23456 R$/kWh)",
    b: "março de 2025: Vermelha P2, 1.234.567,89 R$/MWh (1.234,56789 R$/kWh)",
    zero: "janeiro de 2026: Verde, 0,00 R$/MWh (0,00000 R$/kWh)",
    ausente: "fevereiro de 2026: sem nome publicado, sem valor publicado",
    ultima: "março de 2026: Amarela, 42,50 R$/MWh (0,04250 R$/kWh)",
  },
  en: {
    a: "janeiro de 2025: Amarela, 1.234,56 R$/MWh (1.23456 R$/kWh)",
    b: "março de 2025: Vermelha P2, 1.234.567,89 R$/MWh (1,234.56789 R$/kWh)",
    zero: "janeiro de 2026: Verde, 0,00 R$/MWh (0.00000 R$/kWh)",
    ausente: "fevereiro de 2026: sem nome publicado, sem valor publicado",
    ultima: "março de 2026: Amarela, 42,50 R$/MWh (0.04250 R$/kWh)",
  },
} as const;
const CELULAS = ["a", "b", "zero", "ausente", "ultima"] as const;
const ENTRADAS_PT = ["Amarela, 1.234,56 R$/MWh", "Vermelha P2, 1.234.567,89 R$/MWh", "Verde, 0,00 R$/MWh", "sem nome publicado, sem valor publicado", "Amarela, 42,50 R$/MWh"];
type Celula = typeof CELULAS[number];
let navegador: NavegadorGrade | undefined;
beforeAll(async () => { navegador = await criarNavegadorGrade(); }, 60_000);
afterAll(async () => { await navegador?.fechar(); });

async function comGrade(idioma: Idioma | undefined, verificar: (page: Page) => Promise<void>): Promise<void> {
  if (!navegador) throw new Error("A prova da grade requer Vite e Chromium disponíveis");
  const pagina = await navegador.pagina(idioma), erros: unknown[] = [];
  try {
    await verificar(pagina.page);
    expect(pagina.page.url()).toBe(pagina.url);
  } catch (e) { erros.push(e); }
  try { await pagina.fechar(); } catch (e) { erros.push(e); }
  try { expect(pagina.falhas, "nenhum erro de execução ou pedido inesperado").toEqual([]); } catch (e) { erros.push(e); }
  if (erros.length === 1) throw erros[0];
  if (erros.length) throw new AggregateError(erros, "Falhas na interação ou limpeza da grade");
}

async function dica(page: Page, id: Celula, idioma: Idioma): Promise<void> {
  await expect.poll(() => page.locator("[data-dica-bandeira]").textContent()).toBe(TEXTOS[idioma][id]);
  expect(await page.locator(`#${id}`).getAttribute("title")).toBe(TEXTOS[idioma][id]);
}

async function parada(page: Page, id: Celula, idioma: Idioma): Promise<void> {
  expect(await page.evaluate(() => document.activeElement?.id)).toBe(id);
  expect(await page.locator("#montagem td.cb-cel").evaluateAll((nodes) => nodes.map((n) => [n.id, n.getAttribute("tabindex")]))).toEqual(
    CELULAS.map((celula) => [celula, celula === id ? "0" : "-1"]),
  );
  await dica(page, id, idioma);
}

describe("ContaGradeDica real: entrada PT e apresentação selecionada no DOM", () => {
  it.each([undefined, "pt", "en"] as const)("foco, mouse e clique isolado com idioma %s", { timeout: 30_000 }, async (idioma) => {
    await comGrade(idioma, async (page) => {
      const lang = idioma ?? "pt", status = page.locator("[data-dica-bandeira]");
      expect(await status.count()).toBe(1);
      expect(await status.getAttribute("role")).toBe("status");
      expect(await status.getAttribute("aria-live")).toBe("polite");
      expect(await status.textContent()).toBe(INSTRUCAO_GRADE);
      expect(await page.locator("#montagem td[title]").count()).toBe(0);
      expect(await page.locator('#montagem td[tabindex="0"]').evaluateAll((nodes) => nodes.map((n) => n.id))).toEqual(["ultima"]);

      await page.mouse.move(0, 0);
      await page.locator("#a").focus();
      await dica(page, "a", lang);
      await page.locator("#zero [data-alvo]").hover();
      await dica(page, "zero", lang);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("a");
      // Click sintético no DOM real, sem hover/foco que poderiam encobrir onClick quebrado.
      await page.locator("#b [data-alvo]").dispatchEvent("click");
      await dica(page, "b", lang);
      await page.locator("#ausente [data-alvo]").dispatchEvent("click");
      await dica(page, "ausente", lang);
      for (const seletor of ["#ano", "#vazia", "#fora [data-alvo]"]) {
        await page.locator(seletor).dispatchEvent("click");
        expect(await status.textContent()).toBe(TEXTOS[lang].ausente);
      }
      expect(await page.locator("#montagem td.cb-cel .sr-only").allTextContents()).toEqual(ENTRADAS_PT);
      expect(await page.locator("#vazia").getAttribute("title")).toBeNull();
      expect(await page.locator("#fora").getAttribute("title")).toBeNull();
    });
  });

  it.each(["pt", "en"] as const)("setas preservam a parada única e pulam mês vazio em %s", { timeout: 30_000 }, async (idioma) => {
    await comGrade(idioma, async (page) => {
      // Caso fresco: foco direto no teste anterior não muda tabindex no componente.
      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");
      await parada(page, "ultima", idioma);
      for (const [tecla, destino] of [["ArrowUp", "b"], ["ArrowLeft", "a"], ["ArrowDown", "zero"], ["ArrowRight", "ausente"], ["ArrowLeft", "zero"], ["ArrowLeft", "zero"], ["Enter", "zero"]] as const) {
        await page.keyboard.press(tecla);
        await parada(page, destino, idioma);
      }
    });
  });

  it("troca idioma na mesma montagem, preserva o anúncio e usa a closure nova só no próximo evento", { timeout: 30_000 }, async () => {
    await comGrade("pt", async (page) => {
      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowLeft");
      await parada(page, "a", "pt");

      const trocar = async (idioma: Idioma) => page.evaluate(async (lang) => {
        const raiz = document.querySelector("#montagem > div")!;
        const celula = document.getElementById("a")!;
        const status = document.querySelector("[data-dica-bandeira]")!;
        const foco = document.activeElement;
        const capturar = () => ({
          texto: status.textContent, titulo: celula.getAttribute("title"),
          tabs: Array.from(raiz.querySelectorAll("td.cb-cel"), (n) => [n.id, n.getAttribute("tabindex")]),
          entradas: Array.from(raiz.querySelectorAll("td.cb-cel .sr-only"), (n) => n.textContent),
        });
        const antes = capturar(), eventos: string[] = [], mutacoes: string[] = [];
        const registrar = (evento: Event) => { eventos.push(evento.type); };
        const tipos = ["focusin", "mouseover", "click", "keydown"];
        const observer = new MutationObserver((records) => { mutacoes.push(...records.map((r) => r.type)); });
        for (const tipo of tipos) raiz.addEventListener(tipo, registrar);
        observer.observe(status, { childList: true, characterData: true, subtree: true });
        for (const td of raiz.querySelectorAll("td.cb-cel")) observer.observe(td, { attributes: true, attributeFilter: ["title"] });
        try {
          const ponte = (window as JanelaGrade).__contaGrade;
          if (!ponte) throw new Error("Bridge de atualização da grade indisponível");
          ponte.renderizar(lang);
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          mutacoes.push(...observer.takeRecords().map((r) => r.type));
          return { antes, depois: capturar(), eventos, mutacoes,
            mesmosNos: raiz === document.querySelector("#montagem > div") && celula === document.getElementById("a") && status === document.querySelector("[data-dica-bandeira]"),
            mesmoFoco: foco === document.activeElement };
        } finally {
          observer.disconnect();
          for (const tipo of tipos) raiz.removeEventListener(tipo, registrar);
        }
      }, idioma);

      for (const [novo, anterior] of [["en", "pt"], ["pt", "en"]] as const) {
        const troca = await trocar(novo);
        expect(troca.mesmosNos).toBe(true);
        expect(troca.mesmoFoco).toBe(true);
        expect(troca.depois).toEqual(troca.antes);
        expect(troca.depois.texto).toBe(TEXTOS[anterior].a);
        expect(troca.depois.titulo).toBe(TEXTOS[anterior].a);
        expect(troca.depois.entradas).toEqual(ENTRADAS_PT);
        expect(troca.eventos).toEqual([]);
        expect(troca.mutacoes).toEqual([]);
        await page.locator("#a [data-alvo]").dispatchEvent("click");
        await parada(page, "a", novo);
      }
      await page.keyboard.press("ArrowRight");
      await parada(page, "b", "pt");
    });
  });
});
