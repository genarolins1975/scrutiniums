import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dadosSaude, goldSaude, INDICADORES_DA_PAGINA } from "@/lib/eficiencia/saude/dados";
import {
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_SERIE,
  IndiceSaude,
  avisoDoPeriodo,
  comparar,
  composicao,
  composicaoAgregada,
  linhasCsvComparacao,
  linhasCsvSerie,
  medida,
  notasMateriais,
  serie,
  serieDaMediana,
  variacao,
} from "@/lib/eficiencia/saude/consulta";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { fraseAmplitude, fraseCapital, fraseDiferenca, fraseEvolucao, minuscula, posicaoNaMediana, resumoDoRecorte } from "@/lib/eficiencia/saude/frases";
import { HISTORICO_REVISOES } from "@/lib/eficiencia/saude/revisoes";
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

  it("o CSV da comparação tem uma linha por capital do grupo, os mesmos valores da tabela e metadados que o explicam fora do site", () => {
    const c = comparar(ix, m, 2025, OPC, "todas", null, "alfabetica");
    const linhas = linhasCsvComparacao(ix, m, 2025, OPC, c, "exercício de 2025");
    expect(linhas).toHaveLength(26);
    expect(linhas.every((l) => l.length === CABECALHO_CSV_COMPARACAO.length)).toBe(true);
    const col = (nome: string) => CABECALHO_CSV_COMPARACAO.findIndex((h) => h.startsWith(nome));
    expect(linhas.filter((l) => l[col("Na comparação")] === "sim")).toHaveLength(c.incluidas.length);
    const macapa = linhas.find((l) => l[0] === "Macapá")!;
    expect(macapa[col("Na comparação")]).toBe("não");
    for (const i of c.incluidas) expect(Number(linhas.find((l) => l[0] === i.cap.nome)![col("Valor numérico")])).toBe(i.valor);
    for (const l of linhas) {
      expect(l[col("Fonte")]).toContain("Siconfi");
      expect(l[col("Fonte")]).not.toMatch(/siconfi_dca/);
      expect(l[col("Páginas oficiais")]).toMatch(/^https?:\/\//);
      expect(l[col("Páginas oficiais")]).not.toContain("<");
      expect(l[col("Fonte")]).not.toMatch(/IPCA/);
      expect(l[col("Data de captura")]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l[col("Hash dos dados")]).toBe(d.meta.hash_dados);
      expect(l[col("Mediana do grupo")]).toBe(String(c.ref!.mediana));
      expect(l[col("Leia antes de usar")]).toMatch(/não classificam governos/);
    }
  });

  it("o CSV da série entrega os anos mostrados, com marca de base e mediana do ano", () => {
    const sp = cap("São Paulo");
    const linhas = linhasCsvSerie(ix, m, OPC, sp, null, (a) => `exercício de ${a}`);
    expect(linhas).toHaveLength(5);
    expect(linhas.every((l) => l.length === CABECALHO_CSV_SERIE.length)).toBe(true);
    const col = (nome: string) => CABECALHO_CSV_SERIE.findIndex((h) => h.startsWith(nome));
    expect(linhas.map((l) => l[col("Marca de base")])).toEqual(["nao", "sim", "sim", "nao", "nao"]);
    expect(linhas.map((l) => l[col("Período")])).toEqual([2021, 2022, 2023, 2024, 2025].map((a) => `exercício de ${a}`));
    const medianas = serieDaMediana(ix, m, OPC, null);
    linhas.forEach((l, i) => expect(Number(l[col("Mediana das capitais")])).toBe(medianas[i].valor));
    const semCapital = linhasCsvSerie(ix, m, OPC, null, null, (a) => String(a));
    expect(semCapital).toHaveLength(5);
    expect(semCapital[0][0]).toMatch(/Mediana/);
  });

  it("notas materiais das capitais incluídas aparecem agrupadas por texto", () => {
    const c = comparar(ix, m, 2022, OPC, "todas", null, "alfabetica");
    const notas = notasMateriais(c);
    for (const n of notas) expect(n.capitais.length).toBeGreaterThan(0);
  });
});

