/* J7, usuário por teclado (desktop 1440, só teclado: Tab, Shift+Tab, Enter, Espaço, setas, Esc; nenhum clique de mouse
   nas ações do leitor). Roteiro por script em Chromium headless: não é teste com pessoas.
   Cada tecla pressionada conta como uma interação, inclusive cada Tab: é o esforço real de quem navega só pelo teclado.
   Para comparar com a seleção por mouse, cada escolha feita pelo teclado é repetida numa segunda página do mesmo contexto,
   com clique, que serve só de referência e não entra na contagem de interações do leitor. */

const ORIGEM = "/setor-eletrico";
const LIMITE_TAB = 120;

export default {
  id: "J7",
  titulo: "Usuário por teclado alcança o campo do mapa e a tabela equivalente e chega aos mesmos dados que o mouse",
  perfil: "Leitor que usa só o teclado (desktop 1440 px; Tab, Shift+Tab, Enter, Espaço, setas e Esc)",
  largura: 1440,
  movel: false,
  limite: "Teclado simulado pelo Playwright no Chromium; não cobre leitor de tela nem outros navegadores. Roteiro por script, sem pessoas.",
  async executar(j) {
    const p = j.p;
    const paradas = []; // todas as paradas de foco da jornada
    const tecla = (k) => j.agir(() => p.keyboard.press(k));

    /** descreve o elemento com foco: rótulo, papel, indicador visível e ordem em relação à parada anterior */
    const foco = () =>
      p.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return { rotulo: "(nada)", corpo: true };
        const cs = getComputedStyle(e);
        const opaco = (c) => !/^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)$/.test(c) && c !== "transparent";
        const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 && opaco(cs.outlineColor);
        const sombra = cs.boxShadow !== "none" && /rgb/.test(cs.boxShadow);
        let anel = false;
        if (e.namespaceURI && e.namespaceURI.includes("svg")) {
          anel = [...e.querySelectorAll("rect,path,circle")].some((x) => {
            const c = getComputedStyle(x);
            return c.stroke !== "none" && parseFloat(c.strokeWidth) >= 1.5 && c.fill === "none";
          });
        }
        const tipo = outline ? `contorno ${cs.outlineWidth}` : sombra ? "sombra" : anel ? "anel no gráfico" : "nenhum";
        const rotulo = (e.getAttribute("aria-label") || e.innerText || e.value || e.getAttribute("placeholder") || e.id || e.tagName)
          .toString()
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 60);
        const anterior = window.__paradaAnterior;
        const seguinte = anterior && anterior !== e ? !!(anterior.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
        window.__paradaAnterior = e;
        return {
          rotulo,
          tag: e.tagName.toLowerCase(),
          papel: e.getAttribute("role") || "",
          indicador: tipo,
          visivel: tipo !== "nenhum",
          expandido: e.getAttribute("aria-expanded"),
          ativo: e.getAttribute("aria-activedescendant"),
          pressionado: e.getAttribute("aria-pressed"),
          tabindexPositivo: e.tabIndex > 0,
          seguinte,
          corpo: false,
        };
      });

    /** pressiona Tab até a parada satisfazer o teste; devolve a contagem. Falha se passar de 120 Tabs. */
    const ateParar = async (descricao, teste, tecla_ = "Tab") => {
      let n = 0;
      let f;
      while (n < LIMITE_TAB) {
        await tecla(tecla_);
        n++;
        f = await foco();
        paradas.push({ n, ...f });
        if (teste(f)) return { n, f };
      }
      throw new Error(`não alcancei ${descricao} em ${LIMITE_TAB} Tabs; última parada: ${f && f.rotulo}`);
    };
    const resumoParadas = (lista) => {
      const sem = lista.filter((s) => !s.visivel && !s.corpo);
      const fora = lista.filter((s) => s.seguinte === false);
      const corpo = lista.filter((s) => s.corpo);
      const positivos = lista.filter((s) => s.tabindexPositivo);
      return { sem, fora, corpo, positivos };
    };
    const exigirOrdemEIndicador = (lista, onde) => {
      const r = resumoParadas(lista);
      j.afirmar(r.sem.length === 0, `${onde}: parada(s) sem indicador de foco visível: ${r.sem.map((s) => s.rotulo).join("; ")}`);
      j.afirmar(r.corpo.length === 0, `${onde}: o foco caiu no corpo da página (perdido) depois de um Tab`);
      j.afirmar(r.fora.length === 0, `${onde}: o foco voltou para trás na ordem do documento em: ${r.fora.map((s) => s.rotulo).join("; ")}`);
      j.afirmar(r.positivos.length === 0, `${onde}: tabindex positivo em: ${r.positivos.map((s) => s.rotulo).join("; ")}`);
    };
    const normaliza = (t) => t.replace(/\s+/g, " ").trim();
    const parametro = (pg, nome) => new URL(pg.url()).searchParams.get(nome);
    const fichaTerritorio = (pg) => pg.getByRole("complementary", { name: "Ficha da escolha" });
    const fichaPerdas = (pg) => pg.getByText("Distribuidora escolhida", { exact: false }).first().locator("xpath=ancestor::section[1]");
    const abrir = async (pg, caminho) => {
      await pg.goto(j.BASE + caminho, { waitUntil: "networkidle" });
      await pg.waitForTimeout(900);
    };
    /** em Entender a tabela longa vem recolhida; quem quer escolher pela tabela abre o botão que a mostra */
    const abreTabelas = async (pg) => {
      for (const b of await pg.locator("main button.tabela-recolher-btn[aria-expanded=false]").all()) {
        if (await b.isVisible()) await b.click();
      }
      await pg.waitForTimeout(300);
    };
    /** abre uma segunda página do mesmo contexto para repetir a escolha com clique (referência, não conta) */
    const comReferencia = async (fn) => {
      const ref = await j.ctx.newPage();
      try {
        return await fn(ref);
      } finally {
        await ref.close();
      }
    };

    // ---------- Parte 1: Minha região ----------
    let nTerritorio;
    await j.passo("Abre Minha região e percorre com Tab até o campo de busca do mapa, conferindo foco visível e ordem", async () => {
      await abrir(p, `${ORIGEM}/territorio`);
      const ini = paradas.length;
      const { n, f } = await ateParar("o campo de busca do mapa", (s) => s.papel === "combobox");
      nTerritorio = n;
      const lista = paradas.slice(ini);
      exigirOrdemEIndicador(lista, "Minha região");
      j.afirmar(/município|distribuidora|UF|submercado/i.test(await p.locator("main input[role=combobox]").first().getAttribute("placeholder")), "o campo alcançado não é a busca do mapa");
      const tipos = [...new Set(lista.map((s) => s.indicador))].join(" e ");
      return `${n} Tabs até o campo "${await p.locator("main input[role=combobox]").first().getAttribute("placeholder")}"; ${lista.length} paradas, todas com indicador de foco (${tipos}); primeira "${lista[0].rotulo}", ordem do documento respeitada, nenhum tabindex positivo, foco nunca no corpo`;
    });

    await j.passo("Volta uma parada com Shift+Tab e avança com Tab: o foco não fica preso", async () => {
      await tecla("Shift+Tab");
      const atras = await foco();
      await tecla("Tab");
      const frente = await foco();
      j.afirmar(atras.rotulo !== frente.rotulo, "Shift+Tab e Tab pararam no mesmo elemento");
      j.afirmar(frente.papel === "combobox", `Tab não voltou ao campo do mapa: ${frente.rotulo}`);
      return `Shift+Tab foi para "${atras.rotulo}" e Tab voltou ao campo de busca (${frente.indicador})`;
    });

    await j.passo("Digita minas no campo: a lista abre com Minas Gerais na frente", async () => {
      await j.agir(() => p.keyboard.type("minas", { delay: 30 }));
      await j.esperar(500);
      const f = await foco();
      j.afirmar(f.expandido === "true", "o campo não declarou aria-expanded=true com a lista aberta");
      const opcoes = await p.getByRole("listbox").locator("[role=option]").allInnerTexts();
      j.afirmar(opcoes.length > 0 && /Minas Gerais/.test(opcoes[0]), `primeira opção inesperada: ${opcoes[0]}`);
      return `aria-expanded=true; ${opcoes.length} opções; primeira "${normaliza(opcoes[0])}"`;
    });

    await j.passo("Pressiona Esc: a lista fecha, o foco fica no campo e nada foi escolhido", async () => {
      const url0 = j.url();
      await tecla("Escape");
      await j.esperar(300);
      const f = await foco();
      j.afirmar(f.expandido === "false", `aria-expanded depois do Esc: ${f.expandido}`);
      j.afirmar(f.papel === "combobox", `o foco saiu do campo: ${f.rotulo}`);
      j.afirmar(j.url() === url0 && !parametro(p, "sel"), `a URL mudou com o Esc: ${j.url()}`);
      const visiveis = await p.getByRole("listbox").locator("[role=option]:visible").count();
      j.afirmar(visiveis === 0, `${visiveis} opções continuam visíveis depois do Esc`);
      return `aria-expanded=false, nenhuma opção visível, foco no campo, URL ${j.url()} sem escolha`;
    });

    let fichaTecladoMG;
    await j.passo("Abre a lista com a seta para baixo, percorre as opções com setas e escolhe Minas Gerais com Enter", async () => {
      await tecla("ArrowDown");
      const a = await foco();
      j.afirmar(a.expandido === "true" && a.ativo, "a seta para baixo não abriu a lista com opção ativa");
      const primeira = normaliza(await p.locator(`#${a.ativo}`).innerText());
      await tecla("ArrowDown");
      const b = await foco();
      j.afirmar(b.ativo && b.ativo !== a.ativo, "a segunda seta não moveu a opção ativa");
      const segunda = normaliza(await p.locator(`#${b.ativo}`).innerText());
      await tecla("ArrowUp");
      const c = await foco();
      j.afirmar(c.ativo === a.ativo, "a seta para cima não voltou à primeira opção");
      await tecla("Enter");
      await j.esperar(900);
      j.afirmar(parametro(p, "sel") === "uf:MG", `Enter não escolheu Minas Gerais: ${j.url()}`);
      fichaTecladoMG = normaliza(await fichaTerritorio(p).innerText());
      j.afirmar(/Minas Gerais/.test(fichaTecladoMG) && /853/.test(fichaTecladoMG), "a ficha não traz Minas Gerais com 853 municípios");
      return `opção 1 "${primeira}", opção 2 "${segunda}", volta à 1; Enter escolheu e a URL ficou ${j.url()}; ficha com ${fichaTecladoMG.length} caracteres`;
    });

    await j.passo("Repete a escolha de Minas Gerais com clique na tabela e compara URL e texto da ficha com a do teclado", async () => {
      return comReferencia(async (ref) => {
        await abrir(ref, `${ORIGEM}/territorio`);
        await abreTabelas(ref);
        const botao = ref.locator("main button[aria-pressed]", { hasText: /^MG$/ }).first();
        await botao.scrollIntoViewIfNeeded();
        await botao.click();
        await ref.waitForTimeout(800);
        const fichaMouse = normaliza(await fichaTerritorio(ref).innerText());
        j.afirmar(new URL(ref.url()).search === new URL(p.url()).search, `URLs diferentes: teclado ${new URL(p.url()).search}, mouse ${new URL(ref.url()).search}`);
        j.afirmar(fichaMouse === fichaTecladoMG, "o texto da ficha por mouse difere do texto da ficha por teclado");
        return `URL igual (${new URL(ref.url()).search}) e ficha idêntica (${fichaMouse.length} caracteres) nas duas formas`;
      });
    });

    let fichaTecladoBA;
    await j.passo("Segue com Tab até a tabela equivalente e escolhe BA com Espaço", async () => {
      const ini = paradas.length;
      const { n } = await ateParar("o botão BA da tabela de UFs", (s) => s.tag === "button" && s.rotulo === "BA");
      exigirOrdemEIndicador(paradas.slice(ini), "tabela equivalente");
      await tecla(" ");
      await j.esperar(800);
      j.afirmar(parametro(p, "sel") === "uf:BA", `Espaço não escolheu a Bahia: ${j.url()}`);
      const f = await foco();
      j.afirmar(f.pressionado === "true", "o botão BA não ficou com aria-pressed=true");
      fichaTecladoBA = normaliza(await fichaTerritorio(p).innerText());
      j.afirmar(/Bahia/.test(fichaTecladoBA), "a ficha não traz a Bahia");
      return `${n} Tabs do campo de busca até o botão BA (mais ${nTerritorio} até o campo, ${nTerritorio + n} no total desde o topo); Espaço escolheu: URL ${j.url()}, aria-pressed=true`;
    });

    await j.passo("Repete a escolha da Bahia com clique e compara URL e ficha com a do teclado", async () => {
      return comReferencia(async (ref) => {
        await abrir(ref, `${ORIGEM}/territorio?sel=uf:MG`);
        const botao = ref.locator("main button[aria-pressed]", { hasText: /^BA$/ }).first();
        await botao.scrollIntoViewIfNeeded();
        await botao.click();
        await ref.waitForTimeout(800);
        const fichaMouse = normaliza(await fichaTerritorio(ref).innerText());
        j.afirmar(parametro(ref, "sel") === parametro(p, "sel"), `sel diferente: ${parametro(ref, "sel")} contra ${parametro(p, "sel")}`);
        j.afirmar(fichaMouse === fichaTecladoBA, "o texto da ficha por mouse difere do texto da ficha por teclado");
        return `sel=${parametro(ref, "sel")} nas duas formas; ficha idêntica (${fichaMouse.length} caracteres)`;
      });
    });

    await j.passo("Usa o link Pular para o conteúdo e conta os Tabs até o campo do mapa", async () => {
      await abrir(p, `${ORIGEM}/territorio`);
      await p.evaluate(() => {
        window.__paradaAnterior = null;
        document.activeElement && document.activeElement.blur && document.activeElement.blur();
      });
      await tecla("Tab");
      const primeiro = await foco();
      j.afirmar(/pular/i.test(primeiro.rotulo), `a primeira parada não é o link de pular: ${primeiro.rotulo}`);
      await tecla("Enter");
      await j.esperar(300);
      const dentro = await p.evaluate(() => {
        const a = document.activeElement;
        return { tag: a.tagName.toLowerCase(), id: a.id, hash: location.hash, emMain: !!a.closest("main") || a.tagName === "MAIN" };
      });
      let n = 0;
      let f;
      while (n < LIMITE_TAB) {
        await tecla("Tab");
        n++;
        f = await foco();
        if (f.papel === "combobox") break;
      }
      j.afirmar(f && f.papel === "combobox", "não cheguei ao campo do mapa depois do salto");
      j.afirmar(n < nTerritorio, `o salto não encurtou o caminho: ${n} contra ${nTerritorio}`);
      return `Enter no link levou o foco para ${dentro.tag}${dentro.id ? "#" + dentro.id : ""} (hash ${dentro.hash || "vazio"}); depois ${n} Tabs até o campo, contra ${nTerritorio} sem o salto`;
    });

    await j.passo("Segue até o filtro de submercado da tabela, abre com Enter, marca uma caixa com Espaço e fecha com Esc", async () => {
      const ini = paradas.length;
      // em Entender a tabela vem recolhida: o teclado primeiro alcança o botão que a mostra e o abre com Enter
      await ateParar("o botão que mostra a tabela completa", (s) => s.tag === "button" && /ver a tabela completa/i.test(s.rotulo));
      await tecla("Enter");
      await j.esperar(400);
      j.afirmar(await p.evaluate(() => document.activeElement.getAttribute("aria-expanded") === "true"), "Enter não abriu a tabela");
      const { n } = await ateParar("o filtro Submercado da tabela", (s) => s.tag === "summary" && /submercado \(cor no mapa\)/i.test(s.rotulo));
      exigirOrdemEIndicador(paradas.slice(ini), "filtro da tabela");
      const antes = new URL(p.url()).searchParams;
      await tecla("Enter");
      await j.esperar(300);
      j.afirmar(await p.evaluate(() => document.activeElement.closest("details").open), "Enter não abriu o filtro");
      await tecla("Tab");
      const caixa = await p.evaluate(() => ({ tipo: document.activeElement.type, rotulo: (document.activeElement.closest("label")?.innerText || "").replace(/\s+/g, " ").trim() }));
      j.afirmar(caixa.tipo === "checkbox", `a primeira parada dentro do filtro não é uma caixa: ${caixa.tipo}`);
      await tecla(" ");
      await j.esperar(700);
      const marcada = await p.evaluate(() => document.activeElement.checked);
      j.afirmar(marcada, "Espaço não marcou a caixa");
      const depois = new URL(p.url()).searchParams;
      const novos = [...depois.entries()].filter(([k, v]) => antes.get(k) !== v);
      j.afirmar(novos.length === 1, `esperava um parâmetro novo na URL, vieram: ${JSON.stringify(novos)}`);
      const contagem = (await p.locator("main [role=status]").filter({ hasText: /de \d+ linhas/ }).first().innerText()).trim();
      await tecla("Escape");
      await j.esperar(300);
      const fecha = await p.evaluate(() => ({ aberto: [...document.querySelectorAll("details[open]")].length, foco: document.activeElement.tagName.toLowerCase(), rotulo: document.activeElement.innerText.replace(/\s+/g, " ").trim().slice(0, 40) }));
      j.afirmar(fecha.aberto === 0, `${fecha.aberto} filtro(s) continuam abertos depois do Esc`);
      j.afirmar(fecha.foco === "summary", `o foco não voltou ao título do filtro: ${fecha.foco}`);
      const chip = await p.getByRole("button", { name: /^Remover filtro/ }).first().getAttribute("aria-label");
      // mesma escolha com clique, para comparar o parâmetro e a contagem
      const igual = await comReferencia(async (ref) => {
        await abrir(ref, `${ORIGEM}/territorio`);
        await abreTabelas(ref);
        const resumo = ref.locator("main summary").filter({ hasText: /submercado \(cor no mapa\)/i }).first();
        await resumo.scrollIntoViewIfNeeded();
        await resumo.click();
        await resumo.locator("xpath=..").locator("label").first().click();
        await ref.waitForTimeout(700);
        const cMouse = (await ref.locator("main [role=status]").filter({ hasText: /de \d+ linhas/ }).first().innerText()).trim();
        return { param: [...new URL(ref.url()).searchParams.entries()].filter(([k]) => k === novos[0][0]).map(([k, v]) => `${k}=${v}`)[0], contagem: cMouse };
      });
      j.afirmar(igual.param === `${novos[0][0]}=${novos[0][1]}`, `parâmetro por mouse ${igual.param}, por teclado ${novos[0][0]}=${novos[0][1]}`);
      j.afirmar(igual.contagem === contagem, `contagem por mouse "${igual.contagem}", por teclado "${contagem}"`);
      return `${n} Tabs do campo do mapa até o filtro; Enter abriu, Tab foi à caixa "${caixa.rotulo.slice(0, 40)}", Espaço marcou: URL ganhou ${novos[0][0]}=${novos[0][1]}, contagem "${contagem}", chip "${chip}"; Esc fechou e o foco voltou ao título do filtro; clique deu o mesmo parâmetro e a mesma contagem`;
    });

    // ---------- Parte 2: Perdas ----------
    let nPerdas;
    await j.passo("Abre Perdas e percorre com Tab até o campo de busca do mapa, conferindo foco visível e ordem", async () => {
      await abrir(p, `${ORIGEM}/perdas`);
      await p.evaluate(() => (window.__paradaAnterior = null));
      const ini = paradas.length;
      const { n } = await ateParar("o campo de busca do mapa de perdas", (s) => s.papel === "combobox");
      nPerdas = n;
      const lista = paradas.slice(ini);
      exigirOrdemEIndicador(lista, "Perdas");
      const ph = await p.locator("main input[role=combobox]").first().getAttribute("placeholder");
      return `${n} Tabs até o campo "${ph}"; ${lista.length} paradas, todas com indicador de foco; ordem do documento respeitada`;
    });

    let fichaTecladoCemig;
    await j.passo("Digita cemig, desce com a seta e escolhe a distribuidora com Enter", async () => {
      await j.agir(() => p.keyboard.type("cemig", { delay: 30 }));
      await j.esperar(500);
      const opcoes = await p.getByRole("listbox").locator("[role=option]:visible").allInnerTexts();
      j.afirmar(opcoes.length === 1 && /CEMIG-D/.test(opcoes[0]), `opções inesperadas: ${opcoes.join(" | ")}`);
      await tecla("ArrowDown");
      await tecla("Enter");
      await j.esperar(900);
      j.afirmar(parametro(p, "d") === "06981180000116", `Enter não escolheu a CEMIG-D: ${j.url()}`);
      fichaTecladoCemig = normaliza(await fichaPerdas(p).innerText());
      const taxa = (fichaTecladoCemig.match(/em (\d{4}), perdas totais de ([\d.]+) MWh, ([\d,]+)%/) || []);
      j.afirmar(taxa[3], "a ficha da distribuidora não traz a taxa");
      return `opção "${normaliza(opcoes[0])}"; d=${parametro(p, "d")}; ficha: em ${taxa[1]}, perdas totais de ${taxa[2]} MWh, ${taxa[3]}%`;
    });

    await j.passo("Escolhe a mesma distribuidora com clique na tabela e compara a ficha com a do teclado", async () => {
      return comReferencia(async (ref) => {
        await abrir(ref, `${ORIGEM}/perdas?tab.q=CEMIG`);
        const botao = ref.locator("main button[aria-pressed]", { hasText: /^\s*CEMIG-D/ }).first();
        await botao.scrollIntoViewIfNeeded();
        await botao.click();
        await ref.waitForTimeout(900);
        const fichaMouse = normaliza(await fichaPerdas(ref).innerText());
        j.afirmar(parametro(ref, "d") === parametro(p, "d"), `d diferente: ${parametro(ref, "d")} contra ${parametro(p, "d")}`);
        j.afirmar(fichaMouse === fichaTecladoCemig, "o texto da ficha por mouse difere do texto da ficha por teclado");
        return `d=${parametro(ref, "d")} nas duas formas; ficha idêntica (${fichaMouse.length} caracteres). A URL do teclado traz tab.pag=${parametro(p, "tab.pag")}, a do mouse traz tab.q=${parametro(ref, "tab.q")}`;
      });
    });

    await j.passo("Abre Comprove este número com Enter, confere onde cai o foco e fecha com Esc", async () => {
      await abrir(p, `${ORIGEM}/perdas`);
      await p.evaluate(() => (window.__paradaAnterior = null));
      const { n, f } = await ateParar("o botão Comprove este número", (s) => s.tag === "button" && /comprove este número/i.test(s.rotulo));
      const gatilho = f.rotulo;
      await tecla("Enter");
      await j.esperar(600);
      const aberto = await p.evaluate(() => [...document.querySelectorAll("dialog")].filter((d) => d.open).map((d) => (d.innerText || "").replace(/\s+/g, " ").slice(0, 60)));
      j.afirmar(aberto.length === 1, `${aberto.length} diálogos abertos`);
      const dentro = await foco();
      const dentroDoDialogo = await p.evaluate(() => !!document.activeElement.closest("dialog[open]"));
      j.afirmar(dentroDoDialogo, `o foco não foi para dentro do diálogo: ${dentro.rotulo}`);
      await tecla("Escape");
      await j.esperar(400);
      const restam = await p.evaluate(() => [...document.querySelectorAll("dialog")].filter((d) => d.open).length);
      const volta = await foco();
      j.afirmar(restam === 0, "o diálogo continua aberto depois do Esc");
      j.afirmar(volta.rotulo === gatilho, `o foco não voltou ao botão que abriu: ${volta.rotulo}`);
      return `${n} Tabs até "${gatilho.slice(0, 45)}"; Enter abriu o diálogo "${aberto[0]}" com o foco em "${dentro.rotulo}"; Esc fechou e o foco voltou ao botão`;
    });

    // ---------- Parte 3: diferenças regionais ----------
    await j.passo("Em Diferenças regionais, alcança o seletor Par em destaque com Tab e troca para Sul e Norte só com setas", async () => {
      await abrir(p, `${ORIGEM}/pld/diferencas-regionais?modo=analisar`);
      await p.evaluate(() => (window.__paradaAnterior = null));
      const ini = paradas.length;
      const { n } = await ateParar("o seletor Par em destaque", (s) => s.tag === "select" && /Sudeste\/Centro-Oeste e Sul/.test(s.rotulo));
      exigirOrdemEIndicador(paradas.slice(ini), "Diferenças regionais");
      const antes = normaliza(await p.getByText(/Horas separadas: /i).first().innerText());
      for (let i = 0; i < 4; i++) await tecla("ArrowDown");
      await j.esperar(800);
      j.afirmar(parametro(p, "par") === "S_N", `as setas não chegaram a S_N: ${j.url()}`);
      const depois = normaliza(await p.getByText(/Horas separadas: /i).first().locator("xpath=ancestor::*[contains(@class,'border')][1]").innerText());
      j.afirmar(/Sul e Norte/i.test(depois) && /35,53/.test(depois), `indicador não mudou para Sul e Norte: ${depois}`);
      return `${n} Tabs até o seletor; 4 setas para baixo; URL ${j.url()}; indicador: "${depois.slice(0, 90)}"`;
    });

    await j.passo("Escolhe o mesmo par com clique na tabela e compara URL e indicador", async () => {
      return comReferencia(async (ref) => {
        await abrir(ref, `${ORIGEM}/pld/diferencas-regionais?modo=analisar`);
        const botao = ref.locator("main button[aria-pressed]").filter({ hasText: /^Sul e Norte$/ }).first();
        await botao.scrollIntoViewIfNeeded();
        await botao.click();
        await ref.waitForTimeout(800);
        const mouse = normaliza(await ref.getByText(/Horas separadas: /i).first().locator("xpath=ancestor::*[contains(@class,'border')][1]").innerText());
        const teclado = normaliza(await p.getByText(/Horas separadas: /i).first().locator("xpath=ancestor::*[contains(@class,'border')][1]").innerText());
        j.afirmar(parametro(ref, "par") === parametro(p, "par"), `par diferente: ${parametro(ref, "par")} contra ${parametro(p, "par")}`);
        j.afirmar(mouse === teclado, `indicadores diferentes: "${mouse}" contra "${teclado}"`);
        return `par=${parametro(ref, "par")} nas duas formas; indicador idêntico: "${mouse.slice(0, 80)}"`;
      });
    });

    await j.passo("Entra na matriz de pares com Tab, percorre as células com setas e confere uma célula com a tabela equivalente", async () => {
      const ini = paradas.length;
      await p.evaluate(() => (window.__paradaAnterior = null));
      const { n, f } = await ateParar("a primeira célula da matriz", (s) => s.papel === "gridcell");
      exigirOrdemEIndicador(paradas.slice(ini), "matriz");
      await tecla("ArrowRight");
      await tecla("ArrowRight");
      const cel = await foco();
      j.afirmar(cel.visivel, "a célula não mostra indicador de foco");
      const m = cel.rotulo.match(/^([\d,]+)%/);
      j.afirmar(m, `a célula atual não traz um percentual: ${cel.rotulo}`);
      await tecla("ArrowDown");
      const baixo = await foco();
      await tecla("End");
      const fim = await foco();
      await tecla("Home");
      const inicio = await foco();
      j.afirmar(baixo.rotulo !== cel.rotulo && fim.rotulo !== inicio.rotulo, "as setas, End e Home não moveram o foco");
      // a mesma célula (SE/CO por Nordeste) na tabela equivalente da matriz
      const linhaTab = await p.locator("main table").filter({ has: p.locator("th", { hasText: /Submercado B \(coluna\)/ }) }).first().evaluate((t) => {
        const r = [...t.rows].find((x) => x.cells[0] && /^Sudeste\/Centro-Oeste$/.test(x.cells[0].innerText.trim()) && /^Nordeste$/.test((x.cells[1]?.innerText || "").trim()));
        return r ? [...r.cells].map((c) => c.innerText.trim()) : null;
      });
      j.afirmar(linhaTab, "linha SE/CO por Nordeste não achada na tabela equivalente");
      const pct = Number(linhaTab[3].replace(",", "."));
      j.afirmar(Math.abs(Number(m[1].replace(",", ".")) - pct) < 0.06, `célula ${m[1]}% e tabela ${linhaTab[3]}% divergem`);
      return `${n} Tabs até a matriz; duas setas para a direita levaram a "${cel.rotulo}", seta para baixo a "${baixo.rotulo}", End a "${fim.rotulo}", Home a "${inicio.rotulo}"; a tabela equivalente traz SE/CO por Nordeste = ${linhaTab[3]}% (célula ${m[1]}%)`;
    });

    await j.passo("Resume a jornada: nenhuma parada sem indicador de foco e nenhuma perda de foco", async () => {
      const r = resumoParadas(paradas);
      j.afirmar(r.sem.length === 0, `paradas sem indicador: ${r.sem.map((s) => s.rotulo).join("; ")}`);
      j.afirmar(r.corpo.length === 0, "o foco caiu no corpo em alguma parada");
      const tipos = {};
      for (const s of paradas) tipos[s.indicador] = (tipos[s.indicador] || 0) + 1;
      return `${paradas.length} paradas de foco medidas em 4 páginas; indicadores: ${Object.entries(tipos).map(([k, v]) => `${k} ${v}`).join(", ")}; nenhuma sem indicador, nenhuma no corpo da página`;
    });
  },
};
