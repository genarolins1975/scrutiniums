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

/**
 * Espera a página assentar antes de medir (roda no Node, com a página do Playwright). Com a CPU disputada, a rede assenta antes de
 * o React hidratar, e a medida pegava o layout do HTML do servidor. Achado no CI do main (run 1255, 23/10/2026): a 390 px com
 * sessão, /eficiencia-estatal mediu 333 px, com a faixa de consulta aberta ainda na tela; hidratada, mede 195 px. Por isso,
 * nesta ordem:
 * 1. rede quieta e fontes carregadas;
 * 2. a barra comum hidratada (o React já ligou a ela as suas propriedades internas);
 * 3. a consulta de sessão do navegador (/api/auth/estado, src/components/acesso/sessao.ts) concluída, com prazo curto para a
 *    página que não a faz;
 * 4. com sessão, a faixa de consulta aberta ([data-aviso-consulta-aberta]) fora da tela;
 * 5. o cromo igual em duas leituras seguidas, porque a conta e a faixa de frescor ainda se acomodam depois da sessão.
 * Devolve false se, com sessão, a faixa não sumir: ela não deve aparecer para quem tem conta, e quem mede reprova.
 */
export async function esperarPaginaAssentada(page, comSessao, prazo = 30_000) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => {
    const alvo = document.querySelector(".bp") || document.querySelector("h1");
    return !alvo || Object.keys(alvo).some((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"));
  }, undefined, { timeout: prazo }).catch(() => undefined);
  await page.waitForFunction(() => performance.getEntriesByType("resource").some((e) => e.name.includes("/api/auth/estado")), undefined, { timeout: 5_000 })
    .catch(() => undefined);
  const semFaixa = !comSessao
    || (await page.waitForFunction(() => !document.querySelector("[data-aviso-consulta-aberta]"), undefined, { timeout: prazo }).then(() => true, () => false));
  // duas leituras iguais seguidas, com 300 ms entre elas, no máximo por 15 s
  let anterior = "";
  for (let i = 0; i < 50; i++) {
    const atual = JSON.stringify(await page.evaluate(medirCromo));
    if (atual === anterior) break;
    anterior = atual;
    await page.waitForTimeout(300);
  }
  return semFaixa;
}

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
