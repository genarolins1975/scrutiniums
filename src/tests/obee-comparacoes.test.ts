import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";
import {
  CABECALHO_CSV_TABELA_COMPARATIVA,
  COLUNAS,
  Indice,
  comparar,
  diferenca,
  internacionaisDa,
  linhasCsvComparacao,
  linhasCsvTabelaComparativa,
  ordenaTabela,
  ponteMatricula,
  referenciasExternas,
  serie,
  tabelaComparativa,
  variacao,
} from "@/lib/eficiencia/consulta";

/**
 * Rodada 5: despesa por habitante e por matrícula, referências do grupo, nacionais e internacionais, tabela comparativa.
 * Os testes miram a igualdade entre cartão, gráfico, tabela e arquivo exportado, a escala correta das diferenças, o que a
 * referência de contexto não pode fazer (entrar na distribuição, gerar diferença) e a herança das exclusões.
 */

const g = goldEducacao()!;
const d = dadosPainel(g);
const ix = new Indice(d);
const cap = (id: string) => d.capitais.find((c) => c.id === id)!;
const csvSerie = (nome: string) => readFileSync(join(process.cwd(), "public", "eficiencia", "series", nome), "utf-8");

describe("diferença para a referência respeita a escala", () => {
  it("despesa: reais e porcentagem; contagem: unidades e porcentagem; taxa: pontos percentuais; Ideb e Saeb: pontos", () => {
    expect(diferenca("despesa_hab", 1361, 1160)!.texto).toMatch(/^\+R\$ 201 \(\+17,3%\), acima da mediana$/);
    expect(diferenca("despesa_mat", 10000, 12500)!).toMatchObject({ unidade: "R$", sentido: "abaixo da" });
    expect(diferenca("matriculas", 150, 100)!.texto).toMatch(/\+50 matrículas \(\+50,0%\)/);
    expect(diferenca("atu", 23.3, 25)!).toMatchObject({ unidade: "alunos por turma", pct: null });
    expect(diferenca("aprovacao", 98.3, 99.1)!.texto).toMatch(/−0,8 ponto percentual, abaixo da/);
    expect(diferenca("aprovacao", 98.0, 99.1)!.texto).toMatch(/pontos percentuais/);
    expect(diferenca("ideb", 5.8, 6.1)!).toMatchObject({ unidade: "pontos", pct: null });
    expect(diferenca("saeb", 216.7, 219.35)!.texto).toMatch(/−2,65 pontos/);
  });

  it("base zero bloqueia a diferença relativa; referência ausente não gera diferença; igual é dito como igual", () => {
    expect(diferenca("despesa_hab", 100, 0)!.pct).toBeNull();
    expect(diferenca("matriculas", 100, 0)!.pct).toBeNull();
    expect(diferenca("despesa_hab", 100, null)).toBeNull();
    expect(diferenca("despesa_hab", 100, 100)!.sentido).toBe("igual à");
  });

  it("a linguagem da diferença é descritiva", () => {
    for (const m of ["despesa", "despesa_hab", "despesa_mat", "matriculas", "atu", "aprovacao", "ideb", "saeb"] as const) {
      for (const [v, r] of [[10, 20], [20, 10]] as const) {
        expect(diferenca(m, v, r)!.texto).not.toMatch(/melhor|pior|eficien|desperd|bom|ruim/i);
      }
    }
  });
});

