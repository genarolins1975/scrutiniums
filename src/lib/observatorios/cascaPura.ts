/**
 * Casca da plataforma na aplicação do Crédito (Iniciativa 2 do parecer de UX de 23/10/2026, "o Crédito na mesma casca").
 *
 * A aplicação (/observatorio, public/obs) é HTML estático e não renderiza React. Este módulo desenha, em texto, o mesmo HTML
 * que as páginas Next renderizam no servidor para:
 *  - a navegação da coleção (NavegacaoColecaoCliente.tsx), com as regras de destinoAtual e dividirItens (navegacaoPura.ts);
 *  - o rótulo de contexto acima do H1 (RotuloContexto.tsx), com a regra de resolverContexto (contextoPuro.ts);
 *  - o bloco "Para ir além" (ParaIrAlem.tsx) e o rodapé da coleção (RodapeColecao.tsx).
 *
 * Uma cópia só, usada nos dois lados: o servidor (barraSpa.ts, no route handler de /observatorio) monta com ela o HTML de cada
 * endereço, e o navegador refaz as mesmas peças a cada troca de página dentro da aplicação, com public/obs/casca.min.js, que
 * scripts/casca-spa.mjs gera deste arquivo (npm run preparar). Por isso não importa nada além de tipos: vira um script clássico
 * sem empacotador. O teste credito-casca confere, endereço por endereço, que o HTML daqui é igual ao dos componentes React;
 * mudou um componente, muda este arquivo (e o CSS gerado por scripts/barra-spa.mjs, public/obs/casca.css).
 */
import type { AtalhosNav, Atual, ItemNav, NavegacaoDaColecao, PaginaNav } from "./navegacaoPura";

/** Navegação de uma coleção como a casca a recebe: o catálogo (navegacaoDaColecao) e a classe do filete do acento. */
export type NavCasca = Pick<NavegacaoDaColecao, "id" | "nome" | "tipo" | "itens" | "atalhos"> & { filete: string };

/** Índice que a casca lê: painéis da aplicação (rota, título, observatório, coleção), atalhos e observatórios. */
export type IndiceCasca = {
  observatorios: { id: string; nome: string; destino: string; colecoes: { id: string; nome: string; href: string }[] }[];
  paineis: (readonly [rota: string, titulo: string, observatorio: string, colecao: string])[];
  /** Painéis que aparecem como atalho em outro observatório (registro.ts, ATALHOS): rota, observatório e coleção. */
  atalhos: (readonly [rota: string, observatorio: string, colecao: string])[];
  navs: Record<string, NavCasca>;
};

/** Escape de texto e de atributo igual ao do React (renderToStaticMarkup). */
export function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[c] as string);
}

// ------------------------------------------------------------------------------------------- regras de navegacaoPura.ts

const MAX_A_VISTA = 8;

