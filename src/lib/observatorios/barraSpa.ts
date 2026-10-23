/**
 * Barra comum da plataforma na SPA do Crédito (public/obs/index.html), que é HTML estático e não renderiza React.
 * Fonte única dos rótulos: o registro dos seis observatórios e das suas 28 coleções (lista.ts), o mesmo que a
 * barra dos outros observatórios lê (src/components/layout/BarraPlataforma.tsx e CabecalhoPlataforma.tsx). O trecho do
 * index.html entre os marcadores é gerado por scripts/barra-spa.mjs a partir desta função, e o teste cabecalho-movel
 * confere que o arquivo publicado é igual ao gerado: mudou o registro, muda a SPA.
 *
 * Mesmas classes da barra React (bp-*, public/observatorios.css), mesma marca, mesma ordem, mesmos rótulos e a mesma
 * regra do celular (abaixo de 640 px as abas saem e o seletor da linha da marca guarda os mesmos destinos), e a mesma busca
 * da plataforma, aqui como formulário GET para /buscar (a SPA não renderiza React). A conta
 * começa oculta e o app.js a mostra pela sessão (/api/auth/eu): "Minha conta" com sessão, "Entrar" sem ela.
 *
 * Logo abaixo da barra, a trilha "Você está em" (Iniciativa 1 do parecer de UX, 21/10/2026), com as mesmas peças da
 * trilha das páginas Next (src/components/layout/NavegacaoContexto.tsx): no HTML, a da entrada da coleção; a cada aba, o
 * app.js a refaz pelo índice embutido (os painéis do registro sob /observatorio), porque abas do Crédito pertencem também
 * às Famílias e às Contas Públicas.
 */
import { OBSERVATORIOS, OBSERVATORIO_PRINCIPAL, destinoObservatorio, type ObservatorioId } from "@/lib/observatorios/lista";
import { ABAS_INSTITUCIONAIS_CREDITO, ATALHOS, paineis } from "@/lib/observatorios/registro";
import { abaPorCaminho } from "@/lib/data/observatorioAbas";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import { htmlNavegacao, htmlParaIrAlem, htmlRodapeColecao, htmlRotulo, type IndiceCasca, type NavCasca } from "@/lib/observatorios/cascaPura";
import { FIM_DA_PAGINA_CREDITO, GRUPOS_CREDITO } from "@/lib/credito/navegacao";
import { ACENTO } from "@/components/home/acentos";
import { resolverContexto, type IndiceContexto } from "@/lib/observatorios/contextoPuro";
import { EXEMPLO_DO_CAMPO } from "@/lib/busca/exemplos";

export const MARCADOR_INICIO = "<!-- barra-plataforma:inicio (gerada por scripts/barra-spa.mjs a partir de src/lib/observatorios/barraSpa.ts; não editar à mão) -->";
export const MARCADOR_FIM = "<!-- barra-plataforma:fim -->";

/** Coleção da SPA: Crédito e sistema financeiro, do Observatório da Economia. */
const DOMINIO_DA_SPA = "credito" as const;

/** Monograma S da Scrutiniums, os mesmos traços de src/components/ui/Logo.tsx (LogoMark, 20 px). */
const MONOGRAMA =
  '<svg width="20" height="25" viewBox="0 0 40 50" fill="none" aria-hidden="true" focusable="false">' +
  '<path d="M28 0 L10 0 C4 4 2 8 2 14 C2 20 6 24 13 26 L21 28 L21 14 C21 8 23 3 28 0 Z" fill="currentColor"/>' +
  '<path d="M12 50 L30 50 C36 46 38 42 38 36 C38 30 34 26 27 24 L19 22 L19 36 C19 42 17 47 12 50 Z" fill="#966B48"/></svg>';

/** Lupa da busca, os mesmos traços de BuscaPlataforma.tsx. */
const LUPA =
  '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"%CLASSE%><circle cx="6.75" cy="6.75" r="5" stroke="currentColor" stroke-width="1.5"/>' +
  '<path d="M10.5 10.5L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';

/**
 * Busca da plataforma na barra da SPA: o mesmo formulário GET para /buscar que o campo das páginas Next manda sem JavaScript,
 * com as mesmas classes (bp-busca*, public/observatorios.css). Abaixo de 640 px fica a lupa, que leva à página /buscar.
 */
