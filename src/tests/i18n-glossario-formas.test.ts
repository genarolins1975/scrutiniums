import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lerGlossario } from "../../scripts/i18n/glossario.mjs";
import { criarContextoProdutos, REGISTRO_PRODUTOS } from "../../scripts/i18n/produtos.mjs";

const FORMAS_REAIS = {
  "estatistica.base_dados": {
    pt: "base de dados", en: "database",
    formas: { home_oficiais_plural: { pt: "bases oficiais", en: "official databases" } },
  },
  "estatistica.fonte_dados": {
    pt: "fonte de dados", en: "data source",
    formas: {
      home_curta: { pt: "fonte", en: "data source" },
      home_curta_inicial: { pt: "Fonte", en: "Data source" },
    },
  },
  "estatistica.periodo_referencia": {
    pt: "período de referência", en: "reference period",
    formas: { home_curta: { pt: "período", en: "reference period" } },
  },
  "federativo.estado": {
    pt: "estado", en: "state",
    formas: { plural: { pt: "estados", en: "states" } },
  },
  "fiscal.contas_publicas": {
    pt: "contas públicas", en: "public accounts",
    formas: { home_curta: { pt: "contas", en: "public accounts" } },
  },
  "saneamento.saneamento_basico": {
    pt: "saneamento básico", en: "basic sanitation",
    formas: { home_curta: { pt: "saneamento", en: "basic sanitation" } },
  },
};

function forma() {
  return { pt: "formas", en: "forms", contexto: "Plural sintético restrito a este teste." };
}

function glossario(formas?: unknown) {
  return {
    schema_version: 1,
    fontes: {
      bcb_fixture: {
        orgao: "BCB",
        titulo: "Synthetic publication",
        url: "https://www.bcb.gov.br/en/publications/fixture.pdf",
        idioma: "en",
        formato: "pdf",
        sha256_consultado: "ab".repeat(32),
      },
    },
    entradas: {
      "teste.termo": {
        tipo: "termo",
        pt: "  termo sintético  ",
        en: "  Synthetic term  ",
        contexto: " Contexto canônico – mantido. ",
        nota: " Nota original — preservada. ",
        evidencias: [{
          fonte: "bcb_fixture",
          trecho: "  Exact quotation – source wording — unchanged.\nSecond line.  ",
          localizacao: "  Synthetic section  ",
          pagina: 3,
        }],
        ...(formas === undefined ? {} : { formas_contextuais: formas }),
      },
    },
    pendencias: [],
  };
}

const ler = (g: unknown, contexto?: Parameters<typeof lerGlossario>[1]) => lerGlossario(JSON.stringify(g), contexto);

