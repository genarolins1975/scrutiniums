import { describe, expect, it } from "vitest";
import {
  avisosDaRodada, instanteBR, linhasArquivo, linhasCoeficientes, respostaP015, respostaP016,
  textoCoeficientes, textoEmissao, vereditoP015, type LinhaArquivo,
} from "@/lib/energia/previsoes";
import { fmt, milhoes } from "@/lib/energia/riscos-formato";
import { textoPicoFrenteAoLimite, textoPonteLimiar } from "@/lib/energia/pld";
import type { Ficha } from "@/lib/energia/tipos-previsoes";
import type { RegimeLimites } from "@/lib/energia/tipos-pld";

function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}

// Oráculos literais, sem Intl ou outro formatador para produzir o esperado.
describe("instantes e emissão: contratos de previsoes", () => {
  it.each([
    ["2026-10-14T12:34:56Z", "14/10/2026 às 09h34", "Oct 14, 2026, 09:34 AM"],
    ["2026-10-01T03:00:00Z", "01/10/2026 às 00h00", "Oct 1, 2026, 12:00 AM"],
    ["2026-10-01T02:59:00Z", "30/09/2026 às 23h59", "Sep 30, 2026, 11:59 PM"],
    ["2026-10-14T09:34:56-03:00", "14/10/2026 às 09h34", "Oct 14, 2026, 09:34 AM"],
    ["captura inválida", "captura inválida", "captura inválida"],
    [null, "sem registro", "sem registro"], [undefined, "sem registro", "sem registro"], ["", "sem registro", "sem registro"],
  ] as const)("preserva o parser e o instante %s", (entrada, pt, en) => {
    expect(instanteBR(entrada)).toBe(pt);
    expect(instanteBR(entrada, "pt")).toBe(pt);
    expect(instanteBR(entrada, "en")).toBe(en);
  });

  const emissao = congelar({ emitido_em: "2026-10-14T12:34:56Z", atraso_min: 1234, modo: "agendada", prazo: "2026-10-14T11:00:00Z" });
  it("encaminha idioma para o instante e os minutos sem mudar o prazo", () => {
    const pt = "emitida pelo agendamento em 14/10/2026 às 09h34, 1.234 minutos depois do prazo das 08h00";
    expect(textoEmissao(emissao)).toBe(pt);
    expect(textoEmissao(emissao, "pt")).toBe(pt);
    expect(textoEmissao(emissao, "en")).toBe("emitida pelo agendamento em Oct 14, 2026, 09:34 AM, 1,234 minutos depois do prazo das 08h00");
    expect(textoEmissao({ ...emissao, prazo: null }, "en")).toBe("emitida pelo agendamento em Oct 14, 2026, 09:34 AM, sem prazo registrado");
    expect(textoEmissao({ ...emissao, atraso_min: 0 }, "en")).toBe("emitida pelo agendamento em Oct 14, 2026, 09:34 AM, dentro do prazo das 08h00");
  });

  it("localiza só a emissão e mantém os demais avisos na mesma ordem", () => {
    const rodada = congelar({ ...emissao, modo: "manual", alertas: [], versao_codigo: null,
      celulas: 2, com_numero: 0, motivos: [], registrado_no_portal_em: "2026-10-15" });
    const pt = avisosDaRodada(rodada, "pt");
    const en = avisosDaRodada(rodada, "en");
    expect(avisosDaRodada(rodada)).toEqual(pt);
    expect(pt[0]).toEqual({ id: "emissao", rotulo: "Emissão", texto: "Emitida manualmente em 14/10/2026 às 09h34, depois do prazo das 08h00." });
    expect(en[0]).toEqual({ id: "emissao", rotulo: "Emissão", texto: "Emitida manualmente em Oct 14, 2026, 09:34 AM, depois do prazo das 08h00." });
    const restantes = [
      { id: "codigo", rotulo: "Reprodutibilidade", texto: "O registro não traz a versão do código que emitiu a rodada." },
      { id: "transcricao", rotulo: "Registro", texto: "Transcrito de outra fonte e incluído no arquivo em 15/10/2026, depois da emissão: não é emissão original do observatório." },
      { id: "sem-numero", rotulo: "Números", texto: "Nenhuma das 2 células tem número." },
    ];
    expect(pt.slice(1)).toEqual(restantes);
    expect(en.slice(1)).toEqual(restantes);
  });
});

