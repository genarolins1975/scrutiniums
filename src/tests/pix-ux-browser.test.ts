import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

const gold = JSON.parse(readFileSync("public/obs/data/gold/pix.json", "utf8"));
let servidor: ServidorProducao;
let navegador: Browser;
let contexto: BrowserContext;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("pix-ux");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
  contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

describe.skipIf(!temBuild && !exigirBuild)("Pix: leitura equivalente e recorte persistente", () => {
  it("tabela e CSV preservam todos os fluxos e os valores da fonte", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/pix");
      await page.locator("#px-fluxos-tabela summary").click();
      const linhas = await page.locator("#px-fluxos-tabela tbody tr").allTextContents();
      expect(linhas).toHaveLength(gold.natureza.atual.length);
      for (const [i, x] of gold.natureza.atual.entries()) {
        expect(linhas[i]).toContain(x.q.toLocaleString("pt-BR"));
        expect(linhas[i]).toContain(x.v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        expect(linhas[i]).toContain(x.t.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
      const download = page.waitForEvent("download");
      await page.locator('#px-fluxos-tabela button').click();
      const arquivo = await (await download).path();
      const rows = readFileSync(arquivo!, "utf8").trim().split("\n").slice(1).map(l => l.split(";"));
      expect(rows).toHaveLength(gold.natureza.atual.length);
      for (const [i, x] of gold.natureza.atual.entries()) {
        expect(rows[i].slice(0, 2)).toEqual([gold.mes_tx, x.k]);
        expect(rows[i].slice(2).map(v => Number(v.replace(",", ".")))).toEqual([x.q, x.v, x.t]);
      }
    } finally { await page.close(); }
  }, 60_000);

  it("alternância por teclado mantém foco, tabela aberta e recorte após recarregar/voltar", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/pix");
      await page.locator("#px-fluxos-tabela summary").click();
      const valor = page.locator('#px-natureza button[onclick="pxSet(\'hmnat\',\'v\')"]');
      await valor.focus(); await page.keyboard.press("Enter");
      await page.waitForURL(/xhmnat=v/);
      expect(await valor.getAttribute("aria-pressed")).toBe("true");
      expect(await valor.evaluate(e => e === document.activeElement)).toBe(true);
      expect(await page.locator("#px-fluxos-tabela").getAttribute("open")).not.toBeNull();
      const recorte = page.url();
      await page.reload();
      await page.locator(".px-heatmap").waitFor();
      expect(await valor.getAttribute("aria-pressed")).toBe("true");
      await page.goto(servidor.origem + "/observatorio/credit");
      await page.goBack();
      await page.locator(".px-heatmap").waitFor();
      expect(page.url()).toBe(recorte);
      expect(await valor.getAttribute("aria-pressed")).toBe("true");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await page.close(); }
  }, 60_000);
  it("gráficos de série do Pulso cabem no celular com eixos legíveis", async () => {
    const page = await contexto.newPage();
    try {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(servidor.origem + "/observatorio/credit");
      await page.locator("#view-pulse .line-chart").first().waitFor();
      await expect.poll(() => page.evaluate(() => [...document.querySelectorAll("#view-pulse .line-chart")].every(e => Math.abs(e.getBoundingClientRect().width - Number((e as HTMLElement).dataset.lineWidth)) < 2))).toBe(true);
      const textos = await page.locator("#view-pulse .line-chart svg text").evaluateAll(nodes => nodes.map(e => {
        const r = e.getBoundingClientRect(), svg = e.closest("svg")!.getBoundingClientRect();
        return { text: e.textContent, width: r.width, inside: r.left >= svg.left - 1 && r.right <= svg.right + 1, size: parseFloat(getComputedStyle(e).fontSize) * svg.width / e.closest("svg")!.viewBox.baseVal.width };
      }).filter(r => r.width > 0));
      expect(textos.length).toBeGreaterThan(20);
      expect(textos.filter(r => !r.inside || r.size < 11.9)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await page.close(); }
  }, 60_000);
  it("comparação trimestral exporta cada período e instrumento do recorte selecionado", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/pix");
      await page.locator('#px-evol button[onclick="pxSet(\'metr\',\'v\')"]').click();
      await page.locator('#px-versus button[onclick="pxToggleInst(\'Boleto\')"]').click();
      const selecionados = ["Pix", "CartaoCredito", "CartaoDebito", "TED"];
      const periodos = gold.tri.periodos.filter((p: string) => p >= "2019");
      await page.locator(".px-comparacao-tabela summary").click();
      const linhas = await page.locator(".px-comparacao-tabela tbody tr").allTextContents();
      expect(linhas).toHaveLength(periodos.length);
      const download = page.waitForEvent("download");
      await page.locator(".px-comparacao-tabela button").click();
      const arquivo = await (await download).path();
      const csv = readFileSync(arquivo!, "utf8").trim().split("\n");
      expect(csv).toHaveLength(periodos.length + 1);
      expect(csv[0]).not.toContain("Boleto");
      const ordem = Object.keys(gold.tri.nomes).filter(i => selecionados.includes(i));
      for (const [i, p] of periodos.entries()) {
        const valores: number[] = ordem.map(k => gold.tri.dados[p]?.[k]?.v || 0);
        const total = valores.reduce((s, n) => s + n, 0);
        const esperados = valores.map(n => total ? Number((n / total * 100).toFixed(1)) : null);
        const campos = csv[i + 1].split(";");
        expect(campos[0]).toBe(p.slice(0, 7));
        expect(campos.slice(1).map(v => v === "" ? null : Number(v.replace(",", ".")))).toEqual(esperados);
        for (const valor of esperados) if (valor !== null) expect(linhas[i]).toContain(valor.toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1}) + "%");
      }
    } finally { await page.close(); }
  }, 60_000);
  it("filtros do Crédito e do Consignado preservam foco e referência após atualização", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/credit");
      const pf = page.locator('#view-pulse button[onclick="setFilter(\'seg\',\'pf\')"]').first();
      await pf.focus(); await page.keyboard.press("Enter");
      await page.waitForURL(/seg=pf/);
      expect(await pf.evaluate(e => e === document.activeElement)).toBe(true);
      await page.goto(servidor.origem + "/observatorio/payroll-lending-aging");
      const regiao = page.locator('#cg-mapa select');
      await regiao.focus(); await regiao.selectOption("Norte");
      await page.waitForURL(/cgregiao=Norte/);
      expect(await regiao.evaluate(e => e === document.activeElement)).toBe(true);
      await page.reload();
      expect(await regiao.inputValue()).toBe("Norte");
      const cabecalhos = await page.locator('#cg-expo .charttable thead').allTextContents();
      expect(cabecalhos.join(" ")).toContain("Servidores públicos");
      expect(cabecalhos.join(" ")).not.toContain("Série 1");
      await page.goto(servidor.origem + "/observatorio/payroll-lending-aging?cgcam=invalida&cgregiao=invalida&cgconf=invalida");
      expect(await regiao.inputValue()).toBe("todas");
      expect(await page.locator('#cg-mapa button[onclick="cgFiltra(\'cam\',\'p60\')"]').getAttribute('class')).not.toContain('ghost');
    } finally { await page.close(); }
  }, 60_000);

  it("cada tabela mantém seu próprio estado e o foco ao redimensionar", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/pix");
      const med = page.locator('#px-med .line-chart details.charttable');
      await med.first().waitFor({state: "attached"});
      expect(await med.count()).toBe(2);
      await med.nth(1).locator('summary').click();
      const evol = page.locator('#px-evol details.charttable');
      await evol.locator('summary').click();
      await page.locator('#px-evol button[onclick="pxSet(\'metr\',\'v\')"]').click();
      expect(await med.nth(0).getAttribute('open')).toBeNull();
      expect(await med.nth(1).getAttribute('open')).not.toBeNull();
      expect(await evol.getAttribute('open')).not.toBeNull();
      await evol.locator('summary').focus();
      await page.setViewportSize({width: 768, height: 900});
      await expect.poll(() => evol.locator('summary').evaluate(e => e === document.activeElement)).toBe(true);
      expect(await evol.getAttribute('open')).not.toBeNull();
    } finally { await page.close(); }
  }, 60_000);

  it("voltar e avançar entre URLs Pix reidrata os padrões quando o parâmetro está ausente", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/pix");
      const boleto = page.locator('#px-versus button[onclick="pxToggleInst(\'Boleto\')"]');
      await boleto.waitFor();
      // Entradas na mesma sessão SPA: goto isoladamente mascararia estado herdado.
      await page.evaluate(() => { history.pushState({}, '', '/observatorio/pix?xinsts=Pix&xsetorTE=Comercio'); dispatchEvent(new PopStateEvent('popstate')); });
      await expect.poll(() => boleto.getAttribute('aria-pressed')).toBe('false');
      await page.goBack();
      await expect.poll(() => boleto.getAttribute('aria-pressed')).toBe('true');
      await page.goForward();
      await expect.poll(() => boleto.getAttribute('aria-pressed')).toBe('false');
    } finally { await page.close(); }
  }, 60_000);

  it("credores e grupo de instituições mantêm foco e recorte compartilhável", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/subnational-credit");
      const janela = page.getByRole('combobox', {name: 'janela dos credores'});
      await janela.focus(); await janela.selectOption('60m');
      await page.waitForURL(/sncred=60m/);
      expect(await janela.evaluate(e => e === document.activeElement)).toBe(true);
      await page.reload(); expect(await janela.inputValue()).toBe('60m');
      await page.goto(servidor.origem + "/observatorio/institutions");
      const grupo = page.locator("select[onchange*=instGroup]");
      await grupo.focus();
      const valor = await grupo.locator('option').last().getAttribute('value');
      await grupo.selectOption(valor!);
      expect(await grupo.evaluate(e => e === document.activeElement)).toBe(true);
      await page.reload(); expect(await grupo.inputValue()).toBe(valor);
    } finally { await page.close(); }
  }, 60_000);

  it("todos os textos SVG de Setores e Consignado respeitam o piso nas quatro larguras", async () => {
    const page = await contexto.newPage();
    try {
      for (const width of [320, 390, 768, 1440]) for (const rota of ['sectors', 'payroll-lending-aging']) {
        await page.setViewportSize({width, height: 900});
        await page.goto(servidor.origem + '/observatorio/' + rota);
        await page.locator(rota === 'sectors' ? '#view-sectors svg text' : '#cg-expo .line-chart svg text').first().waitFor();
        await expect.poll(() => page.locator('section.view.active svg text').evaluateAll(nodes => nodes.map(e => {
          const m = (e as SVGGraphicsElement).getScreenCTM();
          const tamanho = m ? parseFloat(getComputedStyle(e).fontSize) * Math.hypot(m.a, m.b) : 0;
          return {texto: e.textContent, tamanho, visivel: e.getBoundingClientRect().width > 0};
        }).filter(t => t.visivel && t.tamanho < 11.9)), {message: rota + ' / ' + width}).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
    } finally { await page.close(); }
  }, 90_000);
  it("CSV do Pulso equivale à figura e à tabela nos quatro modos, com bandas e recorte", async () => {
    const page = await contexto.newPage();
    const fonte = JSON.parse(readFileSync('public/obs/data/gold/pulse.json', 'utf8'));
    try {
      for (const modo of ['nivel', 'yoy', 'b100', 'real']) {
        await page.goto(servidor.origem + '/observatorio/credit?range=24&transf=' + modo);
        const card = page.locator('#pu-saldo');
        await card.locator('svg[data-chart]').waitFor();
        const dados = await card.locator('svg[data-chart]').evaluate(e => JSON.parse(decodeURIComponent(e.getAttribute('data-chart')!)));
        const linhas = await card.locator('.line-chart tbody tr').evaluateAll(rows => rows.map(r => [...r.children].map(c => c.textContent!.trim())));
        expect(linhas.length).toBe(dados.xs.length);
        expect(dados.series[0].vals.filter((v: number | null) => v !== null)).toHaveLength(24);
        if (modo === 'nivel') {
          expect(dados.unit).toBe('R$ bilhões');
          expect(dados.series[0].vals.slice(0, 24)).toEqual(fonte.series.saldo_total.obs.slice(-24).map((o: {v: number}) => o.v / 1000));
          expect(dados.band).not.toBeNull();
          expect(dados.series[1].label).toContain('previsão');
        } else {
          expect(dados.band).toBeNull();
          expect(dados.status).toBe('calculado');
          if (modo === 'b100') expect(dados.series[0].vals[0]).toBe(100);
        }
        const caption = await card.locator('caption').textContent();
        expect(caption).toContain(dados.unit);
        expect(caption).toContain(dados.status);
        const download = page.waitForEvent('download');
        await card.getByRole('button', {name: 'baixar CSV do gráfico', exact: true}).click();
        const file = await (await download).path();
        const csv = readFileSync(file!, 'utf8').trim().split('\n');
        expect(csv.join('\n')).toContain('# Unidade: ' + dados.unit);
        expect(csv.join('\n')).toContain('# Natureza: ' + dados.status);
        const registros = csv.filter(l => !l.replace(/^\uFEFF/, '').startsWith('#'));
        const campos = registros.map(l => l.split(';').map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"')));
        expect(campos[0]).toHaveLength(linhas[0].length);
        if (modo === 'nivel') expect(campos[0].slice(-2).join(' ')).toContain('previsão p10');
        expect(campos.slice(1)).toHaveLength(linhas.length);
        for (const [i, row] of campos.slice(1).entries()) {
          expect(row[0]).toBe(dados.xs[i]);
          expect(row.slice(1)).toEqual(linhas[i].slice(1).map(v => v === '–' ? '' : v.replace(/\./g, '')));
        }
        await page.reload();
        expect(await page.locator(`#view-pulse button[onclick="setFilter('transf','${modo}')"]`).getAttribute('class')).toContain('active');
      }
      // Contexto macro também respeita a janela, sem exportar toda a base silenciosamente.
      const extra = page.locator('#pu-selic_meta');
      const dadosExtra = await extra.locator('svg[data-chart]').evaluate(e => JSON.parse(decodeURIComponent(e.getAttribute('data-chart')!)));
      const downloadExtra = page.waitForEvent('download');
      await extra.getByRole('button', {name: 'baixar CSV do gráfico', exact: true}).click();
      const arquivoExtra = await (await downloadExtra).path();
      const exportado = readFileSync(arquivoExtra!, 'utf8').trim().split('\n').filter(l => !l.replace(/^\uFEFF/, '').startsWith('#'));
      expect(exportado.length - 1).toBe(24);
      expect(dadosExtra.xs).toHaveLength(24);
      expect(await extra.getByText('Base observada completa', {exact: true}).count()).toBe(1);
    } finally { await page.close(); }
  }, 120_000);

  it("matriz setorial identifica todos os eixos sem hover em celular e desktop", async () => {
    const page = await contexto.newPage();
    try {
      for (const width of [320, 1440]) {
        await page.setViewportSize({width, height: 900});
        await page.goto(servidor.origem + '/observatorio/pix');
        const legenda = page.locator('.px-setor-legenda');
        if (width === 320) await expect.poll(() => page.locator('#view-pix .subnav-caps').evaluate(e => getComputedStyle(e).position)).toBe('static');
        await legenda.waitFor();
        const itens = await legenda.locator('li').allTextContents();
        expect(itens.length).toBeGreaterThan(10);
        expect(itens.join(' ')).toContain('Administração pública');
        expect(itens.join(' ')).toContain('Construção');
        expect(itens.join(' ')).toContain('Saúde humana');
        expect(await page.locator('#px-epae th').filter({hasText: 'Pagador ↓'}).evaluate(e => e.getBoundingClientRect().width)).toBeLessThanOrEqual(113);
        const labels = await page.locator('#px-epae th[aria-label]').evaluateAll(nodes => nodes.map(e => ({nome: e.getAttribute('aria-label')!, id: e.textContent!.trim().slice(0, 2)})));
        expect(labels.length).toBeGreaterThan(10);
        for (const label of labels) {
          const nome = label.nome.slice(label.nome.indexOf(' — ') + 3);
          expect(itens.some(item => item.startsWith(label.id + ' ') && item.endsWith(nome))).toBe(true);
          expect(nome).not.toContain('…');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
    } finally { await page.close(); }
  }, 60_000);

  it("cinco municípios preservam comparação tabular e rolagem por teclado no celular", async () => {
    const page = await contexto.newPage();
    try {
      for (const width of [320, 390]) {
        await page.setViewportSize({width, height: 900});
        await page.goto(servidor.origem + '/observatorio/payroll-lending-aging');
        for (let i = 0; i < 5; i++) await page.locator('#cg-mapa .penlista button').nth(i).click();
        const regiao = page.getByRole('region', {name: 'Comparação de indicadores dos municípios selecionados'});
        const tabela = regiao.locator('table');
        expect(await tabela.locator('thead th').count()).toBe(7);
        expect(await tabela.locator('thead th').last().textContent()).toBe('Natureza do dado');
        expect(await tabela.getAttribute('class')).not.toContain('t-stack');
        expect(await tabela.locator('tbody tr').first().locator('td').first().evaluate(e => {
          const r = e.getBoundingClientRect(), area = e.closest('.tblwrap')!.getBoundingClientRect();
          return r.right <= area.right + 1;
        })).toBe(true);
        const antes = await tabela.locator('tbody tr').allTextContents();
        expect(antes.length).toBeGreaterThan(10);
        await regiao.focus();
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => regiao.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
        expect(await regiao.evaluate(e => e === document.activeElement)).toBe(true);
        expect(await tabela.locator('tbody tr').allTextContents()).toEqual(antes);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
    } finally { await page.close(); }
  }, 60_000);

  it("âncoras de Pix e Subnacional chegam descobertas nas quatro larguras", async () => {
    const page = await contexto.newPage();
    await page.emulateMedia({reducedMotion: 'reduce'});
    try {
      for (const width of [320, 390, 768, 1440]) for (const [rota, alvo] of [['pix', 'px-epae'], ['subnational-credit', 'sn-divida']]) {
        await page.setViewportSize({width, height: 900});
        await page.goto(servidor.origem + '/observatorio/' + rota);
        await page.locator(`.view.active .subnav-caps a[href="#${alvo}"]`).click();
        await expect.poll(() => page.locator('#' + alvo).evaluate(e => {
          const heading = e.querySelector('h3')!.getBoundingClientRect();
          const nav = e.closest('section.view')!.querySelector('.subnav-caps')!;
          const fim = getComputedStyle(nav).position === 'sticky' ? nav.getBoundingClientRect().bottom : 0;
          return heading.top >= fim && heading.top < innerHeight;
        }), {message: rota + ' / ' + width}).toBe(true);
      }
      await page.goto(servidor.origem + '/observatorio/pix?sec=px-epae');
      await expect.poll(() => page.locator('#px-epae h3').evaluate(e => { const top = e.getBoundingClientRect().top; return top > 72 && top < innerHeight; })).toBe(true);
    } finally { await page.close(); }
  }, 90_000);

});
