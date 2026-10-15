import type { Locator, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Idioma } from "@/lib/idioma";
import { ALFA, BETA, CODIGOS_AUSENTES, URLS } from "./suporte/i18n-energia-qualidade-fixtures";
import { criarNavegadorQualidade, type JanelaQualidade, type NavegadorQualidade, type PaginaQualidade } from "./suporte/i18n-energia-qualidade-browser";

const FICHA = "[data-conjuntos-do-municipio]";
const MAPA = '[style*="--mapa-h"]';
const MULTIPLOS = '[data-grafico="pequenos-multiplos"]';
const ESPERA = { timeout: 15_000 };
const TEXTOS = {
  pt: { municipios: "1.234", conjuntos: "1.003", ausentes: "1.001" },
  en: { municipios: "1,234", conjuntos: "1,003", ausentes: "1,001" },
} as const;
const SERIES = {
  pt: [
    [["2024", "1.234,56", "1.000,12", "3.456,78", "3.000,34"], ["2025", "2.345,67", "2.000,23", "4.567,89", "4.000,45"]],
    [["2024", "12,34", "10,12", "34,56", "30,34"], ["2025", "23,45", "20,23", "45,67", "40,45"]],
  ],
  en: [
    [["2024", "1,234.56", "1,000.12", "3,456.78", "3,000.34"], ["2025", "2,345.67", "2,000.23", "4,567.89", "4,000.45"]],
    [["2024", "12.34", "10.12", "34.56", "30.34"], ["2025", "23.45", "20.23", "45.67", "40.45"]],
  ],
} as const;
let navegador: NavegadorQualidade | undefined;
beforeAll(async () => { navegador = await criarNavegadorQualidade(); }, 60_000);
afterAll(async () => { await navegador?.fechar(); });

async function comQualidade(idioma: Idioma | undefined, verificar: (pagina: PaginaQualidade) => Promise<void>) {
  if (!navegador) throw new Error("A prova de Qualidade requer Vite e Chromium disponíveis");
  const pagina = await navegador.pagina(idioma), erros: unknown[] = [];
  try {
    await verificar(pagina);
    expect([...pagina.pedidos].sort()).toEqual(Object.values(URLS).map((url) => `GET ${url}`).sort());
    const atual = new URL(pagina.page.url()), inicial = new URL(pagina.url);
    expect([atual.origin, atual.pathname, atual.searchParams.get("preservar"), atual.hash]).toEqual([inicial.origin, inicial.pathname, "sim", "#painel"]);
  } catch (e) { erros.push(e); }
  try { await pagina.fechar(); } catch (e) { erros.push(e); }
  try { expect(pagina.falhas, "nenhum erro de execução, rede ou cleanup omitido").toEqual([]); } catch (e) { erros.push(e); }
  if (erros.length === 1) throw erros[0];
  if (erros.length) throw new AggregateError(erros, "Falhas na interação ou limpeza de Qualidade");
}

async function celulas(linhas: Locator): Promise<string[][]> {
  return linhas.evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll("th,td"), (c) => c.textContent ?? "")));
}

function detalhe(idioma: Idioma, extremo: "maior" | "menor") {
  return `${extremo} valor entre os ${TEXTOS[idioma].conjuntos} conjuntos que atendem o município`;
}

async function apontarRegiao(page: Page, codigo: string) {
  await page.locator(MAPA).scrollIntoViewIfNeeded();
  // O path pode ser maior que a janela após zoom: mirar a área realmente visível,
  // sem force, eventos sintéticos ou mudança do enquadramento preparado.
  const ponto = await page.locator(`${MAPA} path[data-id="${codigo}"]`).evaluate((path) => {
    const caixa = path.closest('[style*="--mapa-h"]');
    if (!caixa) throw new Error("Caixa do mapa ausente");
    const p = path.getBoundingClientRect(), m = caixa.getBoundingClientRect();
    const esquerda = Math.max(p.left, m.left, 0), direita = Math.min(p.right, m.right, innerWidth);
    const topo = Math.max(p.top, m.top, 0), fundo = Math.min(p.bottom, m.bottom, innerHeight);
    if (direita <= esquerda || fundo <= topo) throw new Error("Polígono sem área visível para hover real");
    const x = (esquerda + direita) / 2, y = (topo + fundo) / 2;
    if (document.elementFromPoint(x, y) !== path) throw new Error("Ponto visível não atinge o polígono esperado");
    return { x, y };
  });
  await page.mouse.move(ponto.x, ponto.y);
}

