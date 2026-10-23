import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parse, serializeOuter } from "parse5";
import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import { pt } from "@/i18n/pt";
import { en } from "@/i18n/en";
import { modoDaPagina } from "./suporte/i18n-build";
import { aguardarHome, criarNavegadorI18n, type NavegadorI18n } from "./suporte/i18n-browser";
import { INDICE_HOME, INTRODUCAO_HOME, verificarHomeParcial } from "./suporte/i18n-home";
import { attr, texto, unico, type No } from "./suporte/i18n-dom";

const require = createRequire(import.meta.url);
const APP = join(process.cwd(), ".next", "server", "app");
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";
let ambiente: NavegadorI18n | undefined;
function pronto(ctx: TestContext): NavegadorI18n {
  if (!existsSync(APP) && !EXIGIR) ctx.skip("sem build local; rode npm run build para verificar a home dinâmica PT/EN");
  if (!ambiente) throw new Error("Prova obrigatória da home requer o build e Chromium disponíveis");
  return ambiente;
}

beforeAll(async () => {
  if (!existsSync(APP) && !EXIGIR) return;
  expect(existsSync(APP), "EXIGIR_BUILD_HTML=1 requer o build de produção").toBe(true);
  for (const caminho of ["/", "/en"]) expect(modoDaPagina(caminho), caminho).toBe("dinamico");
  ambiente = await criarNavegadorI18n();
}, 90_000);
afterAll(async () => { await ambiente?.fechar(); });

type Violacao = { id: string; nodes: { html: string }[] };
function assinaturas(violacoes: Violacao[], ingles: boolean, nomesComprovados: readonly { pt: string; en: string }[] = []): string[] {
  return violacoes.flatMap((v) => v.nodes.map((node) => {
    let html = node.html.replace(/\sdata-i18n-regiao="[^"]*"/g, "");
    if (ingles) {
      for (const chave of [
        "home.hero.titulo_inicio", "home.hero.titulo_destaque", "acesso.criar_conta", "home.hero.ja_cadastrado",
        "home.hero.rotulo", "home.hero.beneficio_conta", "home.hero.beneficio_evidencia", "home.hero.beneficio_gratuidade",
        "home.indice.rotulo", "home.indice.ilustracoes", "home.indice.paginas_tematicas", "home.indice.secoes_publicadas",
        "home.indice.temas_publicados", "home.indice.capitulos_com_dados", "home.indice.unidades_federacao", "home.indice.paginas_por_pergunta",
      ] as const) {
        html = html.replaceAll(en[chave].texto, pt[chave]);
      }
      // O contrato integral já validou quantidade e frase resolvida antes desta equivalência.
      html = html.replaceAll(INTRODUCAO_HOME.en, INTRODUCAO_HOME.pt);
      for (const cartao of INDICE_HOME) {
        if (cartao.en.valor !== cartao.pt.valor) html = html.replaceAll(cartao.en.valor, cartao.pt.valor);
      }
      // Só spans completos de nomes já validados; não remover lang genericamente da região.
      for (const nome of nomesComprovados) html = html.replaceAll(nome.en, nome.pt);
    }
    return `${v.id}: ${html}`;
  }));
}

function nomesDoIndice(ptDoc: No, enDoc: No): { pt: string; en: string }[] {
  return INDICE_HOME.map((esperado) => {
    const span = (doc: No) => {
      const nav = unico(doc, (e) => e.tagName === "nav" && attr(e, "aria-label") === (doc === ptDoc ? pt["home.indice.rotulo"] : en["home.indice.rotulo"].texto), "índice comprovado");
      const anchor = unico(nav, (e) => e.tagName === "a" && attr(e, "href") === esperado.href, `cartão ${esperado.id}`);
      return unico(anchor, (e) => e.tagName === "span" && texto(e) === esperado.nome, `nome ${esperado.nome}`);
    };
    return { pt: serializeOuter(span(ptDoc)), en: serializeOuter(span(enDoc)) };
  });
}

