/* J3 · Analista (desktop 1440): identifica uma variação de preço, examina o contexto e acessa a evidência
   sem confundir períodos. Roteiro por script: cada passo confere um fato lido da página. */

const N = (s) => String(s ?? "").replace(/[  ]/g, " ").replace(/[ \t]+/g, " ").trim();
const D = "(\\d[\\d.]*(?:,\\d+)?)"; // número em pt-BR, sem pontuação final
const num = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", "."));
const fmt = (v, c = 2) => v.toFixed(c).replace(".", ",").replace("-", "−");

export default {
  id: "J3",
  titulo: "Analista: ler a variação do PLD, abrir a ficha e conferir período, fonte e versão",
  perfil: "Analista de mercado, desktop 1440",
  largura: 1440,
  movel: false,
  limite:
    "Roteiro por script confere que período, fonte e versão estão escritos e coerentes entre o número e a ficha; não avalia se um analista confiaria na evidência nem reproduz o cálculo da ficha.",
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
    const kpis = {};
    const lido = {};

    const lerTabela = async () => {
      const tabela = p.locator("table:visible", { hasText: "Dias completos" }).first();
      await tabela.waitFor({ state: "visible", timeout: 15000 });
      await tabela.locator("tbody tr").first().waitFor({ state: "visible", timeout: 8000 });
      const cab = await tabela.locator("thead th").evaluateAll((es) => es.map((e) => e.innerText.replace(/\s+/g, " ").replace(/[↕▲▼]/g, "").trim()));
      const linhas = await tabela.locator("tbody tr").evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll("td,th")].map((c) => c.innerText.trim())));
      return (mes) => {
        const l = linhas.find((r) => r[0] === mes);
        j.afirmar(l, `a tabela não tem a linha ${mes}`);
        return (nome) => l[cab.findIndex((c) => c.startsWith(nome))];
      };
    };

    await j.passo("Abre o histórico do PLD e lê até quando vão os dados", async () => {
      await ir(j.BASE + "/setor-eletrico/pld/historico");
      await p.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible", timeout: 10000 });
      const h1 = N(await p.getByRole("heading", { level: 1 }).first().innerText());
      j.afirmar(/Histórico e distribuição/.test(h1), `h1 inesperado: ${h1}`);
      const texto = N(await p.locator("main").innerText());
      const fontes = texto.match(/CCEE \(PLD até (\d{2}\/\d{2}\/\d{4}) às (\d+)h\), ONS \(carga do balanço até (\d{2}\/\d{2}\/\d{4}) às (\d+)h\)/);
      j.afirmar(fontes, "a página não declara até quando vão o PLD e a carga");
      lido.pldAte = fontes[1];
      lido.cargaAte = fontes[3];
      return `h1 "${h1}"; PLD até ${fontes[1]} às ${fontes[2]}h; carga do balanço do ONS até ${fontes[3]} às ${fontes[4]}h`;
    });

    await j.passo("Lê os quatro números de destaque e o período de cada um", async () => {
      const grupos = await p.locator("main [role=group][aria-label]").evaluateAll((es) =>
        es.map((e) => ({ rotulo: e.getAttribute("aria-label"), texto: e.innerText.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim(), botao: !!e.querySelector("button[data-comprove]") })),
      );
      const acha = (re) => grupos.find((g) => re.test(g.rotulo));
      const dia = acha(/^Média diária de/i);
      const temporal = acha(/^Média temporal de/i);
      const balanco = acha(/^Ponderada pela carga do balanço/i);
      const semMmgd = acha(/^Ponderada pela carga sem MMGD/i);
      j.afirmar(dia && temporal && balanco && semMmgd, `faltam destaques: ${grupos.map((g) => g.rotulo).join(" | ")}`);
      const valor = (g) => g.texto.match(/R\$ ([\d.,]+)\/MWh/)?.[1];
      const periodo = (g) => g.texto.match(/(\d{2}\/\d{2}\/\d{4}(?: \d{2}:\d{2} a \d{2}\/\d{2}\/\d{4} \d{2}:\d{2})?)/)?.[1] ?? null;
      Object.assign(kpis, {
        dia: { rotulo: dia.rotulo, valor: valor(dia), periodo: periodo(dia), botao: dia.botao },
        temporal: { rotulo: temporal.rotulo, valor: valor(temporal), periodo: periodo(temporal), botao: temporal.botao },
        balanco: { rotulo: balanco.rotulo, valor: valor(balanco), periodo: periodo(balanco), botao: balanco.botao },
        semMmgd: { rotulo: semMmgd.rotulo, valor: valor(semMmgd), periodo: periodo(semMmgd), botao: semMmgd.botao },
      });
      for (const [k, v] of Object.entries(kpis)) j.afirmar(v.valor, `destaque ${k} sem valor em R$/MWh`);
      j.afirmar(/30\/09\/2026/.test(dia.rotulo) && periodo(dia) === "30/09/2026", "a média diária não traz a data de referência 30/09/2026");
      j.afirmar(/ago\/2026/i.test(temporal.rotulo), "o rótulo da média temporal não diz o mês");
      j.afirmar(balanco.rotulo.includes("ago/2026") && balanco.texto.includes("01/08/2026 00:00 a 31/08/2026 23:00"), "a ponderada pelo balanço não traz o intervalo de ago/2026");
      const l = (k) => `${kpis[k].rotulo}: R$ ${kpis[k].valor}, período ${kpis[k].periodo ?? "sem linha de período"}, ${kpis[k].botao ? 'com "Comprove este número"' : 'sem "Comprove este número"'}`;
      return [l("dia"), l("temporal"), l("balanco"), l("semMmgd")].join(" || ");
    });

    /** em Entender a tabela longa vem recolhida; o leitor que quer conferir os números abre o botão que a mostra */
    const abreTabela = async (cabecalho) => {
      const alvo = p.locator("main [data-recolhivel='fechada']").filter({ has: p.locator("th", { hasText: cabecalho }) }).first();
      if (!(await alvo.count())) return;
      await clicar(p.locator(`main button[aria-controls="${await alvo.getAttribute("id")}"]`));
      await j.esperar(300);
    };

    await j.passo("Identifica a variação entre set/2026 e ago/2026 e confere na tabela mensal", async () => {
      const texto = N(await p.locator("main").innerText());
      const setLead = texto.match(new RegExp(`set/2026: média temporal de R\\$ ${D}/MWh`))?.[1];
      j.afirmar(setLead, "o texto de abertura não traz a média temporal de set/2026");
      const ago = kpis.temporal.valor;
      await abreTabela("Dias completos");
      const busca = p.locator("input[type=search]").first();
      await busca.scrollIntoViewIfNeeded();
      const linha = await lerTabela();
      const setTab = linha("09/2026")("Média temporal");
      const agoTab = linha("08/2026")("Média temporal");
      j.afirmar(setTab === setLead, `set/2026: tabela ${setTab}, texto ${setLead}`);
      j.afirmar(agoTab === ago, `ago/2026: tabela ${agoTab}, destaque ${ago}`);
      const dif = num(setLead) - num(ago);
      const pct = (dif / num(ago)) * 100;
      lido.set = setLead;
      lido.ago = ago;
      const diaTxt = texto.match(new RegExp(`Em 30/09/2026, a média diária do PLD do Sudeste/Centro-Oeste foi R\\$ ${D}/MWh: percentil ${D} entre as (\\d+) médias diárias de setembro de 2021 a 2025 \\(mediana R\\$ ${D}/MWh\\)`));
      j.afirmar(diaTxt, "o texto de abertura não traz o percentil da média diária");
      j.afirmar(diaTxt[1] === kpis.dia.valor, `média diária: texto ${diaTxt[1]}, destaque ${kpis.dia.valor}`);
      return `Média temporal do Sudeste/Centro-Oeste: set/2026 R$ ${setLead} contra ago/2026 R$ ${ago}, variação ${fmt(dif)} R$/MWh (${fmt(pct, 1)}%), iguais no texto, no destaque e na tabela. Dia 30/09/2026: R$ ${diaTxt[1]}, percentil ${diaTxt[2]} entre ${diaTxt[3]} dias de setembro de 2021 a 2025 (mediana R$ ${diaTxt[4]})`;
    });

    await j.passo("Procura o aviso de mês parcial e confere a linha de set/2026 na tabela", async () => {
      const texto = N(await p.locator("main").innerText());
      const aviso = texto.match(/No mês em curso, as ponderadas usam só as horas com carga publicada[^.]*\./)?.[0];
      j.afirmar(aviso, 'o aviso "No mês em curso, as ponderadas usam só as horas com carga publicada" não está na página');
      const linha = await lerTabela();
      const set = linha("09/2026");
      const ago = linha("08/2026");
      const col = (f, c) => f(c);
      const horasPld = col(set, "Horas com PLD");
      const horasCarga = col(set, "Horas com carga do balanço");
      j.afirmar(Number(horasCarga) < Number(horasPld), `esperava menos horas de carga que de PLD em set/2026: ${horasCarga} e ${horasPld}`);
      j.afirmar(col(set, "Ponderada nas mesmas horas da temporal") === "não" && col(ago, "Ponderada nas mesmas horas da temporal") === "sim", "coluna das mesmas horas não distingue set/2026 de ago/2026");
      const temFiltro = (await p.locator("summary", { hasText: /Mês parcial/i }).count()) > 0;
      return `Aviso na página: "${aviso.slice(0, 150)}..." Tabela em 09/2026: dias completos ${col(set, "Dias completos")}, mês parcial "${col(set, "Mês parcial")}", ${horasPld} horas com PLD e ${horasCarga} com carga do balanço, "ponderada nas mesmas horas" = ${col(set, "Ponderada nas mesmas horas da temporal")} (em 08/2026: ${col(ago, "Ponderada nas mesmas horas da temporal")}); filtro "Mês parcial" existe: ${temFiltro ? "sim" : "não"}`;
    });

    await j.passo('Abre a ficha "Comprove este número" da ponderada pela carga do balanço de ago/2026', async () => {
      const botao = p.getByRole("button", { name: /ago\/2026 ponderado pela carga do balan/i }).first();
      await botao.scrollIntoViewIfNeeded();
      await clicar(botao);
      const ficha = p.locator("dialog[open]");
      await ficha.waitFor({ state: "visible", timeout: 8000 });
      await j.esperar(500);
      const t = N(await ficha.innerText());
      lido.ficha = t;
      const titulo = t.match(/PLD médio de ago\/2026 ponderado pela carga do balanço do ONS/i)?.[0];
      j.afirmar(titulo, "o título da ficha não repete o número aberto");
      const exibido = t.match(new RegExp(`VALOR EXIBIDO\\s+R\\$ ${D}/MWh`, "i"))?.[1];
      const calculo = t.match(/VALOR DE CÁLCULO\s+([\d.,]+)\s+R\$\/MWh/i)?.[1];
      const periodo = t.match(/PER[ÍI]ODO\s+(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} a \d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/i)?.[1];
      j.afirmar(exibido === kpis.balanco.valor, `valor da ficha (${exibido}) difere do destaque (${kpis.balanco.valor})`);
      j.afirmar(periodo === kpis.balanco.periodo, `período da ficha (${periodo}) difere do destaque (${kpis.balanco.periodo})`);
      j.afirmar(/mês 2026-08/.test(t), 'a ficha não filtra "mês 2026-08"');
      j.afirmar(calculo && fmt(num(calculo)) === exibido, `valor de cálculo ${calculo} não arredonda para ${exibido}`);
      return `Ficha aberta: "${titulo}". Valor exibido R$ ${exibido}/MWh (igual ao destaque), valor de cálculo ${calculo}. Período da ficha "${periodo}" igual ao do destaque (${kpis.balanco.periodo}) e ao mês do rótulo (ago/2026, filtro "mês 2026-08")`;
    });

    await j.passo("Lê na ficha a fonte, o arquivo (sha256), a fórmula e a versão", async () => {
      const t = lido.ficha;
      const fonte = t.match(/FONTE\s+(CCEE; ONS · [^\n]+?)(?:\s+ARQUIVO 1|\n)/i)?.[1];
      const hashes = [...t.matchAll(/sha256 ([0-9a-f]{64})/g)].map((m) => m[1]);
      const formula = t.match(/Σ PLD_h × carga_h ÷ Σ carga_h \(carga_h > 0\)/)?.[0];
      const versao = t.match(/PIPELINE\s+(energia-[\d.]+)/i)?.[1];
      const codigo = t.match(/CÓDIGO\s+([0-9a-f]{12}(?:\+alterado)?)/i)?.[1];
      const publicado = t.match(/PUBLICADO EM\s+(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} \(Brasília\))/i)?.[1];
      const captura = t.match(/Capturado em (\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} \(Brasília\))/)?.[1];
      const ressalva = /Publicado com alterações fora do commit/.test(t);
      const reproduz = /PASSOS DE REPRODUÇÃO/i.test(t) && /git checkout/.test(t);
      j.afirmar(fonte, "a ficha não nomeia a fonte");
      j.afirmar(hashes.length >= 2, `esperava ao menos dois sha256, vieram ${hashes.length}`);
      j.afirmar(formula, "a ficha não traz a fórmula");
      j.afirmar(versao && publicado, "a ficha não traz versão e data de publicação");
      j.afirmar(reproduz, "a ficha não traz passos de reprodução");
      return `Fonte: ${fonte.slice(0, 70)}; ${hashes.length} arquivos com sha256 (${hashes[0].slice(0, 8)}..., ${hashes[1].slice(0, 8)}...); captura ${captura}; fórmula "${formula}"; versão ${versao}, código ${codigo}, publicada em ${publicado}; aviso de código alterado fora do commit: ${ressalva ? "sim" : "não"}`;
    });

    await j.passo("Fecha a ficha com a tecla Esc e confere o retorno do foco", async () => {
      await agir(async () => p.keyboard.press("Escape"));
      await j.esperar(400);
      const abertas = await p.locator("dialog[open]").count();
      j.afirmar(abertas === 0, "a ficha continuou aberta depois do Esc");
      const foco = await p.evaluate(() => (document.activeElement?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90));
      j.afirmar(/Comprove este número/i.test(foco), `o foco não voltou ao botão que abriu a ficha: "${foco}"`);
      return `Ficha fechada (0 diálogos abertos); foco de volta em "${foco}"`;
    });

    await j.passo("Abre a ficha da ponderada sem MMGD e compara período, valor, fonte e fórmula com a primeira", async () => {
      const botao = p.getByRole("button", { name: /ago\/2026 ponderado pela carga sem MMGD/i }).first();
      await botao.scrollIntoViewIfNeeded();
      await clicar(botao);
      const ficha = p.locator("dialog[open]");
      await ficha.waitFor({ state: "visible", timeout: 8000 });
      await j.esperar(500);
      const t = N(await ficha.innerText());
      const exibido = t.match(new RegExp(`VALOR EXIBIDO\\s+R\\$ ${D}/MWh`, "i"))?.[1];
      const periodo = t.match(/PER[ÍI]ODO\s+(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} a \d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/i)?.[1];
      j.afirmar(exibido === kpis.semMmgd.valor, `valor da ficha (${exibido}) difere do destaque (${kpis.semMmgd.valor})`);
      j.afirmar(periodo === kpis.semMmgd.periodo && periodo === kpis.balanco.periodo, `período da ficha (${periodo}) difere do destaque`);
      const fonte = t.match(/FONTE\s+(CCEE; ONS · PLD_HORARIO; [^\n]+?)(?:\s+ARQUIVO 1|\n)/i)?.[1] ?? "";
      const formula = t.match(/Σ PLD_h × \(global_h − MMGD_h\) ÷ Σ \(global_h − MMGD_h\)/)?.[0] ?? "";
      const peso = t.match(/a MMGD estimada fica fora do peso/)?.[0] ?? "";
      j.afirmar(/Carga Verificada/.test(fonte) && formula && peso, "a ficha da ponderada sem MMGD não declara a fonte da carga, a fórmula e o tratamento da MMGD");
      const dif = num(kpis.semMmgd.valor) - num(kpis.balanco.valor);
      await agir(async () => p.keyboard.press("Escape"));
      await j.esperar(400);
      return `Ficha da ponderada sem MMGD: R$ ${exibido}/MWh, período "${periodo}" (o mesmo da outra ficha), fonte da carga "Carga Verificada" (a outra usa o Balanço de Energia), fórmula "${formula}", "${peso}". Diferença para a ponderada pelo balanço: R$ ${fmt(dif)}/MWh, só pela escolha do peso`;
    });
  },
};
