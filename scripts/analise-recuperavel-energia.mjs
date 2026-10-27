/** 27/10/2026: o mesmo link preserva a consulta ao passar da página pública à área autenticada. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { subirServidorLocal } from './servidor-local.mjs';
import { aguardarHidratacao } from './ux-cromo-medida.mjs';

const i = process.argv.indexOf('--saida');
const saida = resolve(i >= 0 ? process.argv[i + 1] : '/tmp/analise-energia');
await mkdir(saida, { recursive: true });
const servidor = await subirServidorLocal({ usuario: 'analise-energia' });
const browser = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
const resultados = [], erros = [];
const ir = async (p, rota) => { await p.goto(servidor.origem + rota, { waitUntil: 'networkidle' }); await aguardarHidratacao(p); };
try {
  for (const largura of [390, 1440]) for (const idioma of ['pt', 'en']) {
    const rota = `${idioma === 'en' ? '/en' : ''}/setor-eletrico/conta-de-luz`;
    const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, reducedMotion: 'reduce', hasTouch: largura === 390 });
    const p = await ctx.newPage();
    p.on('pageerror', e => erros.push(e.message));
    await ir(p, rota);
    const municipio = p.getByRole('combobox', { name: idioma === 'en' ? 'Search by municipality' : 'Buscar pelo município', exact: true });
    const consumo = p.getByLabel(idioma === 'en' ? 'Consumption in the month (kWh)' : 'Consumo no mês (kWh)', { exact: true });
    await municipio.fill('Recife');
    await p.getByRole('option', { name: 'Recife PE', exact: true }).click();
    await consumo.fill('450');
    await consumo.press('Tab');
    await p.waitForFunction(() => new URL(location.href).searchParams.get('skwh') === '450');
    const url = new URL(p.url());
    assert.equal(url.searchParams.get('conta_municipio'), 'PE|Recife');
    assert.match(url.searchParams.get('dist'), /^\d{14}$/);
    const publico = await p.locator('[data-conta-aperitivo]').innerText();
    const totalPublico = await p.locator('[data-resultado-aperitivo] .font-serif').innerText();
    assert.match(totalPublico, /R\$\s*[\d.,]+/);
    await p.screenshot({ path: join(saida, `energia-${idioma}-${largura}-publica.png`) });
    await p.reload({ waitUntil: 'networkidle' }); await aguardarHidratacao(p);
    await p.locator('[data-municipio-escolhido]').waitFor();
    assert.equal(await p.locator('[data-conta-aperitivo]').innerText(), publico);
    await ctx.addCookies([servidor.cookie]);
    await ir(p, url.pathname + url.search);
    const consumoCompleto = p.getByLabel(idioma === 'en' ? 'Consumption in the month (kWh)' : 'Consumo no mês (kWh)', { exact: true });
    assert.equal(await consumoCompleto.inputValue(), '450');
    await p.locator('[data-municipio]').waitFor({ state: 'attached' });
    assert.match(await p.locator('[data-municipio]').textContent(), /Recife/);
    const resposta = await p.locator('[data-resposta="p049"]').innerText();
    const valoresCompletos = resposta.match(/R\$\s*[\d.,]*\d/g) ?? [];
    assert.equal(valoresCompletos[0], totalPublico);
    await consumoCompleto.scrollIntoViewIfNeeded();
    await p.screenshot({ path: join(saida, `energia-${idioma}-${largura}-autenticada.png`) });
    const larguraPagina = await p.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(larguraPagina <= largura);
    if (largura < 640) {
      await p.locator('.bp-ferramentas-menu .bp-ferramenta').click();
      await p.getByRole('button', { name: idioma === 'en' ? 'Save this view' : 'Salvar este recorte', exact: true }).click();
    } else await p.getByRole('button', { name: idioma === 'en' ? 'Save view' : 'Salvar recorte', exact: true }).click();
    const caminhoSalvo = await p.locator('.bp-painel details p.break-all').textContent();
    assert.ok(caminhoSalvo.length <= 2000, 'O recorte deve caber no contrato da API de salvamento.');
    const parametrosSalvos = new URL(caminhoSalvo, servidor.origem).searchParams;
    for (const chave of ['dist', 'skwh', 'conta_municipio']) assert.equal(parametrosSalvos.get(chave), url.searchParams.get(chave));
    await p.keyboard.press('Escape');
    // Sem distribuidora identificada, o município não pode receber a tarifa do exemplo inicial.
    const ausente = new URL(url); ausente.searchParams.set('dist', '');
    await ir(p, ausente.pathname + ausente.search);
    const formulario = p.getByRole('form', { name: idioma === 'en' ? 'Simulation parameters' : 'Parâmetros da simulação', exact: true });
    assert.equal(await formulario.getByRole('combobox', { name: idioma === 'en' ? 'Distribution utility' : 'Distribuidora', exact: true }).inputValue(), '');
    assert.doesNotMatch(await p.locator('[data-resposta="p049"]').innerText(), /R\$\s*\d/);
    ausente.searchParams.set('dist', '99999999999999');
    await ir(p, ausente.pathname + ausente.search);
    assert.doesNotMatch(await p.locator('body').innerText(), /a simulação usa a de referência|the simulation uses the reference one/);
    assert.doesNotMatch(await p.locator('[data-resposta="p049"]').innerText(), /R\$\s*\d/);
    const avancado = new URL(url);
    avancado.searchParams.set('sclasse', 'tarifa_social'); avancado.searchParams.set('slig', 'bifasico'); avancado.searchParams.set('sband', 'Verde');
    await ctx.clearCookies();
    await ir(p, avancado.pathname + avancado.search);
    await p.locator('[data-recorte-completo]').waitFor();
    assert.doesNotMatch(await p.locator('[data-resultado-aperitivo]').innerText(), /R\$\s*\d/);
    await p.locator('[data-recorte-completo] a').click();
    // O salto ao convite acrescenta sua âncora; o login deve conservar o endereço daquele clique inteiro.
    const enderecoParaRetorno = new URL(p.url());
    assert.equal(enderecoParaRetorno.search, avancado.search);
    await p.locator('[data-convite-aperitivo] a').click();
    await p.waitForURL(/\/entrar\?de=/);
    const destino = new URL(p.url()).searchParams.get('de');
    assert.equal(destino, enderecoParaRetorno.pathname + enderecoParaRetorno.search + enderecoParaRetorno.hash);
    await ctx.addCookies([servidor.cookie]);
    await ir(p, destino);
    const recuperados = await p.getByRole('form', { name: idioma === 'en' ? 'Simulation parameters' : 'Parâmetros da simulação', exact: true }).getByRole('combobox').evaluateAll(els => els.map(el => el.value));
    for (const v of ['tarifa_social', 'bifasico', 'Verde']) assert.ok(recuperados.includes(v), JSON.stringify(recuperados));
    resultados.push({ largura, idioma, caminho: url.pathname + url.search, caminhoSalvo, publico, resposta, recarga: true, transicao: true, ausenciaPreservada: true, avancadoPreservado: true, larguraPagina });
    console.log(JSON.stringify({ largura, idioma, transicao: true, ausenciaPreservada: true }));
    await ctx.close();
  }
  assert.deepEqual(erros, []);
} finally {
  await writeFile(join(saida, 'energia.json'), JSON.stringify({ commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), build: (await readFile('.next/BUILD_ID', 'utf8')).trim(), resultados, erros }, null, 2));
  await browser.close(); await servidor.encerrar();
}
