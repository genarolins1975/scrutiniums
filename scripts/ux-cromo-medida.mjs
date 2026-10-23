// Medida do orçamento de cromo (Iniciativa 2 do parecer docs/PARECER_UX_2026-10-21.md): do topo da barra comum até o início do
// conteúdo, com a faixa de frescor incluída, e o topo do H1. Usada por scripts/ux-cromo.mjs e por src/tests/ux-orcamentos-cromo.test.ts,
// para os dois medirem a mesma coisa. Roda dentro da página (page.evaluate).
//
// Cromo é a borda de baixo do último destes elementos, contada do topo da barra comum (.bp): a barra, a trilha (.bp-trilha), a
// navegação da coleção (nav[data-nav-colecao]) ou a antiga navegação de módulo (nav cujo aria-label começa por "Navegação da
// coleção" ou "Navegação do observatório") e a faixa de frescor em linha ([data-frescor-faixa="linha"]), desde que ela venha antes
// do H1. Elementos escondidos não contam.

export const ORCAMENTO = { 1440: 230, 390: 200 };
export const TOPO_H1_MAXIMO = { 1440: 600, 390: 844 };

export function medirCromo() {
  const visivel = (e) => {
    if (!e) return false;
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && r.height > 0;
  };
  const barra = document.querySelector(".bp");
  const h1 = document.querySelector("h1");
  const topoH1 = visivel(h1) ? h1.getBoundingClientRect().top + window.scrollY : null;
  const origem = visivel(barra) ? barra.getBoundingClientRect().top + window.scrollY : 0;
  const pecas = [
    barra,
    document.querySelector(".bp-trilha"),
    ...document.querySelectorAll("nav[data-nav-colecao]"),
    ...Array.from(document.querySelectorAll("nav[aria-label]")).filter((n) => /^(Navegação da coleção|Navegação do observatório|Navegação da conta|.+ collection navigation)/.test(n.getAttribute("aria-label") || "")),
    ...document.querySelectorAll('[data-frescor-faixa="linha"]'),
  ].filter(visivel);
  let fim = origem;
  for (const e of pecas) {
    const r = e.getBoundingClientRect();
    const topo = r.top + window.scrollY;
    // só o que vem antes do título; a navegação de módulo que mora dentro do conteúdo (abaixo do H1) não é cromo
    if (topoH1 !== null && topo >= topoH1) continue;
    fim = Math.max(fim, r.bottom + window.scrollY);
  }
  return {
    cromo: Math.round(fim - origem),
    topoH1: topoH1 === null ? null : Math.round(topoH1),
    navColecao: Array.from(document.querySelectorAll("nav[data-nav-colecao]")).map((n) => n.getAttribute("aria-label")),
    linhas: Array.from(document.querySelectorAll("nav[data-nav-colecao] ul[id]")).filter(visivel).length,
    rolagemHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
}

/**
 * Com sessão, a medida só vale depois que o navegador resolveu a sessão: `useSessao` consulta /api/auth/eu depois de hidratar e só
 * então a faixa de consulta aberta ([data-aviso-consulta-aberta], que vem no HTML) sai da página. Até lá ela empurra a faixa de
 * frescor e o H1 para baixo e o cromo sai inflado: no run 1255 do main (23/10/2026), sob carga, /eficiencia-estatal mediu 333 px a
 * 390 px, os 195 px reais mais os 138 px da faixa, porque a espera por rede ociosa estourou antes de a sessão resolver. Esperar o
 * estado, não o tempo. Sem sessão não há o que esperar: a faixa fica. Falha com mensagem própria se a sessão não resolver no prazo.
 */
export async function aguardarSessaoResolvida(page, comSessao, timeout = 60_000) {
  if (!comSessao) return;
  try {
    await page.waitForFunction(() => !document.querySelector("[data-aviso-consulta-aberta]"), undefined, { timeout });
  } catch (e) {
    throw new Error(`a sessão não resolveu no navegador em ${timeout} ms: a faixa de consulta aberta continua na página (${e.message})`);
  }
}

/**
 * Espera a hidratação também onde não há faixa de consulta aberta. Sem a faixa, aguardarSessaoResolvida termina na hora, mas a
 * barra comum ainda se acomoda no cliente: a conta (FerramentasConta) entra depois de a sessão resolver e a faixa de frescor é
 * recalculada. Sob CPU disputada, a medida saía antes e ficava abaixo da real: /conectividade a 390 px com sessão mediu 183 px
 * com a CPU 4 e 8 vezes mais lenta, contra 195 px hidratada (build local do main, 23/10/2026; achado de revisão no PR
 * "Ciclo: medida do cromo espera a página assentar"). Uma medida abaixo da real pode aprovar cabeçalho acima do orçamento.
 * Espera, nesta ordem: a barra comum hidratada (o React já ligou a ela as suas propriedades internas); a consulta de sessão do
 * navegador (/api/auth/estado, src/components/acesso/sessao.ts) concluída, com prazo curto para a página que não a faz; a faixa
 * de frescor calculada (data-frescor-geral deixa de ser "calculando", src/components/frescor/FaixaFrescorCliente.tsx); e o
 * cromo igual em duas leituras seguidas, com 300 ms entre elas, por no máximo 15 s.
 */
export async function aguardarHidratacao(page, prazo = 30_000) {
  await page.waitForFunction(() => {
    const alvo = document.querySelector(".bp") || document.querySelector("h1");
    return !alvo || Object.keys(alvo).some((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"));
  }, undefined, { timeout: prazo }).catch(() => undefined);
  await page.waitForFunction(() => performance.getEntriesByType("resource").some((e) => e.name.includes("/api/auth/estado")), undefined, { timeout: 5_000 })
    .catch(() => undefined);
  // a faixa de frescor sai do servidor como "calculando" e o navegador calcula a situação com o relógio de quem lê
  await page.waitForFunction(() => !document.querySelector('[data-frescor-geral="calculando"]'), undefined, { timeout: prazo }).catch(() => undefined);
  let anterior = "";
  for (let i = 0; i < 50; i++) {
    const atual = JSON.stringify(await page.evaluate(medirCromo));
    if (atual === anterior) break;
    anterior = atual;
    await page.waitForTimeout(300);
  }
}