const bruta: Record<string, string> = {
  forecast_id: "f1", run_id: "r1", tipo: "RODADA_INTERNA", modelo: "C2-P", versao_modelo: "v1", origem: "2026-10-14",
  cutoff: "2026-10-14T10:00:00Z", prazo: "2026-10-14T11:00:00Z", emitido_em: "2026-10-14T12:34:56Z",
  atraso_min: "1234", atraso_origem: "registrado", modo: "manual", horizonte: "W1", entrega: "W2026-10-17", submercado: "SE",
  status: "DISPONIVEL", previsao: "1234.5678", p10: "1000.25", p90: "2000.75", mudanca: "-2.5", motivo: "",
  realizado: "1250.25", erro: "-15.6822", sha256: "a".repeat(64), versao_codigo: "codigo1", registrado_no_portal_em: "2026-10-14",
  alertas: "", substitui: "", anterior: "",
};
const brutas = congelar([
  { ...bruta }, { ...bruta, forecast_id: "f2", modelo: "C2-H" },
  { ...bruta, forecast_id: "f3", modelo: "B0", tipo: "REFERENCIA_EXPERIMENTAL" },
]);
const estados = congelar({ "C2-P": "PESQUISA", "C2-H": "PRODUCAO", B0: "PESQUISA" });

