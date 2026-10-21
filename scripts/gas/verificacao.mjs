/* Auditoria local: 12 rotas, quatro larguras, filtros e política de acesso.
   COOKIE_SECRET deve coincidir com o segredo de desenvolvimento do servidor.
   PLAYWRIGHT_MODULE pode apontar para a instalação do ambiente. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { autenticarAuditoria } from "../sessao-auditoria.mjs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.argv[2] || "http://127.0.0.1:3100";
const saida = process.argv[3] || "/tmp/gas-depois";
mkdirSync(saida, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const anonimo = await browser.newContext();
const publico = await anonimo.request.get(base + "/gas-natural/metodologia", { maxRedirects: 0 });
const protegido = await anonimo.request.get(base + "/gas-natural", { maxRedirects: 0 });
assert.equal(publico.status(), 200);
assert.ok([302, 303, 307, 308].includes(protegido.status()));
await anonimo.close();
autenticarAuditoria(browser, base);
const rotas = ["", "producao", "aproveitamento", "importacao", "precos", "gas-de-cozinha", "gnv-e-gas-encanado", "mercado", "infraestrutura", "regulacao", "dados", "metodologia"];
const resultados = [];
const auditarPaginas = process.argv[4] !== "--interacoes";
for (const slug of auditarPaginas ? rotas : []) for (const largura of [320, 390, 768, 1440]) {
  const rota = "/gas-natural" + (slug ? "/" + slug : "");
  const pagina = await browser.newPage({ viewport: { width: largura, height: 900 }, reducedMotion: "reduce" });
  const erros = [];
  pagina.on("pageerror", (e) => erros.push(String(e)));
  pagina.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  const resposta = await pagina.goto(base + rota, { waitUntil: "networkidle" });
  const info = await pagina.evaluate(() => ({
    h1: document.querySelectorAll("h1").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ancorasAusentes: [...document.querySelectorAll('main a[href^="#"]')].map((a) => a.getAttribute("href").slice(1)).filter((id) => !document.getElementById(id)),
  }));
  await pagina.screenshot({ path: join(saida, `${slug || "inicial"}-${largura}.png`), fullPage: true });
  resultados.push({ rota, largura, status: resposta.status(), ...info, erros });
  await pagina.close();
}
if (auditarPaginas) writeFileSync(join(saida, "paginas.json"), JSON.stringify(resultados, null, 2));
assert.ok(resultados.every((x) => x.status === 200 && x.h1 === 1 && x.overflow <= 1 && !x.erros.length && !x.ancorasAusentes.length), "Página com falha: consultar paginas.json");
const pagina = await browser.newPage({ viewport: { width: 390, height: 900 } });
for (const slug of ["gas-de-cozinha", "gnv-e-gas-encanado"]) {
  await pagina.goto(base + `/gas-natural/${slug}?uf=SP#sua-uf`, { waitUntil: "networkidle" });
  const select = pagina.getByLabel("UF", { exact: true });
  assert.equal(await select.inputValue(), "SP");
  await select.selectOption("RJ");
  assert.equal(new URL(pagina.url()).searchParams.get("uf"), "RJ");
  await pagina.reload({ waitUntil: "networkidle" });
  assert.equal(await select.inputValue(), "RJ");
  await select.selectOption("SP");
  await pagina.goBack();
  await pagina.waitForFunction(() => new URL(location.href).searchParams.get("uf") === "RJ");
  assert.equal(await select.inputValue(), "RJ");
  await select.focus();
  assert.equal(await select.evaluate((e) => document.activeElement === e), true);
  assert.ok((await select.boundingBox()).height >= 44);
  await pagina.goto(base + `/gas-natural/${slug}?uf=XX#sua-uf`, { waitUntil: "networkidle" });
  await pagina.getByText("A UF informada no endereço", { exact: false }).waitFor({ state: "visible" });
assert.ok(await pagina.getByText("A UF informada no endereço", { exact: false }).isVisible());
}
await pagina.goto(base + "/gas-natural/aproveitamento?balanco=2005-07#explorar", { waitUntil: "networkidle" });
await pagina.getByText("Balanço inconsistente:", { exact: false }).waitFor({ state: "visible" });
assert.ok(await pagina.getByText("Balanço inconsistente:", { exact: false }).isVisible());
assert.equal(await pagina.locator("#explorar svg").count(), 0);
const gold = JSON.parse(readFileSync("public/gas/gold/aproveitamento.json", "utf8"));
await pagina.getByLabel("Mês do balanço").selectOption(gold.serie.at(-1).mes);
await pagina.getByText("Balanço conferido", { exact: false }).waitFor({ state: "visible" });
assert.ok(await pagina.getByText("Balanço conferido", { exact: false }).isVisible());
assert.ok(await pagina.locator("#explorar table").count() > 0);
await pagina.reload({ waitUntil: "networkidle" });
assert.equal(await pagina.getByLabel("Mês do balanço").inputValue(), gold.serie.at(-1).mes);
await pagina.goto(base + "/gas-natural/aproveitamento?balanco=9999-01#explorar", { waitUntil: "networkidle" });
await pagina.getByText("O mês informado no endereço", { exact: false }).waitFor({ state: "visible" });
assert.ok(await pagina.getByText("O mês informado no endereço", { exact: false }).isVisible());
await pagina.close();
await browser.close();
writeFileSync(join(saida, "interacoes.json"), JSON.stringify({ publico: publico.status(), protegido: protegido.status(), uf: "seleção, recarga, histórico, foco e parâmetro inválido aprovados em GLP e GNV", balanco: "mês inconsistente, válido, recarga e parâmetro inválido aprovados" }, null, 2));
console.log(`${auditarPaginas ? resultados.length + " páginas e " : ""}Interações aprovadas; acesso público e restrito preservado.`);
