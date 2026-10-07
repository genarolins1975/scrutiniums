/* J4 · Pesquisador (desktop 1440): filtra uma série, exporta e reproduz um agregado.
   Roteiro por script: cada passo confere um fato lido da página ou do arquivo baixado. */
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const N = (s) => String(s ?? "").replace(/[  ]/g, " ").replace(/[ \t]+/g, " ").trim();
const D = "(\\d[\\d.]*(?:,\\d+)?)"; // número em pt-BR, sem pontuação final
const num = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", "."));
const pt = (v, c = 2) => v.toFixed(c).replace(".", ",").replace("-", "−");

/** CSV exportado: separador ;, BOM, decimal com ponto */
function lerCsv(texto) {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  return { cabecalho: linhas[0].split(";"), linhas: linhas.slice(1).map((l) => l.split(";")) };
}

/** lê um .xlsx (zip) pelo diretório central e devolve os arquivos descompactados */
function abrirZip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("o arquivo não é um zip válido");
  const total = buf.readUInt16LE(e + 10);
  let off = buf.readUInt32LE(e + 16);
  const saida = {};
  for (let i = 0; i < total; i++) {
    const metodo = buf.readUInt16LE(off + 10);
    const tam = buf.readUInt32LE(off + 20);
    const nl = buf.readUInt16LE(off + 28);
    const xl = buf.readUInt16LE(off + 30);
    const cl = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const nome = buf.toString("utf8", off + 46, off + 46 + nl);
    const ini = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const dados = buf.subarray(ini, ini + tam);
    saida[nome] = metodo === 0 ? dados : inflateRawSync(dados);
    off += 46 + nl + xl + cl;
  }
  return saida;
}

