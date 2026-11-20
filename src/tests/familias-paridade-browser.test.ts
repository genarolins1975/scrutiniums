import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { CAMADAS, IDS_CAMADAS } from "@/components/familias/consignado/camadas";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

/**
 * Paridade dos três painéis das Famílias que ficaram por último (decisão do dono de 10/11/2026, docs/familias/PARIDADE.md), no
 * navegador e no build de produção: o endereço antigo chega à página nova com a consulta, e a página nova faz o que a vista antiga
 * fazia e a reescrita tinha declarado como perda. Consignado: recorte do mapa no endereço (os mesmos ?cgcam=, ?cgregiao= e ?cgconf=
 * da vista antiga), mapa municipal em classes, lista dos 25 maiores, comparação de até cinco municípios, tabela com busca e arquivo,
 * dispersão com seletor de estado. Crédito imobiliário: mapa municipal em quatro medidas, com região, lista e perfil. Emprego formal:
 * pesos do Risco setorial, lidos da gold setorial.
 *
 * Este arquivo assume as conferências que os testes de navegador da vista antiga faziam (pix-ux-browser, graficos-identificacao-browser,
 * consignado-dispersao-browser, consignado-mapa-teclado-browser, rankings-municipais-reflow-browser), aposentadas lá com o motivo
 * escrito. Invariantes contra a gold, não texto: valores, contagens, ordem, parâmetros do endereço e ausência que nunca vira zero.
 */
const ler = (arquivo: string) => JSON.parse(readFileSync(`public/obs/data/gold/${arquivo}.json`, "utf8"));
type MunCg = { c: string; n: string; uf: string; reg: string; sel: string; p60: number | null; cons_ben: number | null };
type MunMor = { c: string; n: string; uf: string; reg: string; pgp: number | null; alp: number | null; sdom: number | null; gd: number | null; pesp: number | null };
const cg = ler("consignado");
const munCg = ler("consignado_mun").municipios as MunCg[];
const munMor = ler("moradia_mun").municipios as MunMor[];
const setorial = ler("sectors");
/** Municípios da malha oficial do IBGE que a publicação não traz: no mapa do país ficam em hachura, contados como "sem dado". */
const malha = (JSON.parse(readFileSync("public/energia/geo/municipios.json", "utf8")).features as { id: string }[]).map((f) => f.id);
const foraDaGold = (codigos: { c: string }[]) => { const tem = new Set(codigos.map((m) => m.c)); return malha.filter((id) => !tem.has(id)).length; };
const br = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CONSIGNADO = "/divida-das-familias/consignado";
const MORADIA = "/credito-imobiliario";
const EMPREGO = "/emprego-formal";