describe("arquivo e respostas P015", () => {
  it("altera apenas emitido e mantém a retenção própria do conversor de linhas", () => {
    const antes = structuredClone(brutas);
    const pt = linhasArquivo(brutas, estados, "pt");
    const en = linhasArquivo(brutas, estados, "en");
    expect(linhasArquivo(brutas, estados)).toEqual(pt);
    const camposPt = pt.map(({ emitido, ...campos }) => {
      expect(emitido).toBe("14/10/2026 às 09h34");
      return campos;
    });
    const camposEn = en.map(({ emitido, ...campos }) => {
      expect(emitido).toBe("Oct 14, 2026, 09:34 AM");
      return campos;
    });
    expect(camposEn).toEqual(camposPt);
    for (const linhas of [pt, en]) {
      expect(linhas.map((l) => [l.forecast_id, l.previsao, l.p10, l.p90, l.mudanca, l.erro, l.realizado, l.com_numero])).toEqual([
        ["f1", null, null, null, null, null, 1250.25, "número retido (rodada interna)"],
        ["f2", 1234.5678, 1000.25, 2000.75, -2.5, -15.6822, 1250.25, "com número"],
        ["f3", 1234.5678, 1000.25, 2000.75, -2.5, -15.6822, 1250.25, "com número"],
      ]);
      expect(linhas.map((l) => [l.emitido_em, l.cutoff, l.sha256])).toEqual([
        ["2026-10-14T12:34:56Z", "2026-10-14T10:00:00Z", "a".repeat(64)],
        ["2026-10-14T12:34:56Z", "2026-10-14T10:00:00Z", "a".repeat(64)],
        ["2026-10-14T12:34:56Z", "2026-10-14T10:00:00Z", "a".repeat(64)],
      ]);
    }
    expect(brutas).toEqual(antes);
  });

  const linha: LinhaArquivo = {
    id: "f1", linha: "Linha sintética", forecast_id: "f1", run_id: "r1", tipo: "publicação", modelo: "B0", versao_modelo: "v1",
    origem: "2026-10-14", cutoff: "2026-10-14T10:00:00Z", prazo: "2026-10-14T11:00:00Z", emitido_em: "2026-10-14T12:34:56Z",
    emitido: "literal não usado", atraso_min: 1234, atraso_origem: "registrado", modo: "manual", horizonte: "W1", entrega: "W2026-10-17",
    submercado: "SE", sm: "SE/CO", status: "DISPONIVEL", com_numero: "com número", previsao: 1234.5678, p10: null, p90: null,
    mudanca: null, motivo: "", realizado: 1250, erro: null, sha256: "a".repeat(64), versao_codigo: "v1",
    registrado_no_portal_em: "2026-10-14", transcrito: "não", alertas: "", substitui: "", anterior: "",
  };
  const linhas = congelar([linha, { ...linha, id: "f2", forecast_id: "f2", run_id: "r2", origem: "2026-10-15", atraso_min: 2678 }]);

  it("encaminha idioma a duas rodadas sem passar o índice de map como idioma", () => {
    const pt = "Ao fim de 16/10/2026, o arquivo tinha 2 registros (de 1.234 no arquivo completo) de 2 rodadas. A rodada de 14/10/2026 (B0, publicação), emitida 1.234 minutos depois do prazo, tem 1 número. A rodada de 15/10/2026 (B0, publicação), emitida 2.678 minutos depois do prazo, tem 1 número. 2 de 2 previsões com número já têm realizado.";
    const en = "Ao fim de 16/10/2026, o arquivo tinha 2 registros (de 1,234 no arquivo completo) de 2 rodadas. A rodada de 14/10/2026 (B0, publicação), emitida 1,234 minutos depois do prazo, tem 1 número. A rodada de 15/10/2026 (B0, publicação), emitida 2,678 minutos depois do prazo, tem 1 número. 2 de 2 previsões com número já têm realizado.";
    expect(respostaP015(linhas, "2026-10-16", 1234)).toBe(pt);
    expect(respostaP015(linhas, "2026-10-16", 1234, "pt")).toBe(pt);
    expect(respostaP015(linhas, "2026-10-16", 1234, "en")).toBe(en);
    const vereditoPt = "Ao fim de 16/10/2026, o arquivo tinha 2 registros (de 1.234 no arquivo completo) de 2 rodadas; todas têm número. 2 de 2 previsões com número já têm resultado.";
    expect(vereditoP015(linhas, "2026-10-16", 1234)).toBe(vereditoPt);
    expect(vereditoP015(linhas, "2026-10-16", 1234, "pt")).toBe(vereditoPt);
    expect(vereditoP015(linhas, "2026-10-16", 1234, "en")).toBe("Ao fim de 16/10/2026, o arquivo tinha 2 registros (de 1,234 no arquivo completo) de 2 rodadas; todas têm número. 2 de 2 previsões com número já têm resultado.");
  });

  it.each(["pt", "en"] as const)("preserva ausência e data civil em %s", (idioma) => {
    for (const responder of [respostaP015, vereditoP015]) {
      expect(responder([], "2026-10-16", 1234, idioma)).toBe("Nenhum registro estava no arquivo ao fim de 16/10/2026.");
      expect(responder([], "", 1234, idioma)).toBe("O arquivo de emissões não tem registro publicado.");
    }
  });

  it("agrupa registros, rodadas e números acima de mil sem alterar contagens brutas", () => {
    const muitas = congelar(Array.from({ length: 2001 }, (_, i): LinhaArquivo => ({
      ...linha, id: `f${i}`, forecast_id: `f${i}`, run_id: i <= 1000 ? "grande" : `rodada-${i}`,
    })));
    const pt = respostaP015(muitas, "", 2001, "pt");
    const en = respostaP015(muitas, "", 2001, "en");
    expect(pt.startsWith("O arquivo tem 2.001 registros de 1.001 rodadas. A rodada de 14/10/2026 (B0, publicação), emitida 1.234 minutos depois do prazo, tem 1.001 números.")).toBe(true);
    expect(en.startsWith("O arquivo tem 2,001 registros de 1,001 rodadas. A rodada de 14/10/2026 (B0, publicação), emitida 1,234 minutos depois do prazo, tem 1,001 números.")).toBe(true);
    expect(vereditoP015(muitas, "", 2001, "pt")).toBe("O arquivo tem 2.001 registros de 1.001 rodadas; todas têm número. 2001 de 2001 previsões com número já têm resultado.");
    expect(vereditoP015(muitas, "", 2001, "en")).toBe("O arquivo tem 2,001 registros de 1,001 rodadas; todas têm número. 2001 de 2001 previsões com número já têm resultado.");
    expect(pt.endsWith(" 2001 de 2001 previsões com número já têm realizado.")).toBe(true);
    expect(en.endsWith(" 2001 de 2001 previsões com número já têm realizado.")).toBe(true);
    expect(muitas).toHaveLength(2001);
    expect(new Set(muitas.map((l) => l.run_id)).size).toBe(1001);
    expect(muitas.filter((l) => l.run_id === "grande")).toHaveLength(1001);
    expect(muitas.every((l) => l.previsao === 1234.5678 && l.realizado === 1250 && l.atraso_min === 1234)).toBe(true);
  });
});

