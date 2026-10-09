import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiniSerie } from "@/components/eficiencia/graficos";
import { dadosPainel, dadosPainelTema, goldEducacao } from "@/lib/eficiencia/dados";
import {
  CABECALHO_CSV_COMPARACAO,
  Indice,
  comparar,
  intraDaCapital,
  linhasCsvComparacao,
  perimetroIntra,
  serie,
  serieDaMediana,
  tabelaComparativa,
  textoPerimetroIntra,
} from "@/lib/eficiencia/consulta";
import { fraseEvolucao } from "@/lib/eficiencia/frases";
import { universoDaMedida } from "@/lib/eficiencia/visao";

/**
 * Correções da rodada 1 de avaliação independente: perímetro da despesa (intraorçamentárias) junto do número, mudança de base na
 * evolução (gráfico e mediana) e rótulo do universo por medida. Os valores saem da gold publicada.
 */
const g = goldEducacao()!;
const d = dadosPainel(g);
const ix = new Indice(d);

describe("perímetro da despesa: operações intraorçamentárias", () => {
  it("parcela de cada capital vem do RREO da gold e é a mesma em todos os payloads", () => {
    const cru = g.observacoes.filter((o) => o.indicador === "edu.despesa.funcao_educacao" && o.componente === "nominal" && o.status === "OBSERVADO" && o.conferencia?.rreo?.intra != null);
    expect(d.intraPct.length).toBe(cru.length);
    for (const o of cru.slice(0, 40)) {
      const r = o.conferencia!.rreo!;
      expect(intraDaCapital(d, o.ente, o.ano)).toBeCloseTo((100 * r.intra!) / (r.exceto_intra + r.intra!), 3);
    }
    for (const t of ["gastos", "comparar"] as const) expect(dadosPainelTema(g, t).intraPct).toEqual(d.intraPct);
  });

  it("2024: de Macapá (menor) a Porto Alegre (maior), como na verificação independente do RREO", () => {
    const p = perimetroIntra(d, 2024)!;
    expect(p.n).toBe(26);
    expect([p.menor.nome, p.maior.nome]).toEqual(["Macapá", "Porto Alegre"]);
    expect(p.menor.pct).toBeCloseTo(3.1, 1);
    expect(p.maior.pct).toBeCloseTo(35.9, 1);
  });

  it("o texto fica junto do número e diz que a comparação não corrige a diferença", () => {
    const t = textoPerimetroIntra(perimetroIntra(d, 2024), 2024, "despesa_hab");
    expect(t).toContain("exceto as operações intraorçamentárias");
    expect(t).toMatch(/Em 2024 essa parcela pesa de 3,1% da função em Macapá \(AP\) a 35,9% em Porto Alegre \(RS\)/);
    expect(t).toContain("não corrige a diferença");
    expect(textoPerimetroIntra(perimetroIntra(d, 2024), 2024, "despesa_mat")).toContain("O numerador parte da despesa");
  });

  it("ano sem a parcela no RREO: diz que não consta, em vez de calar", () => {
    expect(perimetroIntra(d, 1999)).toBeNull();
    expect(textoPerimetroIntra(null, 1999)).toContain("não consta do RREO");
  });

  it("a tabela comparativa e o CSV de cada capital trazem a parcela", () => {
    const t = tabelaComparativa(ix, 2024, "anos_iniciais", "nominal", "matematica", "todas", d.capitais[0], "despesa_hab");
    const pa = t.linhas.find((l) => l.cap.nome === "Porto Alegre")!;
    expect(pa.celulas.intra_pct.valor).toBeCloseTo(35.9, 1);
    expect(pa.celulas.intra_pct.texto).toBe("35,9%");
    const comp = comparar(ix, "despesa_hab", 2024, "anos_iniciais", "nominal", "matematica", "todas", d.capitais[0], "alfabetica");
    const linhas = linhasCsvComparacao(d, comp, "despesa_hab", 2024, "anos_iniciais", "nominal", "matematica");
    const i = CABECALHO_CSV_COMPARACAO.indexOf("parcela_intraorcamentaria_pct_da_funcao");
    expect(i).toBe(CABECALHO_CSV_COMPARACAO.length - 1);
    expect(linhas.every((l) => l.length === CABECALHO_CSV_COMPARACAO.length)).toBe(true);
    const lpa = linhas.find((l) => l[8] === "Porto Alegre")!;
    expect(Number(lpa[i])).toBeCloseTo(35.9, 1);
    // medidas que não são de despesa não levam a parcela
    const compAtu = comparar(ix, "atu", 2025, "anos_iniciais", "nominal", "matematica", "todas", d.capitais[0], "alfabetica");
    expect(linhasCsvComparacao(d, compAtu, "atu", 2025, "anos_iniciais", "nominal", "matematica").every((l) => l[i] === "")).toBe(true);
  });
});

