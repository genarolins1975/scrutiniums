import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiniSerie } from "@/components/eficiencia/graficos";
import { dadosPainel, dadosPainelTema, goldEducacao } from "@/lib/eficiencia/dados";
import {
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_SERIE,
  CABECALHO_CSV_TABELA_COMPARATIVA,
  dicionarioExportacoes,
  Indice,
  comparar,
  diferenca,
  intraDaCapital,
  linhasCsvComparacao,
  linhasCsvSerie,
  perimetroIntra,
  serie,
  serieDaMediana,
  tabelaComparativa,
  textoPerimetroIntra,
} from "@/lib/eficiencia/consulta";
import { fraseCapital, fraseEvolucao } from "@/lib/eficiencia/frases";
import { avisoDoGrupo, DEFINICAO_CURTA, NAO_MOSTRA, universoDaMedida } from "@/lib/eficiencia/visao";

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
    expect(h.replace(/<!-- -->/g, "")).toMatch(/Mudança de base entre 2021 e 2022; 2022 e 2023; 2023 e 2024/);
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

describe("exibição consistente com a conta do leitor", () => {
  it("a diferença escrita fecha com os valores mostrados (arredondados à mesma precisão)", async () => {
    const { diferenca } = await import("@/lib/eficiencia/consulta");
    // valores brutos 1877,6 e 1103,9: aparecem como R$ 1.878 e R$ 1.104; a diferença escrita é R$ 774, não R$ 774 exato de 773,7... e sim a dos exibidos
    expect(diferenca("despesa_hab", 1877.6, 1103.9)!.texto).toContain("R$ 774");
    expect(diferenca("atu", 25.04, 24.96)!.texto).toContain("menos de 0,1 aluno por turma");
    expect(diferenca("ideb", 6.9, 6.1)!.texto).toContain("0,8 ponto");
    // abaixo da precisão exibida, usa a diferença exata em vez de escrever zero
    expect(diferenca("despesa_hab", 1000.2, 1000.1)!.abs).toBeCloseTo(0.1, 5);
    expect(diferenca("despesa_hab", 1000.2, 1000.1)!.texto).toContain("menos de R$ 1");
  });

  it("valores acima de R$ 10 bilhões mantêm os centavos da fonte no payload", () => {
    const grande = g.observacoes.filter((o) => o.indicador === "edu.despesa.funcao_educacao" && o.componente === "nominal" && o.valor !== null && o.valor >= 1e10);
    expect(grande.length).toBeGreaterThan(0);
    for (const o of grande) {
      const c = d.obs.length ? ix.ponto("edu.despesa.funcao_educacao", o.ente, o.ano, null, "nominal").valor : null;
      expect(c).toBeCloseTo(o.valor as number, 2);
    }
  });
});

describe("evolução: lacunas e notas de período", () => {
  const pts = [2005, 2007, 2009, 2011].map((ano, i) => ({ ano, valor: i < 2 ? 4 + i / 2 : null, elegivel: i < 2, quebraSerie: false }));
  it("diz que a série não termina onde o texto termina", () => {
    const f = fraseEvolucao(pts, "ideb", "a base mudou", "Em Boa Vista (RR)");
    expect(f).toContain("passou de 4,0 em 2005 para 4,5 em 2007");
    expect(f).toContain("Sem valor comparável de 2009 a 2011.");
  });
  it("um único período sem valor depois do último", () => {
    expect(fraseEvolucao(pts.slice(0, 3), "ideb")).toContain("Sem valor comparável em 2009.");
  });
  it("nota de período entre os extremos entra na frase", () => {
    const p = [2019, 2021, 2023].map((ano) => ({ ano, valor: 5, elegivel: true, quebraSerie: false }));
    expect(fraseEvolucao(p, "ideb", "x", undefined, [{ ano: 2021, texto: "edição afetada pela pandemia." }])).toContain("Em 2021: edição afetada pela pandemia.");
    expect(fraseEvolucao(p, "ideb", "x", undefined, [{ ano: 2019, texto: "fora" }])).not.toContain("fora");
  });
});

