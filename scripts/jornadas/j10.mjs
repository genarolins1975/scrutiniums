/* J10, previsão passada e seu resultado (desktop 1440). Roteiro por script em Chromium headless: não é teste com pessoas.
   O leitor inspeciona uma previsão emitida no passado e o que se sabe do resultado: lê o painel Previsão atual, escolhe a
   rodada de 27/09/2026 (sem número) e a de 30/09/2026 (com 28 números) no Arquivo de emissões, usa o controle "Ver o arquivo
   como estava ao fim de" e confere, linha a linha, que nada foi reescrito. Os números vêm da página; o CSV baixado é
   comparado com a tela. */

const ORIGEM = "/setor-eletrico";
const ID_27 = "prosp_2026-09-27_20260927T191013Z";
const ID_30 = "prosp_2026-09-30_20260930T233117Z";

const normaliza = (t) => t.replace(/\s+/g, " ").trim();
const dias = (s) => {
  const m = s.match(/(\d\d)\/(\d\d)\/(\d{4})/);
  return Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86400000;
};
const br = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));

function lerCsv(texto) {
  const t = texto.replace(/^﻿/, "");
  const linhas = [];
  let campo = "";
  let linha = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c !== ""));
}

export default {
  id: "J10",
  titulo: "Leitor inspeciona uma previsão passada e o resultado, sem reescrita do histórico",
  perfil: "Leitor que quer auditar o que foi previsto antes do resultado (desktop 1440 px, modo Auditar)",
  largura: 1440,
  movel: false,
  limite: "Não há resultado publicado para comparar: nenhuma entrega prevista terminou até a publicação lida. Roteiro por script, sem pessoas.",
  async executar(j) {
    const p = j.p;
    const g = {}; // valores lidos que passos seguintes reaproveitam

    const tabelaArquivo = () => p.locator("main table").filter({ has: p.locator("th", { hasText: /sha256 do registro/ }) }).first();
    const caixaArquivo = () => tabelaArquivo().locator("xpath=ancestor::*[.//button[contains(., 'Baixar CSV') or contains(., 'BAIXAR CSV')]][1]");
    const contagemArquivo = async () => normaliza(await caixaArquivo().locator("[role=status]").filter({ hasText: /de \d+ linhas/ }).first().innerText());
    /** todas as linhas do arquivo na tela, por identificador; amplia a página se houver mais de uma */
    const lerArquivo = async () => {
      const caixa = caixaArquivo();
      await tabelaArquivo().scrollIntoViewIfNeeded();
      const sel = caixa.locator("select").last();
      if (await sel.count()) {
        const valores = await sel.locator("option").evaluateAll((o) => o.map((x) => Number(x.value)));
        const maior = Math.max(...valores);
        if ((await sel.inputValue()) !== String(maior)) {
          await j.agir(() => sel.selectOption(String(maior)));
          await j.esperar(700);
        }
      }
      const { cab, linhas } = await tabelaArquivo().evaluate((t) => {
        const n = (x) => x.replace(/\s+/g, " ").trim();
        return {
          cab: [...t.querySelectorAll("thead th")].map((th) => n(th.innerText).replace(/\s*[↕▲▼]\s*$/, "").trim()),
          linhas: [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.cells].map((td) => n(td.innerText))),
        };
      });
      const iId = cab.indexOf("Identificador");
      const mapa = new Map(linhas.map((l) => [l[iId], l]));
      j.afirmar(mapa.size === linhas.length, "identificadores repetidos na tabela do arquivo");
      return { cab, mapa, iId };
    };
    const resposta = async () => normaliza(await p.locator("[data-resposta=p015]").innerText());
    const porNome = (cab, linha) => Object.fromEntries(cab.map((c, i) => [c, linha[i]]));
    const barra = (rotulo) => p.locator(`g[role=button][aria-label^="${rotulo}"]`).first();

    // ---------- Previsão atual ----------
    await j.passo("Abre Previsões e modelos, escolhe Auditar e lê que nenhum modelo está aprovado e o número do B0", async () => {
      await p.goto(j.BASE + `${ORIGEM}/pld/previsoes`, { waitUntil: "networkidle" });
      await j.esperar(900);
      await j.clicar(p.getByRole("radio", { name: /auditar/i }));
      await j.esperar(700);
      j.afirmar(new URL(p.url()).searchParams.get("modo") === "auditar", `URL sem modo=auditar: ${j.url()}`);
      const t = normaliza(await p.locator("main").innerText());
      j.afirmar(/Não há previsão oficial do PLD: nenhum modelo está aprovado para produção/.test(t), "a página não diz que não há previsão oficial");
      const semanal = t.match(/B0 SEMANAL, SE\/CO R\$ ([\d.,]+)\/MWh/i);
      const mensal = t.match(/B0 MENSAL, SE\/CO R\$ ([\d.,]+)\/MWh/i);
      j.afirmar(semanal && mensal, "não achei os cartões B0 semanal e mensal do SE/CO");
      g.b0Semanal = semanal[1];
      g.b0Mensal = mensal[1];
      const rodada = t.match(/Rodada de (\d\d\/\d\d\/\d{4}) com o PLD horário da CCEE até (\d\d\/\d\d\/\d{4}); arquivo com (\d+) registros de (\d+) rodadas/);
      j.afirmar(rodada, "não achei a linha da rodada atual e do arquivo");
      g.total = Number(rodada[3]);
      return `modo=auditar; "Não há previsão oficial do PLD: nenhum modelo está aprovado para produção"; B0 semanal SE/CO R$ ${g.b0Semanal}/MWh e mensal R$ ${g.b0Mensal}/MWh; rodada de ${rodada[1]}, PLD até ${rodada[2]}; arquivo com ${rodada[3]} registros de ${rodada[4]} rodadas`;
    });

    await j.passo("Lê como a página separa a previsão (PREVISTO) do dado já publicado (OBSERVADO)", async () => {
      const t = normaliza(await p.locator("main").innerText());
      const trecho = (ini, fim) => {
        const i = t.search(ini);
        j.afirmar(i >= 0, `não achei ${ini}`);
        const resto = t.slice(i);
        const f = resto.search(fim);
        return f >= 0 ? resto.slice(0, f) : resto.slice(0, 600);
      };
      const cartaoB0 = trecho(/B0 SEMANAL, SE\/CO/i, /COMPROVE/i);
      const cartaoPub = trecho(/PLD JÁ PUBLICADO NO CORTE, SE\/CO/i, /COMPROVE/i);
      j.afirmar(/PREVISTO/i.test(cartaoB0), `o cartão do B0 não traz o selo PREVISTO: ${cartaoB0.slice(0, 120)}`);
      j.afirmar(/OBSERVADO/i.test(cartaoPub), `o cartão do PLD publicado não traz o selo OBSERVADO: ${cartaoPub.slice(0, 120)}`);
      j.afirmar(/É dado, não previsão/.test(cartaoPub), "o cartão do PLD publicado não diz que é dado, não previsão");
      const pub = cartaoPub.match(/R\$ ([\d.,]+)\/MWh\s+(\d\d\/\d\d\/\d{4}, \d\dh a \d\dh)/);
      j.afirmar(pub, "valor e janela do PLD publicado não lidos");
      j.afirmar(/nenhuma entrega prevista inclui essas horas/.test(t), "a página não diz que o PLD publicado não entra em nenhuma entrega");
      g.pldPublicado = pub[1];
      return `cartão B0: selo PREVISTO, R$ ${g.b0Semanal}/MWh; cartão PLD já publicado no corte: selo OBSERVADO, R$ ${pub[1]}/MWh (${pub[2]}), "É dado, não previsão"; a página acrescenta que "nenhuma entrega prevista inclui essas horas"`;
    });

    // ---------- Arquivo de emissões ----------
    await j.passo("Vai ao painel Arquivo de emissões pelo link da página e lê a contagem de registros e rodadas", async () => {
      await j.clicar(p.getByRole("link", { name: /P015\s*Arquivo de emissões/i }).first());
      await j.esperar(900);
      const topo = await p.evaluate(() => {
        const el = document.getElementById("p015");
        return el ? Math.round(el.getBoundingClientRect().top) : null;
      });
      j.afirmar(topo !== null && topo >= 0 && topo < 450, `o painel #p015 ficou a ${topo} px do topo`);
      const r = await resposta();
      const pega = (re, nome) => {
        const m = r.match(re);
        j.afirmar(m, `o painel não traz ${nome}: ${r.slice(0, 160)}`);
        return m;
      };
      const tot = pega(/O arquivo tem (\d+) registros de (\d+) rodadas/, "a contagem de registros e rodadas");
      const r27 = pega(/A rodada de 27\/09\/2026 \(B0, rodada interna\), emitida (\d+) minutos depois do prazo, não tem número: ([^;]*);/, "a rodada de 27/09 sem número");
      const tr = pega(/foi transcrita para o arquivo em (\d\d\/\d\d\/\d{4}), depois da emissão/, "a transcrição depois da emissão");
      const r30 = pega(/A rodada de 30\/09\/2026 \(B0, referência experimental\), emitida (\d+) minutos depois do prazo, tem (\d+) números/, "a rodada de 30/09 com números");
      const fim = pega(/Nenhuma entrega prevista terminou: ainda não há realizado; a primeira, (W[\d-]+), termina em (\d\d\/\d\d\/\d{4})/, "a data da primeira entrega");
      const m = [null, tot[1], tot[2], r27[1], r27[2], tr[1], r30[1], r30[2], fim[1], fim[2]];
      j.afirmar(Number(m[1]) === g.total, `a página diz ${g.total} registros em cima e ${m[1]} no painel`);
      g.arq = { total: Number(m[1]), rodadas: Number(m[2]), atraso27: m[3], motivo27: m[4], transcrita: m[5], atraso30: m[6], numeros30: Number(m[7]), primeira: m[8], termina: m[9] };
      const sub = normaliza(await p.getByText(/Arquivo imutável de emissões/).first().innerText());
      return `painel #p015 a ${topo} px do topo; ${m[1]} registros de ${m[2]} rodadas; rodada de 27/09: sem número, motivo "${m[4]}", emitida ${m[3]} min depois do prazo, transcrita em ${m[5]}; rodada de 30/09: ${m[7]} números, emitida ${m[6]} min depois do prazo; nenhuma entrega terminou, a primeira (${m[8]}) termina em ${m[9]}; subtítulo "${sub.slice(0, 60)}"`;
    });

    await j.passo("Escolhe a rodada de 27/09/2026 no gráfico e lê as linhas: sem número, motivo e sem realizado", async () => {
      const b = barra("Rodada de 27/09/2026: com número");
      await b.scrollIntoViewIfNeeded();
      const rotulo = await b.getAttribute("aria-label");
      await j.clicar(b);
      await j.esperar(800);
      j.afirmar(new URL(p.url()).searchParams.get("rod") === ID_27, `URL sem rod da rodada de 27/09: ${j.url()}`);
      const c = await contagemArquivo();
      j.afirmar(c === "28 de 28 linhas", `contagem: ${c}`);
      const { cab, mapa } = await lerArquivo();
      const linhas = [...mapa.values()].map((l) => porNome(cab, l));
      j.afirmar(linhas.length === 28, `linhas: ${linhas.length}`);
      for (const l of linhas) {
        j.afirmar(l["Número"] === "sem número", `número: ${l["Número"]}`);
        j.afirmar(l["Previsão arquivada (R$/MWh)"] === "sem dado", `previsão arquivada aparece como "${l["Previsão arquivada (R$/MWh)"]}"`);
        j.afirmar(l["Realizado (R$/MWh)"] === "sem dado", `realizado aparece como "${l["Realizado (R$/MWh)"]}"`);
        j.afirmar(/nenhum PLD do período exigido havia sido capturado até o corte/.test(l["Motivo sem número"]), `motivo: ${l["Motivo sem número"]}`);
      }
      const inc = [...new Set(linhas.map((l) => l["Incluída no arquivo em"]))];
      const transc = [...new Set(linhas.map((l) => l["Transcrita depois da emissão"]))];
      return `${rotulo}; ${c}; todas as 28 com "sem número", Previsão arquivada "sem dado" (nenhum 0), Realizado "sem dado", motivo "${linhas[0]["Motivo sem número"]}"; incluídas no arquivo em ${inc.join(", ")}; transcrita depois da emissão: ${transc.join(", ")}`;
    });

    await j.passo("Seleciona a primeira linha da rodada de 27/09 e lê a ficha do registro", async () => {
      const tab = tabelaArquivo();
      const botao = tab.locator("tbody tr").first().locator("button[aria-pressed]").first();
      await botao.scrollIntoViewIfNeeded();
      await j.clicar(botao);
      await j.esperar(800);
      j.afirmar((await botao.getAttribute("aria-pressed")) === "true", "a linha não ficou selecionada");
      const cab = p.getByRole("heading", { name: /^Registro / }).first();
      await cab.scrollIntoViewIfNeeded();
      const t = normaliza(await cab.locator("xpath=ancestor::*[self::div or self::section][1]").innerText());
      j.afirmar(/Registro W1 SE\/CO da rodada de 27\/09\/2026/.test(t), `título da ficha: ${t.slice(0, 60)}`);
      j.afirmar(/PREVISÃO sem número: nenhum PLD do período exigido havia sido capturado até o corte/.test(t), "a ficha não diz sem número com o motivo");
      j.afirmar(/REALIZADO ainda sem realizado \(a entrega não terminou\)/.test(t), "a ficha não diz que o realizado ainda não existe");
      j.afirmar(/CORREÇÃO registro original \(não substitui outro\)/.test(t), "a ficha não diz que é registro original");
      const sha = (t.match(/SHA256 ([0-9a-f]{64})/) || [])[1];
      j.afirmar(sha, "sha256 não lido na ficha");
      return `${j.url().replace(/^.*\?/, "?")}; ficha "Registro W1 SE/CO da rodada de 27/09/2026": PREVISÃO "sem número: nenhum PLD do período exigido havia sido capturado até o corte"; REALIZADO "ainda sem realizado (a entrega não terminou)"; INCLUSÃO "28/09/2026; transcrito depois da emissão: sim"; CORREÇÃO "registro original (não substitui outro)"; sha256 ${sha.slice(0, 12)}...`;
    });

    await j.passo("Escolhe a rodada de 30/09/2026 no gráfico e lê as linhas: com número, sem faixa e sem realizado", async () => {
      const b = barra("Rodada de 30/09/2026: com número");
      await b.scrollIntoViewIfNeeded();
      const rotulo = await b.getAttribute("aria-label");
      await j.clicar(b);
      await j.esperar(800);
      j.afirmar(new URL(p.url()).searchParams.get("rod") === ID_30, `URL sem rod da rodada de 30/09: ${j.url()}`);
      const c = await contagemArquivo();
      j.afirmar(c === "28 de 28 linhas", `contagem: ${c}`);
      const { cab, mapa } = await lerArquivo();
      const linhas = [...mapa.values()].map((l) => porNome(cab, l));
      j.afirmar(linhas.length === 28, `linhas: ${linhas.length}`);
      for (const l of linhas) {
        j.afirmar(l["Número"] === "com número" && /^\d/.test(l["Previsão arquivada (R$/MWh)"]), `linha sem número: ${JSON.stringify(l["Número"])} ${l["Previsão arquivada (R$/MWh)"]}`);
        j.afirmar(l["P10 (R$/MWh)"] === "sem dado" && l["P90 (R$/MWh)"] === "sem dado", "a rodada de 30/09 mostra faixa P10/P90, mas nenhum segmento está calibrado");
        j.afirmar(l["Realizado (R$/MWh)"] === "sem dado", `realizado: ${l["Realizado (R$/MWh)"]}`);
      }
      const w1 = linhas.find((l) => l["Horizonte"] === "W1" && l["Submercado"] === "SE/CO");
      g.arquivo30 = w1["Previsão arquivada (R$/MWh)"];
      return `${rotulo}; ${c}; todas "com número", P10 e P90 "sem dado" (sem faixa), Realizado "sem dado"; W1 SE/CO arquivada em R$ ${w1["Previsão arquivada (R$/MWh)"]}/MWh, emitida em ${w1["Emitida em (Brasília)"]}, atraso ${w1["Atraso sobre o prazo (min)"]} min, código ${w1["Versão do código"]}`;
    });

    await j.passo("Seleciona W1 SE/CO da rodada de 30/09 e compara a previsão arquivada com a de Previsão atual", async () => {
      const tab = tabelaArquivo();
      const linha = tab.locator("tbody tr").filter({ hasText: ":W1:SE:B0" }).first();
      const botao = linha.locator("button[aria-pressed]").first();
      await botao.scrollIntoViewIfNeeded();
      await j.clicar(botao);
      await j.esperar(800);
      const cab = p.getByRole("heading", { name: /^Registro W1 SE\/CO da rodada de 30\/09\/2026/ }).first();
      await cab.scrollIntoViewIfNeeded();
      const t = normaliza(await cab.locator("xpath=ancestor::*[self::div or self::section][1]").innerText());
      const prev = t.match(/PREVISÃO R\$ ([\d.,]+)\/MWh/);
      j.afirmar(prev, `previsão não lida na ficha: ${t.slice(0, 120)}`);
      j.afirmar(/FAIXA P10 A P90 sem faixa gravada/.test(t), "a ficha não diz sem faixa gravada");
      j.afirmar(/REALIZADO ainda sem realizado \(a entrega não terminou\)/.test(t), "a ficha não diz que o realizado não existe");
      const arq = br(prev[1]);
      const atual = br(g.b0Semanal);
      j.afirmar(Math.abs(arq - atual) < 0.005, `a previsão arquivada (${prev[1]}) difere da de Previsão atual (${g.b0Semanal}) além do arredondamento`);
      return `ficha: PREVISÃO R$ ${prev[1]}/MWh, FAIXA "sem faixa gravada", REALIZADO "ainda sem realizado"; o painel Previsão atual mostra R$ ${g.b0Semanal}/MWh para o mesmo W1 SE/CO (mesmo número com 2 casas; o arquivo guarda ${prev[1].split(",")[1].length}); PLD já publicado no corte, outro dado: R$ ${g.pldPublicado}/MWh`;
    });

    // ---------- Arquivo como estava ----------
    let hoje;
    await j.passo("Desfaz a escolha de rodada e mostra as 56 linhas do arquivo de hoje, guardando cada uma pelo identificador", async () => {
      const b = barra("Rodada de 30/09/2026: com número");
      await b.scrollIntoViewIfNeeded();
      await j.clicar(b);
      await j.esperar(800);
      j.afirmar(!new URL(p.url()).searchParams.get("rod"), `a rodada continua na URL: ${j.url()}`);
      const c = await contagemArquivo();
      j.afirmar(c === `${g.total} de ${g.total} linhas`, `contagem: ${c}`);
      hoje = await lerArquivo();
      j.afirmar(hoje.mapa.size === g.total, `linhas lidas: ${hoje.mapa.size}`);
      const r27 = [...hoje.mapa.keys()].filter((k) => k.startsWith(ID_27)).length;
      const r30 = [...hoje.mapa.keys()].filter((k) => k.startsWith(ID_30)).length;
      j.afirmar(r27 === 28 && r30 === 28, `rodadas: ${r27} e ${r30}`);
      return `${c}; ${hoje.mapa.size} identificadores únicos: 28 da rodada de 27/09 e 28 da de 30/09`;
    });

    let antigo;
    await j.passo("Usa Ver o arquivo como estava ao fim de 29/09/2026: o texto e as linhas visíveis são só as que existiam", async () => {
      const campo = p.locator("input[type=date]").last();
      await campo.scrollIntoViewIfNeeded();
      const min = await campo.getAttribute("min");
      const max = await campo.getAttribute("max");
      await j.agir(() => campo.fill("2026-09-29"));
      await j.esperar(900);
      j.afirmar(new URL(p.url()).searchParams.get("em") === "2026-09-29", `URL sem em=2026-09-29: ${j.url()}`);
      const r = await resposta();
      const m = r.match(/Ao fim de 29\/09\/2026, o arquivo tinha (\d+) registros \(de (\d+) hoje\) de (\d+) rodada/);
      j.afirmar(m, `texto inesperado: ${r.slice(0, 160)}`);
      j.afirmar(Number(m[1]) === 28 && Number(m[2]) === g.total, `a página diz ${m[1]} de ${m[2]}`);
      antigo = await lerArquivo();
      j.afirmar(antigo.mapa.size === 28, `a tabela mostra ${antigo.mapa.size} linhas, não 28`);
      const ids = [...antigo.mapa.keys()];
      const esperados = [...hoje.mapa.keys()].filter((k) => hoje.mapa.get(k)[hoje.cab.indexOf("Incluída no arquivo em")] && dias(hoje.mapa.get(k)[hoje.cab.indexOf("Incluída no arquivo em")]) <= dias("29/09/2026"));
      j.afirmar(ids.every((k) => esperados.includes(k)) && esperados.every((k) => ids.includes(k)), "as linhas visíveis não são exatamente as que já estavam incluídas em 29/09/2026");
      j.afirmar(!ids.some((k) => k.startsWith(ID_30)), "há linha da rodada de 30/09 na visão de 29/09");
      const cont = await contagemArquivo();
      return `controle aceita datas de ${min} a ${max}; texto: "Ao fim de 29/09/2026, o arquivo tinha ${m[1]} registros (de ${m[2]} hoje) de ${m[3]} rodada"; tabela "${cont}"; as 28 linhas são exatamente as incluídas até 29/09/2026 (todas da rodada de 27/09) e nenhuma da rodada de 30/09`;
    });

    await j.passo("Compara célula a célula as 28 linhas da visão antiga com as mesmas linhas de hoje", async () => {
      let celulas = 0;
      const dif = [];
      for (const [id, linha] of antigo.mapa) {
        const h = hoje.mapa.get(id);
        j.afirmar(h, `a linha ${id} da visão antiga não existe hoje`);
        linha.forEach((v, i) => {
          celulas++;
          if (v !== h[i]) dif.push(`${id.split(":").slice(1).join(":")} / ${antigo.cab[i]}: antes "${v}", hoje "${h[i]}"`);
        });
      }
      j.afirmar(dif.length === 0, `${dif.length} célula(s) mudaram, primeira: ${dif[0]}`);
      return `${antigo.mapa.size} linhas e ${celulas} células comparadas (inclusive Previsão arquivada, Realizado, sha256 e Incluída no arquivo em): nenhuma diferença entre a visão de 29/09 e a de hoje`;
    });

    await j.passo("Usa a data 30/09/2026 (a rodada nova já incluída) e depois limpa a data: volta às 56 linhas iguais às de hoje", async () => {
      const campo = p.locator("input[type=date]").last();
      await j.agir(() => campo.fill("2026-09-30"));
      await j.esperar(900);
      const r = await resposta();
      const m = r.match(/Ao fim de 30\/09\/2026, o arquivo tinha (\d+) registros de (\d+) rodadas/);
      j.afirmar(m && Number(m[1]) === g.total, `texto de 30/09: ${r.slice(0, 160)}`);
      const v30 = await lerArquivo();
      j.afirmar(v30.mapa.size === g.total, `linhas em 30/09: ${v30.mapa.size}`);
      let dif = 0;
      for (const [id, linha] of v30.mapa) {
        const h = hoje.mapa.get(id);
        if (!h || h.some((v, i) => v !== linha[i])) dif++;
      }
      j.afirmar(dif === 0, `${dif} linha(s) da visão de 30/09 diferem das de hoje`);
      await j.agir(() => campo.fill(""));
      await j.esperar(900);
      j.afirmar(!new URL(p.url()).searchParams.get("em"), `a data continua na URL: ${j.url()}`);
      const r2 = await resposta();
      j.afirmar(/^O arquivo tem 56 registros de 2 rodadas/.test(r2), `texto sem data: ${r2.slice(0, 80)}`);
      return `"Ao fim de 30/09/2026, o arquivo tinha ${m[1]} registros de ${m[2]} rodadas"; as ${v30.mapa.size} linhas coincidem com as de hoje; com a data limpa, a URL perde em= e o texto volta a "O arquivo tem 56 registros de 2 rodadas"`;
    });

    await j.passo("Baixa o CSV Emissões registradas e confere contra a tela: 56 linhas, sha256 iguais, sem número é campo vazio", async () => {
      const a = await j.baixar("/energia/series/previsoes_emissoes.csv");
      j.afirmar(a.status === 200 && /csv/.test(a.tipo), `resposta ${a.status} ${a.tipo}`);
      const csv = lerCsv(a.corpo);
      const cab = csv[0];
      const col = (n) => cab.indexOf(n);
      const linhas = csv.slice(1);
      j.afirmar(linhas.length === g.total, `o CSV tem ${linhas.length} linhas e a tela ${g.total}`);
      const iId = col("forecast_id");
      const iSha = col("sha256");
      const iSha_t = hoje.cab.indexOf("sha256 do registro");
      let semNumero = 0;
      for (const l of linhas) {
        const tela = hoje.mapa.get(l[iId]);
        j.afirmar(tela, `a linha ${l[iId]} do CSV não está na tela`);
        j.afirmar(tela[iSha_t] === l[iSha], `sha256 diferente em ${l[iId]}`);
        const prevTela = tela[hoje.cab.indexOf("Previsão arquivada (R$/MWh)")];
        const prevCsv = l[col("previsao")];
        if (prevTela === "sem dado") {
          j.afirmar(prevCsv === "", `previsão sem dado na tela, "${prevCsv}" no CSV em ${l[iId]}`);
          j.afirmar(l[col("realizado")] === "" && l[col("p10")] === "" && l[col("p90")] === "", `realizado ou faixa preenchidos em ${l[iId]}`);
          semNumero++;
        } else {
          j.afirmar(Math.abs(br(prevTela) - Number(prevCsv)) < 0.00006, `previsão ${prevTela} na tela e ${prevCsv} no CSV em ${l[iId]}`);
        }
      }
      j.afirmar(semNumero === 28, `sem número no CSV: ${semNumero}`);
      return `${linhas.length} linhas (como na tela); os 56 sha256 coincidem com a coluna sha256 do registro; as ${semNumero} linhas sem número têm previsao, realizado, p10 e p90 vazios (não 0); as 28 com número batem com a tela até a 4ª casa`;
    });

    await j.passo("Confere as frases do painel: arquivo imutável, nada reescrito, sem faixa calibrada não vira probabilidade", async () => {
      const t = normaliza(await p.locator("main").innerText());
      const frases = {
        imutavel: /Arquivo imutável de emissões · uma linha por célula/,
        original: /Todas as emissões como foram registradas, antes do resultado|guarda todas as emissões como foram registradas, antes do resultado, para que o desempenho possa ser medido depois sem reescrever nada/,
        probabilidade: /Sem faixa calibrada, não há probabilidade associada ao número\./,
        aprovada: /Não é previsão aprovada nem diz que o preço vai ficar onde está/,
        semFaixa: /Sem faixa de incerteza: nenhum segmento está calibrado\./,
      };
      const achadas = {};
      for (const [k, re] of Object.entries(frases)) {
        const m = t.match(re);
        j.afirmar(m, `a página não traz a frase ${k}: ${re}`);
        achadas[k] = m[0];
      }
      return `imutável: "${achadas.imutavel}"; "${achadas.original.slice(0, 120)}"; "${achadas.probabilidade}"; "${achadas.aprovada}"; "${achadas.semFaixa}"`;
    });

    await j.passo("Abre Desempenho e calibração e lê que ainda não há resultado para comparar com a previsão", async () => {
      await j.clicar(p.getByRole("link", { name: /P016\s*Desempenho e calibração/i }).first());
      await p.waitForLoadState("networkidle");
      await j.esperar(900);
      j.afirmar(/\/pld\/modelos/.test(p.url()), `URL inesperada: ${j.url()}`);
      const t = normaliza(await p.locator("main").innerText());
      j.afirmar(/Ainda não é possível responder no portal/.test(t), `o painel não diz que ainda não é possível responder (URL ${j.url()})`);
      const m = t.match(/nenhuma das (\d+) previsões com número tem realizado: a primeira entrega termina em (\d\d\/\d\d\/\d{4})/);
      j.afirmar(m, `o painel de desempenho não diz que nenhuma previsão tem realizado (URL ${j.url()})`);
      j.afirmar(Number(m[1]) === g.arq.numeros30, `o painel diz ${m[1]} previsões e o arquivo, ${g.arq.numeros30}`);
      j.afirmar(m[2] === g.arq.termina, `termina em ${m[2]} aqui e ${g.arq.termina} no arquivo`);
      const modo = normaliza(await p.locator("[role=radio][aria-checked=true]").first().innerText());
      return `${j.url()} (modo de profundidade marcado: ${modo}; modo na URL: ${new URL(p.url()).searchParams.get("modo") || "nenhum"}; a página anterior estava em auditar); "No acompanhamento prospectivo, nenhuma das ${m[1]} previsões com número tem realizado: a primeira entrega termina em ${m[2]}" (igual ao arquivo: ${g.arq.numeros30} números, primeira entrega ${g.arq.primeira} termina em ${g.arq.termina}); o painel diz que os números de desempenho do teste retrospectivo ficam retidos`;
    });
  },
};