async function conferirFicha(page: Page, idioma: Idioma) {
  const ficha = page.locator(FICHA);
  expect(await ficha.locator("h5").textContent()).toBe(`Os ${TEXTOS[idioma].conjuntos} conjuntos que atendem Município Alfa (RO), com o limite de cada um`);
  expect(await ficha.locator("p").filter({ hasText: "conjuntos citados não têm valor anual publicado" }).textContent()).toBe(
    `${TEXTOS[idioma].ausentes} conjuntos citados não têm valor anual publicado em 2025 (menos de 12 meses ou sem limite): ${CODIGOS_AUSENTES.join(", ")}.`,
  );
}

async function conferirDetalhe(page: Page, idioma: Idioma, extremo: "maior" | "menor") {
  const texto = detalhe(idioma, extremo);
  await expect.poll(() => page.locator(`[data-selecao="${ALFA}"]`).textContent(), ESPERA).toContain(texto);
  expect(await page.locator(`${MAPA} > div[aria-hidden="true"]`).textContent()).toContain(texto);
  const tabelaMapa = page.locator("details").filter({ has: page.locator("summary", { hasText: "Dados do mapa em tabela" }) });
  expect(await tabelaMapa.locator("tbody tr").filter({ hasText: ALFA }).locator("td").last().textContent()).toBe(texto);
}

async function conferirSeries(page: Page, idioma: Idioma) {
  const blocos = page.locator(MULTIPLOS);
  expect(await blocos.count()).toBe(2);
  for (let i = 0; i < 2; i++) {
    expect(await blocos.nth(i).locator("[data-painel]").evaluateAll((ns) => ns.map((n) => n.getAttribute("data-painel")))).toEqual(["00000000000001", "00000000000002"]);
    expect(await celulas(blocos.nth(i).locator("table tbody tr"))).toEqual(SERIES[idioma][i]);
  }
}

async function carregarAlfa(pagina: PaginaQualidade, idioma: Idioma) {
  const { page } = pagina;
  await expect.poll(() => page.getByRole("status").filter({ hasText: "Carregando os municípios…" }).count(), ESPERA).toBe(1);
  expect(await page.locator("#montagem").textContent()).toContain(`O mapa dos ${TEXTOS[idioma].municipios} municípios do cadastro do IBGE`);
  await expect.poll(() => [...pagina.pedidos], ESPERA).toEqual([`GET ${URLS.municipios}`]);
  pagina.liberarMunicipios();
  const busca = page.getByRole("combobox", { name: "Buscar município" });
  await expect.poll(() => busca.isEnabled(), ESPERA).toBe(true);
  expect(await page.locator(MAPA).getAttribute("data-estado")).toBe("pronto");
  expect([...pagina.pedidos].sort()).toEqual([`GET ${URLS.municipios}`, `GET ${URLS.geo}`].sort());
  await busca.fill("Alfa");
  await busca.press("ArrowDown");
  await busca.press("Enter");
  await expect.poll(() => new URL(page.url()).searchParams.get("mun"), ESPERA).toBe(ALFA);
  await expect.poll(() => page.locator(`${FICHA} [role="status"]`).count(), ESPERA).toBe(1);
  expect(await page.locator(`${FICHA} h5`).textContent()).toBe(`Os ${TEXTOS[idioma].conjuntos} conjuntos que atendem Município Alfa (RO), com o limite de cada um`);
  expect(await page.locator(`[data-selecionado="${ALFA}"]`).count()).toBe(1);
  pagina.liberarConjuntos();
  await expect.poll(() => page.locator(`${FICHA} tbody tr[data-id]`).count(), ESPERA).toBe(2);
  await expect.poll(() => page.locator(`${MULTIPLOS} [data-painel]`).count(), ESPERA).toBe(4);
  await conferirFicha(page, idioma);
  // O CSV anual e sua tabela continuam PT neste recorte: zero não vira ausência,
  // código mantém zeros à esquerda e a linha de 2024 não entra em 2025.
  expect(await celulas(page.locator(`${FICHA} tbody tr[data-id]`))).toEqual([
    ["Conjunto Fracionário da Fixture", "12", "12,50", "10,00", "1,250", "2,50", "2,00", "1,250", "FIX-B", "acima do limite", "acima do limite", "000002"],
    ["Conjunto Zero da Fixture", "12", "0,00", "10,00", "0,000", "0,00", "2,00", "0,000", "FIX-A", "até o limite", "até o limite", "000001"],
  ]);
  expect(await page.locator(`${FICHA} tr[data-id="000003"]`).count()).toBe(0);
  await page.locator("summary").filter({ hasText: "Dados do mapa em tabela" }).click();
  for (const bloco of await page.locator(MULTIPLOS).all()) await bloco.locator("summary").click();
  await expect.poll(() => page.locator(`${MULTIPLOS} table tbody tr`).count(), ESPERA).toBe(4);
  await conferirSeries(page, idioma);
  await apontarRegiao(page, ALFA);
  await conferirDetalhe(page, idioma, "maior");
}