describe("dicionário das exportações", () => {
  it("descreve toda coluna dos dois CSV e traz as ressalvas gerais e a citação", () => {
    const dic = dicionarioExportacoes();
    for (const [arquivo, cabecalho] of [["comparação de um indicador", CABECALHO_CSV_COMPARACAO], ["tabela comparativa", CABECALHO_CSV_TABELA_COMPARATIVA]] as const) {
      for (const col of cabecalho) {
        const linha = dic.find((l) => l[0] === arquivo && l[1] === col);
        expect(linha, `${arquivo}: ${col}`).toBeDefined();
        expect(linha![2].length, `${arquivo}: ${col}`).toBeGreaterThan(15);
      }
    }
    expect(dic.filter((l) => l[0] === "todos").map((l) => l[1])).toEqual(["(leia antes de usar)", "(universo e período)", "(como citar)"]);
    expect(dic.find((l) => l[1] === "(leia antes de usar)")![2]).toContain("Células vazias não são zero");
  });

  it("a versão metodológica da tabela comparativa vem do indicador de cada coluna", () => {
    const t = tabelaComparativa(ix, 2025, "anos_iniciais", "nominal", "matematica", "todas", d.capitais[0], "despesa_hab");
    const linhas = (async () => (await import("@/lib/eficiencia/consulta")).linhasCsvTabelaComparativa(d, t, 2025, "anos_iniciais", "nominal", "todas", d.capitais[0], "despesa_hab", ix, "matematica"))();
    return linhas.then((l) => {
      const iv = CABECALHO_CSV_TABELA_COMPARATIVA.indexOf("versao_metodologica");
      const porColuna = new Map(l.map((r) => [r[CABECALHO_CSV_TABELA_COMPARATIVA.indexOf("coluna")], r[iv]]));
      expect(porColuna.get("Despesa total na função Educação")).toBe(d.fichas.find((f) => f.id === "edu.despesa.funcao_educacao")!.versao_metodologica);
      expect(porColuna.get("Despesa por matrícula")).toBe(d.fichas.find((f) => f.id === "edu.despesa.aplicacao_direta_por_matricula")!.versao_metodologica);
      expect(new Set(porColuna.values()).size).toBeGreaterThan(1);
    });
  });
});

describe("lote 4: série em CSV, avisos por tema e ausências declaradas", () => {
  const PROIBIDAS = /\b(eficiente|ineficiente|desperd|melhor|pior|gasta demais|ranking|ideal|bom|ruim)\b/i;

  it("o CSV da série tem uma linha por ano, mediana de referência e colunas descritas no dicionário", () => {
    const cap = d.capitais[0];
    const pontos = serie(ix, "despesa_hab", cap.cod, "total", "nominal", "matematica");
    const medianas = serieDaMediana(ix, "despesa_hab", "total", "nominal", "matematica");
    const linhas = linhasCsvSerie(d, "despesa_hab", "total", "nominal", "matematica", cap, pontos, medianas);
    expect(linhas.length).toBe(pontos.length);
    for (const l of linhas) expect(l.length).toBe(CABECALHO_CSV_SERIE.length);
    const iv = CABECALHO_CSV_SERIE.indexOf("valor_numerico");
    const ie = CABECALHO_CSV_SERIE.indexOf("estado_do_dado");
    linhas.forEach((l, i) => {
      if (pontos[i].valor === null) expect(l[iv]).toBe("");
      else expect(Number(l[iv])).toBe(pontos[i].valor);
      expect(l[ie].length).toBeGreaterThan(0);
    });
    const dic = dicionarioExportacoes();
    for (const col of CABECALHO_CSV_SERIE) {
      const linha = dic.find((x) => x[0] === "série ao longo dos anos" && x[1] === col);
      expect(linha, col).toBeDefined();
      expect(linha![2].length, col).toBeGreaterThan(15);
    }
  });

  it("cada tipo de medida tem aviso próprio, sem juízo de valor", () => {
    const textos = (["despesa", "despesa_hab", "matriculas", "atu", "ideb", "saeb", "aprovacao"] as const).map((m) => avisoDoGrupo(m));
    expect(new Set(textos).size).toBe(3);
    expect(avisoDoGrupo("atu")).toContain("população em idade escolar");
    expect(avisoDoGrupo("ideb")).toContain("não mede o efeito da gestão");
    for (const t of textos) expect(t.replace(/Menor gasto não demonstra eficiência/, "")).not.toMatch(PROIBIDAS);
    for (const t of Object.values(NAO_MOSTRA)) {
      expect(t.length).toBeGreaterThan(80);
      expect(t).not.toMatch(PROIBIDAS);
    }
  });

  it("a definição do Ideb traduz a sigla e o Saeb", () => {
    expect(DEFINICAO_CURTA.ideb.texto).toContain("Índice de Desenvolvimento da Educação Básica");
    expect(DEFINICAO_CURTA.ideb.texto).toContain("Sistema de Avaliação da Educação Básica");
  });
});