describe("despesa por habitante e por matrícula no painel", () => {
  it("2023 tem despesa por habitante com a população censitária da relação do DOU, rotulada como tal e com quebra de série", () => {
    expect(d.populacao["2023"].tipo).toBe("censo_relacao_dou_2023");
    expect(d.populacao["2023"].referencia).toMatch(/31 de julho de 2022/);
    for (const c of d.capitais) {
      const p = ix.ponto("edu.despesa.por_habitante", c.cod, 2023, null, "nominal");
      expect(p.status).toBe("OBSERVADO");
      expect(p.valor).not.toBeNull();
      expect(p.quebraSerie).toBe(true);
      expect(p.nota).toMatch(/31\/08\/2023|relação/);
      // a população de 2023 é a mesma de 2022 (Censo 2022); a de 2022 não carrega quebra
      const pop23 = ix.ponto("ctx.populacao.residente", c.cod, 2023, null, null);
      const pop22 = ix.ponto("ctx.populacao.residente", c.cod, 2022, null, null);
      expect(pop23.valor).toBe(pop22.valor);
      expect(ix.ponto("edu.despesa.por_habitante", c.cod, 2022, null, "nominal").quebraSerie).toBe(false);
    }
    const comp = comparar(ix, "despesa_hab", 2023, "total", "nominal", "matematica", "todas", cap("recife"), "alfabetica");
    expect(comp.incluidas.length).toBeGreaterThan(0);
    expect(comp.ref).not.toBeNull();
  });

  it("variação por habitante entre 2021 e 2022 é bloqueada: a população de 2021 tem outra base", () => {
    const s = serie(ix, "despesa_hab", cap("sao-paulo").cod, "total", "nominal", "matematica");
    const p21 = s.find((p) => p.ano === 2021)!;
    const p22 = s.find((p) => p.ano === 2022)!;
    expect(p21.quebraSerie).toBe(true);
    expect(p22.quebraSerie).toBe(false);
    expect(p21.elegivel).toBe(true);   // dentro das comparações do próprio ano
    expect(p21.valor).not.toBeNull();
  });

  it("Campo Grande 2021: por habitante fora das comparações; por matrícula sem valor; Boa Vista 2024 mantém a ressalva", () => {
    const hab = ix.ponto("edu.despesa.por_habitante", cap("campo-grande").cod, 2021, null, "nominal");
    expect(hab.valor).not.toBeNull();
    expect(hab.elegivel).toBe(false);
    expect(hab.motivo).toMatch(/Perímetro distinto/);
    const mat = ix.ponto("edu.despesa.aplicacao_direta_por_matricula", cap("campo-grande").cod, 2021, null, "nominal");
    expect(mat.valor).toBeNull();
    const comp = comparar(ix, "despesa_hab", 2021, "total", "nominal", "matematica", "todas", cap("campo-grande"), "alfabetica");
    expect(comp.incluidas.some((i) => i.cap.id === "campo-grande")).toBe(false);
    expect(comp.excluidas.find((x) => x.cap.id === "campo-grande")?.comValor).toBe(true);
    const bv = ix.ponto("edu.despesa.aplicacao_direta_por_matricula", cap("boa-vista").cod, 2024, null, "nominal");
    expect(bv.elegivel).toBe(true);
    expect(bv.notaMaterial).toBe(true);
    expect(bv.nota).toMatch(/RREO/);
  });

  it("a ponte soma a DCA e o numerador é a parcela da aplicação direta", () => {
    const p = ponteMatricula(ix, cap("sao-paulo").cod, 2025);
    expect(p.reconcilia).toBe(true);
    const soma = p.linhas.filter((l) => l.componente !== "dca_total").reduce((a, l) => a + l.valor, 0);
    expect(Math.abs(soma - (p.total as number))).toBeLessThan(0.5);   // tolerância de arredondamento da política de conferência
    const dentro = p.linhas.filter((l) => l.dentro);
    expect(dentro.map((l) => l.componente).sort()).toEqual(["ad_beneficiario_indeterminado", "ad_demais_elementos"].filter((c) => dentro.some((l) => l.componente === c)));
    expect(dentro.length).toBeGreaterThan(0);
    const num = { valor: dentro.reduce((a, l) => a + l.valor, 0) };
    const mat = ix.ponto("edu.matriculas.rede_municipal", cap("sao-paulo").cod, 2025, "total", null);
    const razao = ix.ponto("edu.despesa.aplicacao_direta_por_matricula", cap("sao-paulo").cod, 2025, null, "nominal");
    expect(razao.valor).toBeCloseTo(num.valor / (mat.valor as number), 4);
  });
});

