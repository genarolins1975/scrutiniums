/**
 * Frente 3, 27/10/2026: jornadas reais de salvar/reabrir/compartilhar sobre next start.
 * node scripts/analise-recuperavel-verificacao.mjs --saida /tmp/analise-evidencias
 * Conta e banco efêmeros; nenhum pedido autenticado sai de localhost.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { subirServidorLocal } from "./servidor-local.mjs";
import { aguardarHidratacao } from "./ux-cromo-medida.mjs";

const indiceSaida = process.argv.indexOf("--saida");
const saida = resolve(indiceSaida >= 0 ? process.argv[indiceSaida + 1] : "/tmp/analise-evidencias");
await mkdir(saida, { recursive: true });
const servidor = await subirServidorLocal({ usuario: "analise-recuperavel" });
const browser = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
const resultados = [];
const erros = [];
const titulo = "Pernambuco — tanque de 60 litros";
const captura = async (p, nome) => p.screenshot({ path: join(saida, nome + ".png"), fullPage: false });
const ir = async (p, rota) => { await p.goto(servidor.origem + rota, { waitUntil: "networkidle" }); await aguardarHidratacao(p); };
async function abrirSalvar(p, largura) {
  if (largura < 640) { await p.locator('.bp-ferramentas-menu .bp-ferramenta').click(); await p.getByRole('button', { name: 'Salvar este recorte', exact: true }).click(); }
  else await p.getByRole('button', { name: 'Salvar recorte', exact: true }).click();
  await p.getByRole('region', { name: 'Salvar este recorte', exact: true }).waitFor();
}
try {
  for (const largura of [320, 390, 768, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, hasTouch: largura <= 390, reducedMotion: "reduce" });
    await ctx.addCookies([servidor.cookie]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => erros.push({ largura, erro: e.message }));
    await ir(p, "/combustiveis?uf=PE");
    const litros = p.getByLabel("Litros", { exact: true });
    await litros.fill("60");
    const resposta = await p.getByRole("region", { name: "Preço no seu estado", exact: true }).innerText();
    await abrirSalvar(p, largura);
    assert.equal(await p.getByLabel("Título do recorte", { exact: true }).evaluate((el) => el === document.activeElement), true);
    await p.getByLabel("Título do recorte", { exact: true }).fill(titulo);
    const requisicao = p.waitForRequest((r) => new URL(r.url()).pathname === "/api/conta/recortes" && r.method() === "POST");
    await p.getByRole("button", { name: "Salvar", exact: true }).click();
    const corpo = (await requisicao).postDataJSON();
    const url = new URL(corpo.caminho, servidor.origem);
    assert.equal(url.searchParams.get("uf"), "PE");
    assert.equal(url.searchParams.get("litros"), "60");
    await p.getByRole("link", { name: "Ver em Minha conta", exact: true }).waitFor();
    if ([390, 1440].includes(largura)) await captura(p, `salvar-${largura}-depois`);
    await p.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Recusa sintética"); } } }));
    await p.getByRole("button", { name: "Copiar link", exact: true }).click();
    const manual = p.getByRole("textbox", { name: "Endereço para compartilhar", exact: true });
    await manual.waitFor();
    assert.equal(await manual.inputValue(), url.href);
    await p.waitForFunction(() => document.activeElement?.tagName === "TEXTAREA");
    if ([390, 1440].includes(largura)) await captura(p, `copia-manual-${largura}-depois`);
    await p.keyboard.press("Escape");
    assert.equal(await p.evaluate(() => document.activeElement?.tagName), "BUTTON");
    const outro = await browser.newContext({ viewport: { width: largura, height: 900 } });
    await outro.addCookies([servidor.cookie]);
    const destinatario = await outro.newPage();
    await destinatario.goto(url.href, { waitUntil: "networkidle" }); await aguardarHidratacao(destinatario);
    assert.equal(await destinatario.getByLabel("Litros", { exact: true }).inputValue(), "60");
    assert.equal(await destinatario.getByRole("region", { name: "Preço no seu estado", exact: true }).innerText(), resposta);
    await destinatario.reload({ waitUntil: "networkidle" }); await aguardarHidratacao(destinatario);
    assert.equal(await destinatario.getByLabel("Litros", { exact: true }).inputValue(), "60");
    if ([390, 1440].includes(largura)) await captura(destinatario, `combustiveis-${largura}-depois`);
    await outro.close();
    await p.getByLabel("Seu estado", { exact: true }).first().selectOption("SP");
    await abrirSalvar(p, largura);
    await p.goBack();
    await p.waitForFunction(() => new URL(location.href).searchParams.get("uf") === "PE");
    await p.waitForFunction(() => document.querySelector('.bp-painel p.break-all')?.textContent?.includes('uf=PE'));
    await p.goForward();
    await p.waitForFunction(() => document.querySelector('.bp-painel p.break-all')?.textContent?.includes('uf=SP'));
    await p.keyboard.press("Escape");
    if (largura < 640) {
      await p.locator('.bp-ferramentas-menu .bp-ferramenta').click();
      await p.getByRole('button', { name: 'Citar esta página', exact: true }).click();
    } else await p.getByRole('button', { name: 'Citar', exact: true }).click();
    await p.goBack();
    await p.waitForFunction(() => new URL(location.href).searchParams.get('uf') === 'PE');
    for (const formato of ['bib', 'ris']) {
      const download = p.waitForEvent('download');
      await p.getByRole('button', { name: `Baixar .${formato}`, exact: true }).click();
      const arquivo = await download;
      const conteudo = await readFile(await arquivo.path(), 'utf8');
      // A referência deve seguir o recorte após o histórico, não o endereço ao abrir o painel.
      assert.match(conteudo, /uf=PE/);
      assert.match(conteudo, /litros=60/);
      assert.doesNotMatch(conteudo, /uf=SP/);
    }
    await ir(p, "/app/conta#recortes");
    const item = p.locator("#recortes li").filter({ has: p.getByRole("link", { name: titulo, exact: true }) });
    await item.getByRole("link", { name: titulo, exact: true }).waitFor();
    assert.equal(await item.getByRole("link", { name: titulo, exact: true }).getAttribute("href"), corpo.caminho);
    await item.getByRole("button", { name: `Copiar link: ${titulo}`, exact: true }).click();
    // A página em repouso não revela contraste insuficiente no estado após apontar/clicar.
    await p.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });
    const violacoes = await p.evaluate(async () => {
      const r = await window.axe.run(document.querySelector('#recortes'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
      return r.violations.map(v => ({ id: v.id, alvos: v.nodes.map(n => n.target) }));
    });
    assert.deepEqual(violacoes, []);
    if ([390, 1440].includes(largura)) await captura(p, `conta-${largura}-depois`);
    await item.getByRole("button", { name: "Renomear", exact: true }).click();
    await p.waitForFunction(() => document.activeElement?.tagName === "INPUT");
    await p.locator("#recortes").getByRole("button", { name: "Cancelar", exact: true }).click();
    await p.waitForFunction(() => document.activeElement?.textContent?.includes("Renomear"));
    const rolagem = await p.evaluate(() => ({ viewport: innerWidth, largura: document.documentElement.scrollWidth }));
    assert.ok(rolagem.largura <= rolagem.viewport, JSON.stringify(rolagem));
    resultados.push({ largura, caminho: corpo.caminho, mesmoResultado: true, recarga: true, historico: true, citacaoBibRis: true, copiaManual: true, salvoNoBanco: true, foco: true, axeDepoisDeCopiar: violacoes, rolagem });
    console.log(JSON.stringify(resultados.at(-1)));
    await ctx.close();
  }
  assert.deepEqual(erros, []);
} finally {
  await writeFile(join(saida, "jornadas.json"), JSON.stringify({ commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), build: (await readFile(".next/BUILD_ID", "utf8")).trim(), resultados, erros }, null, 2));
  await browser.close(); await servidor.encerrar();
}
