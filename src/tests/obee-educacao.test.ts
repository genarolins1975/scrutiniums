import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import config from "../../tailwind.config";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";
import {
  Indice,
  MEDIDAS,
  comparar,
  composicaoDespesa,
  csv,
  distribuicaoMatriculas,
  edicaoIdeb,
  etapaValida,
  formataEixo,
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_TABELA,
  linhasCsvComparacao,
  linhasCsvTabela,
  linhasTabela,
  mediana,
  serie,
  variacao,
} from "@/lib/eficiencia/consulta";
import { contextos, resumoCobertura } from "@/lib/eficiencia/contexto";

/**
 * Painel Educação municipal nas capitais (OBEE). Os testes miram erros
 * plausíveis: ausência virando zero, capital fora do recorte entrando na
 * comparação, período trocado em silêncio, tabela e download divergentes,
 * linguagem avaliativa no texto público e cor de seleção sem contraste.
 */

const g = goldEducacao()!;
const d = dadosPainel(g);
const ix = new Indice(d);
const cap = (id: string) => d.capitais.find((c) => c.id === id)!;

describe("gold e payload do cliente", () => {
  it("a gold existe e o payload preserva todas as observações", () => {
    expect(g).not.toBeNull();
    expect(d.obs.length).toBe(g.observacoes.length);
  });

  it("26 capitais em ordem alfabética, sem o Distrito Federal", () => {
    expect(d.capitais).toHaveLength(26);
    const nomes = d.capitais.map((c) => c.nome);
    expect([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"))).toEqual(nomes);
    expect(d.capitais.some((c) => c.uf === "DF")).toBe(false);
    expect(d.excluidos.map((e) => e.uf)).toEqual(["DF"]);
  });

  it("toda observação sem valor carrega estado e motivo; nenhuma vira zero", () => {
    for (const o of d.obs) {
      const status = d.status[o[6]];
      if (status !== "OBSERVADO") {
        expect(o[5]).toBeNull();
        expect(o[7]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("o payload é um recorte compacto (abaixo de 600 kB serializado)", () => {
    expect(JSON.stringify(d).length).toBeLessThan(600_000);
  });
});

describe("comparação entre capitais", () => {
  it("inclui só valor observado e comparável; o resto fica listado com motivo", () => {
    const c = comparar(ix, "aprovacao", 2025, "anos_finais", "nominal", "matematica", "todas", cap("aracaju"), "alfabetica");
    expect(c.incluidas.length + c.excluidas.length).toBe(26);
    const rb = c.excluidas.find((e) => e.cap.id === "rio-branco");
    expect(rb?.status).toBe("NAO_APLICAVEL");
    expect(c.incluidas.some((i) => i.cap.id === "rio-branco")).toBe(false);
  });

  it("DCA com intraorçamentárias (Campo Grande 2021) sai da comparação como não comparável", () => {
    const c = comparar(ix, "despesa", 2021, "anos_iniciais", "nominal", "matematica", "todas", cap("campo-grande"), "alfabetica");
    const cg = c.excluidas.find((e) => e.cap.id === "campo-grande");
    expect(cg?.status).toBe("NAO_COMPARAVEL");
    expect(cg?.motivo).toMatch(/intraorçamentárias/);
    // o valor continua na série da capital
    const s = serie(ix, "despesa", cap("campo-grande").cod, "anos_iniciais", "nominal", "matematica");
    expect(s.find((p) => p.ano === 2021)?.valor).toBeGreaterThan(0);
  });

  it("Campo Grande 2021: fora da comparação também em reais de 2025, variações bloqueadas e quebra na série", () => {
    const c = comparar(ix, "despesa", 2021, "anos_iniciais", "real", "matematica", "todas", cap("campo-grande"), "alfabetica");
    const cg = c.excluidas.find((e) => e.cap.id === "campo-grande")!;
    expect(cg.comValor).toBe(true);
    expect(c.comValor).toBe(26);
    expect(c.incluidas).toHaveLength(25);
    const s = serie(ix, "despesa", cap("campo-grande").cod, "anos_iniciais", "nominal", "matematica");
    const p21 = s.find((p) => p.ano === 2021)!;
    const p22 = s.find((p) => p.ano === 2022)!;
    expect(p21.elegivel).toBe(false);
    expect(p21.quebraSerie).toBe(true);
    expect(variacao(p22, p21)).toHaveProperty("bloqueio");
  });

  it("Boa Vista 2024: reconciliada pela MSC, entra na comparação com nota", () => {
    const c = comparar(ix, "despesa", 2024, "anos_iniciais", "nominal", "matematica", "todas", cap("boa-vista"), "alfabetica");
    const bv = c.incluidas.find((i) => i.cap.id === "boa-vista")!;
    expect(bv).toBeDefined();
    expect(bv.ponto.situacao).toBe("RECONCILIADA_MSC");
    expect(bv.ponto.nota).toMatch(/Matriz de Saldos Contábeis/);
    const s = serie(ix, "despesa", cap("boa-vista").cod, "anos_iniciais", "nominal", "matematica");
    expect(variacao(s.find((p) => p.ano === 2024)!, s.find((p) => p.ano === 2023)!)).toHaveProperty("pct");
  });

  it("CSV da comparação: uma linha por capital do grupo, incluídas com nota e excluídas com motivo", () => {
    const c = comparar(ix, "despesa", 2024, "anos_iniciais", "nominal", "matematica", "todas", cap("boa-vista"), "alfabetica");
    const linhas = linhasCsvComparacao(d, c, "despesa", 2024, "anos_iniciais", "nominal", "matematica");
    expect(linhas).toHaveLength(26);
    expect(linhas.every((l) => l.length === CABECALHO_CSV_COMPARACAO.length)).toBe(true);
    const col = (n: string) => CABECALHO_CSV_COMPARACAO.indexOf(n);
    const bv = linhas.find((l) => l[col("capital")] === "Boa Vista")!;
    expect(bv[col("incluida_na_comparacao")]).toBe("sim");
    expect(bv[col("nota")]).toMatch(/Matriz de Saldos Contábeis/);
    expect(bv[col("universo_do_indicador")]).toBeTruthy();
    expect(bv[col("unidade")]).toMatch(/R\$|reais/);
    const cg21 = comparar(ix, "despesa", 2021, "anos_iniciais", "nominal", "matematica", "todas", cap("campo-grande"), "alfabetica");
    const l21 = linhasCsvComparacao(d, cg21, "despesa", 2021, "anos_iniciais", "nominal", "matematica");
    const cg = l21.find((l) => l[col("capital")] === "Campo Grande")!;
    expect(cg[col("incluida_na_comparacao")]).toBe("nao");
    expect(cg[col("valor_numerico")]).not.toBe("");
    expect(cg[col("motivo_exclusao")]).toMatch(/Perímetro distinto/);
    expect(l21.every((l) => l[col("capitais_incluidas")] === "25" && l[col("capitais_com_valor")] === "26")).toBe(true);
  });

  it("mudar a elegibilidade de um valor recalcula mediana e contagens pela mesma regra", () => {
    const base = comparar(ix, "aprovacao", 2025, "anos_iniciais", "nominal", "matematica", "todas", cap("recife"), "alfabetica");
    const alvo = base.incluidas[0];
    const d2 = { ...d, obs: d.obs.map((o) => [...o] as typeof o) };
    const io = d2.obs.findIndex((o) => d.capitais[o[1]].cod === alvo.cap.cod && o[2] === 2025 && d.indicadores[o[0]] === "edu.aprovacao.rede_municipal"
      && o[3] === d.etapas.findIndex((e) => e.id === "anos_iniciais"));
    d2.obs[io][9] = 0;
    const depois = comparar(new Indice(d2), "aprovacao", 2025, "anos_iniciais", "nominal", "matematica", "todas", cap("recife"), "alfabetica");
    expect(depois.incluidas).toHaveLength(base.incluidas.length - 1);
    expect(depois.comValor).toBe(base.comValor);
    expect(depois.excluidas.find((x) => x.cap.id === alvo.cap.id)?.comValor).toBe(true);
    expect(depois.mediana).toBe(mediana(base.incluidas.slice(1).map((i) => i.valor)));
  });

  it("cada indicador declara um universo próprio, coerente com o passaporte", () => {
    const u = (id: string) => g.indicadores.find((f) => f.id === id)!;
    const desp = u("edu.despesa.funcao_educacao").universo_curto;
    const rede = u("edu.matriculas.rede_municipal").universo_curto;
    const conv = u("edu.matriculas.conveniadas_municipais").universo_curto;
    expect(new Set([desp, rede, conv]).size).toBe(3);
    expect(desp).toMatch(/^Despesa liquidada do município/);
    expect(rede).toMatch(/dependência municipal/);
    expect(u("edu.matriculas.conveniadas_municipais").nome).toMatch(/exclusiva/);
    const c = comparar(ix, "despesa", 2024, "anos_iniciais", "nominal", "matematica", "todas", cap("recife"), "alfabetica");
    expect(c.universoIndicador).toBe(desp);
    expect(c.criterio).not.toMatch(/rede municipal/i);
  });

  it("grupo regional usa só capitais da mesma região da capital selecionada", () => {
    const c = comparar(ix, "matriculas", 2025, "total", "nominal", "matematica", "regiao", cap("recife"), "alfabetica");
    expect(c.universo.every((u) => u.regiao === "NE")).toBe(true);
    expect(c.universo).toHaveLength(9);
  });

  it("ordem inicial alfabética; ordem por valor só quando pedida", () => {
    const a = comparar(ix, "ideb", 2025, "anos_iniciais", "nominal", "matematica", "todas", cap("aracaju"), "alfabetica");
    expect(a.incluidas.map((i) => i.cap.id)).toEqual(d.capitais.filter((c) => a.incluidas.some((i) => i.cap.id === c.id)).map((c) => c.id));
    const v = comparar(ix, "ideb", 2025, "anos_iniciais", "nominal", "matematica", "todas", cap("aracaju"), "valor");
    const vals = v.incluidas.map((i) => i.valor);
    expect([...vals].sort((x, y) => x - y)).toEqual(vals);
  });

  it("mediana simples, sem ponderação", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
});

describe("períodos e etapas", () => {
  it("o Ideb é bienal: ano par usa a edição anterior e diz que não é exata", () => {
    expect(edicaoIdeb(2025)).toEqual({ edicao: 2025, exata: true });
    expect(edicaoIdeb(2024)).toEqual({ edicao: 2023, exata: false });
  });

  it("a série do Ideb não inventa anos pares nem repete valores", () => {
    const s = serie(ix, "ideb", cap("sao-paulo").cod, "anos_iniciais", "nominal", "matematica");
    expect(s.map((p) => p.ano)).toEqual(g.periodos.ideb);
    expect(s.every((p) => p.ano % 2 === 1)).toBe(true);
  });

  it("etapas válidas por medida (despesa não tem etapa; Ideb só no fundamental)", () => {
    expect(etapaValida("despesa", "creche")).toBe(true);
    expect(etapaValida("ideb", "creche")).toBe(false);
    expect(etapaValida("atu", "ensino_medio")).toBe(false);
    for (const m of MEDIDAS) expect(etapaValida(m, "anos_iniciais")).toBe(true);
  });
});

describe("decomposições reconciliam", () => {
  it("subfunções somam o total da função em todas as capitais e anos", () => {
    for (const c of d.capitais)
      for (const ano of g.periodos.financeiros) {
        const r = composicaoDespesa(ix, c.cod, ano);
        expect(r.inconsistente).toBe(false);
        const soma = r.linhas.reduce((a, l) => a + l.valor, 0);
        expect(Math.abs(soma - (r.total.valor ?? 0))).toBeLessThanOrEqual(1);
      }
  });

  it("etapas da rede somam o total; conveniadas ficam fora da soma", () => {
    const r = distribuicaoMatriculas(ix, cap("sao-paulo").cod, 2025);
    expect(r.linhas.reduce((a, l) => a + (l.rede ?? 0), 0)).toBe(r.total.valor);
    expect(r.linhas.reduce((a, l) => a + (l.conveniadas ?? 0), 0)).toBeGreaterThan(0);
  });
});

describe("tabela auditável e exportação", () => {
  it("o CSV tem exatamente as linhas da tabela, com estado do dado", () => {
    const linhas = linhasTabela(ix, cap("macapa").cod, 2024);
    const texto = csv(CABECALHO_CSV_TABELA, linhasCsvTabela(d, cap("macapa"), linhas));
    expect(texto.trim().split("\n").length - 1).toBe(linhas.length);
    expect(texto).toContain("Macapá;1600303;");
    const semValor = linhas.filter((l) => l.status !== "OBSERVADO");
    expect(semValor.length).toBeGreaterThan(0);
    expect(semValor.every((l) => l.valor === "")).toBe(true);
  });

  it("ano par: Ideb e Saeb entram pela edição anterior, com o período escrito", () => {
    const linhas = linhasTabela(ix, cap("recife").cod, 2024);
    const ideb = linhas.filter((l) => l.indicador === "edu.ideb.rede_municipal");
    expect(ideb.length).toBeGreaterThan(0);
    expect(ideb.every((l) => l.periodo === "Edição 2023")).toBe(true);
    expect(linhas.filter((l) => l.indicador === "edu.despesa.funcao_educacao").every((l) => l.periodo === "Exercício 2024")).toBe(true);
  });

  it("CSV escapa separador e aspas", () => {
    expect(csv(["x"], [['a;b "c"']])).toContain('"a;b ""c"""');
  });

  it("eixos sem casas decimais supérfluas", () => {
    expect(formataEixo("saeb", 220)).toBe("220");
    expect(formataEixo("ideb", 5.5)).toBe("5,5");
    expect(formataEixo("aprovacao", 96)).toBe("96%");
  });
});

describe("passaportes", () => {
  it("todo indicador do catálogo tem contexto com validações e cobertura", () => {
    const ctx = contextos(g);
    for (const f of g.indicadores) {
      expect(ctx[f.id].validacoes.length).toBeGreaterThan(0);
      if (f.estado !== "NAO_PUBLICAVEL") expect(ctx[f.id].cobertura.length).toBeGreaterThan(0);
    }
    expect(resumoCobertura(g.cobertura["edu.ideb.rede_municipal"], { anos_finais: "anos finais", anos_iniciais: "anos iniciais" }).join(" ")).toMatch(/Rio Branco/);
  });

  it("a razão despesa por matrícula não é publicada nem aparece em observação", () => {
    const f = g.indicadores.find((i) => i.id === "edu.despesa_por_matricula")!;
    expect(f.estado).toBe("NAO_PUBLICAVEL");
    expect(d.obs.some((o) => d.indicadores[o[0]] === "edu.despesa_por_matricula")).toBe(false);
  });
});

/* ------------------------------------------------------------------ neutralidade */

const PROIBIDAS =
  /\b(eficiente|ineficiente|ineficiência|desperdício|desperdicio|melhores?|piores?|ranking|insights?|principais achados|nossa análise|o que os dados revelam|merece atenção|sinaliza|excesso|bom desempenho|mau desempenho|destaque positivo|destaque negativo|campeã|lanterna)\b/i;

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(join(dir, e.name)) : [join(dir, e.name)]));
}

describe("neutralidade do texto público", () => {
  const fontes = [
    ...arquivos(join(process.cwd(), "src/components/eficiencia")),
    ...arquivos(join(process.cwd(), "src/app/eficiencia-estatal")),
    join(process.cwd(), "src/lib/eficiencia/consulta.ts"),
  ];
  for (const f of fontes) {
    it(`sem linguagem avaliativa em ${f.replace(process.cwd() + "/", "")}`, () => {
      const t = readFileSync(f, "utf-8");
      expect(t.match(PROIBIDAS)?.[0] ?? null).toBeNull();
    });
  }
  it("sem linguagem avaliativa no catálogo, nas notas e nas validações da gold", () => {
    const t = JSON.stringify({ i: g.indicadores, v: g.validacoes, n: d.notas });
    expect(t.match(PROIBIDAS)?.[0] ?? null).toBeNull();
  });
  it("sem cores de semáforo nos componentes do domínio", () => {
    for (const f of arquivos(join(process.cwd(), "src/components/eficiencia"))) {
      const t = readFileSync(f, "utf-8");
      expect(t).not.toMatch(/text-(sucesso|erro)|bg-(sucesso|erro)|--cor-(sucesso|erro)|#[0-9a-fA-F]{6}/);
    }
  });
});

/* ------------------------------------------------------------------ tokens */

type Cores = Record<string, string | Record<string, string>>;
const cores = (config.theme?.extend?.colors ?? {}) as Cores;
const tom = (nome: string, passo = "DEFAULT") => {
  const c = cores[nome];
  return typeof c === "string" ? c : c[passo];
};
function luminancia(hex: string) {
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b;
}
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("contraste dos tokens do OBEE", () => {
  const fundos = { superficie: tom("superficie"), papel: tom("papel"), "obee-fundo": tom("obee", "fundo") };
  for (const [nome, cor] of Object.entries({ obee: tom("obee"), "obee-dark": tom("obee", "dark"), "obee-tinta": tom("obee", "tinta"), "carvao-muted": tom("carvao", "muted") })) {
    for (const [f, fundo] of Object.entries(fundos)) {
      it(`${nome} sobre ${f} ≥ 4,5:1 (texto)`, () => expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(4.5));
    }
  }
  it("neutro dos pares ≥ 3:1 sobre superfície e papel (marca não textual)", () => {
    expect(contraste(tom("obee", "neutro"), tom("superficie"))).toBeGreaterThanOrEqual(3);
    expect(contraste(tom("obee", "neutro"), tom("papel"))).toBeGreaterThanOrEqual(3);
  });
});
