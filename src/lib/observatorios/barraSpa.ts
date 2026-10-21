/**
 * Barra comum da plataforma na SPA do Crédito (public/obs/index.html), que é HTML estático e não renderiza React.
 * Fonte única dos rótulos: o registro dos seis observatórios e das suas 28 coleções (lista.ts), o mesmo que a
 * barra dos outros observatórios lê (src/components/layout/BarraPlataforma.tsx e CabecalhoPlataforma.tsx). O trecho do
 * index.html entre os marcadores é gerado por scripts/barra-spa.mjs a partir desta função, e o teste cabecalho-movel
 * confere que o arquivo publicado é igual ao gerado: mudou o registro, muda a SPA.
 *
 * Mesmas classes da barra React (bp-*, public/observatorios.css), mesma marca, mesma ordem, mesmos rótulos e a mesma
 * regra do celular (abaixo de 640 px as abas saem e o seletor da linha da marca guarda os mesmos destinos). A conta
 * começa oculta e o app.js a mostra pela sessão (/api/auth/eu): "Minha conta" com sessão, "Entrar" sem ela.
 *
 * Logo abaixo da barra, a trilha "Você está em" (Iniciativa 1 do parecer de UX, 21/10/2026), com as mesmas peças da
 * trilha das páginas Next (src/components/layout/NavegacaoContexto.tsx): no HTML, a da entrada da coleção; a cada aba, o
 * app.js a refaz pelo índice embutido (os painéis do registro sob /observatorio), porque abas do Crédito pertencem também
 * às Famílias e às Contas Públicas.
 */
import { OBSERVATORIOS, OBSERVATORIO_PRINCIPAL, destinoObservatorio } from "@/lib/observatorios/lista";
import { paineis } from "@/lib/observatorios/registro";
import { resolverContexto, type IndiceContexto } from "@/lib/observatorios/contextoPuro";

export const MARCADOR_INICIO = "<!-- barra-plataforma:inicio (gerada por scripts/barra-spa.mjs a partir de src/lib/observatorios/barraSpa.ts; não editar à mão) -->";
export const MARCADOR_FIM = "<!-- barra-plataforma:fim -->";

/** Coleção da SPA: Crédito e sistema financeiro, do Observatório da Economia. */
const DOMINIO_DA_SPA = "credito" as const;

/** Monograma S da Scrutiniums, os mesmos traços de src/components/ui/Logo.tsx (LogoMark, 20 px). */
const MONOGRAMA =
  '<svg width="20" height="25" viewBox="0 0 40 50" fill="none" aria-hidden="true" focusable="false">' +
  '<path d="M28 0 L10 0 C4 4 2 8 2 14 C2 20 6 24 13 26 L21 28 L21 14 C21 8 23 3 28 0 Z" fill="currentColor"/>' +
  '<path d="M12 50 L30 50 C36 46 38 42 38 36 C38 30 34 26 27 24 L19 22 L19 36 C19 42 17 47 12 50 Z" fill="#966B48"/></svg>';

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Índice da trilha da SPA: observatórios, coleções e os painéis do registro sob /observatorio. */
export function indiceTrilhaSpa() {
  return {
    observatorios: OBSERVATORIOS.map((o) => ({ id: o.id, nomeCurto: o.nomeCurto, entrada: destinoObservatorio(o), colecoes: o.colecoes.map((c) => ({ id: c.id, nome: c.nome, href: c.href })) })),
    paineis: paineis().filter((p) => p.rota === "/observatorio" || p.rota.startsWith("/observatorio/")).map((p) => [p.rota, p.titulo, p.observatorio, p.colecao]),
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
    paineis: paineis().filter((p) => p.rota === "/observatorio" || p.rota.startsWith("/observatorio/")).map((p) => [p.rota, p.titulo, p.observatorio, p.colecao] as const),
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
    '    <div class="bp-acoes"><a id="barraConta" class="bp-conta" href="/app/conta" hidden>Minha conta</a></div>',
    "  </div>",
    `  <div class="bp-abas"><div class="bp-abas-linha"><nav aria-label="Observatórios da Scrutiniums" class="obs-dominios">${abas}</nav></div></div>`,
    "</header>",
    htmlTrilhaSpa(caminho),
    `<script type="application/json" id="obsTrilhaIndice">${JSON.stringify(indiceTrilhaSpa()).replace(/</g, "\\u003c")}</script>`,
    MARCADOR_FIM,
  ].join("\n");
}