export default {
  id: "J4",
  titulo: "Pesquisador: filtrar a série mensal do PLD, exportar e reproduzir agregados",
  perfil: "Pesquisador que reproduz números, desktop 1440",
  largura: 1440,
  movel: false,
  limite:
    "Roteiro por script reproduz a média temporal, a mediana e o percentil a partir dos arquivos oferecidos na página; as médias ponderadas pela carga não foram reproduzidas porque dependem da carga horária do ONS, que a página não oferece como arquivo.",
  async executar(j) {
    const p = j.p;
    let n = 0;
    const clicar = (l, o) => (n++, j.clicar(l, o));
    const agir = (f) => (n++, j.agir(f));
    const est = { kpiAgo: null, cabTabela: [], aposFiltro: 0 };
    let raiz;
    let tabela;

    const lerLinhas = async () =>
      tabela.locator("tbody tr").evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll("td,th")].map((c) => c.innerText.trim())));
    const contagem = async () => {
      const t = N(await raiz.getByText(/\d+ de \d+ linhas/).first().innerText());
      const m = t.match(/(\d+) de (\d+) linhas/);
      return { texto: t, mostradas: Number(m[1]), total: Number(m[2]) };
    };
    const baixarCsv = async () => {
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), clicar(raiz.getByRole("button", { name: /Baixar CSV/i }))]);
      return { nome: dl.suggestedFilename(), csv: lerCsv(await readFile(await dl.path(), "utf8")) };
    };

    await j.passo("Abre o histórico do PLD, localiza a tabela mensal e lê o KPI de ago/2026", async () => {
      await p.goto(j.BASE + "/setor-eletrico/pld/historico");
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible", timeout: 10000 });
      tabela = p.locator("table:visible", { hasText: "Dias completos" }).first();
      raiz = tabela.locator("xpath=ancestor::*[.//input[@type='search']][1]");
      await raiz.locator("input[type=search]").scrollIntoViewIfNeeded();
      await tabela.waitFor({ state: "visible", timeout: 15000 });
      const kpi = N(await p.getByRole("group", { name: /^Média temporal de ago\/2026/i }).first().innerText());
      est.kpiAgo = kpi.match(new RegExp(`R\\$ ${D}/MWh`))?.[1];
      j.afirmar(est.kpiAgo, `KPI sem valor: ${kpi}`);
      est.cabTabela = await tabela.locator("thead th").evaluateAll((es) => es.map((e) => e.innerText.replace(/\s+/g, " ").replace(/[↕▲▼]/g, "").trim()));
      const c = await contagem();
      j.afirmar(c.mostradas === c.total && c.total > 60, `contagem inicial inesperada: ${c.texto}`);
      const botoes = await raiz.getByRole("button", { name: /Baixar (CSV|XLSX)/i }).evaluateAll((es) => es.map((e) => e.innerText.trim()));
      j.afirmar(botoes.length === 2, `esperava os botões Baixar CSV e Baixar XLSX, vieram ${botoes.join(", ")}`);
      return `Tabela "PLD médio mensal, Sudeste/Centro-Oeste": "${c.texto}", ${est.cabTabela.length} colunas; KPI "Média temporal de ago/2026": R$ ${est.kpiAgo}/MWh; botões ${botoes.join(" e ")}`;
    });

    await j.passo('Digita "2026" na busca da tabela e confere a contagem e o chip do filtro', async () => {
      await agir(async () => raiz.locator("input[type=search]").fill("2026"));
      await j.esperar(600);
      const c = await contagem();
      const linhas = await lerLinhas();
      j.afirmar(c.total === 69 && c.mostradas === linhas.length && c.mostradas > 0, `contagem e linhas divergem: ${c.texto}, ${linhas.length} linhas na página`);
      j.afirmar(linhas.every((l) => l[0].endsWith("/2026")), "há linha fora de 2026 depois da busca");
      const chip = N(await raiz.getByRole("button", { name: /^Remover filtro Busca/ }).first().innerText().catch(() => ""));
      const chips = await raiz.getByRole("button", { name: /^Remover filtro/ }).evaluateAll((es) => es.map((e) => e.getAttribute("aria-label") || e.innerText.trim()));
      j.afirmar(chips.some((x) => /2026/.test(x)), `chip do filtro ausente: ${chips.join(" | ")}`);
      return `"${c.texto}"; ${linhas.length} linhas, de ${linhas.at(-1)[0]} a ${linhas[0][0]}; chip: "${chips.join(" | ")}"`;
    });

    await j.passo('Aplica o filtro "Ponderada nas mesmas horas da temporal = sim" e confere o recorte', async () => {
      const resumo = raiz.locator("summary", { hasText: /Ponderada nas mesmas horas da temporal/i }).first();
      await resumo.scrollIntoViewIfNeeded();
      await clicar(resumo);
      const caixa = resumo.locator("xpath=..").getByRole("checkbox", { name: /^sim\b/ });
      await clicar(caixa);
      await j.esperar(500);
      await clicar(resumo); // fecha a lista de opções
      await j.esperar(300);
      const c = await contagem();
      const linhas = await lerLinhas();
      est.aposFiltro = c.mostradas;
      j.afirmar(c.total === 69 && c.mostradas === 8 && linhas.length === 8, `esperava 8 meses de 2026 com as mesmas horas, veio: ${c.texto} e ${linhas.length} linhas`);
      j.afirmar(!linhas.some((l) => l[0] === "09/2026"), "09/2026 deveria sair do recorte (a ponderada não cobre as mesmas horas)");
      const iCol = est.cabTabela.findIndex((x) => x === "Ponderada nas mesmas horas da temporal");
      j.afirmar(linhas.every((l) => l[iCol] === "sim"), 'há linha com "mesmas horas" diferente de sim');
      const chips = await raiz.getByRole("button", { name: /^Remover filtro/ }).evaluateAll((es) => es.map((e) => e.getAttribute("aria-label") || e.innerText.trim()));
      return `"${c.texto}"; meses ${linhas.map((l) => l[0]).reverse().join(", ")} (09/2026 saiu); ${chips.length} chips: ${chips.join(" | ")}`;
    });

    await j.passo("Ordena por média temporal e confere o aria-sort e a ordem dos valores", async () => {
      const botao = tabela.getByRole("button", { name: /^Média temporal \(R\$\/MWh\)/ }).first();
      const th = botao.locator("xpath=ancestor::th");
      await clicar(botao);
      await j.esperar(400);
      const sentido = await th.getAttribute("aria-sort");
      const iCol = est.cabTabela.findIndex((x) => x.startsWith("Média temporal (R$/MWh)"));
      const linhas = await lerLinhas();
      const valores = linhas.map((l) => num(l[iCol]));
      const ordenado = [...valores].sort((a, b) => (sentido === "ascending" ? a - b : b - a));
      j.afirmar(sentido === "ascending" || sentido === "descending", `aria-sort inesperado: ${sentido}`);
      j.afirmar(JSON.stringify(valores) === JSON.stringify(ordenado), `valores fora de ordem ${sentido}: ${valores.join(", ")}`);
      return `aria-sort="${sentido}"; primeira linha ${linhas[0][0]} com ${linhas[0][iCol]}, última ${linhas.at(-1)[0]} com ${linhas.at(-1)[iCol]}; ${valores.length} valores em ordem ${sentido === "ascending" ? "crescente" : "decrescente"}`;
    });

    let tabelaNaTela = [];
    let csvFiltrado;
    await j.passo("Baixa o CSV do recorte e confere linhas, cabeçalho e ordem com a tabela", async () => {
      tabelaNaTela = await lerLinhas();
      const c = await contagem();
      const { nome, csv } = await baixarCsv();
      csvFiltrado = csv;
      j.afirmar(csv.linhas.length === c.mostradas, `o CSV tem ${csv.linhas.length} linhas e a página mostra ${c.mostradas}`);
      j.afirmar(csv.cabecalho.length === est.cabTabela.length && csv.cabecalho.every((h, i) => h === est.cabTabela[i]), "o cabeçalho do CSV difere das colunas da tabela");
      const iCol = est.cabTabela.findIndex((x) => x.startsWith("Média temporal (R$/MWh)"));
      const naTela = tabelaNaTela.map((l) => num(l[iCol]));
      const noCsv = csv.linhas.map((l) => parseFloat(l[iCol]));
      j.afirmar(JSON.stringify(naTela) === JSON.stringify(noCsv), `valores do CSV (${noCsv.join(", ")}) diferem dos da tabela (${naTela.join(", ")})`);
      const mesCsv = csv.linhas[0][0];
      return `Arquivo ${nome}; ${csv.linhas.length} linhas de dados = "${c.texto}"; ${csv.cabecalho.length} colunas iguais às da tabela; mesma ordem e mesmos valores da média temporal; formato do arquivo: mês "${mesCsv}" e decimal com ponto ("${csv.linhas[0][iCol]}"), na tela "${tabelaNaTela[0][0]}" e "${tabelaNaTela[0][iCol]}"`;
    });

    await j.passo("Baixa o XLSX do mesmo recorte e confere as linhas da planilha", async () => {
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), clicar(raiz.getByRole("button", { name: /Baixar XLSX/i }))]);
      const buf = await readFile(await dl.path());
      j.afirmar(buf.subarray(0, 2).toString() === "PK", "o arquivo XLSX não começa com a assinatura de zip");
      const zip = abrirZip(buf);
      const planilha = zip["xl/worksheets/sheet1.xml"]?.toString("utf8");
      j.afirmar(planilha, "sem a planilha xl/worksheets/sheet1.xml");
      const linhas = (planilha.match(/<row /g) ?? []).length;
      j.afirmar(linhas - 1 === csvFiltrado.linhas.length, `a planilha tem ${linhas - 1} linhas de dados e o CSV ${csvFiltrado.linhas.length}`);
      const iCol = est.cabTabela.findIndex((x) => x.startsWith("Média temporal (R$/MWh)"));
      const letra = String.fromCharCode(65 + iCol);
      const cel = planilha.match(new RegExp(`<c r="${letra}2"[^>]*>(?:<v>([^<]*)</v>|<is><t[^>]*>([^<]*)</t></is>)`));
      const valor = cel?.[1] ?? cel?.[2];
      j.afirmar(valor !== undefined && parseFloat(valor) === parseFloat(csvFiltrado.linhas[0][iCol]), `célula ${letra}2 da planilha (${valor}) difere do CSV (${csvFiltrado.linhas[0][iCol]})`);
      return `Arquivo ${dl.suggestedFilename()} (${buf.length} bytes, zip válido, abas ${Object.keys(zip).filter((k) => k.startsWith("xl/worksheets/")).length}); ${linhas - 1} linhas de dados = CSV; célula ${letra}2 = ${valor} igual à primeira linha do CSV`;
    });

    await j.passo('Reproduz o KPI "média temporal de ago/2026" a partir do CSV e da série horária', async () => {
      const linhaAgo = csvFiltrado.linhas.find((l) => l[0] === "2026-08");
      j.afirmar(linhaAgo, "o CSV do recorte não tem 2026-08");
      const iCol = est.cabTabela.findIndex((x) => x.startsWith("Média temporal (R$/MWh)"));
      const doCsv = parseFloat(linhaAgo[iCol]);
      j.afirmar(pt(doCsv) === est.kpiAgo, `CSV ${doCsv} não corresponde ao KPI ${est.kpiAgo}`);
      const r = await j.baixar("/energia/series/pld_horario.csv");
      j.afirmar(r.status === 200, `série horária indisponível: HTTP ${r.status}`);
      const horas = lerCsv(r.corpo).linhas.filter((l) => l[0].startsWith("2026-08"));
      j.afirmar(horas.length === 744, `esperava 744 horas em ago/2026, vieram ${horas.length}`);
      const media = horas.reduce((s, l) => s + parseFloat(l[1]), 0) / horas.length;
      const dif = Math.abs(media - num(est.kpiAgo));
      j.afirmar(dif < 0.005, `média recalculada ${media} difere do KPI ${est.kpiAgo} em ${dif}`);
      return `KPI exibido R$ ${est.kpiAgo}/MWh; linha 2026-08 do CSV exportado ${linhaAgo[iCol]} (diferença 0); recalculado sobre ${horas.length} horas de pld_horario.csv (coluna SE) ${media.toFixed(4)}; diferença para o KPI ${(media - num(est.kpiAgo)).toFixed(4).replace(".", ",")} R$/MWh, só de arredondamento`;
    });

    await j.passo("Reproduz a mediana e o percentil da média diária de 30/09/2026 a partir da série diária", async () => {
      const texto = N(await p.locator("main").innerText());
      const m = texto.match(new RegExp(`foi R\\$ ${D}/MWh: percentil ${D} entre as (\\d+) médias diárias de setembro de 2021 a 2025 \\(mediana R\\$ ${D}/MWh\\)`));
      j.afirmar(m, "a página não traz o percentil e a mediana da média diária");
      const r = await j.baixar("/energia/series/pld_diario.csv");
      j.afirmar(r.status === 200, `série diária indisponível: HTTP ${r.status}`);
      const linhas = lerCsv(r.corpo).linhas;
      const set = linhas.filter((l) => /^(2021|2022|2023|2024|2025)-09-/.test(l[0])).map((l) => parseFloat(l[1])).sort((a, b) => a - b);
      const dia = linhas.find((l) => l[0] === "2026-09-30");
      j.afirmar(dia && set.length === Number(m[3]), `esperava ${m[3]} dias de setembro, vieram ${set.length}`);
      const valorDia = parseFloat(dia[1]);
      const mediana = set.length % 2 ? set[(set.length - 1) / 2] : (set[set.length / 2 - 1] + set[set.length / 2]) / 2;
      const percentil = (set.filter((x) => x < valorDia).length / set.length) * 100;
      j.afirmar(pt(valorDia) === m[1], `média diária recalculada ${valorDia} difere da exibida ${m[1]}`);
      j.afirmar(pt(mediana) === m[4], `mediana recalculada ${mediana} difere da exibida ${m[4]}`);
      j.afirmar(pt(percentil, 1) === m[2], `percentil recalculado ${percentil} difere do exibido ${m[2]}`);
      return `Exibido: média de 30/09/2026 R$ ${m[1]}, percentil ${m[2]}, mediana R$ ${m[4]} (${m[3]} dias). Recalculado em pld_diario.csv (SE): média ${valorDia.toFixed(4)}, percentil ${percentil.toFixed(2)} (fração de dias abaixo), mediana ${mediana.toFixed(4)}; diferenças só de arredondamento`;
    });

    await j.passo("Remove os dois filtros pelos chips e confere que voltam as 69 linhas", async () => {
      await clicar(raiz.getByRole("button", { name: /^Remover filtro Busca/ }).first());
      await j.esperar(400);
      const intermediaria = await contagem();
      j.afirmar(intermediaria.mostradas === 68, `esperava 68 linhas só com o filtro de mesmas horas, veio: ${intermediaria.texto}`);
      await clicar(raiz.getByRole("button", { name: /^Remover filtro Ponderada/ }).first());
      await j.esperar(400);
      const c = await contagem();
      j.afirmar(c.mostradas === 69 && c.total === 69, `esperava 69 de 69 linhas, veio: ${c.texto}`);
      const restantes = await raiz.getByRole("button", { name: /^Remover filtro/ }).count();
      j.afirmar(restantes === 0, `sobraram ${restantes} chips`);
      return `Depois do primeiro chip: "${intermediaria.texto}"; depois do segundo: "${c.texto}"; chips restantes: ${restantes}`;
    });

    await j.passo("Pagina a tabela inteira e confere que o CSV traz todas as linhas, não só a página", async () => {
      const proxima = raiz.getByRole("button", { name: /Próxima/i }).first();
      await proxima.scrollIntoViewIfNeeded();
      await clicar(proxima);
      await j.esperar(400);
      const rodape = N(await raiz.getByText(/Página \d+ de \d+ · linhas \d+ a \d+/).first().innerText());
      j.afirmar(/Página 2 de 3 · linhas 26 a 50/.test(rodape), `rodapé de paginação inesperado: ${rodape}`);
      const naPagina = (await lerLinhas()).length;
      const c = await contagem();
      const { nome, csv } = await baixarCsv();
      j.afirmar(csv.linhas.length === c.total && csv.linhas.length > naPagina, `o CSV tem ${csv.linhas.length} linhas, a tabela diz ${c.texto} e a página mostra ${naPagina}`);
      return `Rodapé: "${rodape}" (${naPagina} linhas na tela); "${c.texto}"; ${nome} com ${csv.linhas.length} linhas de dados, isto é, todas as páginas`;
    });
  },
};
