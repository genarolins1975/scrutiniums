/* eslint-disable @typescript-eslint/no-explicit-any -- leitura do bundle da SPA e dos gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";

/**
 * Travas das correções da avaliação de 05/09/2026 (docs/AVALIACAO_PAINEIS_2026-09.md,
 * seção 8). Cada bloco corresponde a um achado: o teste descreve o defeito que
 * não pode voltar, não a implementação.
 */
const raiz = process.cwd();
const app = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const html = readFileSync(join(raiz, "public/obs/index.html"), "utf-8");
const css = readFileSync(join(raiz, "public/obs/styles.css"), "utf-8");
const gold = (n: string) => JSON.parse(readFileSync(join(raiz, "public/obs/data/gold", n), "utf-8"));

function mapa(nome: string): Record<string, string> {
  const m = app.match(new RegExp(`const ${nome} = \\{([\\s\\S]*?)\\};`));
  expect(m, nome).toBeTruthy();
  const out: Record<string, string> = {};
  for (const par of Array.from(m![1].matchAll(/(\w+): "([^"]*)"/g))) out[par[1]] = par[2];
  return out;
}

describe("P0 — o que era trivial e estava quebrado", () => {
  it("o link do LinkedIn na aba Sobre não é mais um literal", () => {
    expect(app).not.toContain('href="HREF_LINKEDIN"');
    expect(app).toContain('meta[name="obs:linkedin"]');
    const head = readFileSync(join(raiz, "src/lib/observatorioHead.ts"), "utf-8");
    expect(head).toContain('<meta name="obs:linkedin"');
  });

  it("Recuperações & Falências não renderiza mais fichas nem séries fictícias", () => {
    const i0 = app.indexOf("function renderRJ() {");
    const i1 = app.indexOf("/* ---------- INSTITUIÇÕES ---------- */");
    const rj = app.slice(i0, i1);
    expect(rj).not.toMatch(/serie_pedidos_mensais|casos\.map|Fichas dos processos \(demo\)|badge\("demo"\)/);
    expect(rj).toContain("rjRealSection()");
    // a latência do DataJud é dita ao lado da projeção
    expect(app).toContain("Cobertura parcial nos meses recentes");
  });
});

describe("E1/E15 — número antes do método, ações recolhidas", () => {
  it("pageHead recolhe as ações num menu e mantém os controles da página visíveis", () => {
    expect(app).toContain("function phActions(itens, controles)");
    expect(app).toMatch(/details class="ph-menu"/);
    expect(css).toContain(".ph-menu .ph-items");
    // cabeçalhos próprios (Visão geral, Bets, Fraudes, Juros) usam o mesmo helper
    expect((app.match(/\$\{phActions\(/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("Instituições: método e limitações vêm DEPOIS da tabela, e o disclaimer só no rodapé", () => {
    const i0 = app.indexOf("function renderInstitutions() {");
    const seg = app.slice(i0, i0 + 20000);
    const tabela = seg.indexOf("<tbody>${rows}</tbody></table></div>");
    const metodo = seg.indexOf("método do score e limitações");
    expect(tabela).toBeGreaterThan(-1);
    expect(metodo).toBeGreaterThan(tabela);
    expect(seg).not.toContain("meta.plataforma.disclaimer");
  });

  it("Desenrola: o aviso de cobertura vem depois dos números oficiais", () => {
    expect(app).toContain("</div>${avisoDes}");
    expect(app).not.toContain("Antes do primeiro número: esta base não cobre");
  });

  it("a carta 'comece por aqui' só aparece na primeira visita", () => {
    expect(app).toContain("const PRIMEIRA_VISITA = !loadLS(\"obc_visitou\", false);");
    expect(app).toContain("PRIMEIRA_VISITA && !loadLS(\"obc_boas_vindas_ok\", false)");
  });
});

describe("E2 — modo capítulo nos dossiês", () => {
  it("subnavFixa oferece leitura por capítulos e as seções são identificáveis", () => {
    expect(app).toContain("ler por capítulos");
    expect(app).toContain("function aplicaCapitulos()");
    expect(app).toContain("window.capIr = id =>");
    expect(app).toMatch(/aplicaCapitulos\(\);\n  \}, 120\);/); // roda após cada render
    // a ficha da IF usa o mesmo componente (não um subnav próprio)
    expect(app).toContain("const subnav = subnavFixa(subnavItens);");
    expect(css).toContain(".capnav");
  });
});

describe("E4/E5 — gráficos: piso tipográfico e escala log", () => {
  it("o piso de 10,5 px vale dentro dos SVG (ajuste em runtime pela escala do viewBox)", () => {
    expect(app).toContain("const FS_PISO_SVG = 10.5;");
    expect(app).toContain("function ajustaFonteSvg(raiz)");
    expect(css).toContain("svg.chart.fs-piso text { font-size: var(--svg-fs); }");
    expect(app).toContain('<text class="xl"'); // rótulos do eixo x rareáveis
  });

  it("lineChart aceita escala log e o Mercado a usa quando a dispersão passa de 4×", () => {
    expect(app).toContain("const useLog = !!opts.log && Math.min(...all) > 0;");
    expect(app).toContain("log: useLog");
    expect(app).toContain("c.log ? Math.log10(y) : y"); // crosshair coerente
    expect(app).toContain("razao > 4");
    expect(app).toContain("mktSet('escala','log')");
    expect(app).not.toContain("os três perfis do piloto");
    expect(app).toContain("(ai % 4) * 12"); // quatro faixas de rótulo
  });
});

describe("E9/E10 — guia em toda aba, um nome por aba", () => {
  it("Juros, Bets, Fraudes e as rotas dinâmicas renderizam o guia", () => {
    for (const v of ["juros", "bets", "fraudes", "inst", "product", "sector"]) {
      expect(app, v).toContain(`guiaPagina("${v}")`);
    }
  });

  it("rótulo do menu = título do catálogo = VIEW_TITLES, para toda aba no menu", () => {
    const titulos = mapa("VIEW_TITLES");
    const nav = Array.from(html.matchAll(/data-view="(\w+)"[^>]*>([^<]+)</g));
    expect(nav.length).toBeGreaterThanOrEqual(25);
    for (const [, view, rotulo] of nav) {
      expect(rotulo.replace(/&amp;/g, "&").trim(), view).toBe(titulos[view]);
      const aba = ABAS_OBSERVATORIO.find((a) => a.view === view);
      expect(aba?.titulo, view).toBe(titulos[view]);
    }
  });

  it("o H2 de cada aba estática começa pelo mesmo nome do catálogo", () => {
    const titulos = mapa("VIEW_TITLES");
    const cabecalhos = new Set<string>();
    for (const m of Array.from(app.matchAll(/pageHead\(\{\s*title: ["`]([^"`]+)["`]/g))) cabecalhos.add(m[1]);
    for (const m of Array.from(app.matchAll(/<h2(?: [^>]*)?>([^<$]+)</g))) cabecalhos.add(m[1].trim());
    const fora = ["inst", "sector", "product", "presmun", "estado", "bets", "fraudes"]; // título vem do dado
    for (const [view, t] of Object.entries(titulos)) {
      if (fora.includes(view)) continue;
      const bate = Array.from(cabecalhos).some((c) => c === t || c.startsWith(t + " ") || c === t.replace("&", "&amp;"));
      expect(bate, `${view}: nenhum cabeçalho começa por "${t}"`).toBe(true);
    }
  });

  it("o menu tem seis grupos pela pergunta do leitor; Perguntas e Sugestões saem do menu, ficam no rodapé", () => {
    const grupos = Array.from(html.matchAll(/<span class="navlabel">([^<]+)<\/span>/g)).map((m) => m[1]);
    expect(grupos).toEqual(["Diagnóstico", "Território", "Instituições", "Produtos e preços", "Riscos e temas", "Referência"]);
    expect(html).not.toMatch(/data-view="research"/);
    expect(html).not.toMatch(/data-view="sugestoes"/);
    expect(html).toContain('href="/observatorio/research"');
    expect(html).toContain('href="/observatorio/suggestions"');
  });
});

describe("E11/E12 — alertas com hierarquia, 'O que mudou' sem monopólio de família", () => {
  it("o crachá do menu conta só atenção ou acima", () => {
    expect(app).toMatch(/filter\(x => \["atencao", "relevante", "critico"\]\.includes\(x\.nivel\)\)\.length/);
  });

  it("no gold publicado, FRE não entregue é uma linha por ano, e a família tem nível", () => {
    const C = gold("alertas_central.json");
    const oper = C.alertas.filter((a: any) => a.familia === "operacional");
    expect(oper.every((a: any) => a.nivel)).toBe(true);
    const semFre = oper.filter((a: any) => a.id.includes(":sem_fre:"));
    for (const a of semFre) expect(a.titulo).toMatch(/companhia\(s\) sem FRE/);
    expect(oper.some((a: any) => /\(-?100(\.0)?%|variação de -100/.test(a.detalhe || ""))).toBe(false);
  });

  it("'O que mudou' reserva até duas vagas por família na primeira rodada e aponta regimes para a seção certa", () => {
    const N = gold("overview.json").novidades;
    const porTipo: Record<string, number> = {};
    for (const it of N.itens) porTipo[it.tipo] = (porTipo[it.tipo] ?? 0) + 1;
    const tipos = Object.keys(porTipo);
    if (tipos.length > 1) for (const t of tipos) expect(porTipo[t], t).toBeLessThanOrEqual(Math.max(2, 8 - 2 * (tipos.length - 1)));
    for (const it of N.itens.filter((x: any) => x.tipo === "regime")) {
      expect(it.link).toEqual({ view: "institutions", sec: "sec-regimes" });
    }
    expect(app).toContain('id="sec-regimes"');
  });
});

describe("2.1 — fonte em pane: vigília e faixa na aba", () => {
  it("a SPA mapeia aba → coletores essenciais e avisa quando todos falharam", () => {
    expect(app).toContain("const VIEW_COLETORES = {");
    expect(app).toContain("function fontePane(view)");
    expect(app).toMatch(/\$\{filterBar\(currentView\(\)\)\}\$\{guiaPagina\(currentView\(\)\)\}\$\{fontePane\(currentView\(\)\)\}/);
    expect(css).toContain(".note.pane");
  });

  it("a vigília tem o cheque 'pane' e o workflow o agenda", () => {
    const vig = readFileSync(join(raiz, "scripts/vigilancia.py"), "utf-8");
    expect(vig).toContain("def pane():");
    expect(vig).toContain("COLETORES_ESSENCIAIS");
    expect(vig).toContain("PRAZO_VINTAGE_DIAS");
    const wf = readFileSync(join(raiz, ".github/workflows/vigilancia.yml"), "utf-8");
    expect(wf).toContain("cheque: [frescor, fontes, pane]");
    expect(wf).toMatch(/pane\)\s+TITULO=/);
  });
});

describe("2.2/2.3 — sem alert(), fontes do meta derivadas, uma metodologia", () => {
  it("nenhum alert() nativo; o toast existe", () => {
    expect(app).not.toMatch(/[^a-zA-Z_]alert\(/);
    expect(app).toContain("function aviso(msg, ms)");
    expect(css).toContain(".toast.on");
  });

  it("âncoras de navegação interna têm href real (a rota), não javascript:void", () => {
    expect(app).not.toMatch(/href="javascript:void\(0\)" onclick="nav\('\w+'\)"/);
    expect(app).not.toMatch(/href="javascript:void\(0\)" onclick="nav\('\$\{/);
    expect(app).toContain(`href="/observatorio/methodology" onclick="nav('method');return false"`);
  });

  it("meta.json declara as fontes pelo status da coleta, sem módulos demonstrativos", () => {
    const m = gold("meta.json");
    expect(m.fontes_demo).toEqual([]);
    expect(m.fontes_reais.length).toBeGreaterThan(20);
    expect(m.fontes_reais).toContain("CVM/FRE e FCA");
    const g = readFileSync(join(raiz, "pipeline/gold.py"), "utf-8");
    expect(g).toContain("def fontes_reais_de(fetch_status)");
    expect(g).not.toContain('"fontes_reais": ["BCB/SGS"');
    expect(html).not.toContain("DADO DEMONSTRATIVO");
    expect(html).not.toContain("12 fontes oficiais");
  });

  it("/metodologia e /fontes redirecionam para a metodologia viva; as páginas genéricas saíram", () => {
    const cfg = readFileSync(join(raiz, "next.config.mjs"), "utf-8");
    expect(cfg).toContain('source: "/metodologia", destination: "/observatorio/methodology"');
    expect(cfg).toContain('source: "/fontes", destination: "/observatorio/methodology"');
    expect(existsSync(join(raiz, "src/app/metodologia/page.tsx"))).toBe(false);
    expect(existsSync(join(raiz, "src/app/fontes/page.tsx"))).toBe(false);
    const sitemap = readFileSync(join(raiz, "src/app/sitemap.ts"), "utf-8");
    expect(sitemap).not.toMatch(/rota\("\/metodologia"/);
  });

  it("a versão dos ativos subiu junto com o app", () => {
    expect(app).toContain('const APP_VERSION = "0.93.0";');
    expect(html).toContain("?v=0.93.0");
    expect(html).not.toContain("?v=0.86.0");
  });
});
