import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dadosSaude, goldSaude, INDICADORES_DA_PAGINA } from "@/lib/eficiencia/saude/dados";
import {
  CABECALHO_CSV_COMPARACAO,
  IndiceSaude,
  comparar,
  composicao,
  composicaoAgregada,
  linhasCsvComparacao,
  medida,
  notasMateriais,
  serie,
  serieDaMediana,
  variacao,
} from "@/lib/eficiencia/saude/consulta";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { fraseAmplitude, fraseCapital, fraseEvolucao } from "@/lib/eficiencia/saude/frases";
import { MEDIDAS_ORDEM, MEDIDAS_SAUDE, TEMAS_SAUDE } from "@/lib/eficiencia/saude/medidas";
import { ABAS_SAUDE, CAMINHO_COMPARAR, CAMINHO_METODOS, CAMINHO_TEMA, hrefSaude, ROTA_ENTRADA, ROTA_SAUDE } from "@/lib/eficiencia/saude/rotas";
import sitemap from "@/app/sitemap";

/**
 * Módulo Saúde nas capitais (OBEE). Os testes miram erros plausíveis e as suas consequências: capital pendente ou de perímetro distinto
 * entrando na mediana, ausência virando zero, composição que não reconcilia, indicador não publicável vazando para a interface, tabela e
 * download divergentes, linguagem avaliativa no texto público, arquivo ou rota de Educação tocados.
 */

const g = goldSaude()!;
const d = dadosSaude(g, "comparar");
const ix = new IndiceSaude(d);
const cap = (nome: string) => d.capitais.find((c) => c.nome === nome)!;
const OPC = { moeda: "nominal", denominador: "ripsa" } as const;
const OPC_REAL = { moeda: "real", denominador: "ripsa" } as const;