const ficha = congelar<Ficha>({
  codigo: "C2-P", nome: "Ficha sintética", versao: "v1", estado: "PESQUISA", papel: null, implementado_no_repositorio: true,
  motivo_sem_implementacao: null, entradas: [], formula: null, transformacoes: [], configuracao: null,
  coeficientes_ultimo_ajuste: {
    variaveis: [{ id: "d7_menos_b0", rotulo: "Média dos 7 dias menos B0" }], leitura: "Fixture",
    segmentos: ([1234.5678, 12, "ZERO", null, "1234.5678"] as const).map((lambda, i) => ({
      horizonte: (["W1", "W2", "W3", "W4", "M1"] as const)[i], submercado: "SE", origem_ajuste: "2026-10-14",
      ok: true, motivo: null, lambda, entregas_treino: 1234, coeficientes: { d7_menos_b0: 1234.567 },
    })),
  },
  corte: "Fixture", hipoteses: [], aprovacao: { estado: "PESQUISA", promovido_em: null, referencia_experimental: false, leitura: "Fixture" },
  limitacoes: [], falhas_conhecidas: [], implementacao: null, reproducao: null,
});

describe("coeficientes e retenção de desempenho", () => {
  it("localiza lambda numérico, preserva strings e todos os demais campos", () => {
    const pt = linhasCoeficientes([ficha], "pt");
    const en = linhasCoeficientes([ficha], "en");
    expect(linhasCoeficientes([ficha])).toEqual(pt);
    const ptEsperado = ["1.234,568", "12", "zero (correção desligada)", "sem ajuste", "1234.5678"];
    const enEsperado = ["1,234.568", "12", "zero (correção desligada)", "sem ajuste", "1234.5678"];
    const camposPt = pt.map(({ lambda, ...campos }, i) => { expect(lambda).toBe(ptEsperado[i]); return campos; });
    const camposEn = en.map(({ lambda, ...campos }, i) => { expect(lambda).toBe(enEsperado[i]); return campos; });
    expect(camposEn).toEqual(camposPt);
    expect(pt.map((l) => [l.segmento, l.d7_menos_b0, l.entregas_treino])).toEqual([
      ["W1-SE", 1234.567, 1234], ["W2-SE", 1234.567, 1234], ["W3-SE", 1234.567, 1234], ["W4-SE", 1234.567, 1234], ["M1-SE", 1234.567, 1234],
    ]);
  });

  it("encaminha idioma ao coeficiente, lambda, treino e achado acima de um", () => {
    const pt = 'No ajuste de 14/10/2026 para W1, Sudeste/Centro-Oeste: no C2-P, o maior peso é o da variável "Média dos 7 dias menos B0" (1.234,57), com λ 1.234,568 e 1.234 entregas de treino. Coeficiente da média dos 7 dias menos B0 acima de 1 (C2-P: 1.234,57): a correção amplia o desvio recente em vez de reduzi-lo.';
    expect(textoCoeficientes([ficha], "W1-SE")).toBe(pt);
    expect(textoCoeficientes([ficha], "W1-SE", "pt")).toBe(pt);
    expect(textoCoeficientes([ficha], "W1-SE", "en")).toBe('No ajuste de 14/10/2026 para W1, Sudeste/Centro-Oeste: no C2-P, o maior peso é o da variável "Média dos 7 dias menos B0" (1,234.57), com λ 1,234.568 e 1,234 entregas de treino. Coeficiente da média dos 7 dias menos B0 acima de 1 (C2-P: 1,234.57): a correção amplia o desvio recente em vez de reduzi-lo.');
  });

  it("agrupa origens sem liberar desempenho retido nem alterar a decisão", () => {
    const g = congelar<Parameters<typeof respostaP016>[0]>({
      desempenho: { publicado: false, motivo: "Retido", calculado: "interno" },
      publicacao_desempenho: { estado: "RETIDA", publicado: false, regra: "Fixture", decisao: null, motivo: "Retido",
        interpretacao_do_implementador: "Fixture", para_liberar: "Decisão", arquivos_retirados_do_portal: [] },
      validacoes: [{ nome: "A", resultado: "aprovado", detalhe: "Fixture" }, { nome: "B", resultado: "ressalva", detalhe: "Fixture" }],
      dados: {
        instante_informacao: "2026-10-14T12:00:00Z", ultimo_dia_pld: "2026-10-14", origens: { inicio: "2023-01-01", fim: "2026-10-14", n: 1234 },
        snapshots: {}, revisoes_hidrologia: {},
        dicionarios_ons: {
          ear: { url: "", sha256: null, capturado_em: null, arquivo: null, campos: null, leitura: "Fixture" },
          ena: { url: "", sha256: null, capturado_em: null, arquivo: null, campos: null, leitura: "Fixture" },
        },
        ultima_entrega_apurada_teste: null, linhas_csv: { semanal: 0, mensal: 0 }, ultimo_dia_ear: null, ultimo_dia_ena: null,
        configuracao_sha256: "fixture", configuracao_registrada_sha256: null,
      },
      prospectivo: {
        rodadas: [], total_rodadas: 0, registros: 0, registros_por_tipo: { PUBLICACAO: 0, RODADA_INTERNA: 0, REFERENCIA_EXPERIMENTAL: 0 },
        apuracoes: [], apuracoes_total: 0, metricas: null, leitura: "Fixture", revisoes_entre_rodadas: [],
        reexecucao: { conferidas: 0, divergentes: [], tolerancia: "Fixture" },
        calibracao_regra_antiga: { descricao: "Fixture", rodadas: [], registros: 0, cobertura_diferente: 0, status_diferente: 0, por_registro: [] },
      },
      definicoes: {
        alvo: "", realizado: "", entregas: "", conhecido_no_corte: "", corte_operacional: "", cenario_de_elegibilidade: "", quantis: "",
        erro: "", ganho: "", perda_quantilica: "", cobertura: "", calibracao: "com pelo menos 100 entregas distintas",
        periodos: { desenvolvimento: "", teste: "", fronteira: "" },
      },
    });
    const antes = structuredClone(g);
    const pt = "Ainda não é possível responder no portal. O teste retrospectivo fora da amostra está calculado (1.234 origens diárias de 01/01/2023 a 14/10/2026; 1 de 2 controles aprovados), mas os números de desempenho ficam retidos até a liberação formal pelo responsável pela plataforma, ainda não registrada. O acompanhamento prospectivo ainda não tem previsão com número.";
    expect(respostaP016(g)).toBe(pt);
    expect(respostaP016(g, "pt")).toBe(pt);
    expect(respostaP016(g, "en")).toBe("Ainda não é possível responder no portal. O teste retrospectivo fora da amostra está calculado (1,234 origens diárias de 01/01/2023 a 14/10/2026; 1 de 2 controles aprovados), mas os números de desempenho ficam retidos até a liberação formal pelo responsável pela plataforma, ainda não registrada. O acompanhamento prospectivo ainda não tem previsão com número.");
    expect(g).toEqual(antes);
  });
});

