/* J5 · Professor (desktop 1440): encontra conceito, exemplo e gráfico real adequados para explicar em aula.
   Roteiro por script: cada passo confere um fato lido da página (texto, URL, número, tabela). */

const N = (s) => String(s ?? "").replace(/[  ]/g, " ").replace(/[ \t]+/g, " ").trim();
const D = "(\\d[\\d.]*(?:,\\d+)?)"; // número em pt-BR, sem pontuação final

export default {
  id: "J5",
  titulo: "Professor: levar um conceito de água e um de preço, com exemplo real e gráfico, para a sala",
  perfil: "Professor de engenharia ou economia, desktop 1440",
  largura: 1440,
  movel: false,
  limite:
    "Roteiro por script confere que exemplo, gráfico, tabela, unidade, fonte e caminho de volta existem e batem entre si; não avalia se o material serve didaticamente nem se o gráfico fica legível projetado.",
  async executar(j) {
    const p = j.p;
    // a página vem do servidor com blocos de níveis mais profundos visíveis e só os esconde depois de hidratar:
    // espera a rede assentar antes de ler visibilidade ou de clicar
    const assentar = async () => {
      await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await j.esperar(400);
    };
    const ir = async (url) => {
      await p.goto(url);
      await assentar();
    };
    let n = 0;
    const clicar = (l, o) => (n++, j.clicar(l, o));
    const agir = (f) => (n++, j.agir(f));
    const ear = {};
    const preco = {};

    /** nome acessível de um gráfico: aria-label ou o título apontado por aria-labelledby */
    const nomesDosGraficos = (escopo) =>
      escopo.locator("svg[role=img]").evaluateAll((es) =>
        es
          .map((e) => e.getAttribute("aria-label") || document.getElementById(e.getAttribute("aria-labelledby") ?? "")?.textContent || "")
          .map((t) => t.replace(/\s+/g, " ").trim())
          .filter(Boolean),
      );

    await j.passo("Abre a página Aprenda e localiza os verbetes de água e de preço", async () => {
      await ir(j.BASE + "/setor-eletrico/aprenda");
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible", timeout: 10000 });
      const h1 = N(await p.getByRole("heading", { level: 1 }).first().innerText());
      const texto = N(await p.locator("main").innerText());
      const parcial = texto.match(/(\d+) de (\d+) verbetes estão conferidos na fonte primária/);
      const todos = texto.match(/Os (\d+) verbetes estão conferidos na fonte primária/);
      j.afirmar(parcial || todos, "a página não diz quantos verbetes estão conferidos");
      const conferidos = parcial ?? [null, todos[1], todos[1]];
      const earLink = await p.locator('main a[href="/setor-eletrico/aprenda/ear"]').count();
      const pldLink = await p.locator('main a[href="/setor-eletrico/aprenda/pld"]').count();
      const trilha = await p.locator('main a[href="/setor-eletrico/aprenda/trilhas/agua-operacao-preco"]').count();
      j.afirmar(earLink && pldLink && trilha, `faltam cartões na página Aprenda (EAR ${earLink}, PLD ${pldLink}, trilha ${trilha})`);
      const cartoes = await p.locator('main a[href^="/setor-eletrico/aprenda/"]').evaluateAll((es) => es.filter((e) => !/\/trilhas/.test(e.getAttribute("href"))).length);
      return `h1 "${h1}"; ${conferidos[1]} de ${conferidos[2]} verbetes conferidos na fonte primária; ${cartoes} cartões de verbete; cartões EAR, PLD e a trilha "Água, operação e preço" presentes`;
    });

    await j.passo("Abre o verbete EAR e lê a definição, o exemplo real com data e número e a natureza do dado", async () => {
      await clicar(p.locator('main a[href="/setor-eletrico/aprenda/ear"]').first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/ear/, { timeout: 10000 });
      await assentar();
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
      const texto = N(await p.locator("main").innerText());
      const frase = texto.match(/EM UMA FRASE\s*([^\n]+)/i)?.[1] ?? "";
      const ex = texto.match(new RegExp(`Em (\\d{2}/\\d{2}/\\d{4}), os reservatórios do Sudeste/Centro-Oeste estavam com ${D}% da EAR máxima`));
      const mediana = texto.match(new RegExp(`a mediana para a data, nos anos completos desde 2001, é ${D}%`))?.[1];
      const natureza = /NATUREZA DO DADO:\s*OBSERVADO/i.test(texto);
      const unidade = texto.match(/UNIDADE\s*([^\n]+)/i)?.[1];
      j.afirmar(/Energia associada ao volume de água/i.test(frase), "definição em uma frase ausente");
      j.afirmar(ex, "o exemplo real não traz data e percentual");
      j.afirmar(mediana && natureza && unidade, "faltam mediana, natureza do dado ou unidade no exemplo");
      Object.assign(ear, { data: ex[1], valor: ex[2], mediana });
      return `Em uma frase: "${frase.slice(0, 80)}..."; exemplo real: ${ex[1]}, Sudeste/Centro-Oeste com ${ex[2]}% da EAR máxima (observado), mediana da data ${mediana}%; unidade: ${unidade}`;
    });

    await j.passo('Segue "ver no painel" do exemplo da EAR e confere gráfico, tabela, unidade e botão de retorno', async () => {
      await clicar(p.getByRole("link", { name: /ver no painel/i }).first());
      await p.waitForURL(/\/setor-eletrico\/agua-e-clima/, { timeout: 10000 });
      await assentar();
      const voltar = p.getByRole("link", { name: /Voltar ao verbete EAR/ });
      await voltar.first().waitFor({ state: "visible", timeout: 10000 });
      await p.getByRole("heading", { name: "Quanta energia está armazenada?", level: 2 }).waitFor({ state: "attached", timeout: 10000 });
      const painel = p.locator("section", { has: p.getByRole("heading", { name: "Quanta energia está armazenada?", level: 2 }) }).first();
      const graficos = await nomesDosGraficos(painel);
      j.afirmar(graficos.length > 0, "o painel de destino não tem gráfico com nome acessível (svg role=img)");
      const resumo = painel.locator("summary:visible", { hasText: /Dados do gráfico em tabela/i }).first();
      await resumo.scrollIntoViewIfNeeded();
      await clicar(resumo);
      await resumo.locator("xpath=..").locator("tbody tr").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
      const linhasTabela = await resumo.locator("xpath=..").locator("tbody tr").count();
      j.afirmar(linhasTabela > 0, "a tabela equivalente do gráfico está vazia");
      const texto = N(await painel.innerText());
      const unidade = texto.match(/UNIDADE\s*([^\n]+)/i)?.[1];
      j.afirmar(unidade && /MWmês/.test(unidade), `unidade do painel ausente: ${unidade}`);
      return `Botão de retorno: "${N(await voltar.first().innerText()).replace(/\s+/g, " ")}"; ${graficos.length} gráfico(s) com nome acessível, o primeiro: "${graficos[0].slice(0, 100)}"; tabela equivalente com ${linhasTabela} linhas; unidade: "${unidade.slice(0, 70)}"`;
    });

    await j.passo("Compara o número do exemplo do verbete com o que o painel mostra", async () => {
      const painel = N(await p.locator("main").innerText());
      const sin = painel.match(new RegExp(`Em (\\d{2}/\\d{2}/\\d{4}), o SIN guardava ${D} MWmês, ${D}% da EAR máxima`));
      j.afirmar(sin, "a frase de abertura do painel não traz data e percentual do SIN");
      const tabela = p.locator("table:visible", { hasText: "EAR (%)" }).first();
      await tabela.waitFor({ state: "visible", timeout: 10000 });
      const cab = await tabela.locator("thead th").evaluateAll((es) => es.map((e) => e.innerText.replace(/\s+/g, " ").replace(/[↕▲▼]/g, "").trim()));
      const linhas = await tabela.locator("tbody tr").evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll("td,th")].map((c) => c.innerText.trim())));
      const se = linhas.find((l) => l[0] === "Sudeste/Centro-Oeste");
      j.afirmar(se, "a tabela do painel não tem a linha Sudeste/Centro-Oeste");
      const dia = se[cab.indexOf("Dia")];
      const pct = se[cab.indexOf("EAR (%)")];
      const mesmoNumero = dia === ear.data && pct.replace(/0$/, "") === ear.valor;
      const apareceNaPagina = painel.includes(`${ear.valor}%`);
      return `Verbete: ${ear.data}, ${ear.valor}%. Painel (padrão): ${dia}, Sudeste/Centro-Oeste ${pct}% e SIN ${sin[3]}% em ${sin[1]}. O número do exemplo ${mesmoNumero ? "é o mesmo do painel" : `não é o mostrado no painel (data do painel ${dia}, diferença de ${(parseFloat(pct.replace(",", ".")) - parseFloat(ear.valor.replace(",", "."))).toFixed(2).replace(".", ",").replace("-", "−")} p.p.)`}; "${ear.valor}%" aparece em algum texto da página: ${apareceNaPagina ? "sim" : "não"}`;
    });

    await j.passo('Volta ao verbete pelo botão "Voltar ao verbete EAR"', async () => {
      await clicar(p.getByRole("link", { name: /Voltar ao verbete EAR/ }).first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/ear#exemplo/, { timeout: 10000 });
      await assentar();
      const h1 = N(await p.getByRole("heading", { level: 1 }).first().innerText());
      j.afirmar(/EAR/.test(h1), `h1 inesperado: ${h1}`);
      return `URL ${j.url()}; h1 "${h1}"`;
    });

    await j.passo('Segue "Nas trilhas" do verbete EAR até o passo 2 da trilha Água, operação e preço', async () => {
      await clicar(p.getByRole("link", { name: /Água, operação e preço, passo 2/ }).first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/trilhas\/agua-operacao-preco/, { timeout: 10000 });
      await assentar();
      const passo = p.locator("#passo-armazenamento");
      await passo.waitFor({ state: "attached", timeout: 10000 });
      const t = N(await passo.innerText());
      const m = t.match(new RegExp(`EAR DO SIN\\s*${D}%\\s*da EAR máxima[\\s\\S]*?(\\d{2}/\\d{2}/\\d{4}) · Sistema Interligado Nacional`, "i"));
      j.afirmar(/PASSO 2 DE 6/i.test(t) && m, "o passo 2 não traz o número da EAR do SIN com data");
      return `URL ${j.url()}; passo 2 de 6 "A água guardada": EAR do SIN ${m[1]}% da EAR máxima em ${m[2]} (escopo SIN, não Sudeste/Centro-Oeste como no verbete)`;
    });

    await j.passo("Vai ao passo 5, o preço de curto prazo, pelo índice da trilha e lê o número do observatório", async () => {
      await clicar(p.getByRole("link", { name: /5\. O preço de curto prazo/ }).first());
      const passo = p.locator("#passo-pld");
      await passo.waitFor({ state: "attached", timeout: 10000 });
      await j.esperar(500);
      const t = N(await passo.innerText());
      j.afirmar(/PASSO 5 DE 6/i.test(t), "o índice não levou ao passo 5");
      const m = t.match(new RegExp(`Em (\\d{2}/\\d{2}/\\d{4}), o PLD horário do Sudeste/Centro-Oeste variou de R\\$ ${D} a R\\$ ${D}/MWh[\\s\\S]*?a média simples das 24 horas foi R\\$ ${D}/MWh`));
      j.afirmar(m, "o passo 5 não traz data, faixa horária e média do PLD");
      Object.assign(preco, { data: m[1], min: m[2], max: m[3], media: m[4] });
      return `Passo 5 de 6: em ${m[1]}, PLD horário do Sudeste/Centro-Oeste de R$ ${m[2]} a R$ ${m[3]}/MWh, média simples das 24 horas R$ ${m[4]}/MWh`;
    });

    await j.passo('Segue "ver no painel" do passo 5 até o PLD e confere que o painel mostra os mesmos números', async () => {
      await clicar(p.locator("#passo-pld").getByRole("link", { name: /ver no painel/i }).first());
      await p.waitForURL(/\/setor-eletrico\/pld/, { timeout: 10000 });
      await assentar();
      const voltar = p.getByRole("link", { name: /Voltar à trilha Água, operação e preço, passo 5/ });
      await voltar.first().waitFor({ state: "visible", timeout: 10000 });
      const hoje = p.locator("section#hoje");
      await hoje.waitFor({ state: "attached", timeout: 10000 });
      const t = N(await hoje.innerText());
      const se = t.match(new RegExp(`SUDESTE/CENTRO-OESTE\\s*R\\$ ${D}/MWh\\s*média de (\\d{2}/\\d{2}/\\d{4})[\\s\\S]*?Faixa horária\\s*R\\$ ${D} a R\\$ ${D}`, "i"));
      j.afirmar(se, "o painel não traz o cartão do Sudeste/Centro-Oeste com média e faixa horária");
      j.afirmar(se[1] === preco.media && se[3] === preco.min && se[4] === preco.max, `o painel (${se[1]}, ${se[3]} a ${se[4]}) difere da trilha (${preco.media}, ${preco.min} a ${preco.max})`);
      j.afirmar(se[2] === preco.data, `data do painel ${se[2]} difere da da trilha ${preco.data}`);
      // posição em que a página aterrissa: o que o botão fixo de retorno cobre e se o gráfico já está à vista
      const aterrissagem = await p.evaluate(() => {
        const link = [...document.querySelectorAll("a")].find((a) => /Voltar à trilha/.test(a.textContent ?? ""));
        const fixo = link?.closest("[class*=fixed]") ?? link;
        const r = fixo.getBoundingClientRect();
        const cobertas = [...document.querySelectorAll("section#hoje button")]
          .filter((b) => /^(DIA \d|7 DIAS|30 DIAS|12 MESES|HISTÓRICO)/i.test((b.textContent ?? "").trim()))
          .filter((b) => {
            const q = b.getBoundingClientRect();
            return q.width > 0 && q.bottom > 0 && q.top < innerHeight && !(q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom);
          })
          .map((b) => (b.textContent ?? "").trim());
        const g = document.querySelector("section#hoje svg[role=img]")?.getBoundingClientRect();
        return { cobertas, graficoNaTela: !!g && g.top < innerHeight && g.bottom > 0, rolagem: Math.round(scrollY) };
      });
      await j.captura("painel_pld");
      return `Botão de retorno: "${N(await voltar.first().innerText()).replace(/\s+/g, " ")}"; cartão Sudeste/Centro-Oeste: média R$ ${se[1]} em ${se[2]}, faixa horária R$ ${se[3]} a R$ ${se[4]}, iguais ao texto da trilha. Ao chegar (rolagem ${aterrissagem.rolagem} px): gráfico horário ${aterrissagem.graficoNaTela ? "já está" : "não está"} à vista; abas de período cobertas pelo botão fixo: ${aterrissagem.cobertas.length ? aterrissagem.cobertas.join(", ") : "nenhuma"}`;
    });

    await j.passo("Confere o gráfico do PLD: nome acessível, unidade e a tabela equivalente com o pico do exemplo", async () => {
      const hoje = p.locator("section#hoje");
      const graficos = await nomesDosGraficos(hoje);
      j.afirmar(graficos.length > 0, "o painel do PLD não tem gráfico com nome acessível");
      const resumo = hoje.locator("summary", { hasText: /Dados do gráfico em tabela \(24 linhas\)/i }).first();
      await resumo.scrollIntoViewIfNeeded();
      await clicar(resumo);
      const detalhe = resumo.locator("xpath=..");
      await detalhe.locator("tbody tr").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
      const legenda = N(await detalhe.locator("caption").first().innerText().catch(() => ""));
      const cab = await detalhe.locator("thead th").evaluateAll((es) => es.map((e) => e.innerText.trim()));
      const linhas = await detalhe.locator("tbody tr").evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll("td,th")].map((c) => c.innerText.trim())));
      j.afirmar(linhas.length === 24, `esperava 24 horas na tabela, vieram ${linhas.length}`);
      j.afirmar(/R\$\/MWh/.test(legenda) && cab.every((c, i) => i === 0 || /R\$\/MWh/.test(c)), `unidade ausente na legenda ou nas colunas: ${legenda} | ${cab.join(", ")}`);
      const iSe = cab.findIndex((c) => /^Sudeste/.test(c));
      const horaMax = linhas.find((l) => l[iSe] === preco.max);
      j.afirmar(horaMax, `a tabela não tem o pico ${preco.max} citado no exemplo`);
      const horaMin = linhas.filter((l) => l[iSe] === preco.min).map((l) => l[0]);
      const media = linhas.reduce((s, l) => s + parseFloat(l[iSe].replace(",", ".")), 0) / linhas.length;
      return `Gráfico: "${graficos[0].slice(0, 80)}"; tabela equivalente com 24 horas, legenda "${legenda}", colunas ${cab.slice(0, 2).join(" | ")}...; pico R$ ${preco.max} às ${horaMax[0]} (Sudeste/Centro-Oeste); média das 24 linhas ${media.toFixed(2).replace(".", ",")} contra R$ ${preco.media} no texto`;
    });

    await j.passo('Lê no painel o que o professor leva para a sala: interpretação, "o que não é possível concluir" e fonte', async () => {
      const hoje = p.locator("section#hoje");
      const t = N(await hoje.innerText());
      const interpretar = t.match(/COMO INTERPRETAR\s*([^\n]+)/i)?.[1];
      const naoConcluir = t.match(/O QUE NÃO É POSSÍVEL CONCLUIR:?\s*([^\n]+)/i)?.[1];
      const fonte = t.match(/Fonte: CCEE, PLD_HORARIO[^\n]*/)?.[0];
      j.afirmar(interpretar && naoConcluir && fonte, "faltam interpretação, limite de conclusão ou fonte no painel");
      const exportaImagem = await hoje.locator("button, a").evaluateAll((es) => es.filter((e) => /imagem|png|svg|imprimir|copiar gráfico/i.test((e.getAttribute("aria-label") || e.innerText))).length);
      const baixar = await hoje.locator("button:visible, a:visible").evaluateAll((es) => es.filter((e) => /Baixar CSV/i.test(e.innerText)).length);
      return `Como interpretar: "${interpretar.slice(0, 90)}..."; O que não é possível concluir: "${naoConcluir.slice(0, 90)}..."; ${fonte.slice(0, 100)}; ações do painel: baixar CSV ${baixar}, exportar o gráfico como imagem ${exportaImagem}`;
    });

    await j.passo('Volta à trilha pelo botão "Voltar à trilha Água, operação e preço, passo 5"', async () => {
      await clicar(p.getByRole("link", { name: /Voltar à trilha Água, operação e preço, passo 5/ }).first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/trilhas\/agua-operacao-preco#passo-pld/, { timeout: 10000 });
      await assentar();
      await j.esperar(600);
      const visivel = await p.locator("#passo-pld").evaluate((e) => {
        const r = e.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0;
      });
      j.afirmar(visivel, "a trilha reabriu sem o passo 5 na tela");
      return `URL ${j.url()}; o passo 5 está na janela de leitura`;
    });

    await j.passo("Abre o verbete PLD pela trilha e confere que o exemplo real é o mesmo número", async () => {
      await clicar(p.locator("#passo-pld").getByRole("link", { name: /^PLD$/ }).first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/pld/, { timeout: 10000 });
      await assentar();
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
      const t = N(await p.locator("main").innerText());
      const m = t.match(new RegExp(`Em (\\d{2}/\\d{2}/\\d{4}), o PLD horário do Sudeste/Centro-Oeste variou de R\\$ ${D} a R\\$ ${D}/MWh[\\s\\S]*?a média simples das 24 horas foi R\\$ ${D}/MWh`));
      j.afirmar(m, "o verbete PLD não traz o exemplo real com data e faixa");
      j.afirmar(m[1] === preco.data && m[2] === preco.min && m[3] === preco.max && m[4] === preco.media, `exemplo do verbete (${m.slice(1).join(", ")}) difere do da trilha (${Object.values(preco).join(", ")})`);
      const contraste = /O PLD não é a tarifa do consumidor/.test(t);
      return `URL ${j.url()}; exemplo real em ${m[1]}: R$ ${m[2]} a R$ ${m[3]}/MWh, média R$ ${m[4]}/MWh, igual ao da trilha e do painel; "O PLD não é a tarifa do consumidor" em "O que não se pode concluir": ${contraste ? "sim" : "não"}`;
    });
  },
};