describe("gold e payload do cliente", () => {
  it("a gold existe e é a de Saúde", () => {
    expect(g).not.toBeNull();
    expect(g.painel.id).toMatch(/saude/);
  });

  it("26 capitais em ordem alfabética, sem o Distrito Federal, com o motivo de Saúde registrado", () => {
    expect(d.capitais).toHaveLength(26);
    const nomes = d.capitais.map((c) => c.nome);
    expect([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"))).toEqual(nomes);
    expect(d.capitais.some((c) => c.uf === "DF")).toBe(false);
    expect(g.universo.excluidos).toHaveLength(1);
    const motivo = g.universo.excluidos[0].motivo.toLowerCase();
    expect(motivo).toContain("saúde");
    expect(motivo).not.toMatch(/censo escolar|rede municipal de ensino/);
  });

  it("cada página recebe só os seus indicadores e preserva todas as observações deles", () => {
    for (const pagina of Object.keys(INDICADORES_DA_PAGINA) as (keyof typeof INDICADORES_DA_PAGINA)[]) {
      const p = dadosSaude(g, pagina);
      const esperado = g.observacoes.filter((o) => INDICADORES_DA_PAGINA[pagina].includes(o.indicador)).length;
      expect(p.obs.length, pagina).toBe(esperado);
      expect(new Set(p.indicadores)).toEqual(new Set(INDICADORES_DA_PAGINA[pagina].filter((id) => g.indicadores.some((f) => f.id === id))));
    }
  });

  it("indicador não publicável não vira observação, medida nem link de download", () => {
    const nao = g.indicadores.filter((f) => f.estado === "NAO_PUBLICAVEL").map((f) => f.id);
    expect(nao.sort()).toEqual(["sau.aps.producao", "sau.despesa.por_atendimento", "sau.rede.profissionais_carga_horaria"]);
    for (const pagina of Object.keys(INDICADORES_DA_PAGINA) as (keyof typeof INDICADORES_DA_PAGINA)[]) {
      const p = dadosSaude(g, pagina);
      for (const id of nao) expect(p.indicadores).not.toContain(id);
    }
    for (const m of Object.values(MEDIDAS_SAUDE)) expect(nao).not.toContain(m.indicador);
    for (const f of g.indicadores.filter((x) => x.estado === "NAO_PUBLICAVEL")) expect(f.download ?? null).toBeNull();
  });

  it("ausência nunca vira zero: todo estado diferente de observado chega sem valor", () => {
    for (const o of g.observacoes) {
      if (o.status !== "OBSERVADO") expect(o.valor, `${o.indicador} ${o.ente} ${o.ano}`).toBeNull();
    }
    const compactas = d.obs.filter((o) => d.status[o[5]] !== "OBSERVADO");
    for (const o of compactas) expect(o[4]).toBeNull();
  });

  it("os arquivos de download de Saúde existem e têm prefixo próprio", () => {
    for (const f of g.indicadores) {
      if (!f.download) continue;
      expect(f.download).toMatch(/\/eficiencia\/series\/sau_/);
      expect(existsSync(join(process.cwd(), "public", f.download))).toBe(true);
    }
  });
});

describe("regras de comparação", () => {
  const m = medida("despesa_hab");

  it("Macapá 2025 (conferência pendente) fica fora da comparação, com o valor oficial preservado", () => {
    const c = comparar(ix, m, 2025, OPC, "todas", null, "alfabetica");
    expect(c.incluidas.some((i) => i.cap.nome === "Macapá")).toBe(false);
    const x = c.excluidas.find((e) => e.cap.nome === "Macapá")!;
    expect(x).toBeDefined();
    expect(x.comValor).toBe(true);
    expect(x.motivo.length).toBeGreaterThan(20);
    expect(c.incluidas.length + c.excluidas.length).toBe(26);
  });

  it("Campo Grande 2021 (perímetro distinto) sai da comparação no nominal e no real", () => {
    for (const o of [OPC, OPC_REAL]) {
      const c = comparar(ix, m, 2021, o, "todas", null, "alfabetica");
      expect(c.incluidas.some((i) => i.cap.nome === "Campo Grande")).toBe(false);
      expect(c.excluidas.find((e) => e.cap.nome === "Campo Grande")?.comValor).toBe(true);
    }
  });

  it("a mediana publicada é a das capitais incluídas, não a de todas as que têm valor", () => {
    const c = comparar(ix, m, 2025, OPC, "todas", null, "alfabetica");
    const valores = c.incluidas.map((i) => i.valor).sort((a, b) => a - b);
    const meio = valores.length / 2;
    const mediana = valores.length % 2 ? valores[(valores.length - 1) / 2] : (valores[meio - 1] + valores[meio]) / 2;
    expect(c.ref).not.toBeNull();
    expect(c.ref!.n).toBe(valores.length);
    expect(c.ref!.mediana!).toBeCloseTo(mediana, 6);
    const todos = d.capitais.map((x) => ix.ponto(m.indicador, x.cod, 2025, "nominal")).filter((p) => p.valor !== null);
    expect(todos.length).toBeGreaterThan(valores.length);
  });

  it("o recorte regional usa o grupo da capital escolhida e a referência desse grupo", () => {
    const rec = cap("Recife");
    const c = comparar(ix, m, 2024, OPC, "regiao", rec, "valor");
    expect(c.incluidas.length).toBeGreaterThan(3);
    expect(c.incluidas.every((i) => i.cap.regiao === rec.regiao)).toBe(true);
    expect(c.noGrupo).toBe(d.capitais.filter((x) => x.regiao === rec.regiao).length);
    const ordenados = c.incluidas.map((i) => i.valor);
    expect([...ordenados].sort((a, b) => a - b)).toEqual(ordenados);
  });

  it("ordenação por valor decrescente e alfabética não perdem nem duplicam capitais", () => {
    const a = comparar(ix, m, 2024, OPC, "todas", null, "alfabetica");
    const b = comparar(ix, m, 2024, OPC, "todas", null, "valor_desc");
    expect(new Set(a.incluidas.map((i) => i.cap.id))).toEqual(new Set(b.incluidas.map((i) => i.cap.id)));
    const v = b.incluidas.map((i) => i.valor);
    expect([...v].sort((x, y) => y - x)).toEqual(v);
  });

  it("o CSV da comparação tem uma linha por capital do grupo e os mesmos valores da tabela", () => {
    const c = comparar(ix, m, 2025, OPC, "todas", null, "alfabetica");
    const linhas = linhasCsvComparacao(ix, m, 2025, OPC, c, "exercício de 2025", "Siconfi, IBGE");
    expect(linhas).toHaveLength(26);
    expect(linhas.every((l) => l.length === CABECALHO_CSV_COMPARACAO.length)).toBe(true);
    const idxNa = CABECALHO_CSV_COMPARACAO.indexOf("Na comparação");
    expect(linhas.filter((l) => l[idxNa] === "sim")).toHaveLength(c.incluidas.length);
    const macapa = linhas.find((l) => l[0] === "Macapá")!;
    expect(macapa[idxNa]).toBe("não");
    const idxNum = CABECALHO_CSV_COMPARACAO.indexOf("Valor numérico");
    for (const i of c.incluidas) expect(Number(linhas.find((l) => l[0] === i.cap.nome)![idxNum])).toBe(i.valor);
  });

  it("notas materiais das capitais incluídas aparecem agrupadas por texto", () => {
    const c = comparar(ix, m, 2022, OPC, "todas", null, "alfabetica");
    const notas = notasMateriais(c);
    for (const n of notas) expect(n.capitais.length).toBeGreaterThan(0);
  });
});

describe("séries e quebras", () => {
  it("a série de uma capital não ponteia anos sem valor e marca a quebra de base populacional de 2021", () => {
    const sp = cap("São Paulo");
    const s = serie(ix, medida("despesa_hab"), sp.cod, OPC);
    expect(s.map((p) => p.ano)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(s[0].quebraSerie).toBe(true);
    expect(s[1].quebraSerie).toBe(false);
  });

  it("a variação entre 2021 e 2022 por habitante é bloqueada pela mudança de base populacional; 2024 e 2025 têm variação", () => {
    const sp = cap("São Paulo");
    const s = serie(ix, medida("despesa_hab"), sp.cod, OPC);
    expect(variacao(s[1], s[0])).toEqual({ bloqueio: expect.stringMatching(/base populacional|fora das comparações/) });
    expect(variacao(s[4], s[3])).toHaveProperty("pct");
  });

  it("a cobertura potencial de 2021 não entra nas comparações", () => {
    const c = comparar(ix, medida("cobertura_aps"), 2021, OPC, "todas", null, "alfabetica");
    expect(c.incluidas).toHaveLength(0);
    expect(c.excluidas.length).toBe(26);
    expect(comparar(ix, medida("cobertura_aps"), 2022, OPC, "todas", null, "alfabetica").incluidas.length).toBeGreaterThan(20);
  });

  it("a série da mediana informa quantas capitais a compõem em cada ano", () => {
    const s = serieDaMediana(ix, medida("despesa_hab"), OPC, null);
    expect(s).toHaveLength(5);
    expect(s.every((p) => p.n > 0 && p.n <= 26)).toBe(true);
    expect(s[4].n).toBeLessThan(26);
  });

  it("as medidas de resultado terminam em 2024 e as financeiras em 2025", () => {
    const icsap = serie(ix, medida("icsap_taxa"), cap("Recife").cod, OPC).map((p) => p.ano);
    expect(Math.max(...icsap)).toBe(2024);
    const desp = serie(ix, medida("despesa"), cap("Recife").cod, OPC).map((p) => p.ano);
    expect(Math.max(...desp)).toBe(2025);
  });
});

describe("composições", () => {
  const gastos = new IndiceSaude(dadosSaude(g, "gastos"));
  const SUBS = Object.entries(g.subfuncoes) as [string, string][];
  const NAT: [string, string][] = Object.entries(g.categorias_natureza);

  it("a composição por subfunção soma a despesa da função e 100%", () => {
    const sp = gastos.d.capitais.find((c) => c.nome === "São Paulo")!;
    const r = composicao(gastos, "sau.despesa.subfuncao", sp.cod, 2024, SUBS);
    expect(r.indisponivel).toBeNull();
    const total = gastos.ponto("sau.despesa.funcao_saude", sp.cod, 2024, "nominal").valor!;
    expect(r.linhas.reduce((s, l) => s + l.valor, 0)).toBeCloseTo(total, 0);
    expect(r.linhas.reduce((s, l) => s + l.participacao, 0)).toBeCloseTo(100, 1);
  });

  it("natureza indisponível não é completada com zero: Macapá 2025 devolve o motivo", () => {
    const mac = gastos.d.capitais.find((c) => c.nome === "Macapá")!;
    const r = composicao(gastos, "sau.despesa.natureza", mac.cod, 2025, NAT);
    expect(r.linhas).toHaveLength(0);
    expect(r.indisponivel).toBeTruthy();
  });

  it("a composição agregada só soma capitais com todas as categorias observadas e elegíveis", () => {
    const r = composicaoAgregada(gastos, "sau.despesa.natureza", 2024, NAT);
    expect(r.capitais).toBeGreaterThan(15);
    expect(r.capitais).toBeLessThanOrEqual(26);
    expect(r.linhas.reduce((s, l) => s + l.participacao, 0)).toBeCloseTo(100, 1);
  });
});

describe("medidas, frases e rotas", () => {
  it("toda medida aponta para um indicador publicável do catálogo e existe numa página", () => {
    for (const id of MEDIDAS_ORDEM) {
      const m = MEDIDAS_SAUDE[id];
      const f = g.indicadores.find((x) => x.id === m.indicador);
      expect(f, id).toBeDefined();
      expect(f!.estado).not.toBe("NAO_PUBLICAVEL");
      expect(Object.values(INDICADORES_DA_PAGINA).some((l) => l.includes(m.indicador)), id).toBe(true);
      expect(m.definicao.length).toBeGreaterThan(20);
      expect(m.naoE.length).toBeGreaterThan(10);
    }
    for (const t of Object.values(TEMAS_SAUDE)) expect(t.medidas).toContain(t.medidaInicial);
  });

  it("as frases descrevem sem classificar", () => {
    const m = medida("despesa_hab");
    const f1 = fraseAmplitude([{ nome: "A", uf: "AA", valor: 10 }, { nome: "B", uf: "BB", valor: 30 }], m, 2024, 20);
    const f2 = fraseCapital("A", "AA", 10, 20, 25, m, false);
    const f3 = fraseCapital("C", "CC", 10, 20, 25, m, true);
    const f4 = fraseEvolucao([{ ano: 2022, valor: 1, elegivel: true, quebraSerie: false }, { ano: 2025, valor: 2, elegivel: true, quebraSerie: false }], m, "A", "x");
    for (const f of [f1, f2, f3, f4]) {
      expect(f).not.toMatch(/\b(melhor|pior|eficiente|ineficiente|ranking|desperdício|destaque)\b/i);
      expect(f).not.toMatch(/undefined|NaN|\d{4}-\d{2}-\d{2}/);
    }
    expect(f1).toContain("A mediana das 2 capitais");
    expect(f3).toContain("fora da comparação");
  });

  it("hrefSaude monta a URL sem parâmetros vazios e as abas apontam para rotas existentes", () => {
    expect(hrefSaude("/gastos", { med: "despesa_hab", ano: 2024, cap: "", vs: undefined })).toBe(`${ROTA_SAUDE}/gastos?med=despesa_hab&ano=2024`);
    expect(hrefSaude("")).toBe(ROTA_SAUDE);
    const base = join(process.cwd(), "src", "app", "eficiencia-estatal", "saude-capitais");
    for (const a of ABAS_SAUDE) expect(existsSync(join(base, a.caminho.replace(/^\//, ""), "page.tsx")), a.id).toBe(true);
    for (const c of [CAMINHO_COMPARAR, CAMINHO_METODOS, ...Object.values(CAMINHO_TEMA)]) expect(existsSync(join(base, c.replace(/^\//, ""), "page.tsx")), c).toBe(true);
  });

  it("o sitemap lista a entrada do observatório e as seis páginas de Saúde, sem duplicar Educação", () => {
    const urls = sitemap().map((x) => new URL(x.url).pathname);
    expect(urls).toContain(ROTA_ENTRADA);
    for (const p of ["", ...Object.values(CAMINHO_TEMA), CAMINHO_COMPARAR, CAMINHO_METODOS]) expect(urls).toContain(`${ROTA_SAUDE}${p}`);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("/eficiencia-estatal/educacao-municipal-capitais");
  });

  it("cada ficha publicável tem contexto com validações e cobertura", () => {
    const ctx = contextosSaude(g);
    for (const f of g.indicadores) {
      expect(ctx[f.id].validacoes.length, f.id).toBeGreaterThan(0);
      if (f.estado !== "NAO_PUBLICAVEL") expect(ctx[f.id].cobertura.length, f.id).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ neutralidade */

const PROIBIDAS =
  /\b(eficiente|ineficiente|ineficiência|desperdício|desperdicio|melhores?|piores?|ranking|insights?|principais achados|nossa análise|o que os dados revelam|merece atenção|sinaliza|excesso|bom desempenho|mau desempenho|destaque positivo|destaque negativo|campeã|lanterna)\b/i;

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(join(dir, e.name)) : [join(dir, e.name)]));
}

describe("neutralidade do texto público de Saúde", () => {
  const fontes = [
    ...arquivos(join(process.cwd(), "src/components/eficiencia/saude")),
    ...arquivos(join(process.cwd(), "src/app/eficiencia-estatal/saude-capitais")),
    ...arquivos(join(process.cwd(), "src/lib/eficiencia/saude")),
    join(process.cwd(), "src/app/eficiencia-estatal/page.tsx"),
    join(process.cwd(), "src/components/eficiencia/CabecalhoEntrada.tsx"),
  ];
  for (const f of fontes) {
    it(`sem linguagem avaliativa em ${f.replace(process.cwd() + "/", "")}`, () => {
      expect(readFileSync(f, "utf-8").match(PROIBIDAS)?.[0] ?? null).toBeNull();
    });
  }

  it("sem linguagem avaliativa no catálogo, nas validações e na matriz de fontes da gold", () => {
    const t = JSON.stringify({ i: g.indicadores, v: g.validacoes, m: g.matriz_fontes, n: d.notas });
    expect(t.match(PROIBIDAS)?.[0] ?? null).toBeNull();
  });

  it("sem cores de semáforo nem hexadecimais soltos nos componentes de Saúde", () => {
    for (const f of arquivos(join(process.cwd(), "src/components/eficiencia/saude"))) {
      expect(readFileSync(f, "utf-8")).not.toMatch(/text-(sucesso|erro)|bg-(sucesso|erro)|--cor-(sucesso|erro)|#[0-9a-fA-F]{6}/);
    }
  });

  it("sem hífen nem travessão como pontuação nos textos de interface de Saúde", () => {
    for (const f of arquivos(join(process.cwd(), "src/components/eficiencia/saude")).filter((x) => x.endsWith(".tsx"))) {
      const t = readFileSync(f, "utf-8");
      expect(t.match(/ — | – /)?.[0] ?? null, f).toBeNull();
    }
  });
});

describe("isolamento de Educação", () => {
  it("os componentes de Saúde não importam módulos de Educação de dados (usam apenas componentes compartilhados)", () => {
    for (const f of arquivos(join(process.cwd(), "src/components/eficiencia/saude"))) {
      const t = readFileSync(f, "utf-8");
      expect(t).not.toMatch(/from "@\/lib\/eficiencia\/dados"/);
      expect(t).not.toMatch(/goldEducacao|dadosPainel/);
    }
  });

  it("a gold de Educação não foi tocada pela gold de Saúde (arquivos e painéis distintos)", () => {
    const edu = JSON.parse(readFileSync(join(process.cwd(), "public/eficiencia/gold/educacao_capitais.json"), "utf-8"));
    expect(edu.painel.id).not.toBe(g.painel.id);
    expect(edu.meta.hash_dados).not.toBe(g.meta.hash_dados);
  });
});
