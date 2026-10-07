/* J8, link compartilhado (desktop 1440). Roteiro por script em Chromium headless: não é teste com pessoas.
   Em três páginas (Histórico e distribuição do PLD, Perdas e Minha região) o leitor monta um recorte, usa "Copiar link
   deste painel" e o endereço é aberto num NOVO contexto de navegador (sem cookies, sem armazenamento, sem histórico),
   como faria quem recebe o link. Compara-se o que o recorte tinha com o que o link restaurou, faceta por faceta.
   O que depende só de estado local (série desligada, zoom do mapa, seções abertas) não precisa voltar; é listado para o
   relatório e não derruba o passo. O que o link promete, o "recorte atual" na URL, tem de voltar igual. */

const ORIGEM = "/setor-eletrico";

/** foto das facetas visíveis de uma página, executada dentro do navegador */
function fotoNoNavegador() {
  const norm = (t) => (t || "").replace(/\s+/g, " ").trim();
  const main = document.querySelector("main");
  const visivel = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const semMarcas = (t) => norm(t).replace(/[▲▼↕▴▾]/g, "").trim();
  const f = {};
  f.modo = [...main.querySelectorAll("[role=radio][aria-checked=true]")].map((e) => norm(e.innerText));
  f.opcoes = [...main.querySelectorAll("input[type=radio]:checked")].map((e) => norm(e.closest("label")?.innerText || e.value));
  f.seletores = [...main.querySelectorAll("select")].filter(visivel).map((s) => norm(s.selectedOptions[0]?.textContent)).slice(0, 8);
  f.faixa = [...main.querySelectorAll("input[type=range]")].map((e) => e.value);
  f.buscas = [...main.querySelectorAll("input[type=search]")].map((e) => e.value).filter(Boolean);
  f.ordenacao = [...main.querySelectorAll("[aria-sort]")].filter((e) => e.getAttribute("aria-sort") !== "none").map((e) => `${semMarcas(e.innerText)}:${e.getAttribute("aria-sort")}`);
  f.contagens = [...main.querySelectorAll("[role=status]")].map((e) => norm(e.innerText)).filter((t) => /^\d[\d.]* de \d[\d.]* linhas/.test(t));
  f.chips = [...main.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") || "").filter((t) => /^Remover (filtro|.* da comparação)/.test(t));
  f.selecionados = [...main.querySelectorAll("button[aria-pressed=true]")]
    .filter((b) => !b.closest("[role=radiogroup]"))
    .map((b) => norm(b.getAttribute("aria-label") || b.innerText).slice(0, 40));
  f.desligados = [...main.querySelectorAll("button[aria-pressed=false]")]
    .filter((b) => !b.closest("table") && !b.closest("[role=radiogroup]") && visivel(b))
    .map((b) => norm(b.getAttribute("aria-label") || b.innerText).slice(0, 40))
    .filter((t) => /^(Média|Ponderada)/.test(t));
  f.abertos = [...main.querySelectorAll("details[open] > summary")].map((s) => semMarcas(s.innerText).slice(0, 50)).filter((t) => /dados d|em tabela/i.test(t));
  const mapa = [...main.querySelectorAll("svg[role=img]")].find((x) => x.querySelectorAll("path").length > 20);
  f.zoomMapa = mapa ? mapa.getAttribute("viewBox") : null;
  const ficha = document.querySelector('aside[aria-label="Ficha da escolha"]');
  f.ficha = ficha ? norm(ficha.innerText).slice(0, 80) : null;
  return f;
}

const NOME = {
  modo: "modo de profundidade",
  opcoes: "opções marcadas (submercado, moeda, camada)",
  seletores: "seletores de ano e indicador",
  faixa: "intervalo do gráfico",
  buscas: "busca na tabela",
  ordenacao: "ordenação (aria-sort)",
  contagens: "contagem de linhas",
  chips: "chips de filtro e de comparação",
  selecionados: "seleção e séries ligadas",
  desligados: "séries desligadas",
  abertos: "seção Dados do gráfico em tabela aberta",
  zoomMapa: "zoom do mapa",
  ficha: "ficha da escolha",
};
const nome = (k) => NOME[k] || k;

export default {
  id: "J8",
  titulo: "Leitor abre um link compartilhado e encontra o mesmo recorte",
  perfil: "Leitor que recebe um endereço copiado de outra pessoa (desktop 1440 px, contexto de navegador novo)",
  largura: 1440,
  movel: false,
  limite: "Segundo contexto do mesmo Chromium (sem cookies nem armazenamento), mesma máquina e mesmo servidor; roteiro por script, sem pessoas.",
  async executar(j) {
    const p = j.p;
    const origin = new URL(j.BASE).origin;
    await j.ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    const normaliza = (t) => t.replace(/\s+/g, " ").trim();
    const resultados = {}; // por página: o que voltou e o que não voltou

    /** abre o endereço num contexto novo, tira a foto e compara com a foto de origem */
    const abrirComoDestinatario = async (pagina, endereco, fotoA, ancoraId) => {
      const ctx2 = await j.ctx.browser().newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
      const p2 = await ctx2.newPage();
      try {
        await p2.goto(endereco, { waitUntil: "networkidle" });
        await p2.waitForTimeout(2200);
        const fotoB = await p2.evaluate(fotoNoNavegador);
        const pos = await p2.evaluate((id) => {
          const el = id ? document.getElementById(id) : null;
          const b = el && el.getBoundingClientRect();
          return { hash: location.hash, existe: !!el, topo: b ? Math.round(b.top) : null, rolagem: Math.round(window.scrollY), titulo: el ? (el.querySelector("h2,h3")?.innerText || "").slice(0, 60) : "" };
        }, ancoraId);
        const chaves = Object.keys(fotoA);
        const iguais = [];
        const diferentes = [];
        const vazias = [];
        for (const k of chaves) {
          const a = JSON.stringify(fotoA[k]);
          const b = JSON.stringify(fotoB[k]);
          if (a === b) {
            iguais.push(k);
            if (vazio(fotoA[k])) vazias.push(k);
          } else diferentes.push({ faceta: k, origem: fotoA[k], link: fotoB[k] });
        }
        resultados[pagina] = { iguais, diferentes, vazias, pos, urlFinal: new URL(p2.url()).pathname + new URL(p2.url()).search };
        return { fotoB, pos, iguais, diferentes, vazias, urlFinal: resultados[pagina].urlFinal };
      } finally {
        await ctx2.close();
      }
    };

    /** clica em "Copiar link deste painel", confere a mensagem e que a área de transferência traz o mesmo endereço */
    const copiarLink = async (nome) => {
      const gatilho = p.getByText(/copiar link deste painel/i).first();
      await gatilho.scrollIntoViewIfNeeded();
      await j.clicar(gatilho);
      await j.esperar(700);
      const msg = (await p.locator("main [role=status]").filter({ hasText: /copiado/i }).first().innerText()).trim();
      j.afirmar(/copiado para a área de transferência/i.test(msg), `mensagem inesperada: ${msg}`);
      const link = await p.evaluate(() => navigator.clipboard.readText());
      j.afirmar(link.startsWith(origin), `o link copiado não é deste servidor: ${link}`);
      const campo = p.getByLabel(/endereço deste painel/i);
      const noCampo = (await campo.count()) ? await campo.first().inputValue() : null;
      if (noCampo !== null) j.afirmar(noCampo === link, `campo "${noCampo}" difere da área de transferência "${link}"`);
      return { msg, link, noCampo };
    };

    const vazio = (v) => v === null || (Array.isArray(v) && v.length === 0);
    const descreve = (r) => {
      const voltou = r.iguais.filter((k) => !r.vazias.includes(k)).map(nome);
      const nao = r.diferentes.map((d) => {
        const cortar = (v) => JSON.stringify(v).slice(0, 55);
        return `${nome(d.faceta)} (origem ${cortar(d.origem)}; link ${cortar(d.link)})`;
      });
      return `voltaram: ${voltou.join(", ") || "nenhuma"}; não voltaram: ${nao.join("; ") || "nenhuma"}`;
    };

    // ---------- Página 1: Histórico e distribuição ----------
    let fotoH;
    let linkH;
    await j.passo("Em Histórico e distribuição, monta o recorte: Analisar, Sul, série desligada, 5 anos, busca, ordem e filtro", async () => {
      await p.goto(j.BASE + `${ORIGEM}/pld/historico`, { waitUntil: "networkidle" });
      await j.esperar(900);
      await j.clicar(p.getByRole("radio", { name: /analisar/i }));
      await j.esperar(400);
      await j.clicar(p.locator("label").filter({ hasText: /^Sul$/ }).first());
      await j.esperar(500);
      const serie = p.getByRole("button", { name: /^Ponderada pela carga do balanço do ONS/ }).first();
      await serie.scrollIntoViewIfNeeded();
      await j.clicar(serie);
      await j.esperar(400);
      j.afirmar((await serie.getAttribute("aria-pressed")) === "false", "a série não ficou desligada");
      await j.clicar(p.getByRole("button", { name: /5 anos/i }));
      await j.esperar(500);
      const resumoDados = p.locator("main summary").filter({ hasText: /dados do gráfico em tabela/i }).first();
      await j.clicar(resumoDados);
      await j.esperar(300);
      const busca = p.locator("main input[type=search]").first();
      await busca.scrollIntoViewIfNeeded();
      await j.agir(() => busca.fill("2024"));
      await j.esperar(500);
      const th = p.getByRole("button", { name: /^Média temporal \(R\$\/MWh\)/ }).first();
      await j.clicar(th);
      await j.clicar(th);
      await j.esperar(400);
      const resumoFiltro = p.locator("main summary").filter({ hasText: /^\s*mês parcial/i }).first();
      await j.clicar(resumoFiltro);
      await j.clicar(resumoFiltro.locator("xpath=..").locator("label").filter({ hasText: /^\s*não/i }).first());
      await j.esperar(500);
      await j.clicar(resumoFiltro);
      const u = new URL(p.url());
      for (const [k, v] of [["modo", "analisar"], ["sm", "S"], ["mes.q", "2024"], ["mes.ord", "-temporal"], ["mes.f.parcial", "não"]]) {
        j.afirmar(u.searchParams.get(k) === v, `URL sem ${k}=${v}: ${j.url()}`);
      }
      j.afirmar(u.searchParams.get("de") && u.searchParams.get("ate"), `URL sem de e ate: ${j.url()}`);
      fotoH = await p.evaluate(fotoNoNavegador);
      return `URL ${j.url()}; a série "Ponderada pela carga do balanço do ONS" ficou desligada (não vai para a URL) e "Dados do gráfico em tabela" ficou aberto`;
    });

    await j.passo("Clica em Copiar link deste painel e confere a mensagem, o campo e a área de transferência", async () => {
      const c = await copiarLink("historico");
      linkH = c.link;
      j.afirmar(/#p\d+$/.test(linkH), `o link não termina numa âncora de painel: ${linkH}`);
      return `mensagem "${c.msg}"; link ${linkH.replace(origin, "")}; campo "Endereço deste painel com o recorte atual" igual à área de transferência`;
    });

    await j.passo("Abre o link num novo contexto de navegador e compara o recorte de Histórico e distribuição", async () => {
      const ancora = new URL(linkH).hash.slice(1);
      const r = await abrirComoDestinatario("historico", linkH, fotoH, ancora);
      const exigidos = ["modo", "opcoes", "faixa", "buscas", "ordenacao", "contagens", "chips"];
      const faltou = r.diferentes.filter((d) => exigidos.includes(d.faceta));
      j.afirmar(faltou.length === 0, `o link não restaurou: ${faltou.map((d) => `${nome(d.faceta)} (origem ${JSON.stringify(d.origem)}, link ${JSON.stringify(d.link)})`).join("; ")}`);
      j.afirmar(r.pos.existe && r.pos.topo >= 0 && r.pos.topo < 450, `o painel âncora ${ancora} não ficou à vista: topo ${r.pos.topo} px, rolagem ${r.pos.rolagem} px`);
      return `âncora #${ancora} (${r.pos.titulo}) a ${r.pos.topo} px do topo da janela, rolagem ${r.pos.rolagem} px; ${descreve(r)}`;
    });

    // ---------- Página 2: Perdas ----------
    let fotoP;
    let linkP;
    await j.passo("Em Perdas, monta o recorte: Analisar, ano 2024, indicador técnicas, zoom no mapa, filtro de UF, ordem, distribuidora e comparação", async () => {
      await p.goto(j.BASE + `${ORIGEM}/perdas`, { waitUntil: "networkidle" });
      await j.esperar(900);
      await j.clicar(p.getByRole("radio", { name: /analisar/i }));
      await j.esperar(400);
      const per = p.locator("#perdas-periodo");
      await per.scrollIntoViewIfNeeded();
      await j.agir(() => per.selectOption({ label: "2024" }));
      await j.esperar(400);
      await j.agir(() => p.locator("#perdas-medida").selectOption({ value: "tecnica" }));
      await j.esperar(600);
      const aproximar = p.getByRole("button", { name: "Aproximar", exact: true }).first();
      await aproximar.scrollIntoViewIfNeeded();
      await j.clicar(aproximar);
      await j.esperar(600);
      const resumoUF = p.locator("main summary").filter({ hasText: /^\s*UF\b/ }).first();
      await resumoUF.scrollIntoViewIfNeeded();
      await j.clicar(resumoUF);
      await j.clicar(resumoUF.locator("xpath=..").locator("label").filter({ has: p.getByText(/^MG$/) }).first());
      await j.esperar(600);
      await j.clicar(resumoUF);
      const th = p.getByRole("button", { name: /^Técnicas \(%\)/ }).first();
      await th.scrollIntoViewIfNeeded();
      await j.clicar(th);
      await j.esperar(500);
      const botao = p.locator("main button[aria-pressed]", { hasText: /^\s*CEMIG-D/ }).first();
      await botao.scrollIntoViewIfNeeded();
      await j.clicar(botao);
      await j.esperar(800);
      const campo = p.getByRole("combobox", { name: /distribuidoras para comparar/i });
      await campo.scrollIntoViewIfNeeded();
      for (const nome of ["COELBA", "COPEL"]) {
        await j.clicar(campo);
        await j.agir(() => campo.fill(nome));
        await j.esperar(500);
        await j.clicar(p.getByRole("listbox", { name: /distribuidoras para comparar/i }).getByRole("option").first());
        await j.esperar(600);
      }
      const resumoTab = p.locator("[data-componente=comparador]").locator("xpath=ancestor::section[1]").locator("summary").filter({ hasText: /dados do gráfico em tabela/i }).first();
      await j.clicar(resumoTab);
      await j.esperar(300);
      const u = new URL(p.url());
      for (const [k, v] of [["modo", "analisar"], ["periodo", "2024"], ["medida", "tecnica"], ["tab.f.ufs", "MG"], ["d", "06981180000116"]]) {
        j.afirmar(u.searchParams.get(k) === v, `URL sem ${k}=${v}: ${j.url()}`);
      }
      j.afirmar(u.searchParams.get("tab.ord"), `URL sem ordenação da tabela: ${j.url()}`);
      j.afirmar(/^\d{14},\d{14}$/.test(u.searchParams.get("cmp") || ""), `URL sem cmp com duas distribuidoras: ${j.url()}`);
      fotoP = await p.evaluate(fotoNoNavegador);
      return `URL ${j.url()}; a seção "Dados do gráfico em tabela" do comparador ficou aberta (não vai para a URL)`;
    });

    await j.passo("Clica em Copiar link deste painel de Perdas e confere a mensagem e a área de transferência", async () => {
      const c = await copiarLink("perdas");
      linkP = c.link;
      j.afirmar(/#\w+$/.test(linkP), `o link não traz âncora: ${linkP}`);
      return `mensagem "${c.msg}"; link ${linkP.replace(origin, "")}${c.noCampo === null ? " (esta página não mostra um campo com o endereço, só a mensagem)" : ""}`;
    });

    await j.passo("Abre o link de Perdas num novo contexto e compara ano, indicador, filtro, ordem, escolha e comparação", async () => {
      const ancora = new URL(linkP).hash.slice(1);
      const r = await abrirComoDestinatario("perdas", linkP, fotoP, ancora);
      const exigidos = ["modo", "seletores", "ordenacao", "contagens", "chips", "selecionados"];
      const faltou = r.diferentes.filter((d) => exigidos.includes(d.faceta));
      j.afirmar(faltou.length === 0, `o link não restaurou: ${faltou.map((d) => `${nome(d.faceta)} (origem ${JSON.stringify(d.origem)}, link ${JSON.stringify(d.link)})`).join("; ")}`);
      return `âncora #${ancora}: elemento ${r.pos.existe ? "existe" : "não existe"} no destino, topo ${r.pos.topo === null ? "sem elemento" : r.pos.topo + " px"}, rolagem ${r.pos.rolagem} px; ${descreve(r)}`;
    });

    await j.passo("Confere em Perdas que o painel certo ficou à vista ao abrir o link (âncora do link copiado)", async () => {
      const r = resultados.perdas;
      const ancora = new URL(linkP).hash.slice(1);
      j.afirmar(r.pos.existe, `o link termina em #${ancora}, mas nenhum elemento da página tem id="${ancora}" e a rolagem ficou em ${r.pos.rolagem} px`);
      j.afirmar(r.pos.topo >= 0 && r.pos.topo < 450, `o painel #${ancora} ficou a ${r.pos.topo} px do topo`);
      return `painel #${ancora} a ${r.pos.topo} px do topo da janela`;
    });

    // ---------- Página 3: Minha região ----------
    let fotoT;
    let linkT;
    await j.passo("Em Minha região, monta o recorte: Analisar, UF BA, zoom no mapa, filtro de submercado e ordem na tabela", async () => {
      await p.goto(j.BASE + `${ORIGEM}/territorio`, { waitUntil: "networkidle" });
      await j.esperar(900);
      await j.clicar(p.getByRole("radio", { name: /analisar/i }));
      await j.esperar(400);
      const botao = p.locator("main button[aria-pressed]", { hasText: /^BA$/ }).first();
      await botao.scrollIntoViewIfNeeded();
      await j.clicar(botao);
      await j.esperar(700);
      const mais = p.getByRole("button", { name: /aproximar o mapa/i }).first();
      await mais.scrollIntoViewIfNeeded();
      await j.clicar(mais);
      await j.esperar(700);
      const resumo = p.locator("main summary").filter({ hasText: /submercado \(cor no mapa\)/i }).first();
      await resumo.scrollIntoViewIfNeeded();
      await j.clicar(resumo);
      await j.clicar(resumo.locator("xpath=..").locator("label").filter({ hasText: /^\s*Nordeste/ }).first());
      await j.esperar(600);
      await j.clicar(resumo);
      const th = p.getByRole("button", { name: "Municípios", exact: true }).locator("visible=true").first();
      await th.scrollIntoViewIfNeeded();
      await j.clicar(th);
      await j.esperar(500);
      const u = new URL(p.url());
      j.afirmar(u.searchParams.get("sel") === "uf:BA", `URL sem sel=uf:BA: ${j.url()}`);
      fotoT = await p.evaluate(fotoNoNavegador);
      return `URL ${j.url()}`;
    });

    await j.passo("Clica em Copiar link deste painel de Minha região e confere a mensagem e a área de transferência", async () => {
      const c = await copiarLink("territorio");
      linkT = c.link;
      return `mensagem "${c.msg}"; link ${linkT.replace(origin, "")}`;
    });

    await j.passo("Abre o link de Minha região num novo contexto e compara escolha, ficha, filtro e ordem", async () => {
      const ancora = new URL(linkT).hash.slice(1);
      const r = await abrirComoDestinatario("territorio", linkT, fotoT, ancora);
      const exigidos = ["modo", "opcoes", "ordenacao", "contagens", "chips", "ficha"];
      const faltou = r.diferentes.filter((d) => exigidos.includes(d.faceta));
      j.afirmar(faltou.length === 0, `o link não restaurou: ${faltou.map((d) => `${nome(d.faceta)} (origem ${JSON.stringify(d.origem)}, link ${JSON.stringify(d.link)})`).join("; ")}`);
      return `âncora #${ancora}: elemento ${r.pos.existe ? "existe" : "não existe"}, topo ${r.pos.topo === null ? "sem elemento" : r.pos.topo + " px"}, rolagem ${r.pos.rolagem} px; ${descreve(r)}`;
    });

    await j.passo("Resume o que o link não restaurou nas três páginas", async () => {
      const faltas = Object.entries(resultados).map(([pg, r]) => `${pg}: ${r.diferentes.map((d) => nome(d.faceta)).join(", ") || "nada"}`);
      return `não voltaram em ${faltas.join(" | ")}`;
    });
  },
};
