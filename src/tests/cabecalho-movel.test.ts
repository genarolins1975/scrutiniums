import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DOMINIOS } from "@/lib/dominios";
import { OBSERVATORIOS } from "@/lib/observatorios/registro";
import { OBSERVATORIO_PRINCIPAL, destinoObservatorio, type ObservatorioId } from "@/lib/observatorios/lista";
import { APERITIVOS, ehRotaPublica } from "@/lib/rotasPublicas";
import { MARCADOR_FIM, MARCADOR_INICIO, htmlBarraSpa } from "@/lib/observatorios/barraSpa";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoEntrada } from "@/components/eficiencia/CabecalhoEntrada";
import { EstadoConta } from "@/components/energia/AcessoConta";
import { NavegacaoColecaoCliente } from "@/components/layout/NavegacaoColecaoCliente";
import { PaginaAberta } from "@/components/acesso/PaginaAberta";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";

// endereço que o navegador vê; o seletor, as abas e a trilha resolvem o contexto por ele (NavegacaoContexto.tsx)
const navegador = vi.hoisted(() => ({ caminho: "/sobre" }));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  usePathname: () => navegador.caminho,
}));
vi.mock("next/headers", () => ({ cookies: () => ({ has: () => false }) }));
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn() }));

/**
 * Cabeçalho único da plataforma (achado A7 da banca de 19/10/2026: eram cinco cabeçalhos) e cabeçalho móvel (etapa 4 de
 * docs/saneamento/ARQUITETURA_2026-10-17.md, achado 4). Uma barra comum (BarraPlataforma) em todos os observatórios:
 * a mesma marca, os seis observatórios na ordem e com os rótulos do registro, o atual marcado, o seletor que guarda os
 * mesmos destinos no celular e a conta. Abaixo de 640 px a lista dos observatórios sai e fica o seletor. Estes testes
 * garantem que nenhuma entrada perde a barra nem o caminho para os outros observatórios, com e sem sessão.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const html = (el: ReactElement) => renderToStaticMarkup(el);

function fontes(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fontes(p, out);
    else if (n.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Trecho do HTML entre a abertura de um elemento com o atributo dado e o fechamento da mesma tag. */
function bloco(html: string, marca: string, fecho: string): string {
  const ini = html.indexOf(marca);
  expect(ini, marca).toBeGreaterThan(-1);
  return html.slice(ini, html.indexOf(fecho, ini));
}

/** Âncoras de um trecho: destino, texto visível (sem as marcas de leitor de tela) e se é a atual. */
function ancoras(trecho: string) {
  return [...trecho.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: m[1].match(/\bhref="([^"]*)"/)?.[1] ?? "",
    texto: m[2].replace(/<span class="sr-only">[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, "").trim(),
    atual: /\baria-current="(true|page)"/.test(m[1]),
  }));
}

/** O que a marca diz e desenha, sem a sintaxe do JSX ou do HTML escrito à mão. */
function marca(h: string) {
  const m = h.match(/<a\b(?=[^>]*class="bp-marca)([^>]*)>([\s\S]*?)<\/a>/);
  expect(m, "link da marca").not.toBeNull();
  const [, atributos, conteudo] = m!;
  return {
    classes: atributos.match(/class="([^"]*)"/)?.[1],
    rotulo: atributos.match(/aria-label="([^"]*)"/)?.[1],
    href: atributos.match(/href="([^"]*)"/)?.[1],
    nome: conteudo.match(/<span class="bp-marca-nome">([^<]*)<\/span>/)?.[1],
    tracos: [...conteudo.matchAll(/<path d="([^"]*)"/g)].map((x) => x[1]),
    tamanho: conteudo.match(/<svg width="(\d+)" height="(\d+)"/)?.slice(1),
  };
}

/** Só a barra comum (o elemento com data-barra-plataforma, até o fechamento dele), sem a navegação do módulo abaixo. */
function barra(h: string): string {
  const ini = h.lastIndexOf("<", h.indexOf('data-barra-plataforma=""'));
  const tag = h.slice(ini + 1, h.indexOf(" ", ini));
  let nivel = 0;
  for (const m of h.slice(ini).matchAll(new RegExp(`<(/?)${tag}\\b`, "g"))) {
    nivel += m[1] ? -1 : 1;
    if (nivel === 0) return h.slice(ini, ini + m.index! + tag.length + 3);
  }
  throw new Error("barra sem fechamento");
}