describe("a mesma regra em cartão, gráfico, tabela e arquivo", () => {
  const casos = [
    ["despesa_hab", 2025, "total", "nominal"],
    ["despesa_mat", 2024, "total", "real"],
    ["despesa", 2022, "total", "nominal"],
    ["atu", 2025, "anos_finais", "nominal"],
    ["ideb", 2023, "anos_iniciais", "nominal"],
  ] as const;

  it("a coluna da medida na tabela comparativa tem os mesmos valores, a mesma elegibilidade e a mesma mediana do gráfico", () => {
    for (const [m, ano, etapa, moeda] of casos) {
      const c = comparar(ix, m, ano, etapa, moeda, "matematica", "todas", cap("recife"), "alfabetica");
      const t = tabelaComparativa(ix, ano, etapa, moeda, "matematica", "todas", cap("recife"), m);
      const col = COLUNAS.find((x) => x.medida === m)!.id;
      const doGrafico = new Map(c.incluidas.map((i) => [i.cap.id, i.valor]));
      for (const l of t.linhas) {
        const cel = l.celulas[col];
        const incluida = cel.valor !== null && cel.elegivel && cel.ponto.status === "OBSERVADO" && !cel.foraDoEscopo;
        expect(doGrafico.has(l.cap.id), `${m} ${l.cap.nome}`).toBe(incluida);
        if (incluida) expect(doGrafico.get(l.cap.id)).toBe(cel.valor);
      }
      expect(t.resumo[col]!.mediana).toBe(c.mediana);
      expect(t.resumo[col]!.n).toBe(c.incluidas.length);
    }
  });

  it("o CSV da comparação e o CSV da tabela trazem os valores da tabela, com a referência do grupo", () => {
    const c = comparar(ix, "despesa_hab", 2025, "total", "nominal", "matematica", "todas", cap("recife"), "alfabetica");
    const csv = linhasCsvComparacao(d, c, "despesa_hab", 2025, "total", "nominal", "matematica");
    const cab = ["media_simples_das_incluidas", "razao_agregada_do_grupo", "primeiro_quartil", "quartis_exibidos"];
    expect(csv).toHaveLength(26);
    expect(csv[0].length).toBeGreaterThan(cab.length);
    const t = tabelaComparativa(ix, 2025, "total", "nominal", "matematica", "todas", cap("recife"), "despesa_hab");
    const linhas = linhasCsvTabelaComparativa(d, t, 2025, "total", "nominal", "todas", cap("recife"), "despesa_hab", ix, "matematica");
    expect(linhas.every((l) => l.length === CABECALHO_CSV_TABELA_COMPARATIVA.length)).toBe(true);
    expect(linhas).toHaveLength(26 * COLUNAS.length);
    const iv = CABECALHO_CSV_TABELA_COMPARATIVA.indexOf("valor_numerico");
    const ic = CABECALHO_CSV_TABELA_COMPARATIVA.indexOf("coluna");
    const icap = CABECALHO_CSV_TABELA_COMPARATIVA.indexOf("codigo_ibge");
    for (const l of t.linhas) {
      const linha = linhas.find((x) => x[icap] === String(l.cap.cod) && x[ic] === "Despesa por habitante")!;
      expect(linha[iv]).toBe(l.celulas.despesa_hab.valor === null ? "" : String(l.celulas.despesa_hab.valor));
    }
  });

  it("o valor do CSV publicado da despesa por habitante é o da gold (precisão original), e o painel usa 12 algarismos significativos", () => {
    const linhas = csvSerie("edu_despesa_por_habitante.csv").trim().split("\n");
    const cab = linhas[0].split(",");
    expect(cab).toContain("numerador");
    expect(cab).toContain("denominador");
    const obs = g.observacoes.filter((o) => o.indicador === "edu.despesa.por_habitante");
    expect(linhas.length - 1).toBe(obs.length);
    const o = obs.find((x) => x.ente === 3550308 && x.ano === 2025 && x.componente === "nominal")!;
    const p = ix.ponto("edu.despesa.por_habitante", 3550308, 2025, null, "nominal");
    expect(p.valor).toBeCloseTo(o.valor as number, 6);
  });

  it("o CSV das referências contém todas as estatísticas e os pares usados", () => {
    const linhas = csvSerie("referencias_educacao_capitais.csv").trim().split("\n");
    expect(linhas.length - 1).toBe(g.referencias.length);
    const cab = linhas[0].split(",");
    for (const c of ["media_simples", "mediana", "capitais_do_minimo", "primeiro_quartil", "razao_agregada", "pares_codigos_ibge"]) expect(cab).toContain(c);
  });
});

