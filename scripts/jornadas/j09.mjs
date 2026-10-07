/* J9, ausência legítima ou fonte defasada (desktop 1440). Roteiro por script em Chromium headless: não é teste com pessoas.
   O leitor quer saber se "sem dado" e "atrasado" querem dizer zero. Percorre a página de saúde dos dados (situação
   atrasado e sem dado, com a conta do atraso refeita a partir das datas da própria página), confere em três tabelas de
   módulos (Perdas, Restrições, Histórico do PLD) que toda célula "sem dado" da tela é célula vazia no CSV baixado, e abre
   o painel do catálogo e as fichas completas dos conjuntos. Os números são lidos da página. */
import { readFile } from "node:fs/promises";

const ORIGEM = "/setor-eletrico";

/** "dd/mm/aaaa" para dias desde 1970 */
const dias = (s) => {
  const m = s.match(/(\d\d)\/(\d\d)\/(\d{4})/);
  return Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86400000;
};
/** "dd/mm/aaaa, hh:mm" ou "dd/mm/aaaa hh:mm" para minutos desde 1970 */
const minutos = (s) => {
  const m = s.match(/(\d\d)\/(\d\d)\/(\d{4})[, ]+(?:às )?(\d\d):(\d\d)/);
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) / 60000;
};
const normaliza = (t) => t.replace(/\s+/g, " ").trim();
const semSeta = (t) => normaliza(t).replace(/\s*[↕▲▼▴▾]\s*$/, "").trim();

/** CSV com ponto e vírgula, BOM e aspas, em linhas de campos */
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
  return linhas;
}

