import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pxCaractere12, ticksQueCabem } from "@/lib/energia/escalas";
import { indicesDoEixoX, rotulosDoEixoX } from "@/lib/energia/series-temporais";

/**
 * Gráficos e tabelas no celular, depois da r9. Os revisores da r9 repetiram, sobre 390 px: rótulos de categoria truncados e idênticos
 * ("Recebimento p…" duas vezes, "Central gerad…" três vezes), marcas de eixo coladas ("25.00050.00075.000"), anos em intervalos
 * irregulares (2015, 2017, 2018, 2020...) e tabelas de 12 a 20 colunas abertas em Entender, mostrando duas colunas.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("ticksQueCabem: marcas de eixo sem encostar na vizinha", () => {
  const ticks = [0, 25000, 50000, 75000, 100000];
  const larg = (v: number) => String(v).length * 6.2 + 4; // "25000" a "100000"

  it("com espaço, mantém todas as marcas", () => {
    const pos = (v: number) => (v / 100000) * 300;
    expect(ticksQueCabem(ticks, pos, larg, 10)).toEqual(ticks);
  });

  it("sem espaço, fica com múltiplos regulares do passo a partir do zero, nunca com marcas soltas", () => {
    const pos = (v: number) => (v / 100000) * 150;
    expect(ticksQueCabem(ticks, pos, larg, 10)).toEqual([0, 50000, 100000]);
  });

  it("com muito pouco espaço, ainda devolve o zero", () => {
    const pos = (v: number) => (v / 100000) * 20;
    const r = ticksQueCabem(ticks, pos, larg, 10);
    expect(r).toContain(0);
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it("parte do zero mesmo quando ele não é a primeira marca (barras com negativos)", () => {
    const t = [-2000, -1000, 0, 1000, 2000, 3000];
    const pos = (v: number) => ((v + 2000) / 5000) * 130;
    const r = ticksQueCabem(t, pos, () => 36, 10);
    expect(r).toContain(0);
    const passos = r.slice(1).map((v, i) => v - r[i]);
    expect(new Set(passos).size).toBe(1);
  });

  it("no eixo vertical usa a altura da linha, não a largura do texto", () => {
    const pos = (v: number) => 200 - (v / 100) * 200;
    expect(ticksQueCabem([0, 25, 50, 75, 100], pos, () => 12, 6)).toEqual([0, 25, 50, 75, 100]);
  });
});

describe("indicesDoEixoX: marcas com passo constante a partir do último ponto", () => {
  const passos = (l: number[]) => l.slice(1).map((v, i) => v - l[i]);

  it("onze anos em até sete marcas: de dois em dois, terminando no ano mais recente", () => {
    const r = indicesDoEixoX(11, 7);
    expect(r).toEqual([0, 2, 4, 6, 8, 10]);
    expect(new Set(passos(r)).size).toBe(1);
  });

  it("doze meses em até quatro marcas: trimestres inteiros, com o último mês na ponta", () => {
    expect(indicesDoEixoX(12, 4)).toEqual([2, 5, 8, 11]);
  });

  it("vinte e quatro meses em até quatro marcas: semestres", () => {
    expect(indicesDoEixoX(24, 4)).toEqual([5, 11, 17, 23]);
  });

  it("quarenta e cinco dias em até quatro marcas: de quinze em quinze, em semanas inteiras (quinzenas)", () => {
    const r = indicesDoEixoX(45, 4, "data");
    expect(r).toEqual([2, 16, 30, 44]);
    expect(new Set(passos(r)).size).toBe(1);
    expect(passos(r)[0]).toBe(14);
  });

  it("horas de sete dias em até sete marcas: de 24 em 24 horas", () => {
    const r = indicesDoEixoX(168, 7, "hora");
    expect(r.at(-1)).toBe(167);
    expect(passos(r)[0]).toBe(24);
  });

  it("meses mantêm o passo de calendário e anos (texto) o passo de 1, 2 ou 5", () => {
    expect(indicesDoEixoX(12, 4, "mes")).toEqual([2, 5, 8, 11]);
    expect(indicesDoEixoX(11, 7, "texto")).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("o último ponto sempre tem marca, o número de marcas respeita o máximo e o passo é constante", () => {
    for (const n of [3, 5, 7, 12, 13, 30, 45, 90, 365, 1000]) {
      for (const max of [4, 7]) {
        const r = indicesDoEixoX(n, max);
        expect(r.at(-1), `n=${n}`).toBe(n - 1);
        expect(r.length, `n=${n} max=${max}`).toBeLessThanOrEqual(Math.max(2, Math.min(max, n)));
        expect(new Set(passos(r)).size, `n=${n} max=${max}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("série curta ou unitária", () => {
    expect(indicesDoEixoX(1, 7)).toEqual([0]);
    expect(indicesDoEixoX(2, 4)).toEqual([0, 1]);
    expect(indicesDoEixoX(0, 4)).toEqual([0]);
  });
});

describe("rótulos do eixo de horas", () => {
  it("horas que cobrem mais de um dia levam o dia no rótulo; num dia só ficam curtas", () => {
    expect(rotulosDoEixoX(["2026-10-07T23:00", "2026-10-08T23:00"], "hora")).toEqual(["07/10 23h", "08/10 23h"]);
    expect(rotulosDoEixoX(["2026-10-07T06:00", "2026-10-07T12:00"], "hora")).toEqual(["06h", "12h"]);
  });
});

describe("rótulo da categoria acima da barra no celular", () => {
  it("barras horizontais: abaixo de 520 px o rótulo ocupa a largura toda, numa linha acima da barra", () => {
    const t = ler("src/components/energia/GraficoBarras.tsx");
    expect(t).toContain("const LARGURA_ESTREITA = 520;");
    expect(t).toContain("rotuloEmCima = w < LARGURA_ESTREITA;");
    expect(t).toContain("colunaRotulo = rotuloEmCima ? 0 :");
    expect(t).toContain("rotuloEmCima ? cabe(nomes[i], w - 8, pxCaractere12(nomes[i])) : cabe(nomes[i], colunaRotulo - 8)");
    expect(t).toContain('data-rotulos={vertical ? undefined : rotuloEmCima ? "acima" : "lateral"}');
  });

  it("a categoria continua com pelo menos 44 px de alvo de toque quando o rótulo vai para cima", () => {
    const t = ler("src/components/energia/GraficoBarras.tsx");
    expect(t).toMatch(/hc = rotuloEmCima\s*\? Math\.max\(alturaCategoria \?\? 0, 44, topo \+ k \* 14/);
  });

  it("pontos pareados e faixas de tempo seguem a mesma regra", () => {
    const p = ler("src/components/energia/GraficoPontos.tsx");
    expect(p).toContain("const rotuloEmCima = w < LARGURA_ESTREITA;");
    expect(p).toContain("rotuloEmCima ? cabe(p.rotulo, w - colunaDif - 12, pxCaractere12(p.rotulo)) : cabe(p.rotulo, colunaRotulo - 8)");
    const f = ler("src/components/energia/RegulacaoFaixas.tsx");
    expect(f).toContain("const emCima = w < 520;");
    expect(f).toContain("emCima ? cabe(f.rotulo, w - 12, pxCaractere12(f.rotulo)) : cabe(f.rotulo, colRotulo - 10)");
  });

  it("barras verticais: a margem do eixo cabe o maior rótulo e o último rótulo do eixo X não passa da borda", () => {
    const t = ler("src/components/energia/GraficoBarras.tsx");
    expect(t).toContain("const larguraEixo = Math.max(...dom.ticks.map((t) => rotuloTick(t, dom.passo).length)) * 6.4 + 14;");
    expect(t).toContain('const ancora = centro + meia > w - 2 ? "end" : centro - meia < 2 ? "start" : "middle";');
  });
});

describe("marcas de eixo e de tempo", () => {
  it("barras e pontos desenham grade e rótulos só das marcas que cabem", () => {
    const b = ler("src/components/energia/GraficoBarras.tsx");
    expect(b).toContain("ticksQueCabem(dom.ticks, escala,");
    expect(b).toContain("const grade = ticksEixo.map(");
    const p = ler("src/components/energia/GraficoPontos.tsx");
    expect(p).toContain("const ticksEixo = ticksQueCabem(dom.ticks, x,");
    expect(p).not.toMatch(/dom\.ticks\.map/);
  });

  it("o gráfico de linhas marca o eixo X com passo constante", () => {
    const l = ler("src/components/energia/GraficoLinhas.tsx");
    expect(l).toContain("const xt = indicesDoEixoX(n, largura < ESTREITO ? 4 : 7, formatoX);");
    expect(l).not.toContain("Math.round((k / Math.max(nx - 1, 1)) * (n - 1))");
  });
});

describe("tabela de Entender", () => {
  it("a linha escolhida pela própria página (padrão) não abre a tabela; só uma escolha feita depois", () => {
    const t = ler("src/components/energia/TabelaInterativa.tsx");
    expect(t).toContain("const selecaoInicial = useRef(selecionado);");
    expect(t).toContain("selecionado !== selecaoInicial.current;");
    expect(t).toContain("const comRecorte = !!busca || itensFiltro.length > 0 || paginaPedida > 1 || selecaoNova;");
    expect(t).not.toMatch(/paginaPedida > 1 \|\| !!selecionado/);
  });

  it("a tabela montada depois de um pedido do leitor ('Abrir: tabela...') nasce aberta, para ele não achar o botão de abrir de novo", () => {
    expect(ler("src/components/energia/TabelaInterativa.tsx")).toContain("const [aberta, setAberta] = useState(iniciarAberta);");
    for (const f of ["QualidadeTabela", "GeracaoTabelasSobDemanda", "MercadoTabelasSobDemanda", "VisaoTabelasSobDemanda"]) {
      expect(ler(`src/components/energia/${f}.tsx`), f).toMatch(/iniciarAberta/);
    }
  });
});

describe("coluna com rótulo longo no celular", () => {
  it("abaixo de 520 px a coluna com rótulo de mais de nove caracteres vira barra horizontal, até 16 categorias, e aparece inteira", () => {
    const b = ler("src/components/energia/GraficoBarras.tsx");
    expect(b).toContain('const virouHorizontal = orientacao === "vertical" && largura < LARGURA_ESTREITA && maiorRotulo > 9 && n <= 16;');
    expect(b).toContain('const vertical = orientacao === "vertical" && !virouHorizontal;');
    expect(b).toContain("const limiteAltura = virouHorizontal ? Math.max(alturaMaxima, h) : alturaMaxima;");
    expect(b).toContain('data-orientacao={vertical ? "vertical" : "horizontal"}');
  });
});

describe("eixo dos pontos pareados no celular", () => {
  it("o cabeçalho da diferença ocupa a própria linha e o rótulo das marcas não passa da borda", () => {
    const p = ler("src/components/energia/GraficoPontos.tsx");
    expect(p).toContain("height={rotuloEmCima ? 36 : 22}");
    expect(p).toContain('<g transform={rotuloEmCima ? "translate(0 14)" : undefined}>');
    expect(p).toContain('textAnchor={px - meia < 0 ? "start" : px + meia > w ? "end" : "middle"}');
    expect(p).toContain("rotuloEmCima ? [22, w - 22]");
  });

  it("o rótulo acima da linha usa a largura de um caractere de 12 px, mais larga para nome em caixa alta, para não passar da borda", () => {
    expect(pxCaractere12("Sudeste/Centro-Oeste")).toBe(6.9);
    expect(pxCaractere12("MATRINCHA TRANSMISSORA DE ENERGIA (TP NORTE) S.A.")).toBe(8.2);
    expect(pxCaractere12("Aneel 2026")).toBe(6.9);
    expect(pxCaractere12("12.345")).toBe(6.9);
    expect(pxCaractere12("")).toBe(6.9);
  });
});

describe("tabela estática em Entender no celular", () => {
  const css = ler("src/app/globals.css");

  it("até 640 px encolhe até onde as palavras deixam, sem partir palavra, exceto mapas de calor e grades", () => {
    expect(css).toMatch(
      /@media \(max-width: 40rem\) \{\s*\.modo-profundidade\[data-modo="entender"\] \.tabela-scroll table\.border-collapse\[class\*="min-w-"\]:not\(\[data-grade\]\):not\(\[data-comparacao\]\) \{\s*min-width: 0 !important;\s*font-size: 0\.75rem;/,
    );
    expect(css).toContain("padding-left: 0.3rem !important;");
    const secao = css.slice(css.indexOf("Celular, Entender: a tabela estática"), css.indexOf("Profundidade progressiva"));
    expect(secao).toMatch(/\.modo-profundidade\[data-modo="entender"\] \.tabela-scroll :is\(th, td\) \{\s*overflow-wrap: normal;/);
    // nenhuma regra nova parte palavra no meio da célula
    expect(css.slice(css.indexOf("Celular, Entender: a tabela estática"), css.indexOf("Profundidade progressiva"))).not.toMatch(/overflow-wrap: anywhere|word-break/);
  });
});