function semConsulta(href: string): string {
  const s = href.split(/[?#]/)[0] || "/";
  return s.length > 1 && s.endsWith("/") ? s.slice(0, -1) : s;
}

function casamento(href: string, caminho: string): number {
  const h = semConsulta(href);
  if (href.includes("#") && h === caminho) return h.length - 0.5;
  if (h === caminho) return h.length + 0.25;
  return caminho.startsWith(`${h}/`) ? h.length : -1;
}

/** Destino atual de um endereço, com a regra de destinoAtual (navegacaoPura.ts). */
export function destinoAtual(nav: Pick<NavCasca, "itens" | "atalhos">, endereco: string | null): Atual {
  const nenhum: Atual = { item: -1, sub: null, atalho: null };
  if (!endereco) return nenhum;
  const caminho = semConsulta(endereco);
  let atalho: { k: keyof AtalhosNav; nota: number } | null = null;
  for (const k of ["dados", "metodo", "glossario"] as const) {
    const h = nav.atalhos[k];
    if (!h || h.includes("#")) continue;
    if (semConsulta(h) === caminho) return { ...nenhum, atalho: k };
    const n = casamento(h, caminho);
    if (n >= 0 && (!atalho || n > atalho.nota)) atalho = { k, nota: n };
  }
  let melhor = nenhum;
  let nota = -1;
  nav.itens.forEach((it, i) => {
    if (!it.publicado) return;
    const n = casamento(it.href, caminho);
    if (n > nota) {
      nota = n;
      melhor = { item: i, sub: null, atalho: null };
    }
    (it.subpaginas ?? []).forEach((s, j) => {
      if (!s.publicado) return;
      const m = casamento(s.href, caminho);
      if (m > nota || (m === nota && melhor.item === i && melhor.sub === null)) {
        nota = m;
        melhor = { item: i, sub: j, atalho: null };
      }
    });
  });
  if (atalho && atalho.nota > nota) return { ...nenhum, atalho: atalho.k, abaixoDoAtalho: true };
  return melhor;
}

function dividirItens<T>(itens: T[], atual: number): { aVista: { item: T; i: number }[]; mais: { item: T; i: number }[] } {
  const todos = itens.map((item, i) => ({ item, i }));
  if (todos.length <= MAX_A_VISTA) return { aVista: todos, mais: [] };
  const aVista = todos.slice(0, MAX_A_VISTA);
  const mais = todos.slice(MAX_A_VISTA);
  const k = mais.findIndex((x) => x.i === atual);
  if (k >= 0) {
    const [escolhido] = mais.splice(k, 1, aVista[MAX_A_VISTA - 1]);
    aVista[MAX_A_VISTA - 1] = escolhido;
    mais.sort((a, b) => a.i - b.i);
  }
  return { aVista, mais };
}

// --------------------------------------------------------------------------------------- NavegacaoColecaoCliente.tsx

const ROTULO_ATALHO: Record<keyof AtalhosNav, string> = { dados: "Dados", metodo: "Método", glossario: "Glossário" };
const SEM_BARRA = "[scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden";

type OpcoesDestino = { ativo: boolean; grupoAtivo?: boolean; filete: string; noMenu?: boolean; menor?: boolean };

/** Um destino (Destino em NavegacaoColecaoCliente): link com o filete do acento quando é o atual. */
function destino(p: PaginaNav, o: OpcoesDestino): string {
  const altura = o.menor ? "min-h-[44px] sm:min-h-[40px]" : "min-h-[44px]";
  const base = o.noMenu ? `flex ${altura} w-full items-center gap-2 px-4 text-sm` : `relative flex ${altura} items-center gap-1 whitespace-nowrap px-3 text-sm`;
  // destino sem página: texto, nunca link (as coleções da aplicação não têm nenhum hoje)
  if (!p.publicado) return `<span class="${base} text-mineral ">${esc(p.rotulo)}</span>`;
  const marcado = o.ativo || Boolean(o.grupoAtivo);
  const classe = `${base} motion-safe:transition-colors motion-safe:duration-150 ${marcado ? "text-carvao" : "text-carvao-muted hover:text-carvao"} ${o.noMenu && o.ativo ? "bg-papel" : o.noMenu ? "hover:bg-papel" : ""} `;
  const atributos = (o.ativo ? ' aria-current="page"' : "") + (marcado ? ' data-atual=""' : "") + ` class="${classe}" href="${esc(p.href)}"`;
  const corpo =
    esc(p.rotulo) +
    (o.grupoAtivo ? '<span class="sr-only"> (grupo da página atual)</span>' : "") +
    (marcado && !o.noMenu ? `<span aria-hidden="true" class="absolute inset-x-3 bottom-0 h-0.5 ${o.filete}"></span>` : "");
  return `<a${atributos}>${corpo}</a>`;
}

/** Navegação de uma coleção para um endereço, com o HTML de NavegacaoColecaoCliente (sem `estado`, `acoes` nem inglês). */
export function htmlNavegacao(nav: NavCasca, caminho: string): string {
  const atual = destinoAtual(nav, caminho);
  const { aVista, mais } = dividirItens<ItemNav>(nav.itens, atual.item);
  const corrente = atual.item >= 0 ? nav.itens[atual.item] : null;
  const subpaginas = corrente?.subpaginas?.length ? corrente.subpaginas : null;
  const filete = nav.filete;
  const atalhos = (["dados", "metodo", "glossario"] as const).filter((k) => nav.atalhos[k]);
  const atalho = (k: keyof AtalhosNav) =>
    destino(
      { rotulo: ROTULO_ATALHO[k], href: nav.atalhos[k] as string, publicado: true },
      { ativo: atual.atalho === k && !atual.abaixoDoAtalho, grupoAtivo: atual.atalho === k && Boolean(atual.abaixoDoAtalho), filete },
    );
  const rotulo = nav.tipo === "colecao" ? `Navegação da coleção ${nav.nome}` : nav.tipo === "observatorio" ? `Navegação do observatório ${nav.nome}` : "Navegação da conta";
  let h = `<nav aria-label="${esc(rotulo)}" class="nav-colecao border-b border-linha bg-superficie" data-nav-colecao="${esc(nav.id)}">`;
  h += '<div class="nav-colecao-caixa flex items-stretch gap-x-2">';
  h += `<ul id="nav-colecao-${esc(nav.id)}" class="nav-colecao-faixa -ml-3 flex min-w-0 flex-1 overflow-x-auto ${SEM_BARRA}">`;
  for (const { item, i } of aVista) h += `<li class="shrink-0">${destino(item, { ativo: atual.item === i && atual.sub === null, grupoAtivo: atual.item === i && atual.sub !== null, filete })}</li>`;
  // no celular nada se esconde em "Mais": a faixa rola, e os atalhos vêm no fim dela
  for (const { item, i } of mais) h += `<li class="shrink-0 sm:hidden">${destino(item, { ativo: atual.item === i, filete })}</li>`;
  for (const k of atalhos) h += `<li class="shrink-0 sm:hidden">${atalho(k)}</li>`;
  h += "</ul>";
  if (mais.length) {
    h += '<details class="group relative hidden shrink-0 sm:block">';
    h +=
      '<summary class="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap px-3 text-sm text-carvao-muted hover:text-carvao [&amp;::-webkit-details-marker]:hidden">Mais' +
      '<span aria-hidden="true" class="text-xs motion-safe:transition-transform motion-safe:duration-150 group-open:rotate-180">▾</span></summary>';
    h += '<ul class="absolute right-0 top-full z-40 mt-px hidden w-72 border border-linha bg-superficie py-1 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block">';
    for (const { item, i } of mais) h += `<li>${destino(item, { ativo: atual.item === i, filete, noMenu: true })}</li>`;
    h += "</ul></details>";
  }
  if (atalhos.length) h += `<div class="-mr-3 hidden shrink-0 items-stretch gap-x-1 border-l border-linha pl-2 sm:flex">${atalhos.map(atalho).join("")}</div>`;
  h += "</div>";
  if (subpaginas && corrente) {
    h += '<div class="border-t border-linha bg-papel"><div class="nav-colecao-caixa">';
    h += `<ul id="nav-colecao-${esc(nav.id)}-paginas" aria-label="${esc(`Páginas de ${corrente.rotulo}`)}" class="nav-colecao-faixa -ml-3 flex overflow-x-auto ${SEM_BARRA}">`;
    subpaginas.forEach((s, j) => {
      h += `<li class="shrink-0">${destino(s, { ativo: atual.sub === j, filete, menor: true })}</li>`;
    });
    h += "</ul></div></div>";
  }
  return `${h}</nav>`;
}

// ------------------------------------------------------------------------- regras de contextoPuro.ts e RotuloContexto.tsx

type Contexto = {
  observatorio: IndiceCasca["observatorios"][number];
  colecao: IndiceCasca["observatorios"][number]["colecoes"][number] | null;
  pagina: { titulo: string; rota: string } | null;
};

/** Contexto de um endereço da aplicação: o painel do próprio endereço ou o mais próximo acima dele (resolverContexto). */
export function contexto(indice: Pick<IndiceCasca, "observatorios" | "paineis">, endereco: string): Contexto | null {
  const c = semConsulta(endereco);
  const porRota = new Map(indice.paineis.map((p) => [p[0], p]));
  let atual = c;
  while (atual) {
    const p = porRota.get(atual);
    if (p) {
      const o = indice.observatorios.find((x) => x.id === p[2]);
      if (!o) return null;
      const colecao = o.colecoes.find((x) => x.id === p[3]) ?? null;
      if (colecao && p[0] === colecao.href) return { observatorio: o, colecao, pagina: null };
      return { observatorio: o, colecao, pagina: { titulo: p[1], rota: p[0] } };
    }
    const corte = atual.lastIndexOf("/");
    if (corte <= 0) break;
    atual = atual.slice(0, corte);
  }
  return null;
}

/** Rótulo acima do H1 ("Observatório X · Coleção Y · Página Z"), com o HTML de RotuloContexto (`classe`: o className dele). */
export function htmlRotulo(indice: Pick<IndiceCasca, "observatorios" | "paineis">, endereco: string, classe?: string): string {
  const ctx = contexto(indice, endereco);
  if (!ctx) return "";
  let t = esc(ctx.observatorio.nome);
  if (ctx.colecao) t += ` · ${esc(ctx.colecao.nome)}`;
  if (ctx.pagina) t += ` · ${esc(ctx.pagina.titulo)}`;
  return `<p class="${classe ? `rotulo ${classe}` : "rotulo"}" data-rotulo-contexto=""><span>${t}</span></p>`;
}

// ------------------------------------------------------------------------------------------------------ ParaIrAlem.tsx

/** Bloco "Para ir além" de um endereço, com o HTML de ParaIrAlem (em português: a aplicação não tem irmã inglesa). */
export function htmlParaIrAlem(indice: IndiceCasca, endereco: string): string {
  const porRota = new Map(indice.paineis.map((p) => [p[0], p]));
  let atual = semConsulta(endereco);
  let p: IndiceCasca["paineis"][number] | undefined;
  while (atual) {
    p = porRota.get(atual);
    if (p) break;
    const corte = atual.lastIndexOf("/");
    if (corte <= 0) break;
    atual = atual.slice(0, corte);
  }
  if (!p) return "";
  const [rota, , idObs, idCol] = p;
  const o = indice.observatorios.find((x) => x.id === idObs);
  if (!o) return "";
  const colecao = o.colecoes.find((c) => c.id === idCol);
  const outras = o.colecoes.filter((c) => c.id !== idCol);
  const tambem = indice.atalhos
    .filter((a) => a[0] === rota)
    .flatMap((a) => {
      const ox = indice.observatorios.find((x) => x.id === a[1]);
      const cx = ox?.colecoes.find((c) => c.id === a[2]);
      return ox && cx ? [{ observatorio: ox, colecao: cx }] : [];
    });
  const link = "inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4";
  let h = '<aside aria-labelledby="para-ir-alem" class="border-t border-linha bg-papel"><div class="mx-auto max-w-page px-6 py-8">';
  h += '<h2 id="para-ir-alem" class="rotulo text-mineral">Para ir além</h2>';
  h += `<p class="mt-3 text-sm leading-relaxed text-carvao">Este painel está no <a class="underline decoration-linha underline-offset-4 hover:decoration-carvao" href="${esc(o.destino)}">${esc(o.nome)}</a>`;
  if (colecao) h += `, coleção ${esc(colecao.nome)}`;
  h += ".</p>";
  if (outras.length) {
    h += '<p class="mt-2 text-sm leading-relaxed text-carvao-muted">No mesmo observatório: ';
    h += outras.map((c, i) => `<span>${i > 0 ? " · " : ""}<a class="${link}" href="${esc(c.href)}">${esc(c.nome)}</a></span>`).join("");
    h += "</p>";
  }
  if (tambem.length) {
    h += '<p class="mt-1 text-sm leading-relaxed text-carvao-muted">Também aparece em: ';
    h += tambem.map((x, i) => `<span>${i > 0 ? " · " : ""}<a class="${link}" href="${esc(x.observatorio.destino)}">${esc(x.observatorio.nome)}</a>, ${esc(x.colecao.nome)}</span>`).join("");
    h += "</p>";
  }
  return `${h}</div></aside>`;
}

// --------------------------------------------------------------------------------------------------- RodapeColecao.tsx

/**
 * Rodapé da coleção com o HTML de RodapeColecao: `filhos` (HTML pronto: as fontes e a data que a aplicação declara) e os
 * destinos (entrada, dados, método, glossário e `extras`). As coleções servidas pela aplicação não têm parceria técnica.
 */
export function htmlRodapeColecao(nav: NavCasca, filhos: string, extras: readonly { rotulo: string; href: string }[] = []): string {
  const destinos = [
    { rotulo: `Início de ${nav.nome}`, href: nav.itens[0].href },
    ...(nav.atalhos.dados ? [{ rotulo: "Dados", href: nav.atalhos.dados }] : []),
    ...(nav.atalhos.metodo ? [{ rotulo: "Método", href: nav.atalhos.metodo }] : []),
    ...(nav.atalhos.glossario ? [{ rotulo: "Glossário", href: nav.atalhos.glossario }] : []),
    ...extras,
  ];
  const link = "inline-flex min-h-[44px] items-center gap-1 text-carvao underline-offset-4 hover:underline";
  let h = `<aside aria-label="${esc(`${nav.nome}: fontes, método e parceria`)}" class="border-t border-linha bg-papel" data-rodape-colecao="${esc(nav.id)}">`;
  h += '<div class="ed-pagina grid gap-x-10 gap-y-4 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start"><div class="min-w-0">';
  h += filhos;
  h += `<ul class="flex flex-wrap gap-x-6 text-sm">${destinos.map((d) => `<li><a class="${link}" href="${esc(d.href)}">${esc(d.rotulo)}</a></li>`).join("")}</ul>`;
  return `${h}</div></div></aside>`;
}

// ---------------------------------------------------------------------------------------- comportamento (só no navegador)

/**
 * No celular a faixa rola na horizontal: traz o destino atual à vista só quando ele está cortado, rente à borda esquerda, e
 * marca as bordas em que ainda há itens fora da vista (a regra de AtivoVisivel).
 */
function acompanhaFaixa(lista: HTMLElement): void {
  const alinha = () => {
    const ativo = lista.querySelector<HTMLElement>('[aria-current="page"], [data-atual]');
    if (!ativo || lista.scrollWidth <= lista.clientWidth + 1) return;
    const a = ativo.getBoundingClientRect();
    const l = lista.getBoundingClientRect();
    if (a.left >= l.left && a.right <= l.right - 8) return;
    const alvo = Math.max(0, lista.scrollLeft + (a.left - l.left));
    const maximo = lista.scrollWidth - lista.clientWidth;
    if (alvo > maximo) lista.style.paddingRight = `${(parseFloat(getComputedStyle(lista).paddingRight) || 0) + (alvo - maximo)}px`;
    lista.scrollLeft = alvo;
  };
  const bordas = () => {
    const maximo = lista.scrollWidth - lista.clientWidth;
    lista.style.setProperty("--fade-esq", lista.scrollLeft > 1 ? "1" : "0");
    lista.style.setProperty("--fade-dir", lista.scrollLeft < maximo - 1 ? "1" : "0");
  };
  alinha();
  bordas();
  lista.addEventListener("scroll", bordas, { passive: true });
  document.fonts?.ready.then(() => {
    if (!lista.isConnected) return;
    alinha();
    bordas();
  });
}

/** O "Mais" fecha com Esc (o foco volta ao resumo), com clique fora e quando o foco sai dele (a regra de DetalhesFechaveis). */
function fechavel(el: HTMLDetailsElement): void {
  document.addEventListener("pointerdown", (e) => {
    if (el.open && !el.contains(e.target as Node)) el.open = false;
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.open) {
      el.open = false;
      el.querySelector("summary")?.focus();
    }
  });
  el.addEventListener("focusout", (e) => {
    if (el.open && !el.contains(e.relatedTarget as Node | null)) el.open = false;
  });
}

/** Liga o comportamento de uma navegação recém-desenhada (a faixa que rola no celular e o "Mais"). */
export function ligarNavegacao(nav: Element | null): void {
  if (!nav) return;
  nav.querySelectorAll<HTMLElement>(".nav-colecao-faixa").forEach(acompanhaFaixa);
  nav.querySelectorAll("details").forEach(fechavel);
}