describe("formas contextuais documentadas do glossário", () => {
  it("registra exatamente sete pares em seis termos reais, preservando seus pares canônicos", () => {
    const raiz = fileURLToPath(new URL("../../", import.meta.url));
    const resultado = lerGlossario(readFileSync(join(raiz, "config/glossario-en.json"), "utf8"), criarContextoProdutos(raiz));
    const formas = Object.fromEntries(Object.entries(resultado.entradas).flatMap(([id, entrada]) => {
      if (entrada.tipo !== "termo" || entrada.formas_contextuais === undefined) return [];
      return [[id, {
        pt: entrada.pt,
        en: entrada.en,
        formas: Object.fromEntries(Object.entries(entrada.formas_contextuais).map(([nome, f]) => [nome, { pt: f.pt, en: f.en }])),
      }]];
    }));
    expect(formas).toStrictEqual(FORMAS_REAIS);
  });

  it("mantém a forma canônica suficiente quando o campo opcional não existe", () => {
    const g = glossario();
    expect(ler(g)).toStrictEqual(g);
    expect(ler(g).entradas["teste.termo"]).not.toHaveProperty("formas_contextuais");
  });

  it("preserva textos, fontes, evidências e notas sem aparar, mudar caixa ou normalizar acentos", () => {
    const f = { pt: "  Formas cafe\u0301 – literais  ", en: "  Synthetic term  ", contexto: "\tContexto — literal.\n" };
    const g = glossario({ curta: f, curta_2: { ...f } });
    // Dois nomes podem ter o mesmo par, inclusive o inglês canônico, sem deduplicação.
    expect(ler(g)).toStrictEqual(g);
  });

  it.each([{}, [], null, "plural"].map((formas) => ({ formas })))("rejeita mapa vazio ou de tipo inválido: $formas", ({ formas }) => {
    expect(() => ler(glossario(formas))).toThrow();
  });

  it.each(["canonica", "Plural", "1plural", "forma-invalida", "forma.outra", "plurál", "", " plural"])(
    "rejeita nome de forma inválido ou reservado: %j", (nome) => {
      expect(() => ler(glossario({ [nome]: forma() }))).toThrow();
    },
  );

  const camposInvalidos = (["pt", "en", "contexto"] as const).flatMap((campo) =>
    [undefined, "", " \t\n ", 4].map((valor) => ({ campo, valor })),
  );
  it.each(camposInvalidos)("exige texto não vazio em $campo: $valor", ({ campo, valor }) => {
    expect(() => ler(glossario({ plural: { ...forma(), [campo]: valor } }))).toThrow();
  });

  it.each([
    null,
    "forms",
    [],
    { ...forma(), alias: "alternative" },
    { ...forma(), evidencias: [] },
    { ...forma(), nota: "Não pertence à forma." },
  ].map((f) => ({ f })))("rejeita forma que não é o objeto estrito pt/en/contexto: $f", ({ f }) => {
    expect(() => ler(glossario({ plural: f }))).toThrow();
  });

  it.each(["–", "—"])("rejeita %s no inglês publicável da forma", (traco) => {
    expect(() => ler(glossario({ plural: { ...forma(), en: `Synthetic ${traco} forms` } }))).toThrow();
  });

  it("não permite formas contextuais em nome próprio institucional", () => {
    const g = glossario();
    const nome = {
      tipo: "nome_proprio", pt: "Programa Sintético", en: "Programa Sintético",
      contexto: "Nome próprio preservado.", explicacao_en: "Synthetic program.",
      evidencias: g.entradas["teste.termo"].evidencias,
    };
    const valido = { ...g, entradas: { "nome.programa": nome } };
    expect(ler(valido)).toStrictEqual(valido);
    expect(() => ler({ ...valido, entradas: { "nome.programa": { ...nome, formas_contextuais: { plural: forma() } } } })).toThrow();
  });

  it("não permite formas contextuais em produto com origem canônica válida", () => {
    const g = glossario();
    const nome = {
      tipo: "nome_proprio_produto", pt: "Produto Sintético", en: "Produto Sintético",
      contexto: "Nome do produto preservado.", explicacao_en: "Synthetic product.",
      origem_nome: { arquivo: REGISTRO_PRODUTOS, id: "sintetico", campo: "nomeCurto" },
      evidencias_explicacao: g.entradas["teste.termo"].evidencias,
    };
    const contexto = { carregarProdutos: () => ({ arquivo: REGISTRO_PRODUTOS, nomes: new Map([["sintetico", nome.pt]]) }) };
    const valido = { ...g, entradas: { "nome.observatorio_sintetico": nome } };
    expect(ler(valido, contexto)).toStrictEqual(valido);
    expect(() => ler({ ...valido, entradas: { "nome.observatorio_sintetico": { ...nome, formas_contextuais: { plural: forma() } } } }, contexto)).toThrow();
  });

  it.each(["plural", "\\u0070lural"])("rejeita chave bruta duplicada de forma, inclusive escape equivalente: %s", (chave) => {
    const f = JSON.stringify(forma());
    const original = JSON.stringify({ plural: forma() });
    const duplicado = `{"plural":${f},"${chave}":${f}}`;
    const bruto = JSON.stringify(glossario({ plural: forma() })).replace(original, duplicado);
    expect(() => lerGlossario(bruto)).toThrow("Chave JSON duplicada");
  });

  it.each(["pt", "\\u0070t"])("rejeita chave bruta duplicada dentro da forma: %s", (chave) => {
    const original = JSON.stringify(forma());
    const duplicado = original.replace('"pt":"formas"', `"pt":"formas","${chave}":"formas"`);
    const bruto = JSON.stringify(glossario({ plural: forma() })).replace(original, duplicado);
    expect(() => lerGlossario(bruto)).toThrow("Chave JSON duplicada");
  });
});
