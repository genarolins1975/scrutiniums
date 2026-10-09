import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PequenosMultiplos, type PequenosMultiplosProps } from "@/components/energia/PequenosMultiplos";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { dominiosPaineis, painelSemDado } from "@/lib/energia/series-temporais";

/**
 * Pequenos múltiplos (src/components/energia/PequenosMultiplos.tsx): escala
 * compartilhada por padrão (altura igual é valor igual), escala livre só com
 * aviso visível, eixo de tempo alinhado, painel sem dado sem linha em zero,
 * lacunas preservadas, grade de uma coluna no celular, títulos por painel e
 * tabela equivalente com todos os painéis.
 */

const dados = [
  { d: "2024-01-01", SE: 10, S: 100, NE: null, N: 5 },
  { d: "2024-01-02", SE: 20, S: 110, NE: null, N: null },
  { d: "2024-01-03", SE: null, S: 120, NE: null, N: 6 },
  { d: "2024-01-04", SE: 40, S: 130, NE: null, N: null },
  { d: "2024-01-05", SE: 50, S: 140, NE: null, N: 8 },
];

describe("domínios dos painéis", () => {
  it("compartilhada: uma régua para todos, que cobre o menor e o maior valor de qualquer painel", () => {
    const doms = dominiosPaineis(dados, [["SE"], ["S"], ["N"]]);
    expect(doms[0]).toBe(doms[1]);
    expect(doms[1]).toBe(doms[2]);
    expect(doms[0].min).toBeLessThanOrEqual(5);
    expect(doms[0].max).toBeGreaterThanOrEqual(140);
  });

  it("livre: cada painel com a própria régua; ausência não puxa o mínimo para zero", () => {
    const [se, s] = dominiosPaineis(dados, [["SE"], ["S"]], { escala: "livre" });
    expect(se.max).toBeLessThan(s.min);
    expect(s.min).toBeGreaterThan(0);
  });

  it("painel só com nulos é 'sem dado', e zero continua sendo dado", () => {
    expect(painelSemDado(dados, ["NE"])).toBe(true);
    expect(painelSemDado([{ d: "x", v: 0 }], ["v"])).toBe(false);
  });
});

const base: PequenosMultiplosProps = {
  titulo: "Carga por subsistema",
  dados,
  chaveX: "d",
  paineis: [
    { id: "SE", titulo: "Sudeste/Centro-Oeste" },
    { id: "S", titulo: "Sul" },
    { id: "NE", titulo: "Nordeste" },
    { id: "N", titulo: "Norte" },
  ],
  unidade: "MWmed",
  casas: 0,
};
const html = (p: Partial<PequenosMultiplosProps> = {}) => renderToStaticMarkup(createElement(PequenosMultiplos, { ...base, ...p }));

function painel(m: string, id: string): string {
  const r = m.match(new RegExp(`<li[^>]*data-painel="${id}"[^>]*>([\\s\\S]*?)</li>`));
  if (!r) throw new Error(`painel ${id} não encontrado`);
  return r[1];
}
const ticksDo = (p: string) => Array.from(p.matchAll(/text-anchor="end" font-size="10"[^>]*>([^<]+)</g)).map((t) => t[1]);

