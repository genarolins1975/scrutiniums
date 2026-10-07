/* J6, usuário de celular (390 px, toque). Roteiro por script em Chromium headless: não é teste com pessoas.
   Parte 1, /territorio: toca uma UF no mapa, lê a ficha, compara com outra UF, limpa a escolha e volta.
   Parte 2, /perdas: escolhe ano e indicador, filtra a tabela por UF, escolhe uma distribuidora, compara duas
   e remove o filtro, conferindo que modo, ano, indicador, escolha, comparação e posição na página ficam como estavam.
   Os números são lidos da própria página; nada é digitado de memória. */

const ORIGEM = "/setor-eletrico";

/** número no formato brasileiro (1.234,5) para Number */
const num = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));

export default {
  id: "J6",
  titulo: "Usuário de celular escolhe uma região, lê o detalhe, compara e remove o filtro sem perder o contexto",
  perfil: "Leitor no celular (390 px de largura, toque, Chromium headless com emulação móvel)",
  largura: 390,
  movel: true,
  limite: "Emulação de celular no Chromium (toque e viewport), não aparelho real; roteiro por script, sem pessoas.",
  async executar(j) {
    const p = j.p;
    const alvos = []; // alvos de toque medidos antes de cada toque
    const leituras = []; // varreduras de largura e de texto por página
    const parametro = (nome) => new URL(p.url()).searchParams.get(nome);
    const rolagemY = () => p.evaluate(() => Math.round(window.scrollY));
    const medir = async (nome, loc) => {
      const b = await loc.boundingBox();
      const a = { nome, w: Math.round(b.width), h: Math.round(b.height) };
      alvos.push(a);
      return a;
    };
    const tocar = async (nome, loc, opcoes) => {
      await loc.scrollIntoViewIfNeeded();
      const a = await medir(nome, loc);
      await j.clicar(loc, opcoes);
      return a;
    };
    const varrer = async (rotulo) => {
      // rola a página inteira para disparar as cargas sob demanda e mede texto espremido e rolagem horizontal
      for (let y = 0; y < 40; y++) {
        const fim = await p.evaluate(() => {
          window.scrollBy(0, 900);
          return window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
        });
        await j.esperar(60);
        if (fim) break;
      }
      const r = await p.evaluate(() => {
        const estreitos = [];
        for (const e of document.querySelectorAll("main p, main li, main dd, main h2, main h3, main figcaption")) {
          const t = (e.innerText || "").trim();
          if (t.length < 30) continue;
          const b = e.getBoundingClientRect();
          if (b.width <= 3) continue; // texto só para leitor de tela
          if (b.width < 120) estreitos.push({ largura: Math.round(b.width), altura: Math.round(b.height), texto: t.slice(0, 60) });
        }
        return { rolagemW: document.documentElement.scrollWidth, janelaW: innerWidth, estreitos };
      });
      leituras.push({ pagina: rotulo, ...r });
      await p.evaluate(() => window.scrollTo(0, 0));
      await j.esperar(200);
      return r;
    };
    const ficha = () => p.getByRole("complementary", { name: "Ficha da escolha" });
    const lerFicha = async () => {
      const t = (await ficha().innerText()).replace(/\s+/g, " ");
      const pega = (re) => (t.match(re) || [])[1];
      return {
        submercado: pega(/está no submercado ([^(]+?) \(/i),
        municipios: pega(/Municípios (\d[\d.]*) /i),
        capacidade: pega(/Capacidade em operação \(UF principal da usina\) ([\d.,]+) MW/i),
        usinas: pega(/\(([\d.]+) usinas\)/i),
        pldDia: pega(/PLD médio do dia \(\d\d\/\d\d\/\d{4}\) ([\d.,]+) R\$\/MWh/i),
        pldData: pega(/PLD médio do dia \((\d\d\/\d\d\/\d{4})\)/i),
        texto: t,
      };
    };
    /** acha um ponto de dentro da região no mapa, para o toque cair na UF e não na vizinha */
    const pontoNaRegiao = async (codigo) => {
      return p.evaluate((cod) => {
        const el = document.querySelector(`main svg[role=img] path[data-id="${cod}"]`);
        const r = el.getBoundingClientRect();
        for (let fy = 0.5; fy <= 0.95; fy += 0.05) {
          for (let fx = 0.2; fx <= 0.9; fx += 0.05) {
            const x = r.left + r.width * fx;
            const y = r.top + r.height * fy;
            if (document.elementFromPoint(x, y) === el) return { x: r.width * fx, y: r.height * fy };
          }
        }
        return null;
      }, codigo);
    };

    // ---------- Parte 1: território ----------
    await j.passo("Abre Minha região no celular e confere o título e a ausência de rolagem horizontal", async () => {
      await p.goto(j.BASE + `${ORIGEM}/territorio`, { waitUntil: "networkidle" });
      await j.esperar(900);
      const h1 = (await p.locator("h1").first().innerText()).trim();
      j.afirmar(/minha região/i.test(h1), `título inesperado: ${h1}`);
      const m = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, j: innerWidth }));
      j.afirmar(m.w <= m.j, `rolagem horizontal: página com ${m.w} px numa janela de ${m.j} px`);
      return `h1 "${h1}"; largura da página ${m.w} px para janela de ${m.j} px (sem rolagem horizontal)`;
    });

    await j.passo("Toca em ANALISAR no seletor de profundidade e confere o modo na URL", async () => {
      const r = p.getByRole("radio", { name: /analisar/i });
      const a = await tocar("ANALISAR (nível de profundidade)", r);
      await j.esperar(500);
      j.afirmar(parametro("modo") === "analisar", `URL sem modo=analisar: ${j.url()}`);
      j.afirmar((await r.getAttribute("aria-checked")) === "true", "ANALISAR não ficou marcado");
      return `URL ${j.url()}; alvo ${a.w} por ${a.h} px; aria-checked=true`;
    });

    let mg;
    let distanciaFicha;
    await j.passo("Toca em Minas Gerais no mapa de UFs e confere a escolha na URL", async () => {
      const svg = p.locator("main svg[role=img]").first();
      await svg.scrollIntoViewIfNeeded();
      await j.esperar(300);
      const ponto = await pontoNaRegiao("31");
      j.afirmar(ponto, "não achei um ponto dentro de Minas Gerais no mapa");
      const regiao = svg.locator('path[data-id="31"]').first();
      const a = await medir("Minas Gerais (região no mapa)", regiao);
      await j.clicar(regiao, { position: ponto });
      await j.esperar(700);
      j.afirmar(parametro("sel") === "uf:MG", `URL sem sel=uf:MG: ${j.url()}`);
      // onde ficou a ficha em relação ao mapa e à janela
      const pos = await p.evaluate(() => {
        const s = document.querySelector("main svg[role=img]").getBoundingClientRect();
        const f = document.querySelector('aside[aria-label="Ficha da escolha"]').getBoundingClientRect();
        return { mapaFim: Math.round(s.bottom), fichaTopo: Math.round(f.top), janela: innerHeight };
      });
      distanciaFicha = pos.fichaTopo - pos.mapaFim;
      return `URL ${j.url()}; região tocada com ${a.w} por ${a.h} px; a ficha começa ${distanciaFicha} px abaixo do fim do mapa (topo da ficha a ${pos.fichaTopo} px do topo da janela de ${pos.janela} px), ${pos.fichaTopo > pos.janela ? "fora da tela" : "na tela"}`;
    });

    await j.passo("Rola até a ficha e lê Minas Gerais: submercado, municípios, capacidade e PLD do dia", async () => {
      await ficha().scrollIntoViewIfNeeded();
      await j.esperar(300);
      mg = await lerFicha();
      j.afirmar(/minas gerais/i.test(mg.texto), "a ficha não nomeia Minas Gerais");
      j.afirmar(mg.municipios && num(mg.municipios) > 800, `municípios de MG não lidos: ${mg.municipios}`);
      j.afirmar(mg.pldDia, "PLD do dia não lido na ficha");
      return `Minas Gerais no submercado ${mg.submercado}; ${mg.municipios} municípios; ${mg.capacidade} MW em ${mg.usinas} usinas; PLD médio do dia ${mg.pldData}: R$ ${mg.pldDia}/MWh (do submercado, não da UF)`;
    });

    let ba;
    await j.passo("Toca em BA na tabela de UFs para comparar e lê a ficha da Bahia", async () => {
      const botao = p.locator("main button[aria-pressed]", { hasText: /^BA$/ }).first();
      const a = await tocar("BA (botão da tabela de UFs)", botao);
      await j.esperar(700);
      j.afirmar(parametro("sel") === "uf:BA", `URL sem sel=uf:BA: ${j.url()}`);
      j.afirmar((await botao.getAttribute("aria-pressed")) === "true", "o botão BA não ficou com aria-pressed=true");
      const topo = await p.evaluate(() => Math.round(document.querySelector('aside[aria-label="Ficha da escolha"]').getBoundingClientRect().top));
      await ficha().scrollIntoViewIfNeeded();
      await j.esperar(300);
      ba = await lerFicha();
      j.afirmar(/bahia/i.test(ba.texto), "a ficha não nomeia a Bahia");
      j.afirmar(ba.municipios && ba.municipios !== mg.municipios, "a ficha da Bahia repete os números de Minas Gerais");
      return `URL ${j.url()}; alvo ${a.w} por ${a.h} px; a ficha da Bahia ficou a ${topo} px do topo da janela logo após o toque (${topo < 0 ? "acima da tela" : topo > 780 ? "abaixo da tela" : "na tela"}); ${ba.submercado}; ${ba.municipios} municípios; ${ba.capacidade} MW em ${ba.usinas} usinas; PLD ${ba.pldData}: R$ ${ba.pldDia}/MWh`;
    });

    await j.passo("Compara as duas fichas: municípios, capacidade e submercado de cada UF", async () => {
      const dMun = num(mg.municipios) - num(ba.municipios);
      const dMW = num(mg.capacidade) - num(ba.capacidade);
      j.afirmar(mg.submercado && ba.submercado, "submercado de alguma ficha não lido");
      return `MG tem ${mg.municipios} municípios e a BA ${ba.municipios} (diferença ${dMun}); capacidade em operação MG ${mg.capacidade} MW contra BA ${ba.capacidade} MW (diferença ${dMW.toLocaleString("pt-BR")} MW); submercados ${mg.submercado} e ${ba.submercado}; PLD do dia MG R$ ${mg.pldDia}/MWh e BA R$ ${ba.pldDia}/MWh${mg.submercado === ba.submercado ? " (mesmo submercado)" : ""}`;
    });

    let y0;
    await j.passo("Toca em Limpar a escolha e confere que o modo e a posição na página continuam", async () => {
      const limpar = p.getByRole("button", { name: /limpar a escolha/i }).first();
      await limpar.scrollIntoViewIfNeeded();
      y0 = await rolagemY();
      const a = await tocar("Limpar a escolha", limpar);
      await j.esperar(800);
      const y1 = await rolagemY();
      j.afirmar(!parametro("sel"), `a URL ainda guarda a escolha: ${j.url()}`);
      j.afirmar(parametro("modo") === "analisar", `o modo se perdeu: ${j.url()}`);
      j.afirmar(Math.abs(y1 - y0) <= 120, `a posição na página mudou de ${y0} para ${y1} px`);
      const vazio = (await ficha().innerText()).replace(/\s+/g, " ");
      j.afirmar(/nenhuma escolha/i.test(vazio), "a ficha não voltou ao estado sem escolha");
      return `URL ${j.url()}; rolagem ${y0} px antes e ${y1} px depois; ficha voltou a "NENHUMA ESCOLHA"; alvo ${a.w} por ${a.h} px`;
    });

    await j.passo("Usa o botão voltar do navegador e confere que a escolha da Bahia volta", async () => {
      await j.agir(() => p.goBack());
      await j.esperar(900);
      j.afirmar(parametro("sel") === "uf:BA", `voltar não restaurou a Bahia: ${j.url()}`);
      j.afirmar(parametro("modo") === "analisar", `voltar perdeu o modo: ${j.url()}`);
      await ficha().scrollIntoViewIfNeeded();
      const f = await lerFicha();
      j.afirmar(/bahia/i.test(f.texto) && f.municipios === ba.municipios, "a ficha restaurada não é a da Bahia");
      return `URL ${j.url()}; ficha mostra de novo a Bahia com ${f.municipios} municípios`;
    });

    await j.passo("Varre a página de Minha região: rolagem horizontal e textos espremidos", async () => {
      const r = await varrer("territorio");
      return `largura ${r.rolagemW} px para janela de ${r.janelaW} px; ${r.estreitos.length} bloco(s) de texto com menos de 120 px de largura${r.estreitos.length ? ": " + r.estreitos.map((e) => `"${e.texto}" com ${e.largura} por ${e.altura} px`).join("; ") : ""}`;
    });

    // ---------- Parte 2: perdas ----------
    let periodoTxt;
    let medidaTxt;
    await j.passo("Abre Perdas, toca em ANALISAR e escolhe o ano 2024 e o indicador Perdas técnicas", async () => {
      await p.goto(j.BASE + `${ORIGEM}/perdas`, { waitUntil: "networkidle" });
      await j.esperar(900);
      await tocar("ANALISAR (nível de profundidade)", p.getByRole("radio", { name: /analisar/i }));
      await j.esperar(500);
      const per = p.locator("#perdas-periodo");
      const med = p.locator("#perdas-medida");
      await per.scrollIntoViewIfNeeded();
      await medir("seletor de ano", per);
      await medir("seletor de indicador", med);
      await j.agir(() => per.selectOption({ label: "2024" }));
      await j.esperar(500);
      await j.agir(() => med.selectOption({ value: "tecnica" }));
      await j.esperar(700);
      j.afirmar(parametro("periodo") === "2024", `URL sem periodo=2024: ${j.url()}`);
      j.afirmar(parametro("medida") === "tecnica", `URL sem medida=tecnica: ${j.url()}`);
      periodoTxt = await per.evaluate((s) => s.selectedOptions[0].textContent.trim());
      medidaTxt = await med.evaluate((s) => s.selectedOptions[0].textContent.trim());
      return `URL ${j.url()}; ano "${periodoTxt}"; indicador "${medidaTxt}"`;
    });

    let linhasTodas;
    await j.passo("Filtra a tabela por UF = MG (toca em UF, marca MG, fecha o painel) e lê o chip e a contagem", async () => {
      const resumo = p.locator("main summary").filter({ hasText: /^\s*UF\b/ }).first();
      await resumo.scrollIntoViewIfNeeded();
      linhasTodas = (await p.locator("main [role=status]").filter({ hasText: /de \d+ linhas/ }).first().innerText()).trim();
      await tocar("UF (abre o filtro da coluna)", resumo);
      await j.esperar(300);
      const caixa = resumo.locator("xpath=..").locator("label").filter({ has: p.getByText(/^MG$/) }).first();
      const a = await tocar("MG (caixa do filtro de UF, rótulo inteiro)", caixa);
      await j.esperar(700);
      j.afirmar(parametro("tab.f.ufs") === "MG", `URL sem tab.f.ufs=MG: ${j.url()}`);
      await tocar("UF (fecha o filtro da coluna)", resumo);
      await j.esperar(300);
      const chip = p.getByRole("button", { name: "Remover filtro UF: MG" });
      j.afirmar((await chip.count()) === 1, "o chip Remover filtro UF: MG não apareceu");
      const contagem = (await p.locator("main [role=status]").filter({ hasText: /de \d+ linhas/ }).first().innerText()).trim();
      const mg2 = contagem.match(/^(\d+) de/);
      j.afirmar(mg2 && Number(mg2[1]) < 123, `o filtro não reduziu a tabela: ${contagem}`);
      return `antes "${linhasTodas}", depois "${contagem}"; caixa tocada com ${a.w} por ${a.h} px; URL ${j.url()}; chip "Remover filtro UF: MG" presente`;
    });

    let cemig;
    await j.passo("Toca no botão da linha CEMIG-D e lê a ficha da distribuidora", async () => {
      const botao = p.locator("main button[aria-pressed]", { hasText: /^\s*CEMIG-D/ }).first();
      const a = await tocar("CEMIG-D (botão da linha da tabela)", botao);
      await j.esperar(800);
      j.afirmar(parametro("d") === "06981180000116", `URL sem d=06981180000116: ${j.url()}`);
      const titulo = p.getByText("Distribuidora escolhida", { exact: false }).first();
      const caixa = titulo.locator("xpath=ancestor::section[1]");
      await caixa.scrollIntoViewIfNeeded();
      const t = (await caixa.innerText()).replace(/\s+/g, " ");
      const taxa = (t.match(/em (\d{4}), perdas totais de ([\d.]+) MWh, ([\d,]+)% da energia injetada/i) || []);
      j.afirmar(/CEMIG-D/.test(t) && taxa[3], "a ficha não traz a taxa de perdas da CEMIG-D");
      cemig = { ano: taxa[1], mwh: taxa[2], taxa: taxa[3] };
      return `URL ${j.url()}; alvo ${a.w} por ${a.h} px; ficha da CEMIG-D diz "em ${cemig.ano}, perdas totais de ${cemig.mwh} MWh, ${cemig.taxa}% da energia injetada", com a página no ano ${periodoTxt}`;
    });

    let comp;
    await j.passo("Compara com COELBA e COPEL-DIS no comparador e lê os valores do último ano", async () => {
      const campo = p.getByRole("combobox", { name: /distribuidoras para comparar/i });
      await campo.scrollIntoViewIfNeeded();
      await medir("campo do comparador", campo);
      const lista = p.getByRole("listbox", { name: /distribuidoras para comparar/i });
      for (const nome of ["COELBA", "COPEL"]) {
        await j.clicar(campo);
        await j.agir(() => campo.fill(nome));
        await j.esperar(500);
        const opcao = lista.getByRole("option").first();
        await tocar(`opção ${nome} do comparador`, opcao);
        await j.esperar(700);
      }
      j.afirmar(/cmp=\d{14},\d{14}/.test(decodeURIComponent(p.url())), `URL sem as duas distribuidoras em cmp: ${j.url()}`);
      const secao = p.locator("[data-componente=comparador]").locator("xpath=ancestor::section[1]");
      const contagem = (await secao.locator("[data-contagem]").first().innerText()).replace(/\s+/g, " ");
      j.afirmar(/2 de 4/.test(contagem), `contagem inesperada: ${contagem}`);
      const resumo = secao.locator("summary").filter({ hasText: /dados do gráfico em tabela/i }).first();
      await tocar("Dados do gráfico em tabela (abre)", resumo);
      await j.esperar(400);
      const cab = await secao.locator("table").first().evaluate((t) => [...t.rows[0].cells].map((c) => c.innerText.trim()));
      const ult = await secao.locator("table").first().evaluate((t) => [...t.rows[t.rows.length - 1].cells].map((c) => c.innerText.trim()));
      comp = Object.fromEntries(cab.map((c, i) => [c, ult[i]]));
      j.afirmar(ult[0] === "2025", `última linha da tabela não é 2025: ${ult[0]}`);
      return `${contagem}; ${ult[0]}: ${cab.slice(1).map((c, i) => `${c.replace(/ \(%\)$/, "")} ${ult[i + 1]}%`).join("; ")}; o comparador mostra a taxa de perdas totais (${cab.length - 1} séries) embora a página esteja no indicador "${medidaTxt}"`;
    });

    await j.passo("Remove o filtro de UF pelo chip e confere modo, ano, indicador, escolha, comparação e posição", async () => {
      const chip = p.getByRole("button", { name: "Remover filtro UF: MG" });
      await chip.scrollIntoViewIfNeeded();
      const antes = { y: await rolagemY(), url: new URL(p.url()) };
      const a = await tocar("Remover filtro UF: MG (chip)", chip);
      await j.esperar(900);
      const depois = { y: await rolagemY(), url: new URL(p.url()) };
      j.afirmar(!depois.url.searchParams.get("tab.f.ufs"), `o filtro continua na URL: ${j.url()}`);
      for (const k of ["modo", "periodo", "medida", "d", "cmp"]) {
        j.afirmar(depois.url.searchParams.get(k) === antes.url.searchParams.get(k), `${k} mudou de "${antes.url.searchParams.get(k)}" para "${depois.url.searchParams.get(k)}"`);
      }
      const per = await p.locator("#perdas-periodo").evaluate((s) => s.selectedOptions[0].textContent.trim());
      const med = await p.locator("#perdas-medida").evaluate((s) => s.selectedOptions[0].textContent.trim());
      j.afirmar(per === periodoTxt && med === medidaTxt, `seletores mudaram: "${per}" e "${med}"`);
      const contagem = (await p.locator("main [role=status]").filter({ hasText: /de \d+ linhas/ }).first().innerText()).trim();
      j.afirmar(contagem === linhasTodas, `contagem não voltou ao total: "${contagem}" contra "${linhasTodas}"`);
      j.afirmar(Math.abs(depois.y - antes.y) <= 120, `a posição mudou de ${antes.y} para ${depois.y} px`);
      const caixa = p.getByText("Distribuidora escolhida", { exact: false }).first().locator("xpath=ancestor::section[1]");
      j.afirmar(/CEMIG-D/.test(await caixa.innerText()), "a distribuidora escolhida se perdeu");
      return `alvo do chip ${a.w} por ${a.h} px; contagem "${contagem}"; ano "${per}", indicador "${med}", modo ${depois.url.searchParams.get("modo")}, escolha d=${depois.url.searchParams.get("d")} e comparação cmp mantidos; rolagem ${antes.y} para ${depois.y} px`;
    });

    await j.passo("Usa o botão voltar e confere que o filtro de UF = MG volta", async () => {
      await j.agir(() => p.goBack());
      await j.esperar(900);
      j.afirmar(parametro("tab.f.ufs") === "MG", `voltar não trouxe o filtro de volta: ${j.url()}`);
      j.afirmar(parametro("periodo") === "2024" && parametro("medida") === "tecnica", `voltar perdeu ano ou indicador: ${j.url()}`);
      const chip = p.getByRole("button", { name: "Remover filtro UF: MG" });
      j.afirmar((await chip.count()) === 1, "o chip do filtro não voltou");
      return `URL ${j.url()}; chip "Remover filtro UF: MG" de volta`;
    });

    await j.passo("Varre Perdas: rolagem horizontal e textos espremidos", async () => {
      const r = await varrer("perdas");
      return `largura ${r.rolagemW} px para janela de ${r.janelaW} px; ${r.estreitos.length} bloco(s) de texto com menos de 120 px de largura`;
    });

    await j.passo("Confere o conjunto: alvos tocados com pelo menos 24 px e nenhuma rolagem horizontal nas páginas medidas", async () => {
      const pequenos = alvos.filter((a) => a.w < 24 || a.h < 24);
      const menor = alvos.reduce((m, a) => (Math.min(a.w, a.h) < Math.min(m.w, m.h) ? a : m), alvos[0]);
      const rolagem = leituras.filter((l) => l.rolagemW > l.janelaW);
      j.afirmar(pequenos.length === 0, `alvos tocados menores que 24 px: ${pequenos.map((a) => `${a.nome} ${a.w} por ${a.h}`).join("; ")}`);
      j.afirmar(rolagem.length === 0, `rolagem horizontal em: ${rolagem.map((l) => l.pagina).join(", ")}`);
      return `${alvos.length} alvos tocados, o menor foi ${menor.nome} com ${menor.w} por ${menor.h} px; páginas medidas ${leituras.map((l) => l.pagina).join(" e ")} sem rolagem horizontal`;
    });

    await j.passo("Confere a legibilidade: nenhum bloco de texto espremido (menos de 120 px de largura) nas páginas visitadas", async () => {
      const espremidos = leituras.flatMap((l) => l.estreitos.map((e) => ({ pagina: l.pagina, ...e })));
      if (espremidos.length) {
        // deixa a tela no primeiro bloco espremido, para a captura de falha mostrar o defeito
        await p.goto(j.BASE + `${ORIGEM}/territorio?modo=analisar`, { waitUntil: "networkidle" });
        await j.esperar(900);
        const alvo = p.getByText(espremidos[0].texto.slice(0, 30), { exact: false }).first();
        for (let t = 0; t < 4; t++) {
          await alvo.evaluate((e) => e.scrollIntoView({ block: "start" }));
          await j.esperar(500); // as seções abaixo carregam sob demanda e deslocam a página
        }
        await p.evaluate(() => window.scrollBy(0, -60));
        await j.esperar(300);
      }
      j.afirmar(
        espremidos.length === 0,
        `texto espremido no celular em ${[...new Set(espremidos.map((e) => e.pagina))].join(" e ")}: ${espremidos.map((e) => `"${e.texto}" com ${e.largura} por ${e.altura} px`).join("; ")}`,
      );
      return `${leituras.length} páginas varridas, nenhum bloco de texto com menos de 120 px de largura`;
    });
  },
};
