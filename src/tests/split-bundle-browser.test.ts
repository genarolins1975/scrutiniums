import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

const fontes = Object.fromEntries(["pgfn", "desenrola"].map(nome => [nome,
  JSON.parse(readFileSync(`public/obs/data/gold/${nome}.json`, "utf8")),
]));
let servidor: ServidorProducao;
let navegador: Browser;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("split-pgfn");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

const caminhos = { pgfn: "/observatorio/federal-tax-debt", desenrola: "/observatorio/desenrola" };
type Vista = keyof typeof caminhos;
async function conferirPainel(page: Page, vista: Vista) {
  const secao = page.locator(`#view-${vista}.active`);
  // editorial.js promove o título gerado por pageHead a h1 antes da leitura da página.
  await secao.locator(".pagehead").getByRole("heading", { level: 1 }).waitFor();
  const fonte = fontes[vista];
  if (fonte.disponivel) {
    // Os caminhos reais exercitam pgfnEscala tanto em PGFN quanto em Desenrola.
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

describe.skipIf(!temBuild && !exigirBuild)("PGFN e Desenrola: chunk municipal carregado sob demanda", () => {
  it.each(["pgfn", "desenrola"] as const)("entrada direta em %s sem cache e navegação cliente de ida e volta", async inicial => {
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
      const outra: Vista = inicial === "pgfn" ? "desenrola" : "pgfn";
      for (const vista of [outra, inicial]) {
        // Usa o mesmo roteador dos onclick; uma navegação de documento mascararia o problema de dependência.
        await page.evaluate(v => (window as unknown as { nav: (v: string) => void }).nav(v), vista);
        await page.waitForURL(servidor.origem + caminhos[vista]);
        await conferirPainel(page, vista);
      }
      expect(documentos).toBe(1);
      expect(pedidosChunk).toBe(1);
      expect(erros).toEqual([]);
      for (const caminho of ["/obs/app.min.js", "/obs/app-municipal.min.js", "/obs/data/gold/pgfn.json", "/obs/data/gold/desenrola.json"]) {
        expect(respostas.filter(r => r.caminho === caminho).map(r => r.status), caminho).toContain(200);
        expect(respostas.filter(r => r.caminho === caminho).every(r => r.status === 200), caminho).toBe(true);
      }
    } finally { await contexto.close(); }
  }, 90_000);
});