describe("riscos-formato: arredondamento e sinais próprios", () => {
  it.each([
    [1234.567, "1.234,57", "1,234.57"], [12, "12", "12"], [1.005, "1,01", "1.01"], [-1.005, "-1,01", "-1.01"],
    [-0, "0", "0"], [-0.004, "0", "0"], [NaN, "NaN", "NaN"], [Infinity, "∞", "∞"], [-Infinity, "-∞", "-∞"],
  ] as const)("conserva precisão variável, EPSILON e política de zero para %s", (v, pt, en) => {
    expect(fmt(v, 2)).toBe(pt);
    expect(fmt(v, 2, "pt")).toBe(pt);
    expect(fmt(v, 2, "en")).toBe(en);
  });
  it("mantém uma casa por default e espaço comum na representação em milhões", () => {
    expect([fmt(1234.56), fmt(1234.56, undefined, "pt"), fmt(1234.56, undefined, "en")]).toEqual(["1.234,6", "1.234,6", "1,234.6"]);
    expect([milhoes(1234567890), milhoes(-1234567890), milhoes(12000000)]).toEqual(["R$ 1.234,57 mi", "R$ -1.234,57 mi", "R$ 12 mi"]);
    expect([milhoes(1234567890, "pt"), milhoes(-1234567890, "pt"), milhoes(12000000, "pt")]).toEqual(["R$ 1.234,57 mi", "R$ -1.234,57 mi", "R$ 12 mi"]);
    expect([milhoes(1234567890, "en"), milhoes(-1234567890, "en"), milhoes(12000000, "en")]).toEqual(["R$ 1,234.57 mi", "R$ -1,234.57 mi", "R$ 12 mi"]);
  });
});

