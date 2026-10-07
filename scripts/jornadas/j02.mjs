/* J2 · Consumidor (desktop 1440): localiza a própria distribuidora e compara perdas e qualidade.
   Roteiro por script: cada passo confere um fato lido da página (texto, URL, valor). */

const N = (s) => String(s ?? "").replace(/[  ]/g, " ").replace(/[ \t]+/g, " ").trim();
const CNPJ = "06981180000116";
const D = "(\\d[\\d.]*(?:,\\d+)?)"; // número em pt-BR, sem pontuação final

export default {
  id: "J2",
  titulo: "Consumidor: achar a distribuidora e comparar perdas e qualidade",
  perfil: "Consumidor residencial de Minas Gerais, desktop 1440",
  largura: 1440,
  movel: false,
  limite:
    "Roteiro por script confere os números e a consistência entre páginas; não mede se o consumidor reconhece sua distribuidora pelo nome nem se entende DEC e FEC.",
  async executar(j) {
    const p = j.p;
    let n = 0;
    const clicar = (l, o) => (n++, j.clicar(l, o));
    const agir = (f) => (n++, j.agir(f));
    const ficha = {};

    await j.passo("Abre a página inicial e digita CEMIG na busca", async () => {
      await p.goto(j.BASE + "/setor-eletrico");
      const busca = p.getByRole("searchbox", { name: /Busque por pergunta/ });
      await busca.waitFor({ state: "visible", timeout: 8000 });
      await agir(async () => {
        await busca.click();
        await busca.pressSequentially("CEMIG", { delay: 40 });
      });
      const itens = p.locator("ul.divide-y li a");
      await itens.first().waitFor({ state: "visible", timeout: 8000 });
      await j.esperar();
      const lista = await itens.evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.innerText.replace(/\s+/g, " ").trim()]));
      const achado = lista.find(([h]) => h === "/setor-eletrico/empresas/cemig-d");
      j.afirmar(achado, `a ficha da CEMIG-D não apareceu na busca: ${JSON.stringify(lista)}`);
      j.afirmar(/DISTRIBUIDORA/i.test(achado[1]) && /06\.981\.180\/0001-16/.test(achado[1]), `resultado sem tipo ou CNPJ: ${achado[1]}`);
      return `${lista.length} resultado(s): "${achado[1]}" (${achado[0]})`;
    });

    await j.passo("Abre a ficha da CEMIG-D e lê perdas, DEC, FEC e tarifa", async () => {
      await clicar(p.locator('ul.divide-y li a[href="/setor-eletrico/empresas/cemig-d"]').first());
      await p.waitForURL(/\/setor-eletrico\/empresas\/cemig-d/, { timeout: 10000 });
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
      const texto = N(await p.locator("main").innerText());
      const re = {
        perdas: new RegExp(`perdeu ${D}% da energia injetada`),
        dec: new RegExp(`o DEC foi de ${D} horas, (?:abaixo|acima) do limite de ${D}`),
        fec: new RegExp(`o FEC foi de ${D} interrupções, (?:abaixo|acima) do limite de ${D}`),
        tarifa: new RegExp(`é de R\\$ ${D}/MWh, sem tributos \\(([^)]+)\\)`),
      };
      const m = Object.fromEntries(Object.entries(re).map(([k, r]) => [k, texto.match(r)]));
      for (const [k, v] of Object.entries(m)) j.afirmar(v, `a ficha não traz ${k} na síntese`);
      ficha.perdas = m.perdas[1];
      ficha.dec = m.dec[1];
      ficha.decLimite = m.dec[2];
      ficha.fec = m.fec[1];
      ficha.fecLimite = m.fec[2];
      ficha.tarifa = m.tarifa[1];
      const kpi = N(await p.getByRole("group", { name: "Perdas totais" }).first().innerText()).replace(/\s+/g, " ");
      j.afirmar(kpi.includes(`${ficha.perdas}%`), `cartão de perdas diverge da síntese: ${kpi.slice(0, 80)}`);
      const prova = texto.match(/TAXA DE PERDAS TOTAIS, ([\d,]+)%/i)?.[1];
      const repetido = /%\s*%/.test(kpi);
      return `Síntese: perdas ${ficha.perdas}%, DEC ${ficha.dec} h (limite ${ficha.decLimite}), FEC ${ficha.fec} (limite ${ficha.fecLimite}), tarifa B1 R$ ${ficha.tarifa}/MWh. Cartão de perdas: "${kpi.slice(0, 45)}" (sinal % repetido: ${repetido ? "sim" : "não"}); botão "Comprove": ${prova}%`;
    });

    await j.passo("Lê como a ficha posiciona a distribuidora frente às pares", async () => {
      const texto = N(await p.locator("main").innerText());
      const perdas = texto.match(/ocupa a posição (\d+) de (\d+) em ordem crescente de taxa de perdas/);
      const dec = texto.match(/porte grande no ranking da ANEEL com DEC em 2025, a CEMIG-D ocupa a posição (\d+) de (\d+) em ordem crescente de DEC/);
      j.afirmar(perdas && dec, "a ficha não traz a posição entre as pares");
      ficha.posPerdas = `${perdas[1]} de ${perdas[2]}`;
      ficha.posDec = `${dec[1]} de ${dec[2]}`;
      const alvo = await p.getByRole("link", { name: /Como a CEMIG-D se compara com outras distribuidoras/ }).count();
      return `Perdas: posição ${ficha.posPerdas} entre as concessionárias (ordem crescente); DEC: posição ${ficha.posDec} entre as de porte grande; link para o comparador: ${alvo ? "sim" : "não"}`;
    });

    await j.passo("Procura na ficha o link para Perdas e Qualidade com a distribuidora já escolhida", async () => {
      const hrefPerdas = `/setor-eletrico/perdas?d=${CNPJ}`;
      const hrefQual = `/setor-eletrico/qualidade?dist=${CNPJ}`;
      const noHtml = (await p.locator(`a[href="${hrefPerdas}"]`).count()) + (await p.locator(`a[href="${hrefQual}"]`).count());
      j.afirmar(noHtml >= 2, "a ficha não traz os links para Perdas e Qualidade nem no HTML");
      const link = p.getByRole("link", { name: /Perdas, com o mapa por conjunto e município/ }).first();
      const visivelEntender = await link.isVisible();
      const visiveisEntender = await p.locator("main a").evaluateAll((es) => es.filter((e) => e.getBoundingClientRect().width > 0 && /\/setor-eletrico\/(perdas|qualidade|conta-de-luz)/.test(e.getAttribute("href") ?? "")).length);
      if (!visivelEntender) {
        await clicar(p.getByRole("radiogroup", { name: "Nível de profundidade" }).getByRole("radio", { name: "Auditar" }));
        await p.waitForURL(/modo=auditar/, { timeout: 8000 });
        await link.waitFor({ state: "visible", timeout: 8000 });
      }
      const rotulos = await p.locator(`a[href="${hrefPerdas}"], a[href="${hrefQual}"]`).evaluateAll((es) => es.map((e) => e.innerText.trim()));
      return `No nível Entender (padrão) o link para Perdas ${visivelEntender ? "está visível" : "não está visível"} (links visíveis para Perdas, Qualidade ou Conta de luz: ${visiveisEntender}); ${visivelEntender ? "" : 'ficou visível ao trocar a profundidade para Auditar; '}rótulos: ${rotulos.join(" | ")}`;
    });

    await j.passo("Abre Perdas pelo link da ficha e confere a distribuidora e o número", async () => {
      await clicar(p.getByRole("link", { name: /Perdas, com o mapa por conjunto e município/ }).first());
      await p.waitForURL(new RegExp(`/setor-eletrico/perdas\\?d=${CNPJ}`), { timeout: 10000 });
      const bloco = p.getByText(/CEMIG-D \(concessionária, MG\): em 2025, perdas totais de/);
      await bloco.first().waitFor({ state: "attached", timeout: 15000 });
      await bloco.first().scrollIntoViewIfNeeded();
      const frase = N(await bloco.first().innerText());
      const taxa = frase.match(new RegExp(`, ${D}% da energia injetada de referência`))?.[1];
      j.afirmar(taxa, `taxa não encontrada em: ${frase}`);
      j.afirmar(taxa === ficha.perdas, `Perdas mostra ${taxa}% e a ficha ${ficha.perdas}%`);
      const consulta = N(await p.locator("main").innerText());
      j.afirmar(/Distribuidora:\s*CEMIG-D/.test(consulta), 'o resumo da consulta não diz "Distribuidora: CEMIG-D"');
      return `URL ${j.url()}; "${frase.slice(0, 170)}"; consulta com "Distribuidora: CEMIG-D"; ${taxa}% = ficha ${ficha.perdas}%`;
    });

    await j.passo("Procura a CEMIG-D na tabela de Perdas e lê a classe e a variação", async () => {
      const busca = p.locator("input[type=search]").first();
      await busca.scrollIntoViewIfNeeded();
      await agir(async () => busca.fill("CEMIG"));
      await j.esperar(700);
      const tabela = p.locator("table", { hasText: "Taxa de perdas totais (%)" }).first();
      const cab = await tabela.locator("thead th").evaluateAll((es) => es.map((e) => e.innerText.replace(/\s+/g, " ").replace(/[↕▲▼]/g, "").trim()));
      const linhas = await tabela.locator("tbody tr").evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll("td,th")].map((c) => c.innerText.trim())));
      j.afirmar(linhas.length === 1, `esperava 1 linha para CEMIG, vieram ${linhas.length}`);
      const col = (nome) => linhas[0][cab.findIndex((c) => c.startsWith(nome))];
      const taxa = col("Taxa de perdas totais (%)");
      j.afirmar(taxa === ficha.perdas, `tabela mostra ${taxa} e a ficha ${ficha.perdas}`);
      const total = N(await p.getByText(/\d+ de \d+ linhas/).first().innerText());
      const texto = N(await p.locator("main").innerText());
      const faixa = texto.match(/a taxa de perdas totais vai de ([\d,]+)% \((\S+)\) a ([\d,]+)% \(([^)]+)\)/);
      const temPosicao = /posição \d+ de \d+/i.test(texto);
      return `Linha CEMIG-D: taxa ${taxa}%, classe "${col("Classe no mapa")}", variação ${col("Variação da taxa")} p.p., ${col("Comparação")}. Contexto: ${faixa ? `faixa de ${faixa[1]}% (${faixa[2]}) a ${faixa[3]}% (${faixa[4]})` : "sem faixa escrita"}; posição ordinal escrita na página: ${temPosicao ? "sim" : "não"}; contagem "${total}"`;
    });

    await j.passo("Volta à ficha e abre Qualidade pelo link da ficha", async () => {
      await agir(async () => p.goBack());
      await p.waitForURL(/\/setor-eletrico\/empresas\/cemig-d/, { timeout: 10000 });
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
      await clicar(p.getByRole("link", { name: /Qualidade do serviço, com os conjuntos elétricos/ }).first());
      await p.waitForURL(new RegExp(`/setor-eletrico/qualidade\\?dist=${CNPJ}`), { timeout: 10000 });
      const frase = p.getByText(/CEMIG-D: DEC acima do limite em \d+ de \d+ anos/).first();
      await frase.waitFor({ state: "attached", timeout: 15000 });
      const t = N(await frase.innerText());
      const m = t.match(new RegExp(`Em 2025: ${D} h para um limite de ${D} h`));
      j.afirmar(m, `frase sem valores de 2025: ${t}`);
      j.afirmar(m[1] === ficha.dec && m[2] === ficha.decLimite, `Qualidade: DEC ${m[1]} e limite ${m[2]}; ficha: ${ficha.dec} e ${ficha.decLimite}`);
      return `URL ${j.url()}; "${t.slice(0, 190)}"; DEC ${m[1]} h e limite ${m[2]} h iguais aos da ficha`;
    });

    await j.passo("Troca o indicador do gráfico para FEC e confere o número", async () => {
      const grupo = p.getByRole("radiogroup", { name: "Indicador do gráfico" });
      await grupo.scrollIntoViewIfNeeded();
      await clicar(grupo.getByText("FEC", { exact: true }));
      await p.waitForURL(/ind=fec/, { timeout: 8000 });
      const frase = p.getByText(/CEMIG-D: FEC acima do limite em \d+ de \d+ anos/).first();
      await frase.waitFor({ state: "attached", timeout: 8000 });
      const t = N(await frase.innerText());
      const m = t.match(new RegExp(`Em 2025: ${D} interrupções para um limite de ${D} interrupções`));
      j.afirmar(m, `frase sem valores de 2025: ${t}`);
      j.afirmar(m[1] === ficha.fec && m[2] === ficha.fecLimite, `Qualidade: FEC ${m[1]} e limite ${m[2]}; ficha: ${ficha.fec} e ${ficha.fecLimite}`);
      return `URL ${j.url()}; "${t.slice(0, 190)}"; FEC ${m[1]} e limite ${m[2]} iguais aos da ficha`;
    });

    await j.passo("Abre a tabela de Qualidade, busca a CEMIG-D e lê limite, razão e posição no ranking", async () => {
      const abrir = p.getByRole("button", { name: /Abrir: Realizado, limite e DGC por distribuidora/ });
      await abrir.scrollIntoViewIfNeeded();
      await clicar(abrir);
      const tabela = p.locator("table", { hasText: "DGC calculado" }).first();
      await tabela.waitFor({ state: "visible", timeout: 15000 });
      const busca = p.getByPlaceholder(/Sigla ou CNPJ/);
      await agir(async () => busca.fill("CEMIG"));
      await j.esperar(700);
      const cab = await tabela.locator("thead th").evaluateAll((es) => es.map((e) => e.innerText.replace(/\s+/g, " ").replace(/[↕▲▼]/g, "").trim()));
      const linhas = await tabela.locator("tbody tr").evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll("td,th")].map((c) => c.innerText.trim())));
      j.afirmar(linhas.length === 1, `esperava 1 linha para CEMIG, vieram ${linhas.length}`);
      const col = (nome) => linhas[0][cab.findIndex((c) => c === nome)];
      j.afirmar(col("DEC apurado (h)") === ficha.dec && col("Limite de DEC (h)") === ficha.decLimite, `tabela: DEC ${col("DEC apurado (h)")}/${col("Limite de DEC (h)")}, ficha ${ficha.dec}/${ficha.decLimite}`);
      j.afirmar(col("FEC apurado (interrupções)") === ficha.fec, `tabela: FEC ${col("FEC apurado (interrupções)")}, ficha ${ficha.fec}`);
      return `Linha CEMIG-D: ${col("Situação")}; DEC ${col("DEC apurado (h)")} h para limite ${col("Limite de DEC (h)")} (razão ${col("DEC ÷ limite")}); FEC ${col("FEC apurado (interrupções)")} para limite ${col("Limite de FEC (interrupções)")} (razão ${col("FEC ÷ limite")}); DGC no ranking ${col("DGC no ranking da ANEEL")}, posição ${col("Posição no ranking")}, porte ${col("Porte no ranking")}`;
    });

    await j.passo("Reabre a ficha e segue o link para o comparador de distribuidoras", async () => {
      await p.goto(j.BASE + "/setor-eletrico/empresas/cemig-d");
      const link = p.getByRole("link", { name: /Como a CEMIG-D se compara com outras distribuidoras/ });
      await link.scrollIntoViewIfNeeded();
      await clicar(link);
      await p.waitForURL(/\/setor-eletrico\/empresas\/distribuidoras\?dist\.cmp=cemig-d/, { timeout: 10000 });
      const texto = p.getByText(/Escolha até 4 para ver lado a lado/);
      await texto.first().waitFor({ state: "attached", timeout: 15000 });
      await texto.first().scrollIntoViewIfNeeded();
      const t = N(await p.locator("main").innerText());
      const ref = t.match(/Brasil, (\d+) concessionárias com os 12 meses de 2025 e sem alerta: ([\d,]+)%/);
      j.afirmar(ref, "o comparador não traz a referência nacional de perdas");
      const sel = t.match(/(\d) de 4 selecionadas?/)?.[0];
      j.afirmar(/CEMIG-D/.test(t.slice(t.indexOf("DISTRIBUIDORAS COMPARADAS"))) && sel, "o comparador não abriu com a CEMIG-D selecionada");
      return `URL ${j.url()}; comparador com a CEMIG-D já escolhida (${sel}); referência nacional de perdas: ${ref[2]}% (${ref[1]} concessionárias)`;
    });

    await j.passo("Adiciona a COPEL-DIS ao comparador e lê perdas, tarifa, DEC e FEC lado a lado", async () => {
      const campo = p.locator('input[role="combobox"]').last();
      await campo.scrollIntoViewIfNeeded();
      await agir(async () => {
        await campo.click();
        await campo.pressSequentially("COPEL", { delay: 40 });
      });
      await clicar(p.getByRole("option", { name: /COPEL-DIS/ }).first());
      await p.getByText(/2 de 4 selecionadas/).first().waitFor({ state: "attached", timeout: 8000 });
      await j.esperar(600);
      const t = N(await p.locator("main").innerText());
      const recorte = t.slice(t.indexOf("Comparando CEMIG-D, COPEL-DIS"));
      j.afirmar(recorte.length > 100, "o comparador não passou a comparar CEMIG-D e COPEL-DIS");
      const esc = (v) => v.replace(/\./g, "\\.");
      const perdas = recorte.match(new RegExp(`${esc(ficha.perdas)}\\s+CEMIG-D\\s+([\\d,]+)\\s+COPEL-DIS`));
      const tarifa = recorte.match(new RegExp(`${esc(ficha.tarifa)}\\s+CEMIG-D\\s+([\\d.]+,\\d+)\\s+COPEL-DIS`));
      const difs = [...recorte.matchAll(/CEMIG-D\s+([−-][\d,]+) (h|interrupções)\s+COPEL-DIS\s+([−-][\d,]+) \2/g)];
      j.afirmar(perdas, "perdas lado a lado não encontradas");
      j.afirmar(tarifa, `tarifa da CEMIG-D (${ficha.tarifa}) não aparece lado a lado com a da COPEL-DIS`);
      j.afirmar(difs.length === 2, `esperava duas diferenças (DEC e FEC), vieram ${difs.length}`);
      return `Perdas CEMIG-D ${ficha.perdas}% contra COPEL-DIS ${perdas[1]}%; tarifa B1 R$ ${ficha.tarifa} contra R$ ${tarifa[1]}/MWh; DEC menos limite: ${difs[0][1]} h contra ${difs[0][3]} h; FEC menos limite: ${difs[1][1]} contra ${difs[1][3]} interrupções`;
    });
  },
};