const BUSCA = [
  '    <form class="bp-busca" action="/buscar" method="get" role="search" aria-label="Buscar na Scrutiniums">',
  `      <a class="bp-busca-lupa" href="/buscar" aria-label="Buscar na Scrutiniums">${LUPA.replace("%CLASSE%", "")}</a>`,
  '      <div class="bp-busca-caixa"><div class="bp-busca-form"><label class="sr-only" for="bpBuscaQ">Buscar na Scrutiniums</label>' +
    LUPA.replace("%CLASSE%", ' class="bp-busca-icone"') +
    `<input id="bpBuscaQ" class="bp-busca-campo" name="q" type="search" placeholder="${EXEMPLO_DO_CAMPO}" autocomplete="off" spellcheck="false" enterkeyhint="search" maxlength="120"></div></div>`,
  "    </form>",
];

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Páginas da aplicação que a trilha, o rótulo e o fim de página resolvem: os painéis do registro sob /observatorio e as duas
 * páginas institucionais dela ("Sobre o Observatório" e "Sugestões"), que o registro deixa de fora da navegação dos
 * observatórios mas que o fim de página liga desde a Iniciativa 2 do parecer de UX de 23/10/2026; sem elas, a trilha e o
 * rótulo dessas páginas diziam "Crédito" no lugar do nome delas (achado do Codex no PR #369).
 */
function paineisDaAplicacao(): (readonly [string, string, ObservatorioId, string])[] {
  const doRegistro = paineis()
    .filter((p) => p.rota === "/observatorio" || p.rota.startsWith("/observatorio/"))
    .map((p) => [p.rota, p.titulo, p.observatorio, p.colecao] as const);
  const institucionais = Array.from(ABAS_INSTITUCIONAIS_CREDITO).flatMap((c) => {
    const aba = abaPorCaminho(c);
    return aba ? [[`/observatorio${c}`, aba.titulo, "economia" as ObservatorioId, DOMINIO_DA_SPA] as const] : [];
  });
  return [...doRegistro, ...institucionais];
}

/** Índice da trilha da SPA: observatórios, coleções e os painéis do registro sob /observatorio. */
export function indiceTrilhaSpa() {
  return {
    observatorios: OBSERVATORIOS.map((o) => ({ id: o.id, nomeCurto: o.nomeCurto, entrada: destinoObservatorio(o), colecoes: o.colecoes.map((c) => ({ id: c.id, nome: c.nome, href: c.href })) })),
    paineis: paineisDaAplicacao(),
  };
}

/**
 * Trilha de um endereço da SPA, em HTML puro, com as mesmas peças da trilha das páginas Next (NavegacaoContexto.tsx). O
 * index.html traz a da entrada da coleção; o route handler da SPA (src/lib/observatorioHead.ts) troca pela da aba pedida,
 * e o app.js a refaz a cada navegação. Sem sessão, raiz e observatório levam à página aberta do observatório.
 */
function indiceSpa(): IndiceContexto {
  return {
    observatorios: OBSERVATORIOS.map((o) => ({ id: o.id, nome: o.nome, nomeCurto: o.nomeCurto, entrada: o.entrada, metodo: o.metodo, colecoes: o.colecoes.map((c) => ({ id: c.id, nome: c.nome, href: c.href })) })),
    paineis: paineisDaAplicacao(),
  };
}

/** Coleção dona de um endereço da SPA no registro (Consignado é de "Dívida e crédito das famílias"), para o título da aba. */
export function colecaoDaRotaSpa(caminho: string): string {
  const indice = indiceSpa();
  const ctx = resolverContexto(caminho, indice) ?? resolverContexto("/observatorio", indice)!;
  return ctx.colecao?.nome ?? ctx.observatorio.nome;
}

export function htmlTrilhaSpa(caminho: string): string {
  const indice = indiceSpa();
  const ctx = resolverContexto(caminho, indice) ?? resolverContexto("/observatorio", indice)!;
  const porta = `/perguntas/${ctx.observatorio.id}`;
  const pecas: [string, string][] = [["Observatórios", porta], [ctx.observatorio.nomeCurto, porta]];
  if (ctx.colecao) pecas.push([ctx.colecao.nome, ctx.colecao.href]);
  if (ctx.pagina) pecas.push([ctx.pagina.titulo, ctx.pagina.rota]);
  const sep = '<span aria-hidden="true">/</span>';
  const itens = pecas.map(([t, h], i) => {
    const antes = i ? sep : "";
    return i === pecas.length - 1 && ctx.exato ? `<li>${antes}<span aria-current="page">${esc(t)}</span></li>` : `<li>${antes}<a href="${h}">${esc(t)}</a></li>`;
  });
  return `<nav aria-label="Você está em" class="trilha bp-trilha obs-trilha" id="obsTrilha" data-trilha=""><ol>${itens.join("")}</ol></nav>`;
}

/**
 * Barra da SPA para um endereço: o index.html traz a da entrada (/observatorio); o route handler da SPA
 * (src/lib/observatorioHead.ts) troca pela da aba pedida, com a coleção e o observatório donos dela no registro
 * (Consignado é das Famílias), e o app.js os acerta a cada navegação.
 */
export function htmlBarraSpa(caminho = "/observatorio"): string {
  const indice = indiceSpa();
  const ctx = resolverContexto(caminho, indice) ?? resolverContexto("/observatorio", indice)!;
  const observatorioAtual = ctx.observatorio.id;
  const corrente = OBSERVATORIOS.find((o) => o.id === observatorioAtual)!.colecoes.find((c) => c.id === ctx.colecao?.id) ??
    OBSERVATORIOS.find((o) => o.id === OBSERVATORIO_PRINCIPAL[DOMINIO_DA_SPA])!.colecoes.find((c) => c.dominio === DOMINIO_DA_SPA)!;
  const seletor = OBSERVATORIOS.map((o) => {
    const colecoes = o.colecoes
      .map((c) =>
        c === corrente
          ? `<a href="${c.href}" aria-current="true">${c.nome}<span class="sr-only"> (atual)</span></a>`
          : `<a href="${c.href}">${c.nome}</a>`,
      )
      .join("");
    return `<a class="obs-trocar-obs" href="${destinoObservatorio(o)}">${o.nomeCurto}</a>${colecoes}`;
  }).join("");
  const abas = OBSERVATORIOS.map((o) =>
    o.id === observatorioAtual
      ? `<a href="${destinoObservatorio(o)}" aria-current="true">${o.nomeCurto}</a>`
      : `<a href="${destinoObservatorio(o)}">${o.nomeCurto}</a>`,
  ).join("");
  return [
    MARCADOR_INICIO,
    '<header class="bp" data-barra-plataforma="">',
    '  <div class="bp-linha">',
    `    <a class="bp-marca bp-marca--compacta" href="/" aria-label="Scrutiniums: página inicial">${MONOGRAMA}<span class="bp-marca-nome">Scrutiniums</span></a>`,
    '    <span aria-hidden="true" class="bp-divisor"></span>',
    `    <details class="obs-trocar" id="obsTrocar"><summary aria-label="Coleção atual: ${corrente.nome}. Trocar de coleção ou de observatório"><span class="obs-trocar-nome">${corrente.nome}</span> <span aria-hidden="true">▾</span></summary><div class="obs-trocar-menu">${seletor}<a class="obs-trocar-conta" href="/app/observatorios">Escolher na minha conta →</a></div></details>`,
    ...BUSCA,
    '    <div class="bp-acoes"><a id="barraConta" class="bp-conta" href="/app/conta" hidden>Minha conta</a></div>',
    "  </div>",
    `  <div class="bp-abas"><div class="bp-abas-linha"><nav aria-label="Observatórios da Scrutiniums" class="obs-dominios">${abas}</nav></div></div>`,
    "</header>",
    htmlTrilhaSpa(caminho),
    `<script type="application/json" id="obsTrilhaIndice">${JSON.stringify(indiceTrilhaSpa()).replace(/</g, "\\u003c")}</script>`,
    MARCADOR_FIM,
  ].join("\n");
}

// ------------------------------------------------------------------------------------------------------------------------
// Casca da plataforma abaixo da trilha e no fim da página (Iniciativa 2 do parecer de UX de 23/10/2026, "o Crédito na mesma
// casca"): a navegação da coleção dona do endereço, o rótulo de contexto acima do H1 e o fim de página ("Para ir além" e rodapé
// da coleção), desenhados por cascaPura.ts com o mesmo HTML dos componentes React. O route handler (observatorioHead.ts) troca,
// por endereço, o trecho entre os marcadores; o app.js refaz as mesmas peças a cada troca de página, com o índice embutido.

export const MARCADOR_NAV_INICIO = "<!-- navegacao-colecao:inicio (gerada por src/lib/observatorios/barraSpa.ts; não editar à mão) -->";
export const MARCADOR_NAV_FIM = "<!-- navegacao-colecao:fim -->";
export const MARCADOR_FIM_INICIO = "<!-- fim-colecao:inicio (gerado por src/lib/observatorios/barraSpa.ts; não editar à mão) -->";
export const MARCADOR_FIM_FIM = "<!-- fim-colecao:fim -->";

/** Endereço que a casca resolve: a raiz da aplicação abre o "Início do painel" (/observatorio/map). */
const enderecoDaCasca = (caminho: string) => (caminho === "/observatorio" || caminho === "/observatorio/" ? "/observatorio/map" : caminho);

const navCasca = (id: string): NavCasca => {
  const n = navegacaoDaColecao(id);
  return { id: n.id, nome: n.nome, tipo: n.tipo, itens: n.itens, atalhos: n.atalhos, filete: ACENTO[n.acento].filete };
};

let indiceCache: IndiceCasca | null = null;

/** Índice da casca: os painéis da aplicação, os atalhos deles, os observatórios e a navegação de cada coleção dona de um painel. */
export function indiceCasca(): IndiceCasca {
  if (indiceCache) return indiceCache;
  const daAplicacao = paineisDaAplicacao();
  const colecoes = Array.from(new Set(daAplicacao.map((p) => p[3])));
  indiceCache = {
    observatorios: OBSERVATORIOS.map((o) => ({ id: o.id, nome: o.nome, destino: destinoObservatorio(o), colecoes: o.colecoes.map((c) => ({ id: c.id, nome: c.nome, href: c.href })) })),
    paineis: daAplicacao,
    atalhos: ATALHOS.filter((a) => daAplicacao.some((p) => p[0] === a.rota)).map((a) => [a.rota, a.observatorio, a.colecao] as const),
    navs: Object.fromEntries(colecoes.map((c) => [c, navCasca(c)])),
  };
  return indiceCache;
}

/** Coleção dona de um endereço da aplicação (id do registro), com a do Crédito quando o registro não conhece o endereço. */
export function colecaoDaCasca(caminho: string): string {
  const indice = indiceSpa();
  const ctx = resolverContexto(enderecoDaCasca(caminho), indice) ?? resolverContexto("/observatorio", indice)!;
  return ctx.colecao?.id ?? DOMINIO_DA_SPA;
}

/** Navegação da coleção dona do endereço, com o atual marcado, e o índice que o app.js usa para refazê-la. */
export function htmlNavegacaoSpa(caminho = "/observatorio"): string {
  const indice = indiceCasca();
  const nav = indice.navs[colecaoDaCasca(caminho)] ?? indice.navs[DOMINIO_DA_SPA];
  return [
    MARCADOR_NAV_INICIO,
    `<div class="casca" id="cascaNav">${htmlNavegacao(nav, enderecoDaCasca(caminho))}</div>`,
    // o índice da casca, os grupos do Crédito (o "Início do painel" os lista) e as páginas institucionais do fim da página
    `<script type="application/json" id="navColecaoIndice">${JSON.stringify({ ...indice, grupos: GRUPOS_CREDITO, extrasRodape: FIM_DA_PAGINA_CREDITO }).replace(/</g, "\\u003c")}</script>`,
    MARCADOR_NAV_FIM,
  ].join("\n");
}

/** Rótulo de contexto acima do H1 de um endereço da aplicação ("Observatório X · Coleção Y · Página Z"). */
export function htmlRotuloSpa(caminho: string): string {
  return htmlRotulo(indiceCasca(), enderecoDaCasca(caminho), CLASSE_ROTULO_SPA);
}

/** Classe do rótulo de contexto na aplicação: a mesma cor de metadado das aberturas da plataforma. */
export const CLASSE_ROTULO_SPA = "text-mineral";

/**
 * Fontes e data da aplicação no rodapé da coleção: o texto que ficava no rodapé próprio dela; o aviso da gold
 * (meta.plataforma.disclaimer) e a data da publicação mais antiga, que antes ficava na barra lateral, o app.js preenche.
 */
export const FONTES_RODAPE_SPA =
  '<p class="max-w-prose2 text-sm leading-relaxed text-carvao-muted">Dados abertos do BCB, CVM, IBGE, CNJ, PGFN e Ipeadata, com atribuição; a lista completa de coletores e o estado de cada fonte estão em <a class="underline decoration-linha underline-offset-4 hover:decoration-carvao" href="/observatorio/methodology">Metodologia e fontes</a>. <span id="footDisclaimer"></span></p>' +
  '<p class="py-1 text-xs text-mineral" id="updatedAt"></p>';

/** Fim de página de um endereço da aplicação: "Para ir além" e o rodapé da coleção dona, com as páginas institucionais dela. */
export function htmlFimSpa(caminho = "/observatorio"): string {
  const indice = indiceCasca();
  const endereco = enderecoDaCasca(caminho);
  const nav = indice.navs[colecaoDaCasca(caminho)] ?? indice.navs[DOMINIO_DA_SPA];
  return [
    MARCADOR_FIM_INICIO,
    `<div class="casca" id="cascaFim">${htmlParaIrAlem(indice, endereco)}${htmlRodapeColecao(nav, FONTES_RODAPE_SPA, FIM_DA_PAGINA_CREDITO)}</div>`,
    MARCADOR_FIM_FIM,
  ].join("\n");
}

export const MARCADOR_RODAPE_INICIO = "<!-- rodape-plataforma:inicio (gerado por scripts/barra-spa.mjs a partir de src/components/layout/Footer.tsx; não editar à mão) -->";
export const MARCADOR_RODAPE_FIM = "<!-- rodape-plataforma:fim -->";

/** Rodapé da plataforma na aplicação: o HTML do componente Footer (renderizado por scripts/barra-spa.mjs), dentro da casca. */
export function htmlRodapePlataformaSpa(footer: string): string {
  return [MARCADOR_RODAPE_INICIO, `<div class="casca">${footer}</div>`, MARCADOR_RODAPE_FIM].join("\n");
}