describe("mudança de base na evolução", () => {
  it("a mediana da despesa por habitante herda a quebra de série: 2021 e 2023 marcados", () => {
    const s = serieDaMediana(ix, "despesa_hab", "anos_iniciais", "nominal", "matematica");
    expect(s.map((p) => [p.ano, p.quebraSerie])).toEqual([[2021, true], [2022, false], [2023, true], [2024, false], [2025, false]]);
  });

  it("a frase da mediana passa a bloquear a comparação 2021 a 2025, como já bloqueava para uma capital", () => {
    const s = serieDaMediana(ix, "despesa_hab", "anos_iniciais", "nominal", "matematica");
    const f = fraseEvolucao(s.map((p) => ({ ano: p.ano, valor: p.valor, elegivel: p.valor !== null, quebraSerie: p.quebraSerie })), "despesa_hab", "a população de referência muda de base", "Na mediana das capitais");
    expect(f).toContain("não são diretamente comparáveis");
    expect(f).not.toMatch(/passou de/);
    const cap = d.capitais.find((c) => c.nome === "São Paulo")!;
    const sc = serie(ix, "despesa_hab", cap.cod, "anos_iniciais", "nominal", "matematica");
    expect(sc.map((p) => p.quebraSerie)).toEqual(s.map((p) => p.quebraSerie));
  });

  it("outras medidas não ganham quebra: a mediana do Ideb e a das matrículas seguem sem marca", () => {
    for (const m of ["ideb", "matriculas", "atu"] as const) expect(serieDaMediana(ix, m, "anos_iniciais", "nominal", "matematica").some((p) => p.quebraSerie)).toBe(false);
  });

  const pontos = (q: boolean[]) => q.map((quebraSerie, i) => ({ ano: 2021 + i, valor: 100 + i, status: "OBSERVADO" as const, nota: null, notaMaterial: false, participacao: null, elegivel: true, situacao: null, motivo: null, quebraSerie }));
  const html = (q: boolean[]) => renderToStaticMarkup(createElement(MiniSerie, { titulo: "Série", pontos: pontos(q), formata: String, formataEixo: String, zero: false }));
  const caminhos = (h: string) => (h.match(/<path d="M/g) ?? []).length;

  it("o gráfico interrompe a linha onde a base muda e marca o ponto, com a explicação na legenda", () => {
    const h = html([true, false, true, false, false]);
    // 2021 | 2022 | 2023 | 2024 a 2025: só 2024 a 2025 forma um trecho de linha
    expect(caminhos(h)).toBe(1);
    expect(h).toContain("mudança de base");
    expect(h).toMatch(/Mudança de base entre 2021 e 2022/);
    expect(h).toMatch(/Mudança de base entre 2023 e 2024/);
  });

  it("série sem mudança de base fica contínua e sem marca", () => {
    const h = html([false, false, false, false, false]);
    expect(caminhos(h)).toBe(1);
    expect(h).not.toContain("mudança de base");
    expect(h).not.toContain("Mudança de base");
  });
});

describe("universo do número", () => {
  it("total e por habitante são do orçamento do município; as demais medidas, da rede municipal", () => {
    expect(universoDaMedida("despesa")).toBe("orçamento do município, função Educação");
    expect(universoDaMedida("despesa_hab")).toBe("orçamento do município, função Educação");
    for (const m of ["despesa_mat", "matriculas", "conveniadas", "atu", "aprovacao", "ideb", "saeb"] as const) expect(universoDaMedida(m)).toBe("rede municipal");
  });
});
