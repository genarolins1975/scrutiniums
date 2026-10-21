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
      // o índice abre com os grupos recolhidos: o leitor procura a sigla (um passo a mais que na versão anterior)
      await agir(() => p.getByLabel("Procurar um termo").fill("EAR"));
      await clicar(p.locator('main a[href="/setor-eletrico/aprenda/ear"]:visible').first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/ear/, { timeout: 10000 });
      await assentar();
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
      const texto = N(await p.locator("main").innerText());
      const frase = texto.match(/EM UMA FRASE\s*([^\n]+)/i)?.[1] ?? "";
      // o exemplo real é uma ficha do SIN: rótulo, percentual, natureza e data ficam em linhas separadas
      const ex = texto.match(new RegExp(`EXEMPLO REAL\\s*EAR DO SIN\\s*${D}%\\s*da EAR máxima[\\s\\S]*?(\\d{2}/\\d{2}/\\d{4}) · Sistema Interligado Nacional`, "i"));
      const natureza = texto.match(/NATUREZA DO DADO:\s*([A-ZÇÃÕÉÊ]+)/i)?.[1];
      const unidade = texto.match(/UNIDADE\s*([^\n]+)/i)?.[1];
      const mediana = /mediana para a data/i.test(texto);
      j.afirmar(/Energia associada ao volume de água/i.test(frase), "definição em uma frase ausente");
      j.afirmar(ex, "o exemplo real não traz data e percentual");
      j.afirmar(natureza && unidade, "faltam natureza do dado ou unidade no exemplo");
      Object.assign(ear, { data: ex[2], valor: ex[1], natureza });
      return `Em uma frase: "${frase.slice(0, 80)}..."; exemplo real: ${ex[2]}, SIN com ${ex[1]}% da EAR máxima (${natureza.toLowerCase()}); a mediana da data ${mediana ? "consta" : "não consta"} no verbete; unidade: ${unidade}`;
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
      // o veredito do painel traz a data e o percentual do SIN; os MWmês ficam na resposta completa, em Analisar
      const sin = painel.match(new RegExp(`Em (\\d{2}/\\d{2}/\\d{4}), o SIN guardava ${D}% da energia que os reservatórios comportam`));
      j.afirmar(sin, "a frase de abertura do painel não traz data e percentual do SIN");
      // em Entender a tabela longa vem recolhida (a linha escolhida pela própria página não a abre mais): o leitor abre o botão que a mostra
      const fechada = p.locator("main [data-recolhivel='fechada']").filter({ has: p.locator("th", { hasText: "EAR (%)" }) }).first();
      if (await fechada.count()) {
        const botao = p.locator(`main button[aria-controls="${await fechada.getAttribute("id")}"]`);
        if (await botao.isVisible()) {
          await botao.scrollIntoViewIfNeeded();
          await clicar(botao);
          await j.esperar(300);
        }
      }
      const tabela = p.locator("table:visible", { hasText: "EAR (%)" }).first();
      await tabela.waitFor({ state: "visible", timeout: 10000 });
      const mesmoNumero = sin[1] === ear.data && sin[2] === ear.valor;
      j.afirmar(mesmoNumero, `o painel diz ${sin[1]} e ${sin[2]}% para o SIN; o verbete diz ${ear.data} e ${ear.valor}%`);
      return `Verbete: ${ear.data}, SIN ${ear.valor}%. Painel (padrão): "Em ${sin[1]}, o SIN guardava ${sin[2]}% da energia que os reservatórios comportam". O número do exemplo é o mesmo do painel, com a mesma data`;
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
      // o número é uma ficha: o rótulo traz a semana operativa; valor e natureza ficam em linhas separadas
      const m = t.match(new RegExp(`PLD MÉDIO DA SEMANA OPERATIVA DE (\\d{2}/\\d{2}/\\d{4}) A (\\d{2}/\\d{2}/\\d{4})\\s*R\\$ ${D}/MWh`, "i"));
      const natureza = t.match(/NATUREZA DO DADO:\s*([A-ZÇÃÕÉÊ]+)/i)?.[1];
      j.afirmar(m && natureza, "o passo 5 não traz a semana operativa, a média do PLD e a natureza do dado");
      Object.assign(preco, { de: m[1], ate: m[2], media: m[3], natureza });
      return `Passo 5 de 6: PLD médio do Sudeste/Centro-Oeste de ${m[1]} a ${m[2]}, R$ ${m[3]}/MWh (${natureza.toLowerCase()})`;
    });

    await j.passo('Segue "ver no painel" do passo 5 até o PLD e confere que o painel mostra os mesmos números', async () => {
      await clicar(p.locator("#passo-pld").getByRole("link", { name: /ver no painel/i }).first());
      await p.waitForURL(/\/setor-eletrico\/pld\/cmo-e-formacao/, { timeout: 10000 });
      await assentar();
      const voltar = p.getByRole("link", { name: /Voltar à trilha Água, operação e preço, passo 5/ });
      await voltar.first().waitFor({ state: "visible", timeout: 10000 });
      const painel = p.locator("section#p009");
      await painel.waitFor({ state: "attached", timeout: 10000 });
      // o veredito do painel traz as diferenças; os valores de cada preço estão na resposta completa, em Analisar
      await clicar(p.getByRole("radio", { name: /analisar/i }));
      await j.esperar(600);
      const t = N(await painel.innerText());
      const m = t.match(new RegExp(`Na semana operativa de (\\d{2}/\\d{2}/\\d{4}) a (\\d{2}/\\d{2}/\\d{4}), no Sudeste/Centro-Oeste, o CMO semanal do DECOMP foi R\\$ ${D}/MWh, a média das \\d+ meias horas do CMO do DESSEM foi R\\$ ${D}/MWh e a média das \\d+ horas do PLD foi R\\$ ${D}/MWh`));
      j.afirmar(m, "o painel não traz a frase da semana com CMO do DECOMP, média do DESSEM e média do PLD");
      j.afirmar(m[1] === preco.de && m[2] === preco.ate, `a semana do painel (${m[1]} a ${m[2]}) difere da da trilha (${preco.de} a ${preco.ate})`);
      j.afirmar(m[5] === preco.media, `o painel diz R$ ${m[5]}/MWh e a trilha R$ ${preco.media}/MWh`);
      // posição em que a página aterrissa: onde fica o painel e se o gráfico já está à vista
      const aterrissagem = await p.evaluate(() => {
        const sec = document.getElementById("p009");
        const g = sec?.querySelector("svg[role=img]")?.getBoundingClientRect();
        return { rolagem: Math.round(scrollY), topo: Math.round(sec?.getBoundingClientRect().top ?? -1), graficoNaTela: !!g && g.top < innerHeight && g.bottom > 0 };
      });
      await j.captura("painel_pld");
      return `Botão de retorno: "${N(await voltar.first().innerText()).replace(/\s+/g, " ")}"; painel CMO e formação de preço: semana ${m[1]} a ${m[2]}, CMO semanal do DECOMP R$ ${m[3]}, média do DESSEM R$ ${m[4]} e média do PLD R$ ${m[5]}/MWh, a mesma da trilha. Ao chegar (rolagem ${aterrissagem.rolagem} px, topo do painel a ${aterrissagem.topo} px): gráfico ${aterrissagem.graficoNaTela ? "já está" : "não está"} à vista`;
    });

    await j.passo("Confere o gráfico do PLD: nome acessível, unidade e a tabela equivalente com a média do exemplo", async () => {
      const painel = p.locator("section#p009");
      const graficos = await nomesDosGraficos(painel);
      j.afirmar(graficos.length > 0, "o painel do PLD não tem gráfico com nome acessível");
      const resumo = painel.locator("summary:visible", { hasText: /Dados do gráfico em tabela \(\d+ linhas\)/i }).first();
      await resumo.scrollIntoViewIfNeeded();
      await clicar(resumo);
      const detalhe = resumo.locator("xpath=..");
      await detalhe.locator("tbody tr").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
      const legenda = N(await detalhe.locator("caption").first().innerText().catch(() => ""));
      const cab = await detalhe.locator("thead th").evaluateAll((es) => es.map((e) => e.innerText.replace(/[↕▲▼]/g, "").replace(/\s+/g, " ").trim()));
      const linhas = await detalhe.locator("tbody tr").evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll("td,th")].map((c) => c.innerText.trim())));
      j.afirmar(linhas.length > 0, "a tabela equivalente do gráfico está vazia");
      j.afirmar(/R\$\/MWh/.test(legenda) || cab.some((c) => /R\$\/MWh/.test(c)), `unidade ausente na legenda ou nas colunas: ${legenda} | ${cab.join(", ")}`);
      const linha = linhas.find((l) => l.includes(preco.media));
      j.afirmar(linha, `a tabela equivalente não tem a média R$ ${preco.media}/MWh do exemplo`);
      return `Gráfico: "${graficos[0].slice(0, 90)}"; tabela equivalente com ${linhas.length} linhas, legenda "${legenda.slice(0, 80)}", colunas ${cab.slice(0, 4).join(" | ")}; linha com a média do exemplo: ${linha.join(" | ")}`;
    });

    await j.passo('Lê no painel o que o professor leva para a sala: interpretação, "o que não é possível concluir" e fonte (modo Analisar)', async () => {
      const painel = p.locator("section#p009");
      const t = N(await painel.innerText());
      const interpretar = t.match(/COMO INTERPRETAR\s*([^\n]+)/i)?.[1];
      const naoConcluir = t.match(/O QUE NÃO É POSSÍVEL CONCLUIR:?\s*([^\n]+)/i)?.[1];
      const fonte = t.match(/Fonte: ONS, CMO Semanal \(DECOMP\)[^\n]*PLD horário por submercado[^\n]*/)?.[0];
      j.afirmar(interpretar && naoConcluir, "faltam interpretação ou limite de conclusão no painel");
      j.afirmar(fonte, "a fonte (ONS, CMO Semanal e Semi-Horário; CCEE, PLD horário por submercado) não aparece no painel, nem em Analisar");
      const baixar = await painel.locator("button:visible, a:visible").evaluateAll((es) => es.filter((e) => /Baixar CSV/i.test(e.innerText)).length);
      return `Como interpretar: "${interpretar.slice(0, 90)}..."; O que não é possível concluir: "${naoConcluir.slice(0, 90)}..."; ${fonte.slice(0, 100)} (a fonte só aparece depois de escolher Analisar); ações do painel: baixar CSV ${baixar}`;
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
      // os chips de verbete trazem a sigla e o nome por extenso; o link é identificado pelo endereço
      await clicar(p.locator('#passo-pld a[href="/setor-eletrico/aprenda/pld"]').first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/pld/, { timeout: 10000 });
      await assentar();
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
      const t = N(await p.locator("main").innerText());
      const m = t.match(new RegExp(`PLD MÉDIO DA SEMANA OPERATIVA DE (\\d{2}/\\d{2}/\\d{4}) A (\\d{2}/\\d{2}/\\d{4})\\s*R\\$ ${D}/MWh`, "i"));
      j.afirmar(m, "o verbete PLD não traz o exemplo real com a semana e a média");
      j.afirmar(m[1] === preco.de && m[2] === preco.ate && m[3] === preco.media, `exemplo do verbete (${m.slice(1).join(", ")}) difere do da trilha (${preco.de}, ${preco.ate}, ${preco.media})`);
      const contraste = /O PLD não é a tarifa do consumidor/.test(t);
      return `URL ${j.url()}; exemplo real de ${m[1]} a ${m[2]}: R$ ${m[3]}/MWh, igual ao da trilha e do painel; "O PLD não é a tarifa do consumidor" em "O que não se pode concluir": ${contraste ? "sim" : "não"}`;
    });
  },
};
