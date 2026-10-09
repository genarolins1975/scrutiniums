/* J1 · Iniciante (desktop 1440): entende PLD versus tarifa e encontra dados de ambos.
   Roteiro por script: cada passo confere um fato lido da página (texto, URL, arquivo baixado). */
import { readFile } from "node:fs/promises";

const N = (s) => String(s ?? "").replace(/[  ]/g, " ").replace(/[ \t]+/g, " ").trim();

/** lê um CSV (separador ; e BOM opcional) e devolve cabeçalho e linhas não vazias */
function lerCsv(texto) {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  return { cabecalho: linhas[0].split(";"), linhas: linhas.slice(1) };
}

export default {
  id: "J1",
  titulo: "Iniciante: entender PLD versus tarifa e achar os dados dos dois lados",
  perfil: "Iniciante, sem vocabulário do setor, desktop 1440",
  largura: 1440,
  movel: false,
  limite:
    "Roteiro por script confere que o contraste está escrito, que os links levam aos dados e que os arquivos baixam; não mede se uma pessoa sem vocabulário entende o texto.",
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
    let n = 0; // interações do leitor até o ponto atual
    const clicar = (l, o) => (n++, j.clicar(l, o));
    const agir = (f) => (n++, j.agir(f));
    const marcos = {};
    let nomePld = "";
    let nomeTarifa = "";

    await j.passo("Abre a página inicial do Observatório e localiza a busca", async () => {
      await ir(j.BASE + "/setor-eletrico");
      const busca = p.getByRole("searchbox", { name: /Busque por pergunta, conceito, página ou distribuidora/ });
      await busca.waitFor({ state: "visible", timeout: 8000 });
      const h1 = N(await p.locator("h1").first().innerText());
      j.afirmar(/Entenda a energia que move o Brasil/i.test(h1), `título inesperado: ${h1}`);
      return `h1 "${h1}"; campo de busca com o rótulo "Busque por pergunta, conceito, página ou distribuidora"`;
    });

    await j.passo('Digita "PLD" na busca e lê os resultados', async () => {
      const busca = p.getByRole("searchbox", { name: /Busque por pergunta/ });
      await agir(async () => {
        await busca.click();
        await busca.pressSequentially("PLD", { delay: 40 });
      });
      const itens = p.locator("ul.divide-y li a");
      await itens.first().waitFor({ state: "visible", timeout: 8000 });
      await j.esperar();
      const lista = await itens.evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.innerText.replace(/\s+/g, " ").trim()]));
      const conceito = lista.find(([h]) => h === "/setor-eletrico/aprenda/pld");
      j.afirmar(conceito, "o resultado do conceito PLD (/setor-eletrico/aprenda/pld) não apareceu");
      j.afirmar(/^CONCEITO/i.test(conceito[1]), `o resultado do verbete não vem marcado como CONCEITO: ${conceito[1].slice(0, 60)}`);
      const pagina = lista.find(([h]) => h === "/setor-eletrico/pld");
      j.afirmar(pagina && /^PÁGINA/i.test(pagina[1]), "a página /setor-eletrico/pld não apareceu como PÁGINA");
      const cont = N(await p.getByText(/\d+ resultados?/).first().innerText().catch(() => ""));
      const tipos = [...new Set(lista.map(([, t]) => t.match(/^(PÁGINA|PAINEL|CONCEITO|PERGUNTA|DISTRIBUIDORA)/i)?.[1]?.toUpperCase() ?? "outro"))];
      return `${lista.length} resultados listados${cont ? ` (página diz: "${cont}")` : ""}; tipos vistos: ${tipos.join(", ")}; CONCEITO leva a ${conceito[0]}, PÁGINA leva a ${pagina[0]}`;
    });

    await j.passo("Abre o conceito PLD pelo resultado da busca", async () => {
      await clicar(p.locator('ul.divide-y li a[href="/setor-eletrico/aprenda/pld"]').first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/pld(\?|#|$)/, { timeout: 10000 });
      await assentar();
      await p.locator("h1").first().waitFor({ state: "visible" });
      const h1 = N(await p.locator("h1").first().innerText());
      j.afirmar(/PLD/.test(h1), `título do verbete inesperado: ${h1}`);
      const texto = N(await p.locator("main").innerText());
      const frase = texto.match(/EM UMA FRASE\s*([^\n]+)/i)?.[1] ?? "";
      j.afirmar(/Preço do Mercado de Curto Prazo/i.test(frase), "definição em uma frase ausente");
      return `URL ${j.url()}; h1 "${h1}"; em uma frase: "${frase.slice(0, 140)}..."`;
    });

    await j.passo('Lê "Não confundir com" e confere o contraste entre PLD e tarifa (TE e TUSD)', async () => {
      const texto = N(await p.locator("main").innerText());
      const bloco = texto.slice(texto.search(/NÃO CONFUNDIR COM/i));
      const iTe = bloco.search(/TE e TUSD \(Tarifa de Energia/i);
      j.afirmar(iTe >= 0, 'o item "TE e TUSD" não consta em "Não confundir com"');
      const contraste = bloco.slice(iTe).split("\n").slice(1, 3).join(" ").trim();
      j.afirmar(/preço das diferenças liquidadas/i.test(contraste) && /TE e a TUSD/i.test(contraste), `contraste PLD versus tarifa não está escrito: "${contraste.slice(0, 120)}"`);
      const naoConcluir = texto.match(/O PLD não é a tarifa do consumidor[^\n]*/i)?.[0] ?? "";
      j.afirmar(naoConcluir, 'a frase "O PLD não é a tarifa do consumidor" não consta em "O que não se pode concluir"');
      const ligaTarifa = await p.locator('a[href="/setor-eletrico/aprenda/tarifa-te-tusd"]').count();
      j.afirmar(ligaTarifa > 0, "não há link do verbete PLD para o verbete de tarifa");
      return `Contraste: "${contraste.slice(0, 175)}"; em "O que não se pode concluir": "${naoConcluir.slice(0, 85)}..."; links ao verbete de tarifa: ${ligaTarifa}`;
    });

    await j.passo('Segue "ver no painel" do exemplo real e chega ao painel do PLD', async () => {
      // o exemplo real é uma ficha: rótulo, data e valor ficam em linhas separadas até o link "Ver no painel"
      const exemplo = N((await p.locator("main").innerText()).match(/EXEMPLO REAL([\s\S]*?)VER NO PAINEL/i)?.[1] ?? "");
      j.afirmar(/\d{2}\/\d{2}\/\d{4}/.test(exemplo) && /R\$\s?[\d.,]+/.test(exemplo), `exemplo real sem data e valor: "${exemplo}"`);
      await clicar(p.getByRole("link", { name: /ver no painel/i }).first());
      await p.waitForURL(/\/setor-eletrico\/pld\/cmo-e-formacao(\?|#|$)/, { timeout: 10000 });
      await assentar();
      await p.locator("h1").first().waitFor({ state: "visible" });
      const h1 = N(await p.locator("h1").first().innerText());
      j.afirmar(h1 === "CMO e formação de preço", `h1 do painel inesperado: ${h1}`);
      const volta = N(await p.getByRole("link", { name: /Voltar ao verbete PLD/ }).first().innerText()).replace(/\s+/g, " ");
      return `Exemplo no verbete: "${exemplo.slice(0, 110)}"; URL ${j.url()}; h1 "${h1}"; botão de retorno: "${volta}"`;
    });

    // o link do exemplo leva ao painel que contém a evidência; o arquivo do PLD fica na página do módulo, a um clique
    await j.passo("Vai do painel à página PLD, onde estão os arquivos", async () => {
      await clicar(p.locator('a[href="/setor-eletrico/pld"]:visible').first());
      await p.waitForURL(/\/setor-eletrico\/pld(\?|#|$)/, { timeout: 10000 });
      await assentar();
      await p.locator("h1").first().waitFor({ state: "visible" });
      const h1 = N(await p.locator("h1").first().innerText());
      j.afirmar(h1 === "PLD", `h1 da página de dados inesperado: ${h1}`);
      marcos.chegadaPld = n;
      return `URL ${j.url()}; h1 "${h1}"`;
    });

    await j.passo("Baixa o CSV do PLD e confere cabeçalho, linhas e último dia", async () => {
      const link = p.locator('a[download][href$="pld_horario.csv"]:visible').first();
      await link.scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), clicar(link)]);
      nomePld = dl.suggestedFilename();
      const csv = lerCsv(await readFile(await dl.path(), "utf8"));
      j.afirmar(csv.linhas.length > 1000, `CSV do PLD com poucas linhas: ${csv.linhas.length}`);
      j.afirmar(csv.cabecalho.join(";") === "data_hora_local;SE;S;NE;N", `cabeçalho inesperado: ${csv.cabecalho.join(";")}`);
      const ultima = csv.linhas.at(-1).split(";");
      j.afirmar(ultima[0].startsWith("2026-09-30") && !Number.isNaN(parseFloat(ultima[1])), `última linha inesperada: ${csv.linhas.at(-1)}`);
      const r = await j.baixar("/energia/series/pld_horario.csv");
      j.afirmar(r.status === 200 && /csv/.test(r.tipo), `resposta HTTP inesperada: ${r.status} ${r.tipo}`);
      marcos.arquivoPld = n;
      return `Arquivo ${nomePld}; cabeçalho ${csv.cabecalho.join(";")}; ${csv.linhas.length} linhas de dados; primeira ${csv.linhas[0]}; última ${csv.linhas.at(-1)}; HTTP ${r.status} ${r.tipo}`;
    });

    await j.passo('Volta ao verbete pelo botão "Voltar ao verbete PLD"', async () => {
      await agir(() => p.goBack());
      await p.waitForURL(/\/setor-eletrico\/pld\/cmo-e-formacao/, { timeout: 10000 });
      await assentar();
      await clicar(p.getByRole("link", { name: /Voltar ao verbete PLD/ }).first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/pld#exemplo/, { timeout: 10000 });
      await assentar();
      return `URL ${j.url()}`;
    });

    await j.passo('Segue o link "TE e TUSD" de "Não confundir com" até o verbete da tarifa', async () => {
      await clicar(p.locator('main a[href="/setor-eletrico/aprenda/tarifa-te-tusd"]').filter({ hasText: /TE e TUSD \(Tarifa/ }).first());
      await p.waitForURL(/\/setor-eletrico\/aprenda\/tarifa-te-tusd/, { timeout: 10000 });
      await assentar();
      await p.locator("h1").first().waitFor({ state: "visible" });
      const texto = N(await p.locator("main").innerText());
      const h1 = N(await p.locator("h1").first().innerText());
      j.afirmar(/TE e TUSD/.test(h1), `h1 inesperado: ${h1}`);
      const volta = texto.match(/PLD \(Preço de Liquidação das Diferenças\)\s*([^\n]+)/i)?.[1] ?? "";
      j.afirmar(/preço das diferenças liquidadas/i.test(volta) && /TE e a TUSD/.test(volta), "o verbete da tarifa não repete o contraste com o PLD");
      const exemplo = texto.match(/R\$\s?[\d.,]+\/kWh/)?.[0];
      j.afirmar(exemplo, "exemplo real da tarifa sem valor em R$/kWh");
      return `URL ${j.url()}; h1 "${h1}"; contraste do lado da tarifa: "${volta.slice(0, 120)}..."; exemplo real: ${exemplo}`;
    });

    await j.passo('Segue "Ver no painel: Conta de luz: tarifa" até a página de dados da tarifa', async () => {
      await clicar(p.getByRole("link", { name: /Ver no painel: Conta de luz/ }).first());
      await p.waitForURL(/\/setor-eletrico\/conta-de-luz(\?|#|$)/, { timeout: 10000 });
      await assentar();
      await p.locator("h1").first().waitFor({ state: "visible" });
      const h1 = N(await p.locator("h1").first().innerText());
      j.afirmar(/Quanto custa a energia ao consumidor/.test(h1), `h1 inesperado: ${h1}`);
      marcos.chegadaTarifa = n;
      return `URL ${j.url()}; h1 "${h1}"`;
    });

    await j.passo("Baixa o CSV de tarifas e confere cabeçalho e linhas", async () => {
      const link = p.locator('a[download][href$="conta_tarifas_b1_vigentes.csv"]:visible').first();
      await link.scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), clicar(link)]);
      nomeTarifa = dl.suggestedFilename();
      const csv = lerCsv(await readFile(await dl.path(), "utf8"));
      j.afirmar(csv.linhas.length > 10, `CSV de tarifas com poucas linhas: ${csv.linhas.length}`);
      for (const col of ["cnpj", "sigla", "te_rs_mwh", "tusd_rs_mwh", "total_rs_kwh"]) j.afirmar(csv.cabecalho.includes(col), `coluna ausente: ${col}`);
      const iSigla = csv.cabecalho.indexOf("sigla");
      const iTotal = csv.cabecalho.indexOf("total_rs_kwh");
      const total = csv.linhas.map((l) => parseFloat(l.split(";")[iTotal])).filter((v) => !Number.isNaN(v));
      j.afirmar(total.length === csv.linhas.length, "há linhas sem tarifa total numérica");
      const r = await j.baixar("/energia/series/conta_tarifas_b1_vigentes.csv");
      j.afirmar(r.status === 200 && /csv/.test(r.tipo), `resposta HTTP inesperada: ${r.status} ${r.tipo}`);
      marcos.arquivoTarifa = n;
      return `Arquivo ${nomeTarifa}; colunas ${csv.cabecalho.slice(0, 10).join(";")}...; ${csv.linhas.length} distribuidoras; primeira ${csv.linhas[0].split(";")[iSigla]} a R$ ${total[0]}/kWh; HTTP ${r.status} ${r.tipo}`;
    });

    await j.passo("Contabiliza as interações do leitor até os dois conjuntos de dados", async () => {
      j.afirmar(nomePld && nomeTarifa, "os dois arquivos precisam ter sido baixados");
      return `${n} interações a partir da home (digitação, cliques e dois downloads). PLD: página de dados na interação ${marcos.chegadaPld}, arquivo na ${marcos.arquivoPld}. Tarifa: página de dados na ${marcos.chegadaTarifa}, arquivo na ${marcos.arquivoTarifa}`;
    });
  },
};
