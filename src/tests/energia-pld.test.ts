/**
 * Módulo PLD (detalhe): contrato da gold pld_detalhe.json e dos arquivos lidos sob demanda.
 *
 * O teste principal compila, com o compilador TypeScript do projeto, um arquivo virtual que
 * atribui o JSON publicado (como literal de objeto) aos tipos de src/lib/energia/tipos-pld.ts.
 * Num literal, o TypeScript recusa campo que o tipo não declara (TS2353) e campo obrigatório
 * ausente (TS2741): assim, qualquer desvio entre o que o pipeline publica e o que a interface
 * espera (como os campos `urls` da fonte composta ou `url` do arquivo do ato da ANEEL, que os
 * tipos compartilhados não têm) faz o teste falhar. Importar o JSON com `import` não pegaria
 * isso, porque o tipo inferido do JSON não passa pela checagem de campos a mais.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { PldDetalheGold } from "@/lib/energia/tipos-pld";

const RAIZ = path.resolve(__dirname, "../..");
const GOLD = path.join(RAIZ, "public/energia/gold/pld_detalhe.json");
const SERIES = path.join(RAIZ, "public/energia/series");

const ARQUIVOS: [string, string][] = [
  ["PldDetalheGold", GOLD],
  ["PldEvidenciasArquivo", path.join(SERIES, "pld_evidencias.json")],
  ["PldHoraDiaArquivo", path.join(SERIES, "pld_hora_dia.json")],
  ["PldHorarioRecenteArquivo", path.join(SERIES, "pld_horario_recente.json")],
];

function diagnosticosDaAtribuicao(): string[] {
  const virtual = path.join(RAIZ, "src/lib/energia/__confere_tipos_pld__.ts");
  const fonte =
    `import type { ${ARQUIVOS.map(([t]) => t).join(", ")} } from "./tipos-pld";\n` +
    ARQUIVOS.map(([t, arq], i) => `export const v${i}: ${t} = ${readFileSync(arq, "utf-8")};\n`).join("");
  const opcoes: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
    baseUrl: RAIZ,
    paths: { "@/*": ["./src/*"] },
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    types: [],
  };
  const host = ts.createCompilerHost(opcoes);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (nome, versao, ...resto) =>
    path.resolve(nome) === virtual ? ts.createSourceFile(nome, fonte, versao) : original(nome, versao, ...resto);
  const lerOriginal = host.readFile.bind(host);
  host.readFile = (nome) => (path.resolve(nome) === virtual ? fonte : lerOriginal(nome));
  const existeOriginal = host.fileExists.bind(host);
  host.fileExists = (nome) => path.resolve(nome) === virtual || existeOriginal(nome);
  const programa = ts.createProgram([virtual], opcoes, host);
  const arquivo = programa.getSourceFile(virtual);
  if (!arquivo) throw new Error("arquivo virtual não compilado");
  return [...programa.getSyntacticDiagnostics(arquivo), ...programa.getSemanticDiagnostics(arquivo)].map((d) => {
    const pos = d.start !== undefined ? arquivo.getLineAndCharacterOfPosition(d.start) : null;
    const trecho = d.start !== undefined ? fonte.slice(Math.max(0, d.start - 80), d.start + 40).replace(/\s+/g, " ") : "";
    return `TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")} (linha ${pos ? pos.line + 1 : "?"}: …${trecho}…)`;
  });
}

const gold = JSON.parse(readFileSync(GOLD, "utf-8")) as PldDetalheGold;

describe("pld_detalhe.json: tipos espelham a gold publicada", () => {
  it("gold, fichas, mapa hora × dia e janela horária atribuíveis aos tipos sem campo a mais nem a menos", () => {
    expect(diagnosticosDaAtribuicao()).toEqual([]);
  }, 180_000);
});

describe("pld_detalhe.json: ponderada pela carga e perímetro do peso", () => {
  const mh = gold.historico.mensal;
  const pond = gold.historico.ponderacao;

  it("perímetro da carga por mês, com a mudança de 2023 marcada", () => {
    expect(mh.perimetro_carga).toHaveLength(mh.meses.length);
    expect(mh.perimetro_carga[mh.meses.indexOf("2021-02")]).toBe("P1");
    expect(mh.perimetro_carga[mh.meses.indexOf("2021-03")]).toBe("P2");
    expect(mh.perimetro_carga[mh.meses.indexOf("2023-04")]).toBe("P2_P3");
    expect(mh.perimetro_carga[mh.meses.indexOf("2023-05")]).toBe("P3");
    expect(pond.perimetros.map((p) => [p.id, p.natureza_do_peso, p.inclui_mmgd])).toEqual([
      ["P1", "OBSERVADO", false],
      ["P2", "ESTIMADO", false],
      ["P3", "ESTIMADO", true],
    ]);
  });

  it("natureza do peso do balanço é ESTIMADO e a do peso sem MMGD é OBSERVADO", () => {
    expect(gold.proveniencia.peso_carga_balanco.natureza).toBe("ESTIMADO");
    expect(gold.metricas_proveniencia.pld_media_mensal_ponderada_carga.fonte).toBe("peso_carga_balanco");
    if (pond.peso_sem_mmgd.disponivel) {
      expect(gold.proveniencia.peso_carga_sem_mmgd?.natureza).toBe("OBSERVADO");
      expect(gold.metricas_proveniencia.pld_media_mensal_ponderada_carga_sem_mmgd.fonte).toBe("peso_carga_sem_mmgd");
    }
  });

  it("revisões da proveniência mensal somam PLD e carga", () => {
    const rv = gold.proveniencia.historico_mensal.revisoes_conhecidas;
    expect(rv).not.toBeNull();
    const comp = rv?.componentes ?? [];
    expect(comp.map((c) => c.fonte)).toContain("carga do balanço (ONS)");
    expect(rv?.total).toBe(comp.reduce((s, c) => s + (c.total ?? 0), 0));
  });

  it("CSV mensal reproduz as colunas da gold (gráfico, tabela e exportação com os mesmos números)", () => {
    const [cab, ...linhas] = readFileSync(path.join(SERIES, "pld_mensal.csv"), "utf-8").trim().split("\n");
    const col = cab.split(";");
    const idx = (c: string) => col.indexOf(c);
    expect(linhas).toHaveLength(mh.meses.length * 4);
    for (const l of linhas) {
      const v = l.split(";");
      const i = mh.meses.indexOf(v[idx("mes")]);
      const sm = v[idx("sm")] as "SE" | "S" | "NE" | "N";
      expect(v[idx("perimetro_carga")]).toBe(mh.perimetro_carga[i]);
      for (const [csv, campo] of [
        ["media_ponderada_carga", "ponderada_carga"],
        ["media_ponderada_carga_sem_mmgd", "ponderada_carga_sem_mmgd"],
        ["media_temporal", "temporal"],
      ] as const) {
        const g = mh[sm][campo][i];
        expect(v[idx(csv)] === "").toBe(g === null);
        if (g !== null) expect(Math.abs(Number(v[idx(csv)]) - g)).toBeLessThanOrEqual(0.005);
      }
    }
  });
});

describe("pld_detalhe.json: blocos anuais e limiares", () => {
  it("empates no piso marcam o ano parcial como os outros blocos anuais", () => {
    const lim = gold.limites;
    if (!lim.disponivel) return;
    const ano = Number(gold.referencia.dia.slice(0, 4));
    const parcial = !gold.referencia.dia.endsWith("-12-31");
    expect(lim.empates_piso.find((e) => e.ano === ano)?.parcial).toBe(parcial);
    expect(lim.permanencia_anual.find((e) => e.ano === ano)?.parcial).toBe(parcial);
  });

  it("amplitude publica a contagem com R$ 1,00/MWh, menor ou igual à de R$ 0,01/MWh", () => {
    for (const a of gold.regional.amplitude) {
      expect(a.horas_acima_1).toBeLessThanOrEqual(a.horas_com_separacao);
      expect(a.horas_acima_10).toBeLessThanOrEqual(a.horas_acima_1);
    }
    const ctrl = gold.controles.find((c) => c.nome.startsWith("Amplitude com R$ 1,00/MWh"));
    expect(ctrl?.resultado).not.toBe("reprovado");
  });
});

describe("pld_detalhe.json: textos derivados dos dados", () => {
  it("A02 cita meias horas publicadas, esperadas e dias sem publicação do próprio bloco", () => {
    const a02 = gold.achados.A02;
    const se = a02.dessem_mesmo_periodo?.find((x) => x.sm === "SE");
    if (!se || !a02.texto) return;
    const n = (v: number) => v.toLocaleString("pt-BR");
    expect(a02.texto).toContain("meias horas publicadas");
    expect(a02.texto).toContain(`${n(se.meias_horas_zero)} de ${n(se.meias_horas)}`);
    expect(a02.texto).toContain(`${n(se.meias_horas_esperadas)} meias horas e ${se.dias_sem_publicacao} dias sem nenhuma publicada`);
    expect(se.meias_horas_esperadas).toBeGreaterThanOrEqual(se.meias_horas);
  });

  it("sensibilidade ao peso: texto com a faixa das diferenças publicadas", () => {
    const sp = gold.historico.ponderacao.sensibilidade_peso;
    if (!sp) return;
    for (const x of sp.por_sm) {
      expect(Math.abs(x.ponderada_menos_sem_mmgd - (x.ponderada_carga - x.ponderada_carga_sem_mmgd))).toBeLessThanOrEqual(0.011);
    }
    expect(sp.texto).toContain("ponderada pela carga sem MMGD");
  });
});

