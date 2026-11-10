import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

/**
 * Chunk municipal da aplicação do Crédito, carregado sob demanda. Até 10/11/2026 o par do teste era PGFN e Desenrola, as duas
 * vistas do chunk que desenham mapa municipal com pgfnEscala. Decisão do dono de 10/11/2026: a vista Desenrola redireciona
 * para a página Next /divida-das-familias/desenrola (src/lib/observatorios/reescritos.ts). O que mudou aqui:
 * - migrado: a entrada direta, a ida e volta pelo roteador interno e a contagem de pedidos do chunk passam a usar o Crédito
 *   rural, outra vista do mesmo chunk que continua na aplicação;
 * - aposentado: a conferência do mapa municipal da vista antiga do Desenrola (um path por município com cor válida). O mapa
 *   novo é o da página Next, coberto por src/tests/familias-desenrola.test.ts; a regra de cor de pgfnEscala segue exercitada
 *   aqui pelo mapa da PGFN;
 * - novo: de dentro da aplicação, nav("desenrola") sai para a página nova, e o endereço antigo chega à página nova.
 */
const fontes = Object.fromEntries(["pgfn", "rural"].map(nome => [nome,
  JSON.parse(readFileSync(`public/obs/data/gold/${nome}.json`, "utf8")),
]));
const PAGINA_DESENROLA = "/divida-das-familias/desenrola";
let servidor: ServidorProducao;
let navegador: Browser;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("split-pgfn");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

const caminhos = { pgfn: "/observatorio/federal-tax-debt", rural: "/observatorio/rural-credit" };
type Vista = keyof typeof caminhos;
async function conferirPainel(page: Page, vista: Vista) {
  const secao = page.locator(`#view-${vista}.active`);
  // editorial.js promove o título gerado por pageHead a h1 antes da leitura da página.
  await secao.locator(".pagehead").getByRole("heading", { level: 1 }).waitFor();
  const fonte = fontes[vista];
  // o Crédito rural entra pelo carregamento do chunk e pelo roteador; o conteúdo dele tem testes próprios
  if (vista === "rural") { if (!fonte.disponivel) expect(await secao.innerText()).toContain(fonte.motivo || fonte.error || "sem dados"); return; }
  if (fonte.disponivel) {
    // Os caminhos reais exercitam pgfnEscala no mapa da PGFN.
    const esperados = fonte.mapa.filter((m: { cod?: string }) => m.cod && fonte.geo?.paths?.[m.cod]).length;
    expect(esperados).toBeGreaterThan(0);
    await expect.poll(() => secao.locator("svg.panmap path").count()).toBe(esperados);
    const cores = await secao.locator("svg.panmap path").evaluateAll(nos => nos.map(n => n.getAttribute("fill")));
    expect(cores.every(c => c && !/undefined|NaN/.test(c))).toBe(true);
  } else {
    // Estado indisponível acompanha a gold servida; não é tratado como painel com dados.
    expect(await secao.innerText()).toContain(fonte.motivo || fonte.error || "sem dados");
  }
}

describe.skipIf(!temBuild && !exigirBuild)("PGFN e Crédito rural: chunk municipal carregado sob demanda", () => {
  it.each(["pgfn", "rural"] as const)("entrada direta em %s sem cache e navegação cliente de ida e volta", async inicial => {
    // Um contexto novo por entrada e roteamento desabilitam reaproveitamento do cache HTTP.
    const contexto = await navegador.newContext();
    await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
    let pedidosChunk = 0;
    await contexto.route("**/obs/app-municipal.min.js*", async rota => { pedidosChunk++; await rota.continue(); });
    const page = await contexto.newPage();
    const erros: string[] = [];
    const respostas: Array<{ caminho: string; status: number }> = [];
    let documentos = 0;
    page.on("pageerror", e => erros.push(e.message));
    page.on("request", r => { if (r.resourceType() === "document") documentos++; });
    page.on("response", r => respostas.push({ caminho: new URL(r.url()).pathname, status: r.status() }));
    try {
      const resposta = await page.goto(servidor.origem + caminhos[inicial]);
      expect(resposta?.status()).toBe(200);
      await conferirPainel(page, inicial);
      expect(pedidosChunk).toBe(1);
      const outra: Vista = inicial === "pgfn" ? "rural" : "pgfn";
      for (const vista of [outra, inicial]) {
        // Usa o mesmo roteador dos onclick; uma navegação de documento mascararia o problema de dependência.
        await page.evaluate(v => (window as unknown as { nav: (v: string) => void }).nav(v), vista);
        await page.waitForURL(servidor.origem + caminhos[vista]);
        await conferirPainel(page, vista);
      }
      expect(documentos).toBe(1);
      expect(pedidosChunk).toBe(1);
      expect(erros).toEqual([]);
      for (const caminho of ["/obs/app.min.js", "/obs/app-municipal.min.js", "/obs/data/gold/pgfn.json", "/obs/data/gold/rural.json"]) {
        expect(respostas.filter(r => r.caminho === caminho).map(r => r.status), caminho).toContain(200);
        expect(respostas.filter(r => r.caminho === caminho).every(r => r.status === 200), caminho).toBe(true);
      }
    } finally { await contexto.close(); }
  }, 90_000);

  // decisão do dono de 10/11/2026: a vista antiga do Desenrola não abre mais, nem por dentro da aplicação nem pelo endereço
  it("de dentro da aplicação, nav('desenrola') sai para a página nova das Famílias, sem desenhar a vista antiga", async () => {
    const contexto = await navegador.newContext();
    await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
    const page = await contexto.newPage();
    const erros: string[] = [];
    page.on("pageerror", e => erros.push(e.message));
    try {
      await page.goto(servidor.origem + caminhos.pgfn);
      await conferirPainel(page, "pgfn");
      await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav("desenrola"));
      await page.waitForURL(servidor.origem + PAGINA_DESENROLA);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      expect(await page.locator("#view-desenrola").count()).toBe(0);
      expect(erros).toEqual([]);
    } finally { await contexto.close(); }
  }, 90_000);

  it("o endereço antigo do Desenrola chega à página nova, com a consulta preservada", async () => {
    const contexto = await navegador.newContext();
    await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
    const page = await contexto.newPage();
    try {
      const resposta = await page.goto(servidor.origem + "/observatorio/desenrola?sec=mapa");
      expect(resposta?.status()).toBe(200);
      expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(PAGINA_DESENROLA + "?sec=mapa");
      expect(resposta?.request().redirectedFrom()?.url()).toBe(servidor.origem + "/observatorio/desenrola?sec=mapa");
      expect(await page.locator("#view-desenrola").count()).toBe(0);
    } finally { await contexto.close(); }
  }, 90_000);
});
