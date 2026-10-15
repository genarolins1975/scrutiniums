import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { formatarLocalNativo } from "@/lib/format";

const troca = vi.hoisted(() => {
  const estado: {
    caminho: string | null;
    resposta: { tipo: "texto"; texto: string } | { tipo: "erro"; erro: Error } | null;
    leituras: number;
  } = { caminho: null, resposta: null, leituras: 0 };
  return estado;
});
// Só o arquivo nomeado é interceptado; parser, formatadores e demais I/O são reais.
vi.mock("node:fs", async (original) => {
  const modulo = await original<typeof import("node:fs")>();
  return { ...modulo, readFileSync: (...args: Parameters<typeof modulo.readFileSync>) => {
    const [caminho, opcoes] = args;
    if (caminho !== troca.caminho || troca.resposta === null) return modulo.readFileSync(...args);
    troca.leituras += 1;
    if (troca.resposta.tipo === "erro") throw troca.resposta.erro;
    const bytes = Buffer.from(troca.resposta.texto, "utf8");
    const encoding = typeof opcoes === "string" ? opcoes : opcoes?.encoding;
    return encoding ? bytes.toString(encoding) : bytes;
  } };
});

import { atualizacaoObservatorio } from "@/lib/atualizacaoObservatorios";

const arquivo = join(process.cwd(), "public", "saneamento", "gold", "meta.json");
const bytesOriginais = readFileSync(arquivo);
troca.caminho = arquivo;
afterAll(() => {
  troca.resposta = null;
  troca.caminho = null;
  expect(readFileSync(arquivo)).toEqual(bytesOriginais);
});

type Json = null | boolean | number | string | Json[] | { [chave: string]: Json };
const campos = ["agua_participantes", "esgoto_participantes", "municipios_censo_2022"] as const;
type Campo = typeof campos[number];
// Entrada da fronteira JSON, sem afirmar que os cenários inválidos são MetaSaneamento.
type Entrada = {
  sinisa: { ano_referencia: number; capturado_em: string; retificacao_agua_municipal: string };
  cobertura: Partial<Record<Campo, Json>>;
};
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
const base = congelar<Entrada>({
  sinisa: { ano_referencia: 2024, capturado_em: "2026-10-14T12:00:00Z", retificacao_agua_municipal: "2026-09-30" },
  cobertura: { agua_participantes: 1234.56789, esgoto_participantes: 0, municipios_censo_2022: 2000 },
});
const indisponivel = { rotulo: "Fontes e cobertura", linhas: ["Dados indisponíveis no momento."] };
function esperado(agua = "1.234,568", esgoto = "0", censo = "2.000") {
  return { rotulo: "Fontes e cobertura", linhas: [
    `SINISA 2025 (ano de referência 2024): ${agua} municípios em água e ${esgoto} com indicadores de esgoto.`,
    `IBGE, Censo 2022 e 2010: ${censo} municípios.`,
    "Captura em 14/10/2026. Base municipal de água retificada em 30/09/2026.",
    "Preço regulado em amostra de atos verificados; capítulos de saúde e desigualdades em preparação.",
  ] };
}
function lerSintetico(resposta: NonNullable<typeof troca.resposta>) {
  troca.resposta = resposta;
  troca.leituras = 0;
  try {
    const resultado = atualizacaoObservatorio("saneamento");
    expect(troca.leituras).toBe(1);
    return resultado;
  } finally {
    troca.resposta = null;
    troca.leituras = 0;
  }
}
function atualizar(entrada: Entrada) {
  const antes = structuredClone(entrada);
  congelar(entrada);
  const resultado = lerSintetico({ tipo: "texto", texto: JSON.stringify(entrada) });
  expect(entrada).toStrictEqual(antes);
  return resultado;
}
function comContagem(campo: Campo, valor: Json | undefined): Entrada {
  const entrada = structuredClone(base);
  if (valor === undefined) delete entrada.cobertura[campo];
  else entrada.cobertura[campo] = valor;
  return entrada;
}