describe("séries e quebras", () => {
  it("a série de uma capital não ponteia anos sem valor e marca a base da população de cada ano", () => {
    const sp = cap("São Paulo");
    const s = serie(ix, medida("despesa_hab"), sp.cod, OPC);
    expect(s.map((p) => p.ano)).toEqual([2021, 2022, 2023, 2024, 2025]);
    // 2021: estimativa anterior ao Censo; 2022 e 2023: a mesma população do Censo 2022; 2024 e 2025: estimativas posteriores
    expect(s.map((p) => p.quebraSerie)).toEqual([false, true, true, false, false]);
  });

  it("a variação por habitante só existe dentro da mesma base: 2022 para 2023 e 2024 para 2025", () => {
    const sp = cap("São Paulo");
    const s = serie(ix, medida("despesa_hab"), sp.cod, OPC);
    expect(variacao(s[1], s[0])).toEqual({ bloqueio: expect.stringMatching(/base populacional/) });
    expect(variacao(s[2], s[1])).toHaveProperty("pct");
    expect(variacao(s[3], s[2])).toEqual({ bloqueio: expect.stringMatching(/base populacional/) });
    expect(variacao(s[4], s[3])).toHaveProperty("pct");
  });

  it("a frase da evolução usa o último trecho da mesma base e diz o que ficou de fora", () => {
    const m2 = medida("despesa_hab");
    const pts = (flags: boolean[]) => flags.map((q, i) => ({ ano: 2021 + i, valor: 100 + i, elegivel: true, quebraSerie: q }));
    const f = fraseEvolucao(pts([false, true, true, false, false]), m2, "A", "a base mudou");
    expect(f).toMatch(/em 2024 para .* em 2025/);
    expect(f).toMatch(/2021, 2022, 2023 usam outra base/);
    expect(fraseEvolucao(pts([false, true, false]), m2, "A", "a base mudou")).toMatch(/sem variação direta/);
    expect(fraseEvolucao(pts([false, false, false]), m2, "A", "x")).toMatch(/de .* em 2021 para .* em 2023\.$/);
  });

  it("a cobertura potencial marca as duas trocas de base da população de referência: dezembro de 2022 para 2023 e de 2024 para 2025", () => {
    const sp = cap("São Paulo");
    const s = serie(ix, medida("cobertura_aps"), sp.cod, OPC);
    // 2021 e 2022: estimativa anterior ao Censo; 2023 e 2024: a mesma população do Censo 2022; 2025: estimativa de 2024
    expect(s.map((p) => p.quebraSerie)).toEqual([true, true, false, false, true]);
    expect(variacao(s[2], s[1])).toEqual({ bloqueio: expect.stringMatching(/base populacional|fora das comparações/) });
    expect(variacao(s[3], s[2])).toHaveProperty("pct");
    expect(variacao(s[4], s[3])).toEqual({ bloqueio: expect.stringMatching(/base populacional/) });
    expect(avisoDoPeriodo(medida("cobertura_aps"), 2022, OPC, d)).toMatch(/anterior ao Censo 2022/);
    expect(avisoDoPeriodo(medida("cobertura_aps"), 2021, OPC, d)).toMatch(/regra anterior/);
    expect(avisoDoPeriodo(medida("cobertura_aps"), 2024, OPC, d)).toMatch(/mesma população de referência/);
    expect(avisoDoPeriodo(medida("cobertura_aps"), 2025, OPC, d)).toMatch(/dois anos de crescimento populacional/);
    const f = fraseEvolucao(s.map((p) => ({ ano: p.ano, valor: p.valor, elegivel: p.elegivel, quebraSerie: p.quebraSerie })), medida("cobertura_aps"), "SP", "a população de referência mudou de base");
    expect(f).toMatch(/de .* em dez\. 2023 para .* em dez\. 2024/);
    expect(f).toMatch(/dez\. 2022, dez\. 2025 usam outra base/);
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

  it("a composição agregada de natureza só soma capitais com todas as categorias observadas e elegíveis, e nomeia as que ficam fora", () => {
    const r = composicaoAgregada(gastos, "sau.despesa.natureza", 2024, NAT, { exigeTodas: true });
    expect(r.capitais).toBeGreaterThan(15);
    expect(r.capitais + r.fora.length).toBe(26);
    expect(r.linhas.reduce((s, l) => s + l.participacao, 0)).toBeCloseTo(100, 1);
    const r25 = composicaoAgregada(gastos, "sau.despesa.natureza", 2025, NAT, { exigeTodas: true });
    expect(r25.fora.map((f) => f.cap.nome)).toContain("Macapá");
    expect(r25.fora.find((f) => f.cap.nome === "Macapá")!.motivo).toMatch(/não reproduz a DCA|fora das comparações|MSC/);
    const r22 = composicaoAgregada(gastos, "sau.despesa.natureza", 2022, NAT, { exigeTodas: true });
    expect(r22.fora.find((f) => f.cap.nome === "Rio de Janeiro")!.motivo).toMatch(/MSC de dezembro não traz registros/);
    expect(r22.fora.find((f) => f.cap.nome === "Florianópolis")!.motivo).toMatch(/sem natureza identificável/);
  });

  it("a composição agregada por subfunção usa as capitais comparáveis (25 ou 26), não 1 a 6, e reproduz o total das despesas somadas", () => {
    for (const ano of [2021, 2022, 2023, 2024, 2025]) {
      const r = composicaoAgregada(gastos, "sau.despesa.subfuncao", ano, SUBS);
      expect(r.capitais, String(ano)).toBeGreaterThanOrEqual(25);
      expect(r.capitais + r.fora.length).toBe(26);
      const somaCats = r.linhas.reduce((s, l) => s + l.valor, 0);
      const somaTotais = gastos.d.capitais
        .filter((c) => !r.fora.some((f) => f.cap.cod === c.cod))
        .reduce((s, c) => s + (gastos.ponto("sau.despesa.funcao_saude", c.cod, ano, "nominal").valor ?? 0), 0);
      expect(somaCats).toBeCloseTo(somaTotais, -1);
      expect(r.linhas.reduce((s, l) => s + l.participacao, 0)).toBeCloseTo(100, 1);
    }
    expect(composicaoAgregada(gastos, "sau.despesa.subfuncao", 2021, SUBS).fora.map((f) => f.cap.nome)).toContain("Campo Grande");
  });
});

describe("razão agregada e comparações na unidade da medida", () => {
  it("a razão agregada tem a unidade do indicador: fica entre o menor e o maior valor do grupo, em todas as medidas e anos", () => {
    const comRazao = Object.values(MEDIDAS_SAUDE).filter((x) => x.razaoAgregada);
    expect(comRazao.length).toBeGreaterThanOrEqual(8);
    for (const x of comRazao) {
      for (const ano of ix.anos(x.indicador, x.componente("nominal", "ripsa"))) {
        const r = ix.referencia(x.indicador, x.componente("nominal", "ripsa"), ano, "todas");
        if (!r || r.razaoAgregada === null || r.minimo === null || r.maximo === null) continue;
        expect(r.razaoAgregada, `${x.id} ${ano}`).toBeGreaterThanOrEqual(r.minimo - 1e-6);
        expect(r.razaoAgregada, `${x.id} ${ano}`).toBeLessThanOrEqual(r.maximo + 1e-6);
      }
    }
    const esf = ix.referencia("sau.aps.equipes_por_10mil", "esf", 2025, "todas")!;
    expect(esf.razaoAgregada!).toBeCloseTo(1.89, 1);
    const icsap = ix.referencia("sau.icsap.taxa", "ripsa", 2024, "todas")!;
    expect(icsap.razaoAgregada!).toBeCloseTo(776.1, 0);
  });

  it("diferença entre duas capitais: pontos percentuais para parcelas, unidade explícita nas razões, sem percentual sobre totais", () => {
    const asps = medida("asps_pct");
    expect(fraseDiferenca({ nome: "A", valor: 21.8 }, { nome: "B", valor: 18.5 }, asps, 2025)).toMatch(/3,3 pontos percentuais a mais que B/);
    expect(fraseDiferenca({ nome: "A", valor: 21.8 }, { nome: "B", valor: 18.5 }, asps, 2025)).not.toMatch(/maior|menor/);
    expect(fraseDiferenca({ nome: "A", valor: 800 }, { nome: "B", valor: 1655 }, medida("icsap_taxa"), 2024)).toMatch(/855 internações por 100 mil habitantes a menos que B/);
    expect(fraseDiferenca({ nome: "A", valor: 3e9 }, { nome: "B", valor: 1e9 }, medida("despesa"), 2025)).not.toMatch(/%/);
    expect(posicaoNaMediana(23342248911, 1.6e8, medida("despesa"))).not.toMatch(/%/);
    expect(posicaoNaMediana(21.8, 20.5, asps)).toMatch(/pontos percentuais acima/);
  });

  it("a marca de base da mediana é a da maioria das capitais: o perímetro distinto de uma capital não troca a base do conjunto", () => {
    const med = serieDaMediana(ix, medida("despesa_hab"), OPC, null);
    expect(med.map((x) => x.quebraSerie)).toEqual([false, true, true, false, false]);
    const cob = serieDaMediana(ix, medida("cobertura_aps"), OPC, null);
    expect(cob.map((x) => x.quebraSerie)).toEqual([true, true, false, false, true]);
    expect(serieDaMediana(ix, medida("despesa"), OPC, null).every((x) => !x.quebraSerie)).toBe(true);
  });

  it("o verbo da frase concorda com o rótulo: equipes e UBS vão, despesa vai", () => {
    const itens = [{ nome: "A", uf: "AA", valor: 1 }, { nome: "B", uf: "BB", valor: 2 }];
    expect(fraseAmplitude(itens, medida("esf_10mil"), 2025, 1.5)).toMatch(/ vão de /);
    expect(fraseAmplitude(itens, medida("ubs_10mil"), 2025, 1.5)).toMatch(/ vão de /);
    expect(fraseAmplitude(itens, medida("despesa_hab"), 2025, 1.5)).toMatch(/ vai de /);
  });

  it("empates são citados em ordem alfabética na frase e nas referências", () => {
    const itens = [{ nome: "Zeta", uf: "ZZ", valor: 1 }, { nome: "Alfa", uf: "AA", valor: 1 }, { nome: "Meio", uf: "MM", valor: 5 }];
    expect(fraseAmplitude(itens, medida("despesa_hab"), 2025, 1)).toMatch(/Alfa \(AA\) e Zeta \(ZZ\)/);
    const r = ix.referencia("sau.aps.equipes_por_10mil", "eap", 2025, "todas")!;
    const nomes = r.capitaisMinimo.map((c) => c.nome);
    expect([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"))).toEqual(nomes);
  });

  it("a primeira letra minúscula preserva siglas: UBS e ICSAP não viram uBS e iCSAP", () => {
    expect(minuscula("UBS públicas ativas")).toBe("UBS públicas ativas");
    expect(minuscula("ICSAP por 100 mil")).toBe("ICSAP por 100 mil");
    expect(minuscula("Equipes de Saúde da Família")).toBe("equipes de Saúde da Família");
    expect(minuscula("eSF por 10 mil")).toBe("eSF por 10 mil");
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
  /\b(eficiente|ineficiente|ineficiência|desperdício|desperdicio|melhores?|piores?|ranking|insights?|principais achados|nossa análise|o que os dados revelam|merece atenção|sinaliza|excesso|bom desempenho|mau desempenho|destaque positivo|destaque negativo|campeã|lanterna|por esse motivo|devido a|em razão d[oae]|em consequência d[oae]|por causa d[oae]|1,07 a 2,79)\b/i;

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

describe("ciclo 5: CSV de série com a marca de perímetro", () => {
  it("a série de Campo Grande traz a marca de perímetro de 2021 e a série da mediana a deixa vazia", () => {
    const cg = cap("Campo Grande");
    const linhas = linhasCsvSerie(ix, medida("despesa_hab"), OPC, cg, null, (a) => String(a));
    expect(linhas.every((l) => l.length === CABECALHO_CSV_SERIE.length)).toBe(true);
    const iPer = CABECALHO_CSV_SERIE.findIndex((h) => h.startsWith("Perímetro da despesa distinto"));
    const iBase = CABECALHO_CSV_SERIE.findIndex((h) => h.startsWith("Marca de base"));
    expect(iPer).toBe(iBase + 1);
    expect(linhas.map((l) => l[iPer])).toEqual(["sim", "nao", "nao", "nao", "nao"]);
    expect(linhas.map((l) => l[iBase])).toEqual(["nao", "sim", "sim", "nao", "nao"]);
    const mediana = linhasCsvSerie(ix, medida("despesa_hab"), OPC, null, null, (a) => String(a));
    expect(mediana.every((l) => l[iPer] === "")).toBe(true);
  });

  it("o histórico descreve a versão atual e as fichas citam a população do Ministério por ano", () => {
    expect(HISTORICO_REVISOES.at(-1)!.hash).toBe(g.meta.hash_dados.slice(0, 16));
    const ficha = g.indicadores.find((f) => f.id === "sau.icsap.taxa")!.comparacao;
    expect(ficha).toMatch(/igual em 2024/);
    expect(JSON.stringify(g.matriz_fontes)).not.toMatch(/variações que as envolvem|2,6% a 10,1% maior que a do Censo 2022/);
  });
});

describe("ciclo 4: marcas, histórico, resumo e entrada", () => {
  it("a marca de perímetro da despesa é separada da marca de base: Campo Grande 2021 bloqueia a variação por perímetro", () => {
    const cg = cap("Campo Grande");
    const s = serie(ix, medida("despesa_hab"), cg.cod, OPC);
    const p2021 = ix.ponto("sau.despesa.por_habitante", cg.cod, 2021, "nominal");
    const p2022 = ix.ponto("sau.despesa.por_habitante", cg.cod, 2022, "nominal");
    expect(s.length).toBe(5);
    // 2021 é anterior ao Censo e tem perímetro distinto (intraorçamentárias): a base e o perímetro diferem de 2022
    expect([p2021.quebraSerie, p2021.quebraPerimetro]).toEqual([false, true]);
    expect([p2022.quebraSerie, p2022.quebraPerimetro]).toEqual([true, false]);
    expect(variacao(p2022, p2021)).toEqual({ bloqueio: "um dos valores está fora das comparações" });
  });

  it("mesmas bases, perímetros diferentes: a variação é bloqueada pelo perímetro", () => {
    const base = { valor: 10, status: "OBSERVADO", nota: null, notaMaterial: false, participacao: null, elegivel: true, situacao: null, motivo: null, quebraSerie: true } as const;
    expect(variacao({ ...base, quebraPerimetro: true }, { ...base, quebraPerimetro: false })).toEqual({ bloqueio: "o perímetro da despesa mudou entre os dois anos" });
    expect(variacao({ ...base, quebraPerimetro: false }, { ...base, quebraPerimetro: false })).toEqual({ pct: 0 });
  });

  it("o histórico de revisões termina na gold publicada e cada hash aparece uma vez", () => {
    const h = HISTORICO_REVISOES;
    expect(h.at(-1)!.hash).toBe(g.meta.hash_dados.slice(0, 16));
    expect(h.at(-1)!.observacoes).toBe(g.meta.observacoes);
    expect(new Set(h.map((r) => r.hash)).size).toBe(h.length);
  });

  it("o resumo do recorte no celular traz medida, período, moeda, denominador, capital e grupo", () => {
    expect(resumoDoRecorte({ medida: "despesa_hab", periodo: "2025", real: false, denominadorIbge: false, capital: null, regiao: null })).toBe("Despesa por habitante · 2025 · todas as capitais");
    expect(resumoDoRecorte({ medida: "icsap_taxa", periodo: "2024", real: false, denominadorIbge: true, capital: "Recife (PE)", regiao: "Nordeste" })).toBe(
      "Taxa de ICSAP por 100 mil habitantes · 2024 · população do IBGE · Recife (PE), comparada à região Nordeste",
    );
    expect(resumoDoRecorte({ medida: "ubs_10mil", periodo: "2025", real: false, denominadorIbge: false, capital: null, regiao: null, ordem: "do maior ao menor" })).toBe("UBS por 10 mil habitantes · 2025 · todas as capitais · ordem do maior ao menor");
    expect(resumoDoRecorte({ medida: "despesa", periodo: "2023", real: true, denominadorIbge: false, capital: null, regiao: null, semCapital: "nenhuma capital escolhida" })).toBe(
      "Despesa total · 2023 · reais de 2025 · nenhuma capital escolhida",
    );
  });

  it("a linha de cobertura da entrada concorda com as golds de Saúde e de Educação", () => {
    const edu = JSON.parse(readFileSync(join(process.cwd(), "public/eficiencia/gold/educacao_capitais.json"), "utf-8"));
    expect(edu.periodos.financeiros[0]).toBe(2021);
    expect(edu.periodos.financeiros.at(-1)).toBe(2025);
    expect(edu.periodos.censo[0]).toBe(2021);
    expect(edu.periodos.censo.at(-1)).toBe(2025);
    expect(edu.periodos.ideb[0]).toBe(2005);
    expect(edu.periodos.ideb.at(-1)).toBe(2025);
    const pagina = readFileSync(join(process.cwd(), "src/app/eficiencia-estatal/page.tsx"), "utf-8");
    expect(pagina).toContain("despesa e matrículas de 2021 a 2025; Ideb de 2005 a 2025");
    expect(pagina).toContain("g.periodos.financeiros[0]");
    expect(g.periodos.financeiros).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(g.periodos.resultados).toEqual([2021, 2022, 2023, 2024]);
  });

  it("cada cartão do Panorama aponta para a trilha da própria medida, que existe em Dados e métodos", () => {
    const pagina = readFileSync(join(process.cwd(), "src/components/eficiencia/saude/PanoramaSaude.tsx"), "utf-8");
    expect(pagina).toContain('#trilha-${ficha.id.replace(/\\./g, "-")}');
    const metodos = readFileSync(join(process.cwd(), "src/app/eficiencia-estatal/saude-capitais/metodos/page.tsx"), "utf-8");
    expect(metodos).toContain('id={`trilha-${t.indicador.replace(/\\./g, "-")}`}');
    const medidasDoPanorama = MEDIDAS_ORDEM.map((id) => MEDIDAS_SAUDE[id].indicador);
    const trilhas = new Set<string>(g.trilhas.map((t) => t.indicador));
    for (const ind of medidasDoPanorama) expect(trilhas.has(ind as string), ind).toBe(true);
  });

  it("as fichas não contradizem as marcas de base da gold", () => {
    const texto = JSON.stringify(g.indicadores);
    expect(texto).not.toMatch(/2021 ou 2023|2021 e 2023 têm base|muda a cada janeiro/);
    // as variações bloqueadas pela base são 2021 para 2022 e 2023 para 2024; as duas outras têm a mesma base
    const sp = cap("São Paulo");
    const marcas = serie(ix, medida("despesa_hab"), sp.cod, OPC).map((p) => p.quebraSerie);
    expect(marcas.map((m, i) => (i > 0 && m !== marcas[i - 1] ? `${2020 + i}-${2021 + i}` : null)).filter(Boolean)).toEqual(["2021-2022", "2023-2024"]);
  });
});