const ABAS = OBSERVATORIOS.map((o) => ({ href: destinoObservatorio(o), texto: o.nomeCurto }));

/**
 * As seis entradas com conta (e a entrada do Território e Clima, que não é coleção), o arquivo que monta o cabeçalho da
 * rota, o trecho que ele precisa conter e o cabeçalho renderizado. O Crédito é a SPA estática, conferida à parte.
 */
const ENTRADAS: { rota: string; arquivo: string; uso: string; observatorio: ObservatorioId; render: () => string }[] = [
  { rota: "/setor-eletrico", arquivo: "src/app/setor-eletrico/page.tsx", uso: '<CabecalhoEnergia atual="mapa" />', observatorio: "energia-e-infraestrutura", render: () => html(createElement(CabecalhoEnergia, { atual: "mapa" })) },
  { rota: "/saneamento", arquivo: "src/app/saneamento/page.tsx", uso: '<CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />', observatorio: "energia-e-infraestrutura", render: () => html(createElement(CabecalhoPlataforma, { colecao: "saneamento", destinoConta: "/saneamento" })) },
  { rota: "/gas-natural", arquivo: "src/app/gas-natural/page.tsx", uso: '<CabecalhoPlataforma colecao="gas" destinoConta="/gas-natural" />', observatorio: "energia-e-infraestrutura", render: () => html(createElement(CabecalhoPlataforma, { colecao: "gas", destinoConta: "/gas-natural" })) },
  { rota: "/eficiencia-estatal", arquivo: "src/app/eficiencia-estatal/page.tsx", uso: "<CabecalhoEntrada/>", observatorio: "servicos-publicos", render: () => html(createElement(CabecalhoEntrada)) },
  { rota: "/contas-publicas", arquivo: "src/app/contas-publicas/layout.tsx", uso: '<CabecalhoPlataforma colecao="contas" destinoConta="/contas-publicas"/>', observatorio: "contas-publicas", render: () => html(createElement(CabecalhoPlataforma, { colecao: "contas", destinoConta: "/contas-publicas" })) },
  { rota: "/agronegocio", arquivo: "src/app/agronegocio/layout.tsx", uso: '<CabecalhoPlataforma colecao="agro" destinoConta="/agronegocio" />', observatorio: "economia", render: () => html(createElement(CabecalhoPlataforma, { colecao: "agro", destinoConta: "/agronegocio" })) },
  { rota: "/observatorios/territorio-e-clima", arquivo: "src/app/observatorios/[id]/page.tsx", uso: "<CabecalhoPlataforma observatorio={id}", observatorio: "territorio-e-clima", render: () => html(createElement(CabecalhoPlataforma, { observatorio: "territorio-e-clima", destinoConta: "/observatorios/territorio-e-clima" })) },
];

const spa = ler("public/obs/index.html");
const barraSpa = spa.slice(spa.indexOf(MARCADOR_INICIO), spa.indexOf(MARCADOR_FIM) + MARCADOR_FIM.length);