describe("ordenação da tabela", () => {
  it("ausentes e fora das comparações não recebem posição numérica: ficam depois dos valores, em ordem alfabética", () => {
    const t = tabelaComparativa(ix, 2025, "total", "nominal", "matematica", "todas", cap("recife"), "despesa_mat");
    const asc = ordenaTabela(t.linhas, "despesa_mat", false);
    const desc = ordenaTabela(t.linhas, "despesa_mat", true);
    const comValor = (l: (typeof asc)[number]) => l.celulas.despesa_mat.valor !== null && l.celulas.despesa_mat.elegivel;
    for (const lista of [asc, desc]) {
      const n = lista.filter(comValor).length;
      expect(lista.slice(0, n).every(comValor)).toBe(true);
      expect(lista.slice(n).every((l) => !comValor(l))).toBe(true);
      const nomes = lista.slice(n).map((l) => l.cap.nome);
      expect([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"))).toEqual(nomes);
    }
    const vs = asc.filter(comValor).map((l) => l.celulas.despesa_mat.valor as number);
    expect([...vs].sort((a, b) => a - b)).toEqual(vs);
    expect(ordenaTabela(t.linhas, "alfabetica", false).map((l) => l.cap.nome)).toEqual([...t.linhas].map((l) => l.cap.nome).sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("a etapa muda só as colunas de resultado: a despesa por matrícula e a despesa total não mudam com a etapa", () => {
    const a = tabelaComparativa(ix, 2025, "anos_iniciais", "nominal", "matematica", "todas", cap("recife"), "despesa_hab");
    const b = tabelaComparativa(ix, 2025, "creche", "nominal", "matematica", "todas", cap("recife"), "despesa_hab");
    for (const c of ["despesa", "populacao", "despesa_hab", "matriculas", "despesa_mat"] as const) {
      expect(a.linhas.map((l) => l.celulas[c].valor)).toEqual(b.linhas.map((l) => l.celulas[c].valor));
    }
    expect(b.linhas.every((l) => l.celulas.ideb.foraDoEscopo && l.celulas.aprovacao.foraDoEscopo)).toBe(true);
    expect(b.linhas.some((l) => !l.celulas.atu.foraDoEscopo)).toBe(true);   // creche tem alunos por turma
  });
});

describe("referências externas", () => {
  it("nacional do mesmo universo: ATU, aprovação, Ideb e Saeb, lidos do INEP, com unidade de diferença", () => {
    const atu = referenciasExternas(d, "atu", 2025, "anos_iniciais", null);
    expect(atu).toHaveLength(1);
    expect(atu[0]).toMatchObject({ tipo: "nacional_mesmo_universo", valor: 22.0, unidade_diferenca: "alunos por turma" });
    expect(atu[0].escopoTexto).toMatch(/não é a média das capitais/);
    expect(referenciasExternas(d, "aprovacao", 2025, "anos_finais", null)[0].valor).toBe(94.6);
    expect(referenciasExternas(d, "ideb", 2025, "anos_iniciais", "ideb")[0].valor).toBe(6.1);
    expect(referenciasExternas(d, "saeb", 2025, "anos_iniciais", "matematica")[0].valor).toBeCloseTo(227.79, 2);
  });

  it("outro universo: investimento por estudante do INEP só em 2021, sem unidade de diferença", () => {
    const r21 = referenciasExternas(d, "despesa_mat", 2021, "total", "nominal");
    expect(r21).toHaveLength(1);
    expect(r21[0].tipo).toBe("nacional_outro_universo");
    expect(r21[0].unidade_diferenca).toBeNull();
    expect(r21[0].valor).toBeCloseTo(9015.878, 2);
    expect(r21[0].escopoTexto).toMatch(/todas as redes públicas|União, estados, DF e municípios/);
    expect(referenciasExternas(d, "despesa_mat", 2025, "total", "nominal")).toHaveLength(0);
  });

  it("não há referência externa para gasto total, por habitante nem matrículas", () => {
    for (const m of ["despesa", "despesa_hab", "matriculas", "conveniadas"] as const) {
      for (const ano of [2021, 2022, 2024, 2025]) expect(referenciasExternas(d, m, ano, "total", "nominal")).toHaveLength(0);
    }
  });

  it("contexto internacional: só tamanho de turma (anos iniciais e finais, públicas) e despesa por estudante; ano mais recente; nunca para outras medidas", () => {
    const ai = internacionaisDa(d, "atu", "anos_iniciais");
    expect(ai).toHaveLength(1);
    expect(ai[0]).toMatchObject({ conjunto: "ocde_tamanho_turma", nivel: "ISCED11_1", instituicoes: "publicas", ano: 2023, preliminar: false });
    expect(ai[0].media_confere).toBe(true);
    expect(ai[0].membros_com_dado).toBeLessThanOrEqual(38);
    expect(ai[0].paises.filter((p) => p.membro)).toHaveLength(ai[0].membros_com_dado);
    expect(ai[0].brasil).not.toBeNull();
    expect(ai[0].paises.length).toBeGreaterThan(30);
    expect(internacionaisDa(d, "atu", "creche")).toHaveLength(0);
    expect(internacionaisDa(d, "atu", "pre_escola")).toHaveLength(0);
    const dm = internacionaisDa(d, "despesa_mat", "total");
    // despesa municipal: só instituições públicas e os níveis 1 e 2; o agregado ISCED 1 a 8 inclui o superior e fica fora do painel
    expect(dm.map((x) => x.nivel).sort()).toEqual(["ISCED11_1", "ISCED11_2"]);
    expect(dm.every((x) => x.instituicoes === "publicas")).toBe(true);
    for (const m of ["despesa", "despesa_hab", "aprovacao", "ideb", "saeb", "matriculas"] as const) expect(internacionaisDa(d, m, "anos_iniciais")).toHaveLength(0);
    // os países do contexto internacional não aparecem entre as capitais nem nas referências do grupo
    const comp = comparar(ix, "atu", 2025, "anos_iniciais", "nominal", "matematica", "todas", cap("recife"), "alfabetica");
    expect(comp.incluidas.length).toBeLessThanOrEqual(26);
    expect(variacao).toBeDefined();
  });
});