describe("PequenosMultiplos no servidor", () => {
  const m = html();

  it("grade responsiva: uma coluna no celular, duas a partir de sm e três a partir de lg", () => {
    expect(m).toMatch(/<ul class="grid grid-cols-1 [^"]*sm:grid-cols-2 lg:grid-cols-3"[^>]*aria-label="Carga por subsistema"/);
    expect(html({ colunas: 2 })).not.toContain("lg:grid-cols");
  });

  it("linhas finas da grade nas bordas das células: com número ímpar de painéis a célula que sobra não ganha fundo", () => {
    const tres = html({ paineis: base.paineis.slice(0, 3) });
    expect(tres).not.toMatch(/<ul class="grid [^"]*bg-linha/);
    expect(tres).toMatch(/<ul class="grid grid-cols-1 border-l border-t border-linha /);
    const celulas = tres.match(/<li [^>]*data-painel="[^"]+"/g) ?? [];
    expect(celulas).toHaveLength(3);
    for (const c of celulas) expect(c).toContain("border-b border-r border-linha");
  });

  it("legenda: uma entrada por rótulo e traço, mesmo com id de série próprio por painel", () => {
    const dd = [
      { d: "a", m1: 1, p1: 2, m2: 3, p2: 4 },
      { d: "b", m1: 2, p1: 3, m2: 4, p2: 5 },
    ];
    const serie = (id: string, rotulo: string, cor: string, tracejada = false) => ({ id, rotulo, cor, tracejada });
    const legendaDe = (m: string) => m.match(/<ul class="[^"]*" aria-label="Legenda">([\s\S]*?)<\/ul>/)?.[1] ?? "";

    // cor da entidade diferente entre painéis: duas entradas (traço cheio e tracejado), amostra neutra e aviso de que a cor distingue o painel
    const porEntidade = html({
      dados: dd,
      paineis: [
        { id: "A", titulo: "Bacia A", series: [serie("m1", "Chuva no mês", "var(--cor-energia)"), serie("p1", "Média do mês", "var(--cor-energia)", true)] },
        { id: "B", titulo: "Bacia B", series: [serie("m2", "Chuva no mês", "var(--cor-agua)"), serie("p2", "Média do mês", "var(--cor-agua)", true)] },
      ],
    });
    const lg = legendaDe(porEntidade);
    expect(lg.match(/Chuva no mês/g)).toHaveLength(1);
    expect(lg.match(/Média do mês/g)).toHaveLength(1);
    expect(lg).toContain("A cor identifica o painel");
    expect(lg).toContain('stroke="var(--cor-carvao)"');
    expect(lg).not.toContain("var(--cor-agua)");

    // mesma cor em todos os painéis: a amostra leva a cor da série e não há aviso
    const igual = html({
      dados: dd,
      paineis: [
        { id: "A", titulo: "Bacia A", series: [serie("m1", "Chuva no mês", "var(--cor-energia)"), serie("p1", "Média do mês", "var(--cor-energia)", true)] },
        { id: "B", titulo: "Bacia B", series: [serie("m2", "Chuva no mês", "var(--cor-energia)"), serie("p2", "Média do mês", "var(--cor-energia)", true)] },
      ],
    });
    const li = legendaDe(igual);
    expect(li.match(/Chuva no mês/g)).toHaveLength(1);
    expect(li).toContain('stroke="var(--cor-energia)"');
    expect(li).not.toContain("A cor identifica o painel");
  });

  it("título por painel como cabeçalho, gráfico com role img rotulado pelo título e um só ponto de parada do Tab", () => {
    for (const t of ["Sudeste/Centro-Oeste", "Sul", "Nordeste", "Norte"]) expect(m).toMatch(new RegExp(`<h3 id="[^"]+" class="[^"]*">${t}</h3>`));
    expect(m.match(/role="img"/g)).toHaveLength(4);
    expect(m.match(/tabindex="0"[^>]*class="block overflow-visible/g)).toHaveLength(1);
    expect(m.match(/tabindex="-1"[^>]*class="block overflow-visible/g)).toHaveLength(3);
  });

  it("escala compartilhada por padrão: mesmos ticks em todos os painéis e régua escrita", () => {
    expect(m).toContain('data-escala="compartilhada"');
    expect(m).toMatch(/Escala compartilhada: a mesma régua vertical em todos os painéis, de 0 a 150 MWmed/);
    expect(ticksDo(painel(m, "SE"))).toEqual(ticksDo(painel(m, "S")));
    expect(m).not.toContain("Escala livre");
  });

  it("escala livre exige aviso visível (role note) e cada painel mostra a própria régua", () => {
    const l = html({ escala: "livre" });
    expect(l).toMatch(/<p role="note" data-aviso="escala-livre"[^>]*><strong[^>]*>Escala livre:<\/strong> cada painel tem o próprio eixo vertical/);
    expect(ticksDo(painel(l, "SE"))).not.toEqual(ticksDo(painel(l, "S")));
  });

  it("painel sem nenhum valor: hachura e 'sem dado no período', sem linha", () => {
    const ne = painel(m, "NE");
    expect(ne).toContain('data-estado="sem-dado"');
    expect(ne).toContain("sem dado no período");
    expect(ne).toMatch(/fill="url\(#[^)]+-hachura\)"/);
    expect(ne).not.toContain("<path");
  });

  it("lacuna na linha: nulo no meio divide o traço; ponto isolado ganha marca própria", () => {
    const se = painel(m, "SE").match(/<path d="([^"]+)"/)?.[1] ?? "";
    expect(se.match(/M/g)).toHaveLength(2);
    // Norte alterna valor e nulo: nenhum segmento, três pontos isolados
    const n = painel(m, "N");
    const dn = n.match(/<path d="([^"]*)"/)?.[1] ?? "";
    expect(dn.match(/M/g)).toHaveLength(3);
    expect(dn).not.toContain("L");
    expect(n.match(/<circle [^>]*r="2"/g)).toHaveLength(3);
  });

  it("tabela equivalente com uma coluna por painel e 'sem dado' para ausência", () => {
    const t = html({ tabelaAbertaInicial: true });
    expect(t).toContain("Dados dos painéis em tabela (5 linhas, 4 painéis)");
    for (const c of ["Sudeste/Centro-Oeste (MWmed)", "Sul (MWmed)", "Nordeste (MWmed)", "Norte (MWmed)"]) expect(t).toContain(c);
    const linha3 = t.match(/03\/01\/2024<\/th>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(linha3.match(/sem dado/g)).toHaveLength(2); // SE e NE
    expect(linha3).toContain(">120<");
  });

  it("cursor sincronizado: todos os painéis mostram a cruz e o valor do mesmo dia no cabeçalho", () => {
    const c = renderToStaticMarkup(createElement(CursorSincronizado, { inicial: { grupo: "d", valor: "2024-01-04" } }, createElement(PequenosMultiplos, base)));
    expect(c.match(/data-cursor=""/g)).toHaveLength(4);
    expect(painel(c, "SE")).toContain("04/01/2024: 40\u00a0MWmed");
    expect(painel(c, "N")).toContain("04/01/2024: sem dado");
  });
});