describe("adaptador nativo com idioma", () => {
  it.each([
    [1234.56789, "1.234,568", "1,234.568"],
    [1234, "1.234", "1,234"],
    [-1234.5, "-1.234,5", "-1,234.5"],
    [0, "0", "0"], [-0, "-0", "-0"],
    [NaN, "NaN", "NaN"], [Infinity, "∞", "∞"], [-Infinity, "-∞", "-∞"],
  ] as const)("preserva a precisão nativa e o valor %s", (valor, pt, en) => {
    expect(formatarLocalNativo(valor)).toBe(pt);
    expect(formatarLocalNativo(valor, "pt")).toBe(pt);
    expect(formatarLocalNativo(valor, "en")).toBe(en);
  });

  it("preserva o receptor, o retorno e exatamente um argumento locale", () => {
    const chamadas: { receptor: unknown; argumentos: [locales?: string] }[] = [];
    const valor = Object.freeze({ toLocaleString(...argumentos: [locales?: string]) {
      chamadas.push({ receptor: this, argumentos });
      return "retorno nativo";
    } });
    expect([formatarLocalNativo(valor), formatarLocalNativo(valor, "pt"), formatarLocalNativo(valor, "en")])
      .toEqual(["retorno nativo", "retorno nativo", "retorno nativo"]);
    expect(chamadas.map((chamada) => chamada.argumentos)).toEqual([["pt-BR"], ["pt-BR"], ["en-US"]]);
    for (const chamada of chamadas) expect(chamada.receptor).toBe(valor);
  });
});

describe("atualização do Saneamento: fronteira JSON real", () => {
  it("mantém as quatro frases PT, fração variável, zero, ano e datas", () => {
    expect(atualizar(base)).toStrictEqual(esperado());
  });

  it("formata também esgoto e Censo, sem rejeitar contagens negativas", () => {
    const entrada = structuredClone(base);
    entrada.cobertura = { agua_participantes: 0, esgoto_participantes: -1234.5, municipios_censo_2022: 1234.56789 };
    expect(atualizar(entrada)).toStrictEqual(esperado("0", "-1.234,5", "1.234,568"));
  });

  for (const campo of campos) {
    it.each([null, undefined])("mantém indisponibilidade integral para " + campo + " = %s", (valor) => {
      expect(atualizar(comContagem(campo, valor))).toStrictEqual(indisponivel);
    });
  }

  it.each<{ nome: string; valor: Json; texto: string }>([
    { nome: "string", valor: "1234.5", texto: "1234.5" },
    { nome: "boolean", valor: true, texto: "true" },
    { nome: "objeto", valor: {}, texto: "[object Object]" },
    { nome: "array", valor: [1234.5, null, 2], texto: "1.234,5,,2" },
  ])("preserva o despacho nativo para $nome sem coerção numérica", ({ valor, texto }) => {
    expect(atualizar(comContagem("agua_participantes", valor))).toStrictEqual(esperado(texto));
  });

  it.each(["toLocaleString", "toString"] as const)("preserva o erro de método próprio %s inválido", (metodo) => {
    expect(atualizar(comContagem("agua_participantes", { [metodo]: null }))).toStrictEqual(indisponivel);
  });

  it.each([["1e400", "∞"], ["-0", "-0"]] as const)("preserva o número JSON literal %s", (numeroJson, texto) => {
    // JSON.stringify mudaria Infinity para null e -0 para 0 antes da leitura real.
    const json = `{"sinisa":{"ano_referencia":2024,"capturado_em":"2026-10-14T12:00:00Z","retificacao_agua_municipal":"2026-09-30"},"cobertura":{"agua_participantes":${numeroJson},"esgoto_participantes":0,"municipios_censo_2022":2000}}`;
    expect(lerSintetico({ tipo: "texto", texto: json })).toStrictEqual(esperado(texto));
  });

  it("mantém indisponibilidade integral para sintaxe JSON inválida", () => {
    expect(lerSintetico({ tipo: "texto", texto: '{"sinisa":' })).toStrictEqual(indisponivel);
  });

  it("mantém indisponibilidade integral para erro de leitura", () => {
    expect(lerSintetico({ tipo: "erro", erro: new Error("Falha de leitura sintética") })).toStrictEqual(indisponivel);
  });
});