describe("barra comum da plataforma nas entradas dos observatórios", () => {
  const marcaReferencia = marca(ENTRADAS[0].render());

  it.each(ENTRADAS)("$rota monta a barra comum, com a mesma marca, os seis observatórios em ordem e o atual marcado", ({ arquivo, uso, observatorio, render }) => {
    expect(ler(arquivo), arquivo).toContain(uso);
    const h = render();
    expect(h.match(/data-barra-plataforma=""/g), "uma barra por página").toHaveLength(1);
    // a marca: monograma de 20 px e o nome em caixa alta espaçada, o mesmo componente em todas
    expect(marca(h)).toEqual(marcaReferencia);
    expect(marca(h)).toMatchObject({ nome: "Scrutiniums", classes: "bp-marca bp-marca--compacta", rotulo: "Scrutiniums: página inicial", href: "/", tamanho: ["20", "25"] });
    // as abas dos seis observatórios, na ordem e com os rótulos do registro; só o observatório da página marcado
    const abas = ancoras(bloco(h, 'class="obs-dominios"', "</nav>"));
    expect(abas.map(({ href, texto }) => ({ href, texto }))).toEqual(ABAS);
    expect(abas.filter((a) => a.atual).map((a) => a.href)).toEqual([destinoObservatorio(OBSERVATORIOS.find((o) => o.id === observatorio)!)]);
    // o seletor da linha da marca (no celular, o caminho para os mesmos destinos)
    const seletor = ancoras(bloco(h, "<details", "</details>")).map((a) => a.href);
    for (const o of OBSERVATORIOS) expect(seletor, o.id).toContain(destinoObservatorio(o));
    // a conta: enquanto o navegador não sabe da sessão, nenhum link ("Entrar" não pisca para quem entrou)
    const linha = bloco(h, 'class="bp-acoes"', "</div>");
    expect(linha).not.toContain("<a");
    expect(h).not.toContain('href="/entrar');
  });

  it("/observatorio (SPA do Crédito) tem a mesma barra, gerada do registro, com a mesma marca e o Crédito marcado", () => {
    expect(barraSpa, "rode node scripts/barra-spa.mjs").toBe(htmlBarraSpa());
    expect(barraSpa.match(/data-barra-plataforma=""/g)).toHaveLength(1);
    expect(marca(barraSpa)).toEqual(marcaReferencia);
    const abas = ancoras(bloco(barraSpa, 'class="obs-dominios"', "</nav>"));
    expect(abas.map(({ href, texto }) => ({ href, texto }))).toEqual(ABAS);
    expect(abas.filter((a) => a.atual).map((a) => a.href)).toEqual([destinoObservatorio(OBSERVATORIOS.find((o) => o.id === OBSERVATORIO_PRINCIPAL.credito)!)]);
    // a conta começa oculta; o app.js a mostra pela sessão
    expect(barraSpa).toContain('<a id="barraConta" class="bp-conta" href="/app/conta" hidden>Minha conta</a>');
  });

  it("nenhum cabeçalho de observatório desenha a própria marca: o monograma sai da barra comum (e das páginas de conta e de acesso)", () => {
    const permitidos = [
      "src/components/ui/Logo.tsx",
      "src/components/layout/BarraPlataforma.tsx",
      // páginas de foco da conta, rodapé, acesso e cadastro: fora dos observatórios
      "src/components/layout/FocoHeader.tsx",
      "src/components/layout/Footer.tsx",
      "src/components/home/SecaoAcesso.tsx",
      "src/app/entrar/page.tsx",
      "src/app/entrar/sms/page.tsx",
      "src/app/entrar/sms/verificar/page.tsx",
      // as páginas de entrada, em português e em inglês, desenham a marca pelo componente comum (PR #261)
      "src/components/onboarding/PaginasEntrar.tsx",
      "src/app/cadastro/layout.tsx",
    ];
    const usam = fontes(join(raiz, "src"))
      .filter((f) => !f.includes("/tests/") && /\bLogo(Mark|Wordmark)\b/.test(readFileSync(f, "utf-8")))
      .map((f) => f.slice(raiz.length + 1));
    expect(usam.filter((f) => !permitidos.includes(f))).toEqual([]);
  });

  it("o cabeçalho público usa a mesma barra e a mesma marca, com o nome à vista também no celular", () => {
    const h = html(createElement(PublicHeaderView, { authenticated: false }));
    expect(h.match(/data-barra-plataforma=""/g)).toHaveLength(1);
    const m = marca(h);
    expect({ ...m, classes: undefined, rotulo: undefined }).toEqual({ ...marcaReferencia, classes: undefined, rotulo: undefined });
    // sem seletor ao lado, o nome cabe no celular: a marca não é a compacta
    expect(m.classes).toBe("bp-marca");
    // as abas abertas têm os mesmos rótulos e a mesma ordem dos observatórios, e levam às páginas abertas
    const abas = ancoras(bloco(h, 'aria-label="Navegação principal"', "</nav>")).filter((a) => a.href.startsWith("/perguntas/") && !a.href.includes("#"));
    expect(abas.slice(-OBSERVATORIOS.length).map((a) => a.texto)).toEqual(OBSERVATORIOS.map((o) => o.nomeCurto));
  });
});