export default {
  id: "J9",
  titulo: "Leitor entende que sem dado e atrasado não são zero",
  perfil: "Leitor que precisa saber se uma lacuna é zero, atraso ou ausência da fonte (desktop 1440 px)",
  largura: 1440,
  movel: false,
  limite: "Confere a ausência em três tabelas e duas fichas; não cobre todos os módulos. Roteiro por script, sem pessoas.",
  async executar(j) {
    const p = j.p;
    const guardado = {}; // valores lidos que passos seguintes reaproveitam

    const abrir = async (caminho) => {
      await p.goto(j.BASE + caminho, { waitUntil: "networkidle" });
      await j.esperar(900);
    };
    const analisar = async () => {
      await j.clicar(p.getByRole("radio", { name: /analisar/i }));
      await j.esperar(600);
    };
    /** a ficha do conjunto guarda coleta, snapshot e capturas num bloco fechado; abre para ler */
    const abreDetalhesTecnicos = async () => {
      const resumo = p.locator("details[data-detalhes-tecnicos] > summary");
      await resumo.scrollIntoViewIfNeeded();
      await j.clicar(resumo);
      await j.esperar(300);
    };
    /** rola até a tabela com o cabeçalho pedido aparecer (as tabelas carregam sob demanda) */
    const acharTabela = async (rotuloCabecalho) => {
      const tab = p.locator("main table").filter({ has: p.locator("th", { hasText: rotuloCabecalho }) }).first();
      for (let i = 0; i < 40 && (await tab.count()) === 0; i++) {
        await p.evaluate(() => window.scrollBy(0, 900));
        await j.esperar(150);
      }
      j.afirmar((await tab.count()) > 0, `tabela com cabeçalho ${rotuloCabecalho} não apareceu`);
      await tab.scrollIntoViewIfNeeded();
      return tab;
    };
    const lerTabela = (tab) =>
      tab.evaluate((t) => {
        const n = (x) => x.replace(/\s+/g, " ").trim();
        const cab = [...t.querySelectorAll("thead th")].map((th) => n(th.innerText).replace(/\s*[↕▲▼]\s*$/, "").trim());
        const linhas = [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.cells].map((td) => n(td.innerText)));
        return { cab, linhas };
      });
    const filtrar = async (rotuloSummary, rotuloCaixa) => {
      const resumo = p.locator("main summary").filter({ hasText: rotuloSummary }).first();
      await resumo.scrollIntoViewIfNeeded();
      await j.clicar(resumo);
      await j.esperar(250);
      await j.clicar(resumo.locator("xpath=..").locator("label").filter({ has: p.getByText(rotuloCaixa) }).first());
      await j.esperar(600);
      await j.clicar(resumo);
      await j.esperar(250);
    };
    const contagem = async () => normaliza(await p.locator("main [role=status]").filter({ hasText: /^\s*\d[\d.]* de \d[\d.]* linhas/ }).first().innerText());
    /** baixa o CSV do botão da tabela e compara, célula a célula, "sem dado" na tela com campo vazio no arquivo */
    const paridadeComCsv = async (tab, { maximizar = false } = {}) => {
      const caixa = tab.locator("xpath=ancestor::*[.//button[contains(., 'Baixar CSV') or contains(., 'BAIXAR CSV')]][1]");
      if (maximizar) {
        const sel = caixa.locator("select").last();
        if (await sel.count()) {
          const valores = await sel.locator("option").evaluateAll((o) => o.map((x) => x.value));
          await j.agir(() => sel.selectOption(valores[valores.length - 1]));
          await j.esperar(700);
        }
      }
      const pagina = await lerTabela(tab);
      const botao = caixa.getByRole("button", { name: /baixar csv/i }).first();
      await botao.scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([p.waitForEvent("download"), j.clicar(botao)]);
      const csv = lerCsv(await readFile(await dl.path(), "utf8"));
      const cabCsv = csv[0].map(semSeta);
      const linhasCsv = csv.slice(1).filter((l) => l.some((c) => c !== ""));
      const colunas = pagina.cab.map((c, i) => ({ nome: c, iPagina: i, iCsv: cabCsv.indexOf(c) })).filter((c) => c.iCsv >= 0 && c.nome !== "");
      const porChave = new Map(linhasCsv.map((l) => [l[colunas[0].iCsv], l]));
      // a chave da tela pode vir formatada de outro jeito no arquivo (09/2026 e 2026-09): sem par por chave, pareia por posição
      const todasPorChave = pagina.linhas.every((l) => porChave.has(l[colunas[0].iPagina]));
      const pareamento = todasPorChave ? "chave" : pagina.linhas.length === linhasCsv.length ? "posição" : "chave";
      let celulas = 0;
      let semDado = 0;
      let vazias = 0;
      let zeroOndeSemDado = 0;
      const rotulos = {}; // coluna -> quantas células "sem dado" viraram o texto "sem dado" (rótulo de classe)
      const divergencias = [];
      let linhasSemPar = 0;
      for (const [iLinha, l] of pagina.linhas.entries()) {
        const chaveP = l[colunas[0].iPagina];
        const lc = pareamento === "posição" ? linhasCsv[iLinha] : porChave.get(chaveP) || linhasCsv.find((x) => normaliza(x[colunas[0].iCsv]) === chaveP);
        if (!lc) {
          linhasSemPar++;
          continue;
        }
        for (const c of colunas.slice(1)) {
          const tela = l[c.iPagina];
          const arq = lc[c.iCsv] ?? "";
          celulas++;
          if (tela === "sem dado") {
            semDado++;
            if (/^0([.,]0+)?$/.test(arq.trim())) zeroOndeSemDado++;
            if (arq === "") vazias++;
            else if (arq === "sem dado") rotulos[c.nome] = (rotulos[c.nome] || 0) + 1;
            else divergencias.push(`${chaveP.slice(0, 30)} / ${c.nome}: tela "sem dado", arquivo "${arq}"`);
          } else if (arq === "") divergencias.push(`${chaveP.slice(0, 30)} / ${c.nome}: tela "${tela.slice(0, 20)}", arquivo vazio`);
        }
      }
      return { arquivo: dl.suggestedFilename(), linhasPagina: pagina.linhas.length, linhasCsv: linhasCsv.length, celulas, semDado, vazias, rotulos, zeroOndeSemDado, divergencias, linhasSemPar, pagina, cabCsv, pareamento };
    };
    const textoRotulos = (r) => {
      const e = Object.entries(r.rotulos);
      return e.length ? `; ${e.reduce((a, [, n]) => a + n, 0)} células "sem dado" de coluna de classe viram o TEXTO "sem dado" no CSV (${e.map(([k, n]) => `${k}: ${n}`).join("; ")}), não campo vazio` : "";
    };
    const exigirParidade = (r, onde) => {
      j.afirmar(r.linhasSemPar === 0, `${onde}: ${r.linhasSemPar} linha(s) da tela sem par no CSV`);
      j.afirmar(r.semDado > 0, `${onde}: nenhuma célula "sem dado" para conferir`);
      j.afirmar(r.vazias > 0, `${onde}: nenhuma célula "sem dado" virou campo vazio no CSV`);
      j.afirmar(r.zeroOndeSemDado === 0, `${onde}: ${r.zeroOndeSemDado} célula(s) "sem dado" viraram 0 no CSV`);
      j.afirmar(r.divergencias.length === 0, `${onde}: ${r.divergencias.length} divergência(s) entre tela e CSV, primeira: ${r.divergencias[0]}`);
    };

    // ---------- Saúde dos dados ----------
    await j.passo("Abre Saúde dos dados, escolhe Analisar e lê as contagens por situação", async () => {
      await abrir(`${ORIGEM}/dados/saude`);
      await analisar();
      const texto = normaliza(await p.locator("main").innerText());
      const m = texto.match(/\((\d\d\/\d\d\/\d{4})\), dos (\d+) conjuntos integrados, (\d+) estavam em dia, (\d+) atrasados?, (\d+) sem SLA.*? e (\d+) sem dado/);
      j.afirmar(m, "não achei a frase com as contagens por situação");
      const [, ref, total, emDia, atrasado, semSla, semDado] = m;
      j.afirmar(+emDia + +atrasado + +semSla + +semDado === +total, `as situações somam ${+emDia + +atrasado + +semSla + +semDado}, não ${total}`);
      guardado.ref = ref;
      guardado.atrasados = +atrasado;
      guardado.semDado = +semDado;
      return `data de referência ${ref}; ${total} conjuntos integrados: ${emDia} em dia, ${atrasado} atrasado, ${semSla} sem SLA, ${semDado} sem dado (soma confere)`;
    });

    await j.passo("Filtra a tabela por Situação = Atrasado e refaz a conta do atraso com as datas da própria linha", async () => {
      await filtrar(/^\s*situação/i, /^Atrasado$/);
      const url = new URL(p.url());
      j.afirmar(url.searchParams.get("sau.f.situacao") === "Atrasado", `URL sem o filtro: ${j.url()}`);
      const c = await contagem();
      j.afirmar(c === `${guardado.atrasados} de 151 linhas`, `contagem inesperada: ${c}`);
      const tab = await acharTabela(/Situação/);
      const { cab, linhas } = await lerTabela(tab);
      j.afirmar(linhas.length === 1, `esperava 1 linha, vieram ${linhas.length}`);
      const l = Object.fromEntries(cab.map((h, i) => [h, linhas[0][i]]));
      const prazo = l["Prazo do próximo período"];
      const atraso = Number(l["Atraso (dias)"]);
      const conta = dias(guardado.ref) - dias(prazo);
      j.afirmar(l["Situação"] === "Atrasado", `situação da linha: ${l["Situação"]}`);
      j.afirmar(conta === atraso, `atraso da tela ${atraso} dias, mas ${guardado.ref} menos ${prazo} dá ${conta} dias`);
      guardado.atrasado = { nome: l["Conjunto"], periodo: l["Último período disponível"], prazo, atraso, captura: l["Última captura"], familia: l["Família"] };
      return `${c}; "${l["Conjunto"].slice(0, 60)}": frequência ${l["Frequência declarada pela fonte"]}, último período ${l["Último período disponível"]}, prazo ${prazo}, atraso ${atraso} dias; a conta ${guardado.ref} menos ${prazo} dá ${conta} dias (confere); última captura ${l["Última captura"]}, completude ${l["Completude interna (%)"]}%`;
    });

    let tabSaude;
    await j.passo("Troca o filtro para Situação = Sem dado e confere que o atraso não aparece como zero", async () => {
      await filtrar(/^\s*situação/i, /^Atrasado$/); // desmarca
      await filtrar(/^\s*situação/i, /^Sem dado$/); // marca
      const url = new URL(p.url());
      j.afirmar(url.searchParams.get("sau.f.situacao") === "Sem dado", `URL sem o filtro Sem dado: ${j.url()}`);
      const c = await contagem();
      j.afirmar(c === `${guardado.semDado} de 151 linhas`, `contagem inesperada: ${c}`);
      tabSaude = await acharTabela(/Situação/);
      const { cab, linhas } = await lerTabela(tabSaude);
      const iAtraso = cab.indexOf("Atraso (dias)");
      const iPrazo = cab.indexOf("Prazo do próximo período");
      j.afirmar(linhas.length === guardado.semDado, `linhas ${linhas.length}`);
      for (const l of linhas) {
        j.afirmar(l[iAtraso] === "sem dado", `atraso de "${l[0].slice(0, 40)}" aparece como "${l[iAtraso]}" e não "sem dado"`);
        j.afirmar(l[iPrazo] === "sem dado", `prazo de "${l[0].slice(0, 40)}" aparece como "${l[iPrazo]}"`);
      }
      guardado.semDadoLinhas = linhas.map((l) => l[0]);
      return `${c}; em todas as ${linhas.length} linhas "Atraso (dias)" e "Prazo do próximo período" dizem "sem dado" (nenhum 0); conjuntos: ${linhas.map((l) => l[0].slice(0, 38)).join(" | ")}`;
    });

    await j.passo("Baixa o CSV desta tabela e confere que cada célula sem dado da tela é campo vazio no arquivo", async () => {
      const r = await paridadeComCsv(tabSaude);
      exigirParidade(r, "Saúde");
      j.afirmar(r.linhasCsv === guardado.semDado, `o CSV tem ${r.linhasCsv} linhas e a tela ${guardado.semDado}`);
      return `CSV com ${r.linhasCsv} linhas, ${r.celulas} células comparadas, ${r.semDado} com "sem dado" na tela, ${r.vazias} vazias no arquivo e nenhuma 0${textoRotulos(r)}`;
    });

    await j.passo("Lê como a página explica sem dado, sem SLA e atrasado, e a regra do CSV", async () => {
      const texto = normaliza(await p.locator("main").innerText());
      const achar = (re, nome) => {
        const m = texto.match(re);
        j.afirmar(m, `a página não traz o texto sobre ${nome}`);
        return m[0];
      };
      const sla = achar(/SLA é o prazo derivado da frequência[^.]*\. Conjunto sem frequência legível fica sem SLA\./, "o SLA");
      const regra = achar(/Situação e atraso valem para a data de referência da publicação, e o prazo é o fim do último período disponível mais a tolerância da cadência/, "o prazo do atraso");
      const csv = achar(/“sem dado” indica ausência na fonte, nunca zero; nos arquivos baixados a ausência é célula vazia/, "ausência e CSV");
      return `SLA: "${sla.slice(0, 150)}..."; atraso: "${regra.slice(0, 110)}..."; ausência: "${csv}"`;
    });

    await j.passo("Compara a data de referência com as datas de captura e de processamento mostradas na página", async () => {
      const texto = normaliza(await p.locator("main").innerText());
      const cab = texto.match(/Data de referência da publicação: (\d\d\/\d\d\/\d{4})\. Gold processada em ([^()]+) \(Brasília\)\. Última captura registrada: ([^()]+) \(Brasília\)/);
      j.afirmar(cab, "não achei a linha de datas do cabeçalho");
      const rodape = normaliza(await p.getByText(/Catálogo e manifesto publicados em/).first().innerText()).match(/Catálogo e manifesto publicados em ([^()]+) \(Brasília\)/);
      j.afirmar(rodape, "não achei a data de publicação do rodapé");
      const [, ref, gold, ultima] = cab;
      const capturaLinha = guardado.atrasado.captura;
      j.afirmar(minutos(capturaLinha) <= minutos(ultima), `a captura da linha (${capturaLinha}) é posterior à última captura registrada (${ultima})`);
      j.afirmar(minutos(ultima) <= minutos(gold), `a última captura (${ultima}) é posterior ao processamento da gold (${gold})`);
      j.afirmar(minutos(rodape[1]) === minutos(gold), `o rodapé diz "${rodape[1]}" e o cabeçalho diz "${gold}": as duas datas deviam ser a mesma publicação`);
      const defasagem = dias(ref) - dias("01/" + guardado.atrasado.periodo.replace(/^(\d\d)\/(\d{4})$/, "$1/$2"));
      return `referência ${ref}; gold processada ${gold}; última captura registrada ${ultima}; captura do conjunto atrasado ${capturaLinha} (antes da gold, na ordem esperada); o último período dele é ${guardado.atrasado.periodo}, ${defasagem} dias antes da referência (contados do dia 1º do mês); o rodapé da mesma página diz "Catálogo e manifesto publicados em ${rodape[1]}", a mesma data do cabeçalho`;
    });

    // ---------- Ausência em tabelas de módulos ----------
    await j.passo("Em Perdas, mostra a tabela inteira e confere sem dado na tela contra célula vazia no CSV", async () => {
      await abrir(`${ORIGEM}/perdas`);
      await analisar();
      const tab = await acharTabela(/Classe no mapa/);
      const r = await paridadeComCsv(tab, { maximizar: true });
      exigirParidade(r, "Perdas");
      const iL = r.pagina.cab.indexOf("Distribuidora");
      const iT = r.pagina.cab.indexOf("Técnicas (%)");
      const iDec = r.pagina.cab.indexOf("Decomposição");
      const linha = r.pagina.linhas.find((l) => /^ÂMBAR AMAZONAS/.test(l[iL]));
      j.afirmar(linha, "a linha da ÂMBAR AMAZONAS não está na tabela");
      j.afirmar(linha[iT] === "sem dado", `técnicas da ÂMBAR AMAZONAS: ${linha[iT]}`);
      j.afirmar(/sem separação publicada/.test(linha[iDec]), `motivo da ausência: ${linha[iDec]}`);
      const texto = normaliza(await p.locator("main").innerText());
      j.afirmar(/“sem dado” indica ausência na fonte, nunca zero/.test(texto), "a nota sobre sem dado não está na página");
      return `CSV com ${r.linhasCsv} linhas e ${r.linhasPagina} na tela; ${r.celulas} células comparadas, ${r.semDado} com "sem dado", ${r.vazias} vazias no CSV e nenhuma 0${textoRotulos(r)}; exemplo ${linha[iL].split(" · ")[0]}: Técnicas "${linha[iT]}", Decomposição "${linha[iDec]}" (motivo na mesma linha)`;
    });

    await j.passo("Em Restrições de geração, confere a tabela por razão: sem dado na tela, célula vazia no CSV, e o total", async () => {
      await abrir(`${ORIGEM}/geracao/restricoes`);
      await analisar();
      const tab = await acharTabela(/Razão \(código do ONS\)/);
      const r = await paridadeComCsv(tab);
      exigirParidade(r, "Restrições");
      const cab = r.pagina.cab;
      const par = r.pagina.linhas.find((l) => /Parecer de acesso/.test(l[0]));
      j.afirmar(par, "linha Parecer de acesso não achada");
      const dic = Object.fromEntries(cab.map((c, i) => [c, par[i]]));
      return `CSV com ${r.linhasCsv} linhas, ${r.celulas} células, ${r.semDado} "sem dado" na tela, ${r.vazias} vazias no CSV e nenhuma 0${textoRotulos(r)}. Linha "Parecer de acesso": origem local "${dic["Origem local (GWh)"]}", origem sistêmica "${dic["Origem sistêmica (GWh)"]}", mas Total "${dic["Total (GWh)"]}" e Parcela "${dic["Parcela da energia não gerada (%)"]}": o total é um número, a página não diz se é zero medido ou soma de ausências`;
    });

    await j.passo("No Histórico do PLD, confere o mês sem moeda constante: sem dado na tela, vazio no CSV e o motivo escrito", async () => {
      await abrir(`${ORIGEM}/pld/historico`);
      await analisar();
      const tab = await acharTabela(/Média temporal em moeda constante/);
      const r = await paridadeComCsv(tab, { maximizar: true });
      exigirParidade(r, "Histórico");
      const iM = r.pagina.cab.indexOf("Mês");
      const iC = r.pagina.cab.indexOf("Média temporal em moeda constante (R$/MWh)");
      const set = r.pagina.linhas.find((l) => l[iM] === "09/2026");
      j.afirmar(set && set[iC] === "sem dado", `moeda constante de 09/2026: ${set && set[iC]}`);
      const ago = r.pagina.linhas.find((l) => l[iM] === "08/2026");
      j.afirmar(ago && /^\d/.test(ago[iC]), `moeda constante de 08/2026: ${ago && ago[iC]}`);
      const texto = normaliza(await p.locator("main").innerText());
      const motivo = texto.match(/Moeda constante só existe até o último mês com IPCA publicado\./);
      j.afirmar(motivo, "a página não explica por que a moeda constante falta");
      const ipca = texto.match(/IBGE \(IPCA até ([a-z]{3}\/\d{4})\)/);
      return `CSV com ${r.linhasCsv} linhas, ${r.celulas} células (pareadas por ${r.pareamento}: o mês é 09/2026 na tela e 2026-09 no arquivo), ${r.semDado} "sem dado" na tela, ${r.vazias} vazias no CSV e nenhuma 0${textoRotulos(r)}. Em 09/2026 a média em moeda constante é "sem dado" e em 08/2026 é ${ago[iC]}; motivo escrito: "${motivo[0]}"${ipca ? ` (cabeçalho: IPCA até ${ipca[1]})` : ""}`;
    });

    // ---------- Catálogo e fichas ----------
    await j.passo("No Catálogo, busca SCS, escolhe a linha e lê no painel Ficha do conjunto como o atraso é explicado", async () => {
      await abrir(`${ORIGEM}/dados`);
      await analisar();
      const busca = p.locator("main input[type=search]").first();
      await busca.scrollIntoViewIfNeeded();
      await j.agir(() => busca.fill("SCS"));
      await j.esperar(600);
      const botao = p.locator("main button[aria-pressed]", { hasText: /^SCS/ }).first();
      await j.clicar(botao);
      await j.esperar(800);
      const painel = p.getByRole("heading", { name: /ficha do conjunto/i }).first().locator("xpath=ancestor::section[1]");
      await painel.scrollIntoViewIfNeeded();
      const t = normaliza(await painel.innerText());
      const at = t.match(/Atualidade: atrasado; último período disponível (\d\d\/\d{4}); (\d+) dias além do prazo/);
      j.afirmar(at, "o painel não explica o atraso");
      j.afirmar(at[1] === guardado.atrasado.periodo && Number(at[2]) === guardado.atrasado.atraso, `o painel diz ${at[1]} e ${at[2]} dias; a saúde diz ${guardado.atrasado.periodo} e ${guardado.atrasado.atraso} dias`);
      const cap = t.match(/última captura em (\d\d\/\d\d\/\d{4})/);
      guardado.painelCaptura = cap && cap[1];
      return `painel: "${at[0]}"; ${cap ? `última captura em ${cap[1]}` : "sem data de captura"}; coincide com a página de saúde (${guardado.atrasado.periodo}, ${guardado.atrasado.atraso} dias)`;
    });

    let fichaScs;
    await j.passo("Abre a ficha completa do conjunto atrasado pelo link do painel e lê os campos de captura", async () => {
      await j.clicar(p.getByRole("link", { name: /abrir a ficha do conjunto/i }).first());
      await p.waitForLoadState("networkidle");
      await j.esperar(600);
      j.afirmar(/\/dados\/aneel-scs$/.test(p.url()), `URL inesperada: ${j.url()}`);
      await abreDetalhesTecnicos();
      const t = normaliza(await p.locator("main").innerText());
      const pega = (re) => (t.match(re) || [])[1];
      fichaScs = {
        titulo: (await p.locator("h1").first().innerText()).trim(),
        captura: pega(/ÚLTIMA CAPTURA (.*?) ÚLTIMA MODIFICAÇÃO/i),
        tentativa: pega(/ÚLTIMA TENTATIVA DE COLETA DIRETA (.*?) (?:Mudanças|Capturas)/i),
        atraso: /atrasad|além do prazo|defasad/i.test(t),
        texto: t,
      };
      return `${j.url()}; título "${fichaScs.titulo.slice(0, 60)}"; última captura "${fichaScs.captura}"; última tentativa de coleta direta "${fichaScs.tentativa}"; menciona atraso: ${fichaScs.atraso ? "sim" : "não"}`;
    });

    await j.passo("Abre a ficha completa de um conjunto sem dado e confere que a ausência vem escrita, nunca como zero", async () => {
      await abrir(`${ORIGEM}/dados?modo=analisar&cat.q=6715`);
      const botao = p.locator("main button[aria-pressed]").first();
      await botao.scrollIntoViewIfNeeded();
      await j.clicar(botao);
      await j.esperar(800);
      await j.clicar(p.getByRole("link", { name: /abrir a ficha do conjunto/i }).first());
      await p.waitForLoadState("networkidle");
      await j.esperar(600);
      j.afirmar(/\/dados\/ibge-pof-6715$/.test(p.url()), `URL inesperada: ${j.url()}`);
      await abreDetalhesTecnicos();
      const t = normaliza(await p.locator("main").innerText());
      // a última captura vem das integrações de publicacao.json (o conjunto tem captura, só não tem SLA mensurável);
      // os campos que a fonte não informa continuam com marca explícita de ausência; o snapshot, quando
      // não existe, não ganha linha própria nos detalhes técnicos, e o que aparece nunca é zero
      const cap = t.match(/ÚLTIMA CAPTURA (.*?) ÚLTIMA MODIFICAÇÃO/i);
      j.afirmar(cap && /\d\d\/\d\d\/\d{4}/.test(cap[1]), `a última captura não é uma data: ${cap && cap[1]}`);
      j.afirmar(/sem dado para medir/i.test(t), "a ficha do conjunto sem dado não diz que a atualidade não pode ser medida");
      const campos = {
        "Última modificação na fonte": /ÚLTIMA MODIFICAÇÃO DE METADADOS NA FONTE (.*?)(?= Observação sobre a licença| Mudanças metodológicas| Detalhes técnicos|$)/i,
        Formatos: /FORMATOS PUBLICADOS (.*?) USADO NAS PÁGINAS/i,
      };
      const snap = t.match(/SNAPSHOT (.*?) SHA256 DO SNAPSHOT/i);
      j.afirmar(!snap || !/^0([.,]0+)?$/.test(snap[1].trim()), `o campo Snapshot mostra ${snap && snap[1]}, um zero no lugar de ausência`);
      const lidos = {};
      for (const [nome, re] of Object.entries(campos)) {
        const m = t.match(re);
        j.afirmar(m, `campo ${nome} não achado`);
        lidos[nome] = m[1].trim();
        j.afirmar(!/^0([.,]0+)?$/.test(lidos[nome]), `o campo ${nome} mostra ${lidos[nome]}, um zero no lugar de ausência`);
        j.afirmar(/^(–|sem captura|sem snapshot|não informad[oa]|não declarad[oa])$/i.test(lidos[nome]), `o campo ${nome} mostra "${lidos[nome]}", não uma marca explícita de ausência`);
      }
      j.afirmar(/campo vazio significa ausência, nunca zero/.test(t), "a ficha não traz a regra do campo vazio");
      return `${j.url()}; última captura ${cap[1].slice(0, 12)}; atualidade "sem dado para medir"; campos sem valor: ${Object.entries(lidos).map(([k, v]) => `${k} "${v}"`).join("; ")}; a ficha traz "campo vazio significa ausência, nunca zero"`;
    });

    await j.passo("Confere se a ficha completa do conjunto atrasado diz que ele está atrasado e concorda com a saúde sobre a última captura", async () => {
      const saude = guardado.atrasado.captura;
      const problemas = [];
      if (!fichaScs.atraso) problemas.push(`a ficha de ${fichaScs.titulo.slice(0, 40)} não menciona atraso, mas a saúde diz ${guardado.atrasado.atraso} dias além do prazo`);
      if (/sem captura/i.test(fichaScs.captura || "")) problemas.push(`a ficha diz última captura "${fichaScs.captura}", mas a saúde dá ${saude} e o painel do catálogo, ${guardado.painelCaptura}`);
      if (problemas.length) {
        // deixa a tela na ficha, no campo em questão, para a captura de falha mostrar o defeito
        await abrir(`${ORIGEM}/dados/aneel-scs`);
        await p.getByText(/última captura/i).first().evaluate((e) => e.scrollIntoView({ block: "center" }));
        await j.esperar(300);
      }
      j.afirmar(problemas.length === 0, problemas.join("; "));
      return "a ficha concorda com a saúde e com o painel do catálogo";
    });
  },
};