describe("home PT/EN: navegador do build de produção", () => {
  it.for([320, 1440])("conclui o DOM e não acrescenta violações WCAG 2/2.1 A/AA a %i px", { timeout: 60_000 }, async (largura, ctx) => {
    const servidor = pronto(ctx);
    const contexto = await servidor.contexto();
    const resultados: { html: string; violacoes: Violacao[]; larguraDocumento: number }[] = [];
    try {
      for (const caminho of ["/", "/en"]) {
        const page = await contexto.newPage();
        try {
          await page.setViewportSize({ width: largura, height: 1000 });
          const falhas: string[] = [];
          page.on("pageerror", (e) => falhas.push(e.message));
          page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error/i.test(m.text())) falhas.push(m.text()); });
          const resposta = await page.goto(servidor.origem + caminho, { waitUntil: "load" });
          expect(resposta?.status()).toBe(200);
          expect(page.url()).toBe(servidor.origem + caminho);
          await aguardarHome(page);
          expect(await page.locator("html").getAttribute("lang")).toBe(caminho === "/en" ? "en" : "pt-BR");
          if (caminho === "/en") {
            const avisos = page.locator("[data-i18n-aviso]");
            expect(await avisos.count()).toBe(4);
            for (const aviso of await avisos.all()) {
              expect(await aviso.isVisible()).toBe(true);
              expect(await aviso.getAttribute("lang")).toBe("en");
              expect(await aviso.textContent()).toBe("Portuguese only");
            }
            const regioes = page.locator("[data-i18n-regiao]");
            expect(await regioes.count()).toBe(10);
            for (const regiao of await regioes.all()) expect(await regiao.isVisible()).toBe(true);
          }
          await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
          const violacoes = await page.evaluate(async () => {
            const axe = (window as unknown as { axe: { run(context: Document, options: { runOnly: { type: "tag"; values: string[] } }): Promise<{ violations: { id: string; nodes: { html: string }[] }[] }> } }).axe;
            const auditoria = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
            return auditoria.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ html: n.html })) }));
          });
          resultados.push({ html: await page.content(), violacoes, larguraDocumento: await page.evaluate(() => document.documentElement.scrollWidth) });
          expect(resultados.at(-1)!.larguraDocumento, caminho + " cabe no viewport").toBeLessThanOrEqual(largura + 1);
          expect(falhas, caminho).toEqual([]);
        } finally { await page.close(); }
      }
      const ptDoc = parse(resultados[0].html), enDoc = parse(resultados[1].html);
      verificarHomeParcial(ptDoc, enDoc);
      const nomesComprovados = nomesDoIndice(ptDoc, enDoc);
      expect(resultados[1].larguraDocumento, "sem regressão da largura horizontal").toBeLessThanOrEqual(Math.max(largura, resultados[0].larguraDocumento));
      const anteriores = assinaturas(resultados[0].violacoes, false);
      const novas: string[] = [];
      for (const assinatura of assinaturas(resultados[1].violacoes, true, nomesComprovados)) {
        const indice = anteriores.indexOf(assinatura);
        if (indice < 0) novas.push(assinatura);
        else anteriores.splice(indice, 1);
      }
      expect(novas, "violações WCAG 2/2.1 A/AA adicionais em inglês; o PT desta execução é a comparação").toEqual([]);
    } finally { await contexto.close(); }
  });

  it("preserva query/fragmento, navega pelo seletor, grava preferência e mantém destinos reais", async (ctx) => {
    const servidor = pronto(ctx);
    const contexto = await servidor.contexto();
    try {
      const page = await contexto.newPage();
      const falhas: string[] = [];
      page.on("pageerror", (e) => falhas.push(e.message));
      const sufixo = "?origem=a%2Fb&repetido=1&repetido=2#hero-titulo";
      await page.goto(servidor.origem + "/" + sufixo.split("#")[0]);
      await aguardarHome(page);
      // Alteração silenciosa não desloca o início do Tab para o alvo do fragmento.
      // O foco real no seletor precisa reler a URL antes da navegação nativa.
      await page.evaluate((destino) => window.history.replaceState(window.history.state, "", destino), "/" + sufixo);
      let encontrou = false;
      for (let tentativa = 0; tentativa < 30; tentativa++) {
        await page.keyboard.press("Tab");
        encontrou = await page.evaluate(() => document.activeElement?.getAttribute("hreflang") === "en");
        if (encontrou) break;
      }
      expect(encontrou, "seletor inglês alcançável pelo teclado").toBe(true);
      expect(await page.locator('a[hreflang="en"]').getAttribute("href")).toBe("/en" + sufixo);
      const foco = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        const estilo = getComputedStyle(e);
        const caixa = e.getBoundingClientRect();
        return { largura: caixa.width, altura: caixa.height, outline: estilo.outlineStyle, espessura: parseFloat(estilo.outlineWidth) };
      });
      expect(foco.largura).toBeGreaterThanOrEqual(44);
      expect(foco.altura).toBeGreaterThanOrEqual(44);
      expect(foco.outline).not.toBe("none");
      expect(foco.espessura).toBeGreaterThan(0);
      await page.keyboard.press("Enter");
      await page.waitForURL(servidor.origem + "/en" + sufixo);
      await aguardarHome(page);
      expect(await page.locator("html").getAttribute("lang")).toBe("en");
      expect((await contexto.cookies()).find((c) => c.name === "scrutiniums_idioma")).toMatchObject({ value: "en", path: "/", sameSite: "Lax", secure: false });
      const acoes = page.locator('[data-i18n-regiao="home-acoes"]');
      expect(await acoes.locator('a[href="/cadastro"]').textContent()).toBe(en["acesso.criar_conta"].texto);
      // a entrada tem tradução publicada: o atalho inglês leva à irmã /en
      expect(await acoes.locator('a[href="/en/entrar"]').textContent()).toBe(en["home.hero.ja_cadastrado"].texto);
      const nav = page.getByRole("navigation", { name: "Collection index", exact: true });
      expect(await nav.count()).toBe(1);
      expect(await nav.getAttribute("data-i18n-regiao")).toBe("home-indice");
      // O índice começa recolhido (achado A9 da banca, 19/10/2026): o resumo traduzido abre as lâminas.
      const resumo = nav.locator("details > summary");
      expect(await resumo.textContent()).toBe(en["home.indice.rotulo"].texto);
      expect(await nav.locator("details").getAttribute("open")).toBeNull();
      await resumo.click();
      expect(await nav.locator("details").getAttribute("open")).not.toBeNull();
      expect(await nav.locator("details > p").textContent()).toBe(en["home.indice.ilustracoes"].texto);
      const indice = nav.locator("ol > li > a");
      expect(await indice.count()).toBe(8);
      for (const [i, esperado] of INDICE_HOME.entries()) {
        const anchor = indice.nth(i);
        expect(await anchor.getAttribute("href")).toBe(esperado.href);
        expect(await anchor.locator('span[lang="pt-BR"]').textContent()).toBe(esperado.nome);
        expect(await anchor.locator("span.tabular-nums").textContent()).toBe(esperado.en.valor);
        expect(await anchor.locator("span.mt-2").textContent()).toBe(`${esperado.en.valor} ${esperado.en.unidade}`);
        const escapar = (valor: string) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const nomeAcessivel = new RegExp(`^${[esperado.nome, esperado.en.valor, esperado.en.unidade].map(escapar).join("\\s*")}$`);
        expect(await nav.getByRole("link", { name: nomeAcessivel }).count(), `nome acessível de ${esperado.id}`).toBe(1);
      }
      const destinos = await indice.evaluateAll((links) => links.map((a) => {
        const href = a.getAttribute("href")!;
        return { href, existe: document.getElementById(href.slice(1)) !== null };
      }));
      expect(destinos.map((d) => d.href)).toEqual(INDICE_HOME.map((d) => d.href));
      expect(destinos.every((d) => d.existe)).toBe(true);
      await indice.last().click();
      expect(new URL(page.url()).pathname).toBe("/en");
      expect(new URL(page.url()).hash).toBe(destinos.at(-1)!.href);
      // A âncora abre o capítulo recolhido da coleção, que fica visível.
      await expect.poll(() => page.locator(destinos.at(-1)!.href).isVisible()).toBe(true);
      expect(falhas).toEqual([]);
    } finally { await contexto.close(); }
  }, 60_000);
});