describe("trilhas de reprodução: população, despesa por habitante e por matrícula", () => {
  const trilha = (id: string) => g.trilhas.find((t) => t.indicador === id)!;
  const obs = (ind: string, ente: number, comp: string | null = "nominal", etapa: string | null = null) =>
    g.observacoes.find((o) => o.indicador === ind && o.ente === ente && o.ano === 2025 && (comp === null || o.componente === comp) && o.etapa === etapa && o.status === "OBSERVADO")!;

  it("cada indicador de despesa derivado tem trilha da mesma capital que a despesa total", () => {
    const ids = g.trilhas.map((t) => t.indicador);
    for (const id of ["ctx.populacao.residente", "edu.despesa.por_habitante", "edu.despesa.aplicacao_direta_por_matricula"]) expect(ids).toContain(id);
    const cod = trilha("edu.despesa.funcao_educacao").ente;
    for (const id of ["ctx.populacao.residente", "edu.despesa.por_habitante", "edu.despesa.aplicacao_direta_por_matricula"]) expect(trilha(id).ente).toBe(cod);
  });

  it("os números das trilhas fecham com a gold", () => {
    const cod = trilha("edu.despesa.funcao_educacao").ente;
    const desp = obs("edu.despesa.funcao_educacao", cod).valor!;
    const pop = obs("ctx.populacao.residente", cod, null).valor!;
    expect(trilha("edu.despesa.por_habitante").valor).toBeCloseTo(desp / pop, 4);
    const ponte = (c: string) => obs("edu.despesa.ponte_matricula", cod, c).valor!;
    const mat = obs("edu.matriculas.rede_municipal", cod, null, "total").valor!;
    expect(trilha("edu.despesa.aplicacao_direta_por_matricula").valor).toBeCloseTo((ponte("ad_demais_elementos") + ponte("ad_beneficiario_indeterminado")) / mat, 4);
    expect(trilha("ctx.populacao.residente").valor).toBe(pop);
  });

  it("a data de referência do Censo 2022 é uma só em toda a gold", () => {
    const texto = JSON.stringify(g);
    expect(texto).not.toMatch(/1º de agosto de 2022/);
  });
});

describe("ordem por valor, crescente e decrescente", () => {
  it("as duas ordens são espelhadas, com o nome desempatando", () => {
    const asc = comparar(ix, "despesa_hab", 2025, "total", "nominal", "matematica", "todas", d.capitais[0], "valor").incluidas.map((i) => i.valor);
    const desc = comparar(ix, "despesa_hab", 2025, "total", "nominal", "matematica", "todas", d.capitais[0], "valor_desc").incluidas.map((i) => i.valor);
    expect(asc.length).toBeGreaterThan(20);
    expect([...asc].sort((a, b) => a - b)).toEqual(asc);
    expect([...asc].reverse()).toEqual(desc);
  });
});

describe("frase da capital e diferença da tabela dizem o mesmo número", () => {
  it("em despesa por habitante e Saeb, a diferença escrita é a dos valores exibidos", () => {
    const casos = [
      ["despesa_hab", 2025, "total", 0],
      ["saeb", 2025, "anos_iniciais", 2],
      ["ideb", 2025, "anos_iniciais", 1],
    ] as const;
    let n = 0;
    for (const [m, ano, etapa, casas] of casos) {
      const comp = comparar(ix, m, ano, etapa, "nominal", "matematica", "todas", d.capitais[0], "alfabetica");
      const med = comp.ref!.mediana!;
      for (const i of comp.incluidas) {
        const dif = diferenca(m, i.valor, med)!;
        if (dif.abaixoDaPrecisao || dif.abs === 0) continue;
        const f = fraseCapital(i.cap.nome, i.cap.uf, i.valor, med, comp.ref!.n, m);
        const esperado = Math.abs(Math.round(i.valor * 10 ** casas) / 10 ** casas - Math.round(med * 10 ** casas) / 10 ** casas);
        expect(esperado).toBeCloseTo(dif.absExibida, 9);
        const texto = (casas === 0 ? `R$ ${Math.round(esperado).toLocaleString("pt-BR")}` : esperado.toFixed(casas).replace(".", ","));
        expect(f, `${m} ${i.cap.nome}`).toContain(`(${texto}`);
        n++;
      }
    }
    expect(n).toBeGreaterThan(40);
  });
});
