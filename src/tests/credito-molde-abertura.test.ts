import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";

/**
 * Diagnóstico de layout de 20/10/2026, item 2: nas abas do Crédito o número vem antes do método. A caixa de leitura
 * que o cabeçalho comum escreve logo abaixo do título desce, na camada de apresentação (public/obs/editorial.js), para
 * depois do primeiro bloco de números; o limite da leitura fica à vista e o resto recolhido; os números formam uma
 * faixa dividida, sem cartão, borda ou sombra por número.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const app = ler("public/obs/app.js");
const editorial = ler("public/obs/editorial.js");
const css = ler("public/observatorios.css");
const html = ler("public/obs/index.html");

describe("molde de abertura do Crédito: contrato no código", () => {
  it("a caixa de leitura mostra o limite e recolhe como ler e por que acompanhar", () => {
    const i = app.indexOf("function guiaPagina(view)");
    const corpo = app.slice(i, app.indexOf("\n}\n", i));
    expect(corpo.indexOf('class="guia-limite"')).toBeGreaterThan(0);
    expect(corpo.indexOf('class="guia-limite"')).toBeLessThan(corpo.indexOf("<details"));
    expect(corpo.indexOf('class="guia-como"')).toBeGreaterThan(corpo.indexOf("<details"));
    expect(corpo).toContain("${g.importa}");
  });

  it("a camada de apresentação reposiciona a caixa antes de montar o índice da página", () => {
    expect(editorial).toContain("function guiaDepoisDosNumeros(view)");
    expect(editorial).toMatch(/guiaDepoisDosNumeros\(view\);\s*indiceDaPagina\(view\);/);
  });

  it("os números formam uma faixa dividida, sem cartão nem sombra, nos dois contêineres de números", () => {
    expect(css).toMatch(/\.observatorio-credito :is\(\.kpirow, \.pan-kpi\) > \.card\.kpi \{[^}]*box-shadow:none/);
    expect(css).toMatch(/\.observatorio-credito :is\(\.kpirow, \.pan-kpi\) \{[^}]*border-block:1px solid var\(--border\)/);
  });

  it("os ativos alterados sobem de versão (cache imutável)", () => {
    expect(html).toContain("/observatorios.css?v=7");
    expect(html).toContain("/obs/editorial.js?v=6");
  });
});

describe("Instituições (item 3 do diagnóstico): busca antes, exclusões depois, régua da Basileia", () => {
  const i0 = app.indexOf("function renderInstitutions() {");
  const aba = app.slice(i0, app.indexOf("\n}\n", i0));
  it("o nome de cada linha é o link para a ficha, sem um botão por linha", () => {
    expect(aba).toContain('<a class="inst-nome" href="/observatorio/institutions/${i.cod_inst}"');
    expect(aba).not.toContain("página completa →</button>");
  });
  it("a síntese não lista mais as exclusões nome a nome; a lista fica num recolhível depois da tabela", () => {
    expect(aba).not.toContain("semBalGrandes.slice(0, 6)");
    const tabela = aba.indexOf("<tbody>${rows}</tbody></table></div>");
    expect(aba.indexOf("${instForaDoCorte(inst)}")).toBeGreaterThan(tabela);
    expect(app).toContain("function instForaDoCorte(inst)");
    // a ressalva continua: ausência na data-base não é saída nem zero
    expect(app).toMatch(/Não é saída nem zero: a ficha de cada uma segue disponível na última entrega/);
  });
  it("a régua da Basileia lê a faixa e a mediana do próprio grupo e diz quantos ficam fora", () => {
    expect(aba.indexOf("${instReguaBasileia(inst)}")).toBeGreaterThan(aba.indexOf("${instForaDoCorte(inst)}"));
    const regua = app.slice(app.indexOf("function instReguaBasileia(inst)"), app.indexOf("function renderInstitutions() {"));
    expect(regua).toContain("(inst.grupos[g].stats || {}).basileia_pct");
    expect(regua).toContain("pool_fallback");
    expect(regua).toContain("não reportam Basileia e ficam fora do gráfico");
    expect(regua).toContain('<details class="charttable">');
  });
});

/* Comportamento no navegador: a mesma página mínima que a SPA monta, com o editorial.js de verdade. */
const pagina = (corpo: string) => `<!doctype html><html><body><main id="main"><section class="view active" id="view-teste">
  <div class="pagehead"><h2>Aba de teste</h2></div>${corpo}</section></main></body></html>`;
const GUIA = '<aside class="guia-leitura"><p class="guia-pergunta">Pergunta?</p></aside>';
const PANE = '<div class="note warn pane">Fonte em pane</div>';

let navegador: Browser;
beforeAll(async () => {
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
});
afterAll(async () => {
  await navegador?.close();
});

async function ordem(corpo: string): Promise<string[]> {
  const p = await navegador.newPage();
  await p.setContent(pagina(corpo));
  await p.addScriptTag({ content: editorial });
  const classes = await p.evaluate(() =>
    Array.from(document.querySelectorAll("#view-teste > *")).map((el) => (el.tagName === "H3" ? "h3" : el.className.split(" ")[0])),
  );
  await p.close();
  return classes;
}

describe("molde de abertura do Crédito: no navegador", () => {
  it("a caixa desce para depois da abertura padrão; o aviso de fonte em pane fica acima dos números", async () => {
    const o = await ordem(`${GUIA}${PANE}<div class="abertura"><div class="kpirow"></div><p class="pan-sintese">s</p></div><h3>Seção</h3>`);
    expect(o).toEqual(["pagehead", "note", "abertura", "guia-leitura", "h3"]);
  });

  it("com a faixa .pan-kpi seguida da síntese, a caixa desce também abaixo da síntese e da sua fonte", async () => {
    const o = await ordem(`${GUIA}<div class="pan-kpi"></div><p class="pan-sintese">s</p><div class="src">fonte</div><h3>Seção</h3>`);
    expect(o).toEqual(["pagehead", "pan-kpi", "pan-sintese", "src", "guia-leitura", "h3"]);
  });

  it("se um título de seção vem antes do primeiro bloco de números, a caixa fica onde estava", async () => {
    const o = await ordem(`${GUIA}<h3>Seção</h3><div class="kpirow"></div>`);
    expect(o).toEqual(["pagehead", "guia-leitura", "h3", "kpirow"]);
  });

  it("sem bloco de números, nada muda; números dentro de um cartão não contam", async () => {
    expect(await ordem(`${GUIA}<p>texto</p>`)).toEqual(["pagehead", "guia-leitura", ""]);
    expect(await ordem(`${GUIA}<div class="card"><div class="kpirow"></div></div>`)).toEqual(["pagehead", "guia-leitura", "card"]);
  });
});