let servidor: ServidorProducao;
let navegador: Browser;
beforeAll(async () => {
  if (!temBuild) {
    if (exigirBuild) throw new Error("EXIGIR_BUILD_HTML=1 sem build em .next: rode npm run build antes");
    return;
  }
  servidor = await subirServidor("familias-paridade");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 120_000);
afterAll(async () => {
  await navegador?.close();
  await servidor?.parar();
});

async function comPagina(opcoes: Parameters<Browser["newContext"]>[0], tarefa: (page: Page, contexto: BrowserContext) => Promise<void>) {
  const contexto = await navegador.newContext({ acceptDownloads: true, ...opcoes });
  await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
  const page = await contexto.newPage();
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  try {
    await tarefa(page, contexto);
    expect(erros, "erros de página").toEqual([]);
  } finally {
    await contexto.close();
  }
}
const caminho = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search;
/** Elementos que fazem a página inteira rolar para o lado (fora de região rolável própria); lista vazia quando não há rolagem. */
const foraDaLargura = (page: Page) =>
  page.evaluate(() => {
    if (document.documentElement.scrollWidth <= innerWidth + 1) return [];
    const contido = (e: Element) => {
      for (let p = e.parentElement; p; p = p.parentElement) if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) return true;
      return false;
    };
    return [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !contido(e))
      .slice(0, 6)
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.getAttribute("class") ?? "").slice(0, 60)} → ${Math.round(e.getBoundingClientRect().right)}px: ${(e.textContent ?? "").trim().slice(0, 40)}`);
  });
const explorador = (page: Page) => page.locator('[data-explorador-municipios="pronto"]');
const seletorDe = (page: Page, rotulo: string) => page.locator("[data-explorador-municipios] label").filter({ hasText: new RegExp(`^${rotulo}`) }).locator("select");
const mapaPronto = (raiz: ReturnType<Page["locator"]>) => raiz.locator('[data-mapa-municipios="pronto"]');

describe.skipIf(!temBuild && !exigirBuild)("Consignado e aposentados: o que a vista antiga fazia, na página nova", () => {
  it("o endereço antigo com recorte chega à página nova com o mesmo recorte, e o recorte vive no endereço", async () => {
    await comPagina({ viewport: { width: 1440, height: 900 } }, async (page) => {
      const resposta = await page.goto(`${servidor.origem}/observatorio/payroll-lending-aging?cgregiao=Norte&cgcam=peso`);
      expect(resposta?.status()).toBe(200);
      expect(caminho(page)).toBe(`${CONSIGNADO}?cgregiao=Norte&cgcam=peso`);
      // o endereço pede um recorte: o explorador carrega sem esperar o botão
      await explorador(page).waitFor({ timeout: 60_000 });
      expect(await seletorDe(page, "Região").inputValue()).toBe("Norte");
      expect(await seletorDe(page, "Medida").inputValue()).toBe("peso");
      await mapaPronto(explorador(page)).waitFor({ timeout: 60_000 });
      // trocar a região grava no endereço, sem tirar o foco do controle; recarregar reabre o mesmo recorte
      const regiao = seletorDe(page, "Região");
      await regiao.focus();
      await regiao.selectOption("Sul");
      await page.waitForURL(/cgregiao=Sul/);
      expect(await regiao.evaluate((e) => e === document.activeElement)).toBe(true);
      const doSul = munCg.filter((m) => m.reg === "Sul" && m.sel !== "baixa").length;
      await expect.poll(() => page.locator("[data-explorador-municipios] [data-resumo-controles]").innerText()).toContain(br(doSul));
      await page.reload();
      await explorador(page).waitFor({ timeout: 60_000 });
      expect(await seletorDe(page, "Região").inputValue()).toBe("Sul");
      expect(await seletorDe(page, "Medida").inputValue()).toBe("peso");
      // o voltar do navegador desfaz a escolha
      await seletorDe(page, "Confiabilidade").selectOption("todas");
      await page.waitForURL(/cgconf=todas/);
      await page.goBack();
      await expect.poll(() => seletorDe(page, "Confiabilidade").inputValue()).toBe("exclui_baixa");
    });
  }, 180_000);

  it("parâmetro inválido vale o padrão, e sem recorte o arquivo municipal só vem quando o leitor pede", async () => {
    await comPagina({ viewport: { width: 1440, height: 900 } }, async (page) => {
      const pedidos: string[] = [];
      page.on("request", (r) => pedidos.push(new URL(r.url()).pathname));
      await page.goto(`${servidor.origem}${CONSIGNADO}?cgcam=invalida&cgregiao=invalida&cgconf=invalida`, { waitUntil: "networkidle" });
      await page.locator('[data-explorador-municipios="parado"]').waitFor();
      expect(pedidos.filter((p) => p.endsWith("consignado_mun.json") || p.endsWith("/geo/municipios.json"))).toEqual([]);
      await page.getByRole("button", { name: "Abrir o mapa e a busca de municípios" }).click();
      await explorador(page).waitFor({ timeout: 60_000 });
      expect(await seletorDe(page, "Região").inputValue()).toBe("todas");
      expect(await seletorDe(page, "Medida").inputValue()).toBe("p60");
      expect(await seletorDe(page, "Confiabilidade").inputValue()).toBe("exclui_baixa");
    });
  }, 180_000);

  it("o mapa tem no máximo cinco classes, método declarado, ausência própria e nenhuma parada de teclado por município", async () => {
    await comPagina({ viewport: { width: 1440, height: 900 } }, async (page) => {
      await page.goto(`${servidor.origem}${CONSIGNADO}?cgconf=todas`);
      await explorador(page).waitFor({ timeout: 60_000 });
      const mapa = mapaPronto(explorador(page));
      await mapa.waitFor({ timeout: 60_000 });
      for (const id of IDS_CAMADAS) {
        await seletorDe(page, "Medida").selectOption(id);
        const C = CAMADAS[id];
        // natureza, unidade e ressalva de cada uma das nove medidas ficam à vista, junto do mapa
        await expect.poll(() => mapa.innerText(), { message: id }).toContain(C.unidade);
        const texto = await mapa.innerText();
        expect(texto.toLowerCase(), `${id}: natureza`).toContain(C.natureza.toLowerCase());
        if (C.ressalva) expect(texto, `${id}: ressalva`).toContain(C.ressalva);
        const classes = await mapa.locator("li[data-classe]").count();
        expect(classes, `${id}: classes`).toBeGreaterThanOrEqual(2);
        expect(classes, `${id}: classes`).toBeLessThanOrEqual(5);
        expect(texto, `${id}: método das classes`).toMatch(/Quantis/);
        // quem não tem a medida aparece contado como "sem dado", nunca numa classe
        const semMedida = munCg.filter((m) => (m as unknown as Record<string, number | null>)[id] == null).length;
        expect(await mapa.locator('li[data-estado="sem-dado"]').innerText(), `${id}: sem dado`).toContain(`(${br(semMedida + foraDaGold(munCg))})`);
      }
      expect(await mapa.locator("svg path[tabindex]").count()).toBe(0);
      // com o filtro de confiabilidade, quem sai do recorte fica em cinza liso, contado à parte, e não some do mapa
      await seletorDe(page, "Medida").selectOption("p60");
      await seletorDe(page, "Confiabilidade").selectOption("exclui_baixa");
      const baixa = munCg.filter((m) => m.sel === "baixa").length;
      await expect.poll(() => mapa.locator('li[data-estado="nao-se-aplica"]').innerText()).toContain(`(${br(baixa)})`);
    });
  }, 240_000);

  it("os 25 maiores, a comparação de cinco municípios e a tabela com busca e arquivo trazem os valores da gold", async () => {
    await comPagina({ viewport: { width: 390, height: 900 }, hasTouch: true }, async (page, contexto) => {
      // fixture explícita de ausência: um município do recorte fica sem a exposição estimada, só nesta sessão de teste
      const alterada = structuredClone(munCg);
      const semDado = alterada.find((m) => m.sel !== "baixa" && m.cons_ben != null)!;
      semDado.cons_ben = null;
      await contexto.route("**/obs/data/gold/consignado_mun.json*", (r) => r.fulfill({ json: { municipios: alterada } }));
      await page.goto(`${servidor.origem}${CONSIGNADO}`);
      await page.getByRole("button", { name: "Abrir o mapa e a busca de municípios" }).click();
      await explorador(page).waitFor({ timeout: 60_000 });
      // lista dos 25 maiores: os mesmos municípios, na mesma ordem e com o valor publicado
      const esperados = alterada.filter((m) => m.sel !== "baixa" && m.p60 != null).sort((a, b) => (b.p60 as number) - (a.p60 as number)).slice(0, 25);
      const lista = explorador(page).getByRole("list", { name: /Os 25 maiores valores/ }).locator("button");
      expect(await lista.count()).toBe(25);
      const textos = await lista.allInnerTexts();
      esperados.forEach((m, i) => {
        expect(textos[i], `posição ${i + 1}`).toContain(m.n);
        expect(textos[i], `posição ${i + 1}`).toContain(`${br(m.p60 as number, 1)}%`);
      });
      // cinco municípios lado a lado: sete colunas, rolagem só na tabela, e os códigos no endereço
      for (let i = 0; i < 5; i++) await lista.nth(i).click();
      const comparacao = page.getByRole("table", { name: /Comparação de indicadores dos municípios selecionados/ });
      await expect.poll(() => comparacao.locator("thead th").count()).toBe(7);
      const cabecalho = await comparacao.locator("thead th").allInnerTexts();
      for (const m of esperados.slice(0, 5)) expect(cabecalho.join(" | "), m.n).toContain(`${m.n} (${m.uf})`);
      expect(new URL(page.url()).searchParams.get("cgmun")?.split(",").sort()).toEqual(esperados.slice(0, 5).map((m) => m.c).sort());
      expect(await foraDaLargura(page)).toEqual([]);
      // tabela do recorte: páginas de 50, busca por nome e UF, ausência como texto na tabela e célula vazia no arquivo
      await seletorDe(page, "Medida").selectOption("cons_ben");
      await page.locator("[data-tabela-municipios] summary").click();
      const linhas = page.locator("[data-tabela-municipios] tbody tr");
      await expect.poll(() => linhas.count()).toBe(50);
      const busca = page.getByRole("searchbox", { name: "Buscar município ou UF" });
      await busca.fill(`${semDado.n} ${semDado.uf}`);
      await expect.poll(() => linhas.count()).toBe(1);
      expect(await linhas.first().innerText()).toContain("sem dado");
      const [baixado] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar CSV deste recorte" }).click()]);
      const csv = readFileSync((await baixado.path())!, "utf8").replace(/^﻿/, "").trimEnd().split("\n");
      expect(csv.some((l) => l.startsWith("# Natureza: estimado"))).toBe(true);
      expect(csv.some((l) => l.startsWith("# Unidade: R$"))).toBe(true);
      const dados = csv.filter((l) => !l.startsWith("#")).slice(1);
      expect(dados).toHaveLength(1);
      expect(dados[0].split(";")[2]).toBe("");
      // a busca percorre o recorte inteiro, não só a página à vista
      await busca.fill("sao");
      const comSao = alterada.filter((m) => m.sel !== "baixa" && semAcento(`${m.n} ${m.uf}`).includes("sao")).length;
      expect(comSao).toBeGreaterThan(50);
      await expect.poll(() => page.locator("[data-tabela-municipios] [role=status]").innerText()).toContain(`de ${br(comSao)} municípios`);
      expect(await foraDaLargura(page)).toEqual([]);
    });
  }, 240_000);

  it("a dispersão por UF destaca o estado consultado, por teclado e por toque, e guarda a consulta no endereço", async () => {
    type Estado = { uf: string; nome: string; outras_censo: number | null; cons_por_60: number | null; a60: number };
    const estados = (cg.estados as Estado[]).filter((e) => e.outras_censo != null && e.cons_por_60 != null);
    await comPagina({ viewport: { width: 320, height: 900 }, hasTouch: true }, async (page) => {
      await page.goto(`${servidor.origem}${CONSIGNADO}`);
      const figura = page.locator('[data-figura-analitica="relacao"]');
      const seletor = figura.getByRole("combobox", { name: "Consultar estado" });
      await seletor.waitFor();
      for (const largura of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width: largura, height: 900 });
        // um círculo por estado, todos dentro do desenho, em qualquer largura
        const medidas = await figura.locator("[data-grafico=dispersao] svg[role=img]").evaluate((svg) => {
          const limite = svg.getBoundingClientRect();
          const circulos = [...svg.querySelectorAll("circle[data-ponto]")].map((c) => c.getBoundingClientRect());
          return { n: circulos.length, fora: circulos.filter((b) => b.left < limite.left - 1 || b.right > limite.right + 1 || b.top < limite.top - 1 || b.bottom > limite.bottom + 1).length };
        });
        expect(medidas, `${largura}px`).toEqual({ n: estados.length, fora: 0 });
        expect(await foraDaLargura(page), `rolagem da página a ${largura}px`).toEqual([]);
      }
      await page.setViewportSize({ width: 390, height: 900 });
      expect(await seletor.evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      const extremo = estados.reduce((a, b) => ((a.outras_censo as number) > (b.outras_censo as number) ? a : b));
      await seletor.selectOption(extremo.uf);
      await page.waitForURL(new RegExp(`cguf=${extremo.uf}`));
      expect(await figura.locator("circle[data-destaque]").getAttribute("data-ponto")).toBe(extremo.uf);
      const leitura = await figura.locator("[data-leitura-estado]").innerText();
      expect(leitura).toContain(extremo.nome);
      expect(leitura).toContain(br(extremo.a60));
      expect(leitura).toContain(br(extremo.cons_por_60 as number));
      // pelo teclado: o seletor é um controle nativo, e a escolha continua valendo depois de recarregar
      await seletor.focus();
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowDown");
      const primeiro = [...estados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))[0];
      await expect.poll(() => seletor.inputValue()).toBe(primeiro.uf);
      await expect.poll(() => figura.locator("circle[data-destaque]").getAttribute("data-ponto")).toBe(primeiro.uf);
      await page.reload();
      await expect.poll(() => figura.getByRole("combobox", { name: "Consultar estado" }).inputValue()).toBe(primeiro.uf);
      expect(await figura.locator("[data-leitura-estado]").innerText()).toContain(primeiro.nome);
    });
  }, 180_000);
});

describe.skipIf(!temBuild && !exigirBuild)("Crédito imobiliário e moradia: o mapa municipal da vista antiga, na página nova", () => {
  const consulta = (page: Page) => page.locator('[data-consulta-municipal="pronto"]');
  const maiores = (k: "pgp" | "alp" | "sdom" | "gd", regiao?: string) =>
    munMor.filter((m) => (!regiao || m.reg === regiao) && typeof m[k] === "number").sort((a, b) => (b[k] as number) - (a[k] as number)).slice(0, 25);

  it("o endereço antigo chega à página nova; o mapa tem quatro medidas, classes declaradas e ausência que não vira zero", async () => {
    await comPagina({ viewport: { width: 1440, height: 900 } }, async (page) => {
      const resposta = await page.goto(`${servidor.origem}/observatorio/housing-credit?medida=sdom`);
      expect(resposta?.status()).toBe(200);
      expect(caminho(page)).toBe(`${MORADIA}?medida=sdom`);
      await page.locator("#municipios").scrollIntoViewIfNeeded();
      await consulta(page).waitFor({ timeout: 60_000 });
      const mapa = mapaPronto(consulta(page));
      await mapa.waitFor({ timeout: 60_000 });
      const botoes = consulta(page).getByRole("group", { name: "Recorte do mapa e da lista de municípios" }).getByRole("button");
      expect(await botoes.count()).toBe(4);
      // saldo por domicílio: município sem dependência bancária é ausência, em hachura, e a contagem é a da gold
      expect(await botoes.nth(2).getAttribute("aria-pressed")).toBe("true");
      const semSaldo = munMor.filter((m) => m.sdom == null).length;
      expect(semSaldo).toBeGreaterThan(0);
      await expect.poll(() => mapa.locator('li[data-estado="sem-dado"]').innerText()).toContain(`(${br(semSaldo + foraDaGold(munMor))})`);
      for (const [i, k] of (["pgp", "alp", "sdom", "gd"] as const).entries()) {
        await botoes.nth(i).click();
        await page.waitForURL(k === "pgp" ? (u) => !u.searchParams.has("medida") : new RegExp(`medida=${k}`));
        const semValor = munMor.filter((m) => m[k] == null).length;
        // lacuna: quem está na mediana do grupo ou acima dela não tem lacuna (cinza liso); grupo pequeno demais é ausência (hachura)
        const semLacuna = k === "gd" ? munMor.filter((m) => m.gd == null && m.pesp != null).length : 0;
        await expect.poll(() => mapa.locator('li[data-estado="sem-dado"]').innerText(), { message: k }).toContain(`(${br(semValor - semLacuna + foraDaGold(munMor))})`);
        expect(await mapa.locator('li[data-estado="nao-se-aplica"]').innerText(), k).toContain(`(${br(semLacuna)})`);
        const classes = await mapa.locator("li[data-classe]").count();
        expect(classes, k).toBeGreaterThanOrEqual(2);
        expect(classes, k).toBeLessThanOrEqual(5);
        expect(await mapa.innerText(), k).toMatch(/Quantis/);
        // a soma das classes é o número de municípios com a medida
        const contagens = await mapa.locator("li[data-classe] .tabular-nums").allInnerTexts();
        expect(contagens.reduce((s, t) => s + Number(t.replace(/\D/g, "")), 0), k).toBe(munMor.length - semValor);
        // a lista ao lado: os 25 maiores da gold, na ordem
        const nomes = await consulta(page).locator("table").first().locator("tbody tr button").allInnerTexts();
        expect(nomes, k).toEqual(maiores(k).map((m) => m.n));
      }
      expect(await mapa.locator("svg path[tabindex]").count()).toBe(0);
    });
  }, 240_000);

  it("medida, região e município ficam no endereço; escolher um município abre o perfil dele", async () => {
    await comPagina({ viewport: { width: 390, height: 900 }, hasTouch: true }, async (page) => {
      await page.goto(`${servidor.origem}${MORADIA}?medida=alp&regiao=Sul`);
      await page.locator("#municipios").scrollIntoViewIfNeeded();
      await consulta(page).waitFor({ timeout: 60_000 });
      const regiao = consulta(page).getByRole("combobox", { name: "Região" });
      expect(await regiao.inputValue()).toBe("Sul");
      const doSul = munMor.filter((m) => m.reg === "Sul");
      expect(await consulta(page).getByRole("group", { name: "Recorte do mapa e da lista de municípios" }).innerText()).toContain(`${br(doSul.length)} municípios no recorte`);
      const esperado = maiores("alp", "Sul");
      const linhas = consulta(page).locator("table").first().locator("tbody tr");
      expect(await linhas.locator("button").allInnerTexts()).toEqual(esperado.map((m) => m.n));
      expect(await linhas.first().innerText()).toContain(`${br(esperado[0].alp as number, 1)}%`);
      await linhas.first().locator("button").click();
      await expect.poll(() => new URL(page.url()).searchParams.get("municipio")).toBe(esperado[0].c);
      // os outros parâmetros do recorte continuam no endereço
      expect(new URL(page.url()).searchParams.get("medida")).toBe("alp");
      expect(new URL(page.url()).searchParams.get("regiao")).toBe("Sul");
      const perfil = page.locator(`[data-perfil-municipal="${esperado[0].c}"]`);
      await perfil.waitFor();
      expect(await perfil.innerText()).toContain(esperado[0].n);
      expect(await foraDaLargura(page)).toEqual([]);
      await page.reload();
      await consulta(page).waitFor({ timeout: 60_000 });
      expect(await consulta(page).getByRole("combobox", { name: "Região" }).inputValue()).toBe("Sul");
      await page.locator(`[data-perfil-municipal="${esperado[0].c}"]`).waitFor();
      await mapaPronto(consulta(page)).waitFor({ timeout: 60_000 });
      expect(await foraDaLargura(page)).toEqual([]);
      // "Limpar seleção" do mapa tira o município do estado e do endereço (o mapa é controlado: sem isso o destaque ficava)
      await consulta(page).getByRole("button", { name: "Limpar seleção" }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get("municipio")).toBeNull();
      await expect.poll(() => page.locator(`[data-perfil-municipal="${esperado[0].c}"]`).count()).toBe(0);
      expect(new URL(page.url()).searchParams.get("regiao")).toBe("Sul");
    });
  }, 240_000);
});

describe.skipIf(!temBuild && !exigirBuild)("Emprego formal: os pesos do Risco setorial, na página nova", () => {
  it("o endereço antigo chega à página nova, que mostra os pesos da gold setorial, sem recalcular", async () => {
    await comPagina({ viewport: { width: 390, height: 900 } }, async (page) => {
      const resposta = await page.goto(`${servidor.origem}/observatorio/formal-employment`);
      expect(resposta?.status()).toBe(200);
      expect(caminho(page)).toBe(EMPREGO);
      const bloco = page.locator("[data-pesos-risco]");
      await bloco.waitFor();
      const componentes = setorial.setores[0].componentes as Record<string, { peso: number; status: string }>;
      const texto = await bloco.innerText();
      const observados = Object.values(componentes).filter((c) => c.status === "observado");
      expect(observados.length).toBeGreaterThan(1);
      for (const c of observados) expect(texto, `peso ${c.peso}`).toContain(br(c.peso, 2));
      // os pesos que entram no cálculo somam 1 na gold, e a página os mostra todos
      expect(observados.reduce((s, c) => s + c.peso, 0)).toBeCloseTo(1, 6);
      expect(await bloco.locator("tbody tr").count()).toBe(Object.keys(componentes).length);
      expect(await foraDaLargura(page)).toEqual([]);
    });
  }, 120_000);
});
