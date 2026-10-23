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
 * Espera a página assentar antes de medir (roda no Node, com a página do Playwright): rede quieta, fontes carregadas, com sessão
 * a faixa de consulta aberta ([data-aviso-consulta-aberta]) fora da tela, e o cromo estável em leituras seguidas. A faixa vem no
 * HTML do servidor e só some quando o React hidrata e resolve a sessão, e outras peças do cabeçalho entram pelo cliente; com a
 * CPU disputada, a rede assenta antes disso e a medida pegava o layout de antes da hidratação. Achado no CI do main (run 1255,
 * 23/10/2026): /eficiencia-estatal a 390 px com sessão mediu 333 px; hidratada, mede 195 px. Com a CPU 20 vezes mais lenta, a
 * medida antiga reproduz os 333 px, e esperar só a faixa dava 173 px. Devolve false se a faixa não sumir no prazo: com sessão
 * ela não deve aparecer, e quem mede reprova.
 */
export async function esperarPaginaAssentada(page, comSessao, prazo = 30_000) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
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