describe("ponte e pico adjacentes ao painel PLD", () => {
  const ponte = congelar({ horas: 10000, horas_separadas: 1200, frac: 0.12 });
  const basePt = "Aqui conta só a hora em que o maior e o menor preço diferem em mais de R$\u00a01,00/MWh. A página Diferenças regionais conta toda hora com diferença acima de R$\u00a00,01/MWh";
  const baseEn = "Aqui conta só a hora em que o maior e o menor preço diferem em mais de R$1.00/MWh. A página Diferenças regionais conta toda hora com diferença acima de R$0.01/MWh";
  it("mantém os dois critérios, NBSP, contagens e uma multiplicação percentual", () => {
    expect(textoPonteLimiar(1, ponte)).toBe(`${basePt}: neste período, 1.200 horas de 10.000 (12,0%).`);
    expect(textoPonteLimiar(1, ponte, "pt")).toBe(`${basePt}: neste período, 1.200 horas de 10.000 (12,0%).`);
    expect(textoPonteLimiar(1, ponte, "en")).toBe(`${baseEn}: neste período, 1,200 horas de 10,000 (12.0%).`);
    expect(textoPonteLimiar(1, { horas: 1, horas_separadas: 1, frac: 1 }, "en")).toBe(`${baseEn}: neste período, 1 hora de 1 (100.0%).`);
  });
  it.each([null, undefined, { horas: 10000, horas_separadas: 0, frac: null }])("não inventa fração para %s", (ausente) => {
    expect(textoPonteLimiar(1, ausente, "pt")).toBe(`${basePt}.`);
    expect(textoPonteLimiar(1, ausente, "en")).toBe(`${baseEn}.`);
  });
  const regimes = congelar<RegimeLimites[]>([{
    inicio: "2026-01-01", fim: "2026-12-31", pld_min: 1, pld_max_horario: 1234.5, pld_max_estrutural: 1000,
    ato_pld_min: null, ato_pld_max_horario: null, ato_pld_max_estrutural: null,
  }]);
  it("formata o teto somente quando coincide em centavos na data vigente", () => {
    expect(textoPicoFrenteAoLimite(1234.504, "2026-10-14T09:00", regimes)).toBe("igual ao teto horário vigente na data (R$\u00a01.234,50/MWh)");
    expect(textoPicoFrenteAoLimite(1234.504, "2026-10-14T09:00", regimes, "pt")).toBe("igual ao teto horário vigente na data (R$\u00a01.234,50/MWh)");
    expect(textoPicoFrenteAoLimite(1234.504, "2026-10-14T09:00", regimes, "en")).toBe("igual ao teto horário vigente na data (R$1,234.50/MWh)");
    for (const idioma of ["pt", "en"] as const) {
      expect(textoPicoFrenteAoLimite(1234.51, "2026-10-14", regimes, idioma)).toBeNull();
      expect(textoPicoFrenteAoLimite(1234.5, "2027-01-01", regimes, idioma)).toBeNull();
      expect(textoPicoFrenteAoLimite(null, "2026-10-14", regimes, idioma)).toBeNull();
      expect(textoPicoFrenteAoLimite(1234.5, undefined, regimes, idioma)).toBeNull();
      expect(textoPicoFrenteAoLimite(1234.5, "2026-10-14", [{ ...regimes[0], pld_max_horario: null }], idioma)).toBeNull();
    }
  });
});