async function selecionarBeta(page: Page) {
  // Seleção pelo botão da tabela real deve atualizar mapa, ficha e URL.
  const municipal = page.locator('[data-componente="tabela-interativa"]').filter({ has: page.locator(`tr[data-id="${BETA}"]`) });
  // TabelaInterativa abre a tabela ao receber a seleção nova feita no mapa.
  expect(await municipal.getByRole("button", { name: "Ocultar a tabela", exact: true }).getAttribute("aria-expanded")).toBe("true");
  await municipal.locator(`tr[data-id="${BETA}"]`).getByRole("button", { name: "Município Beta", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("mun"), ESPERA).toBe(BETA);
  expect(await page.locator(`${FICHA} h5`).textContent()).toBe("O conjunto que atende Município Beta (RO), com o limite de cada um");
  expect(await page.locator(`[data-selecao="${BETA}"]`).textContent()).toContain("valor do conjunto que atende o município");
  expect(await page.locator(`${FICHA} tbody tr[data-id]`).evaluateAll((ns) => ns.map((n) => n.getAttribute("data-id")))).toEqual(["000002"]);
  expect(await page.locator(`${FICHA} p`).filter({ hasText: "conjuntos citados não têm" }).count()).toBe(0);
}

/** Observa somente invariantes de estado/identidade; textos de formato podem mudar. */
async function trocar(page: Page, idioma: Idioma) {
  return page.evaluate(async (lang) => {
    const ponte = (window as JanelaQualidade).__qualidade;
    if (!ponte) throw new Error("Bridge de atualização de Qualidade indisponível");
    const raiz = document.querySelector("#montagem")!;
    const seletores = ['[style*="--mapa-h"]', '[style*="--mapa-h"] > svg', "[data-conjuntos-do-municipio]", '[data-conjuntos-do-municipio] input[type="search"]', '[data-conjuntos-do-municipio] tr[data-id="000002"]', '[data-grafico="pequenos-multiplos"]'];
    const nos = seletores.map((s) => { const n = raiz.querySelector(s); if (!n) throw new Error(`Estado carregado ausente: ${s}`); return n; });
    const tabelas = Array.from(raiz.querySelectorAll("table"));
    const paineis = Array.from(raiz.querySelectorAll('[data-grafico="pequenos-multiplos"]'));
    const foco = document.activeElement;
    const capturar = () => ({
      url: location.href, dados: ponte.dados(),
      medida: raiz.querySelector<HTMLInputElement>('input[name="qualidade-medida-mapa"]:checked')?.value,
      escala: Array.from(raiz.querySelectorAll('[data-grafico="pequenos-multiplos"]'), (n) => n.getAttribute("data-escala")),
      consulta: raiz.querySelector<HTMLInputElement>('[data-conjuntos-do-municipio] input[type="search"]')?.value,
      ordem: Array.from(raiz.querySelectorAll("[data-conjuntos-do-municipio] th[aria-sort]"), (n) => [n.textContent, n.getAttribute("aria-sort")]),
      linhas: Array.from(raiz.querySelectorAll("[data-conjuntos-do-municipio] tr[data-id]"), (n) => [n.getAttribute("data-id"), n.textContent]),
      selecao: raiz.querySelector("[data-selecao]")?.getAttribute("data-selecao"),
      viewBox: raiz.querySelector('[style*="--mapa-h"] > svg')?.getAttribute("viewBox"),
      caminhos: Array.from(raiz.querySelectorAll("svg path[d]"), (n) => n.getAttribute("d")),
      paineis: Array.from(raiz.querySelectorAll("[data-painel]"), (n) => n.getAttribute("data-painel")),
      abertos: Array.from(raiz.querySelectorAll("details"), (n) => n.open),
    });
    const antes = capturar(), eventos: string[] = [], transicoes: string[] = [];
    const observar = (records: MutationRecord[]) => {
      for (const r of records) {
        for (const n of r.removedNodes) if ([...nos, ...tabelas, ...paineis].some((alvo) => n === alvo || n.contains(alvo))) transicoes.push("removeu nó carregado");
        for (const n of r.addedNodes) if (n instanceof Element && Array.from(n.matches('[role="status"]') ? [n] : n.querySelectorAll('[role="status"]')).some((s) => s.textContent?.includes("Carregando"))) transicoes.push("voltou ao carregamento");
      }
    };
    const registrar = (e: Event) => { eventos.push(e.type); };
    const tipos = ["focusin", "input", "change", "click", "keydown", "pointermove"];
    const observer = new MutationObserver(observar);
    observer.observe(raiz, { childList: true, subtree: true });
    for (const tipo of tipos) raiz.addEventListener(tipo, registrar);
    try {
      ponte.renderizar(lang);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      observar(observer.takeRecords());
      return { antes, depois: capturar(), eventos, transicoes, mesmoFoco: foco === document.activeElement,
        mesmosNos: nos.every((n, i) => n === raiz.querySelector(seletores[i]))
          && tabelas.every((n, i) => n === raiz.querySelectorAll("table")[i])
          && paineis.every((n, i) => n === raiz.querySelectorAll('[data-grafico="pequenos-multiplos"]')[i]) };
    } finally {
      observer.disconnect();
      for (const tipo of tipos) raiz.removeEventListener(tipo, registrar);
    }
  }, idioma);
}

describe("QualidadeMapa real: fetch, callbacks e formatos, sem tradução da prosa", () => {
  it.each([undefined, "pt", "en"] as const)("carrega dados e apresenta literais com idioma %s", { timeout: 60_000 }, async (idioma) => {
    await comQualidade(idioma, async (pagina) => {
      const lang = idioma ?? "pt", { page } = pagina;
      await carregarAlfa(pagina, lang);
      const painel = page.locator(`${MULTIPLOS} [data-painel]`).first();
      await painel.locator("svg").focus();
      await painel.locator("svg").press("Home");
      await expect.poll(() => painel.locator("[data-leitura]").textContent(), ESPERA).toBe(lang === "pt"
        ? "2024: DEC apurado 1.234,56\u00a0h · Limite 1.000,12\u00a0h"
        : "2024: DEC apurado 1,234.56\u00a0h · Limite 1,000.12\u00a0h");
      expect(await painel.locator("svg").evaluate((n) => n === document.activeElement)).toBe(true);
      await selecionarBeta(page);
    });
  });

  it("troca PT → EN → PT na mesma montagem carregada e preserva estado e dados", { timeout: 60_000 }, async () => {
    await comQualidade("pt", async (pagina) => {
      const { page } = pagina;
      await carregarAlfa(pagina, "pt");
      await page.locator('input[name="qualidade-medida-mapa"][value="fec_min"]').check();
      await expect.poll(() => new URL(page.url()).searchParams.get("med"), ESPERA).toBe("fec_min");
      await page.getByRole("radio", { name: "Própria de cada painel" }).check();
      const vbInicial = await page.locator(`${MAPA} > svg`).getAttribute("viewBox");
      await page.getByRole("button", { name: "Aproximar em Município Alfa", exact: true }).click();
      await expect.poll(() => page.locator(`${MAPA} > svg`).getAttribute("viewBox"), ESPERA).not.toBe(vbInicial);
      const ficha = page.locator(FICHA), busca = ficha.locator('input[type="search"]');
      await ficha.getByRole("button", { name: /^Código/ }).click();
      await busca.fill("Fracionário");
      await expect.poll(() => ficha.locator("tbody tr[data-id]").count(), ESPERA).toBe(1);
      await busca.focus();
      await apontarRegiao(page, ALFA);
      expect(await busca.evaluate((n) => n === document.activeElement)).toBe(true);
      const pedidos = [...pagina.pedidos], url = page.url();
      for (const idioma of ["en", "pt"] as const) {
        const resultado = await trocar(page, idioma);
        expect(resultado.antes.medida).toBe("fec_min");
        expect(resultado.antes.escala).toEqual(["livre", "livre"]);
        expect(resultado.antes.consulta).toBe("Fracionário");
        expect(resultado.antes.ordem).toEqual([["Código▲", "ascending"]]);
        expect(resultado.antes.selecao).toBe(ALFA);
        expect(resultado.antes.caminhos.length).toBeGreaterThan(4);
        expect(resultado.antes.paineis).toHaveLength(4);
        expect(resultado.depois).toEqual(resultado.antes);
        expect(resultado.mesmosNos).toBe(true);
        expect(resultado.mesmoFoco).toBe(true);
        expect(resultado.eventos).toEqual([]);
        expect(resultado.transicoes).toEqual([]);
        expect(page.url()).toBe(url);
        // A rede prova ausência de novo GET; o cache não prova sozinho dependências de efeitos.
        expect(pagina.pedidos).toEqual(pedidos);
        await conferirFicha(page, idioma);
        await conferirSeries(page, idioma);
        await conferirDetalhe(page, idioma, "menor");
        // A região Beta ainda tem uma faixa visível após o zoom em Alfa. Sair e voltar
        // aciona a leitura nova; não se exige reanúncio retroativo do aria-live guardado.
        await apontarRegiao(page, BETA);
        await apontarRegiao(page, ALFA);
        const anuncio = page.locator(MAPA).locator("..").locator(':scope > p[aria-live="polite"]');
        await expect.poll(() => anuncio.textContent(), ESPERA).toContain(detalhe(idioma, "menor"));
      }
      await selecionarBeta(page);
    });
  });
});