describe("com e sem sessão: a barra não aponta para o login de quem entrou nem abre painel sem conta", () => {
  it("com sessão, só 'Minha conta'; sem sessão, só 'Entrar', com volta à página; sem resposta, nenhum link", () => {
    const rotulos = { conta: "Minha conta", entrar: "Entrar" };
    const com = html(createElement(EstadoConta, { logado: true, hrefEntrar: "/entrar?de=%2Fsetor-eletrico", rotulos }));
    expect(ancoras(com)).toEqual([{ href: "/app/conta", texto: "Minha conta", atual: false }]);
    const sem = html(createElement(EstadoConta, { logado: false, hrefEntrar: "/entrar?de=%2Fsetor-eletrico", rotulos }));
    expect(ancoras(sem)).toEqual([{ href: "/entrar?de=%2Fsetor-eletrico", texto: "Entrar", atual: false }]);
    expect(ancoras(html(createElement(EstadoConta, { logado: null, hrefEntrar: "/entrar", rotulos })))).toEqual([]);
    // a barra comum usa este estado, lido do servidor no navegador (/api/auth/estado, sem cache)
    const acesso = ler("src/components/energia/AcessoConta.tsx");
    expect(acesso).toContain('fetch("/api/auth/estado", { cache: "no-store" })');
    expect(ler("src/components/layout/CabecalhoPlataforma.tsx")).toContain("<AcessoConta destino={destinoConta} />");
  });

  it("na SPA do Crédito, a conta da barra segue a sessão: 'Minha conta' com 204, 'Entrar' com volta sem ela", () => {
    const app = ler("public/obs/app.js");
    const ini = app.indexOf("(function initContaBarra()");
    expect(ini).toBeGreaterThan(-1);
    const trecho = app.slice(ini, app.indexOf("})();", ini));
    expect(trecho).toContain('fetch("/api/auth/eu", { credentials: "same-origin" })');
    expect(trecho).toContain("r.status === 204");
    expect(trecho).toContain('conta.href = "/entrar?de=" + encodeURIComponent(location.pathname + location.search + location.hash)');
    expect(trecho).toContain("conta.hidden = false");
  });

  it.each([false, true])("cabeçalho público, autenticado=%s: com sessão, conta e observatórios; sem ela, entrar e criar acesso", (autenticado) => {
    const h = html(createElement(PublicHeaderView, { authenticated: autenticado }));
    const destinos = ancoras(h).map((a) => a.href);
    if (autenticado) {
      expect(destinos).not.toContain("/entrar");
      expect(destinos).not.toContain("/cadastro");
      expect(destinos).toContain("/app/conta");
    } else {
      expect(destinos).toContain("/entrar");
      expect(destinos).toContain("/cadastro");
      expect(destinos).not.toContain("/app/conta");
    }
  });

  // Consultas pessoais abertas por decisão do dono (19/10/2026, leva 1 da estratégia "aberto e com conta"): a entrada da
  // Eficiência Estatal (retrato da capital, sem a nota composta) é a única entrada que a barra alcança sem conta.
  const ENTRADAS_ABERTAS = ["/eficiencia-estatal"];

  it("as entradas e todo destino da barra dos observatórios seguem com conta, salvo as consultas abertas: a barra não abre painel", () => {
    for (const { rota } of [...ENTRADAS, { rota: "/observatorio" }]) expect(ehRotaPublica(rota), rota).toBe(ENTRADAS_ABERTAS.includes(rota));
    const destinos = new Set<string>();
    // o seletor de idioma (onde há tradução) leva à mesma página no outro idioma, com a mesma regra de acesso dela
    const semIdioma = (h: string) => h.replace(/<div role="group" aria-label="Idioma"[\s\S]*?<\/div>/g, "");
    for (const e of ENTRADAS) for (const a of ancoras(semIdioma(barra(e.render())))) destinos.add(a.href.split(/[?#]/)[0]);
    for (const a of ancoras(barra(barraSpa))) destinos.add(a.href.split(/[?#]/)[0]);
    // a marca leva à home, que é aberta; desde a Iniciativa 1 (21/10/2026) o seletor lista as 28 coleções, e as portas de
    // coleção que são a página única de um tema (APERITIVOS: sem sessão, a versão aperitivo; com sessão, o painel completo)
    // também são abertas; todo o resto da barra (observatórios, coleções, escolha e conta) pede sessão
    const aperitivos = new Set(APERITIVOS.map((a) => a.rota));
    for (const d of destinos) if (ehRotaPublica(d)) expect(d === "/" || ENTRADAS_ABERTAS.includes(d) || aperitivos.has(d), d).toBe(true);
    expect(destinos.size).toBeGreaterThanOrEqual(1 + OBSERVATORIOS.length + OBSERVATORIOS.flatMap((o) => o.colecoes).length + 2);
  });
});

describe("cabeçalho móvel: a lista de observatórios dá lugar ao seletor", () => {
  it("abaixo de 640 px a lista de observatórios sai", () => {
    const css = ler("public/observatorios.css").replace(/\s+/g, "");
    expect(css).toContain("@media(max-width:639px){.obs-dominios{display:none;}}");
  });

  it("a lista de observatórios só existe na barra comum, que sempre traz o seletor de observatório", () => {
    const usam = fontes(join(raiz, "src")).filter((f) => !f.includes("/tests/") && readFileSync(f, "utf-8").includes("<NavegacaoObservatorios"));
    expect(usam.map((f) => f.slice(raiz.length + 1))).toEqual(["src/components/layout/CabecalhoPlataforma.tsx"]);
    expect(readFileSync(usam[0], "utf-8")).toContain("<SwitcherObservatorio");
    // e a barra comum é a dos cabeçalhos de todos os observatórios e painéis
    const cabecalhos = [
      "src/components/energia/CabecalhoEnergia.tsx",
      "src/app/saneamento/page.tsx",
      "src/app/gas-natural/page.tsx",
      "src/app/combustiveis/page.tsx",
      "src/app/custo-de-vida/page.tsx",
      "src/app/educacao-municipal/page.tsx",
      "src/components/credito/Blocos.tsx",
      "src/components/eficiencia/CabecalhoEntrada.tsx",
      "src/components/eficiencia/CabecalhoObee.tsx",
      "src/components/eficiencia/saude/CabecalhoSaude.tsx",
      "src/components/eficiencia/judiciario/Cabecalho.tsx",
      "src/app/agronegocio/layout.tsx",
      "src/app/contas-publicas/layout.tsx",
      "src/app/contas-publicas-estaduais/layout.tsx",
      "src/app/observatorios/[id]/page.tsx",
      "src/app/territorio/layout.tsx",
    ];
    for (const f of cabecalhos) expect(ler(f), f).toMatch(/<CabecalhoPlataforma\b/);
  });

  it("quando o nome Scrutiniums some no celular, o link da marca mantém o alvo de toque de 44 px", () => {
    const css = ler("public/observatorios.css").replace(/\s+/g, " ");
    expect(css).toMatch(/\.bp a\.bp-marca \{[^}]*min-height:44px; min-width:44px;/);
    // o bloco do celular da barra: o nome sai só da marca compacta (a que divide a linha com o seletor), e o link fica centrado
    const ini = css.indexOf("@media(max-width:639px) { .bp-linha");
    expect(ini).toBeGreaterThan(-1);
    const celular = css.slice(ini, css.indexOf("} }", ini));
    expect(celular).toContain(".bp a.bp-marca--compacta { justify-content:center; }");
    expect(celular).toContain(".bp-marca--compacta .bp-marca-nome { display:none; }");
  });

  // Iniciativa 1 (21/10/2026): o seletor lista as coleções do registro (o.colecoes), não mais os oito domínios
  it("o seletor lista as 28 coleções agrupadas pelos seis observatórios do registro", () => {
    // marca a coleção dona do endereço no registro, não a do domínio que a página declara
    navegador.caminho = "/eficiencia-estatal/trabalho-renda/emprego-formal";
    const html = renderToStaticMarkup(createElement(SwitcherObservatorio, { atual: "eficiencia", caminho: navegador.caminho }));
    navegador.caminho = "/sobre";
    for (const o of OBSERVATORIOS) for (const c of o.colecoes) expect(html, `${o.id}/${c.id}`).toContain(`href="${c.href}"`);
    expect(html).toContain('aria-label="Coleção atual: Renda e trabalho.');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="true"[^>]*href="\/eficiencia-estatal\/trabalho-renda"/);
    // fora do registro, vale o domínio declarado: a coleção que o apresenta inteiro
    expect(renderToStaticMarkup(createElement(SwitcherObservatorio, { atual: "eficiencia", caminho: "/fora-do-registro" }))).toContain('aria-label="Coleção atual: Síntese das capitais.');
    expect(OBSERVATORIOS.flatMap((o) => o.colecoes)).toHaveLength(28);
    expect(DOMINIOS).toHaveLength(8);
    for (const d of DOMINIOS) expect(OBSERVATORIOS.some((o) => o.id === OBSERVATORIO_PRINCIPAL[d.id]), d.id).toBe(true);
  });

  // Iniciativa 1 do parecer de UX (21/10/2026): o seletor lista as 28 coleções do registro, não mais os oito domínios antigos
  it("na SPA do Crédito, o seletor da barra lista os seis observatórios e as 28 coleções com os nomes do registro", () => {
    const trocar = bloco(spa, 'class="obs-trocar"', "</details>");
    for (const o of OBSERVATORIOS) {
      expect(trocar, o.id).toContain(`<a class="obs-trocar-obs" href="${destinoObservatorio(o)}">${o.nomeCurto}</a>`);
      for (const c of o.colecoes) expect(trocar, `${o.id}/${c.id}`).toMatch(new RegExp(`<a href="${c.href}"[^>]*>${c.nome}<`));
    }
    expect(trocar).toContain('aria-current="true">Crédito e sistema financeiro<');
    // um só seletor: o da barra lateral repetia o da barra comum
    expect(spa).not.toContain('class="obs-switcher"');
    // fecha com Esc, toque fora e perda de foco
    expect(ler("public/obs/app.js")).toContain('["obsTrocar"].forEach');
  });

  it("no cabeçalho público, o seletor do celular tem só os observatórios; Imprensa e Entrar ficam à vista", () => {
    const html = renderToStaticMarkup(createElement(PublicHeaderView, { authenticated: false }));
    const seletor = bloco(html, "<details", "</details>");
    expect(seletor).toContain("Observatórios");
    const destinos = [...seletor.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(destinos).toEqual(OBSERVATORIOS.map((o) => `/perguntas/${o.id}`));
    expect(seletor).not.toContain("/imprensa");
    const nav = bloco(html, 'aria-label="Navegação principal"', "</nav>");
    expect(nav).toContain('href="/imprensa"');
    expect(nav).toContain('href="/entrar"');
  });
});

describe("navegação da coleção sob a barra comum, nas 28 coleções, com e sem sessão (Iniciativa 2)", () => {
  const colecoes = OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => ({ ...c, observatorio: o.nomeCurto })));

  it.each(colecoes)("$observatorio · $nome: o mesmo componente, o rótulo padrão, o Início marcado na entrada e o selo só na página aberta", (c) => {
    const nav = navegacaoDaColecao(c.id);
    const entrada = nav.itens[0].href;
    navegador.caminho = entrada;
    const painel = html(createElement(NavegacaoColecaoCliente, { nav, caminho: entrada, idioma: "pt" }));
    const aberta = html(createElement(PaginaAberta, null, createElement(NavegacaoColecaoCliente, { nav, caminho: entrada, idioma: "pt" })));
    for (const h of [painel, aberta]) {
      expect(h).toContain(`aria-label="Navegação da coleção ${c.nome}"`);
      expect(h).toContain(`data-nav-colecao="${c.id}"`);
      expect(h, "a navegação não desenha marca própria").not.toContain("bp-marca");
      const atuais = ancoras(h).filter((a) => a.atual);
      expect(atuais.map((a) => a.href)).toEqual([entrada]);
    }
    // com sessão (painel), nenhum selo; sem sessão numa página aberta, todo destino que pede conta leva o selo antes do clique
    // (a entrada que é ela mesma página aberta, como a apresentação do Crédito, já se comporta como aberta)
    if (!ehRotaPublica(entrada)) expect(painel).not.toContain("com conta");
    const fechados = nav.itens.filter((i) => i.publicado && !ehRotaPublica(i.href.split(/[?#]/)[0]));
    if (fechados.length) expect(aberta).toContain("com conta");
  });
});
