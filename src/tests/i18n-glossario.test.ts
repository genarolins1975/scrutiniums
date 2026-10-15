import { describe, expect, it } from "vitest";
import { lerGlossario } from "../../scripts/i18n/glossario.mjs";

function evidencia() {
  return {
    fonte: "bcb_fixture",
    trecho: "  Synthetic quotation – source wording — kept verbatim.\nSecond line.  ",
    localizacao: "Synthetic section, first paragraph",
    pagina: 4,
  };
}

function pendencia() {
  return {
    id: "teste.pendente",
    pt: "Termo pendente",
    contexto: "Contexto sintético da pendência.",
    motivo: "Fonte inglesa ainda não conferida.",
    origens: ["src/fixture.ts:12"],
    depende_de: "pesquisa",
  };
}

function glossario() {
  return {
    schema_version: 1,
    fontes: {
      bcb_fixture: {
        orgao: "BCB",
        titulo: "Synthetic test publication",
        url: "https://www.bcb.gov.br/en/publications/test-fixture.pdf",
        url_pt: "https://www.bcb.gov.br/publicacoes/fixture",
        idioma: "en",
        formato: "pdf",
        sha256_consultado: "a1".repeat(32),
      },
    },
    entradas: {
      "teste.termo": {
        tipo: "termo",
        pt: "Termo sintético",
        en: "  Synthetic term  ",
        contexto: "Contexto sintético, sem validação de tradução.",
        evidencias: [evidencia()],
        nota: "Nota sintética.",
      },
      "teste.nome": {
        tipo: "nome_proprio",
        pt: "Programa Sintético",
        en: "Programa Sintético",
        explicacao_en: "Synthetic proper name used only by this test.",
        formas_preservadas: ["Programa Sintético", "PS"],
        contexto: "Nome próprio mantido como publicado.",
        evidencias: [evidencia()],
      },
    },
    pendencias: [pendencia()],
  };
}

type Fixture = ReturnType<typeof glossario>;
type Alteracao = (g: Fixture) => void;
const ler = (g: unknown) => lerGlossario(JSON.stringify(g));

describe("contrato offline do glossário inglês", () => {
  it("devolve o objeto completo sem normalizar textos, citações ou nomes próprios", () => {
    const entrada = glossario();
    const resultado = ler(entrada);
    expect(resultado).toStrictEqual(entrada);
    expect(resultado.entradas["teste.termo"].en).toBe("  Synthetic term  ");
    const termo = resultado.entradas["teste.termo"];
    if (termo.tipo !== "termo") throw new Error("A fixture deve continuar sendo um termo documentado.");
    expect(termo.evidencias[0].trecho).toBe(evidencia().trecho);
  });

  it("aceita evidência HTML sem inventar página e pendência do mantenedor", () => {
    const g = glossario();
    g.fontes.bcb_fixture.formato = "html";
    g.fontes.bcb_fixture.url = "https://www.bcb.gov.br/en/publications/test-fixture";
    for (const entrada of Object.values(g.entradas)) Reflect.deleteProperty(entrada.evidencias[0], "pagina");
    g.pendencias[0].depende_de = "mantenedor";
    expect(ler(g)).toStrictEqual(g);
  });

  it.each([
    ["no topo", '"schema_version":1', '"schema_version":1,"schema_version":1'],
    ["na fonte", '"orgao":"BCB"', '"orgao":"BCB","orgao":"BCB"'],
    ["com escape equivalente", '"pt":"Termo sintético"', '"pt":"Termo sintético","\\u0070t":"Termo sintético"'],
    ["na evidência", '"pagina":4', '"pagina":4,"pagina":4'],
  ])("rejeita chave JSON duplicada %s, mesmo quando os valores coincidem", (_, chave, duplicada) => {
    const texto = JSON.stringify(glossario()).replace(chave, duplicada);
    expect(() => lerGlossario(texto)).toThrow();
  });

  it.each(["{", "null", "[]", '{"schema_version":1,}'])("rejeita JSON malformado ou raiz inválida: %s", (texto) => {
    expect(() => lerGlossario(texto)).toThrow();
  });

  const camposDesconhecidos: [string, Alteracao][] = [
    ["topo", (g) => { Object.assign(g, { extra: true }); }],
    ["fonte", (g) => { Object.assign(g.fontes.bcb_fixture, { extra: true }); }],
    ["entrada", (g) => { Object.assign(g.entradas["teste.termo"], { extra: true }); }],
    ["evidência", (g) => { Object.assign(g.entradas["teste.termo"].evidencias[0], { extra: true }); }],
    ["pendência", (g) => { Object.assign(g.pendencias[0], { extra: true }); }],
  ];
  it.each(camposDesconhecidos)("rejeita campo desconhecido em %s", (_, alterar) => {
    const g = glossario();
    alterar(g);
    expect(() => ler(g)).toThrow();
  });

  const contratosInvalidos: [string, Alteracao][] = [
    ["versão desconhecida", (g) => { g.schema_version = 2; }],
    ["idioma da fonte diferente de inglês", (g) => { g.fontes.bcb_fixture.idioma = "pt"; }],
    ["hash incompleto", (g) => { g.fontes.bcb_fixture.sha256_consultado = "a1"; }],
    ["hash em maiúsculas", (g) => { g.fontes.bcb_fixture.sha256_consultado = "A1".repeat(32); }],
    ["ID de fonte inválido", (g) => { Object.assign(g.fontes, { "Fonte-Invalida": g.fontes.bcb_fixture }); }],
    ["ID de entrada sem domínio", (g) => { Object.assign(g.entradas, { invalido: g.entradas["teste.termo"] }); }],
    ["entrada sem evidência", (g) => { g.entradas["teste.termo"].evidencias = []; }],
    ["referência a fonte inexistente", (g) => { g.entradas["teste.termo"].evidencias[0].fonte = "fonte_ausente"; }],
    ["nome próprio traduzido", (g) => { g.entradas["teste.nome"].en = "Synthetic Program"; }],
    ["nome próprio sem explicação", (g) => { Reflect.deleteProperty(g.entradas["teste.nome"], "explicacao_en"); }],
    ["termo com explicação exclusiva de nome próprio", (g) => { Object.assign(g.entradas["teste.termo"], { explicacao_en: "Synthetic explanation." }); }],
    ["termo com formas preservadas", (g) => { Object.assign(g.entradas["teste.termo"], { formas_preservadas: ["Termo sintético"] }); }],
  ];
  it.each(contratosInvalidos)("rejeita %s", (_, alterar) => {
    const g = glossario();
    alterar(g);
    expect(() => ler(g)).toThrow();
  });

  it.each([undefined, 0, -1, 1.5, "4"])("PDF exige página inteira positiva, recebido %s", (pagina) => {
    const g = glossario();
    Object.assign(g.entradas["teste.termo"].evidencias[0], { pagina });
    expect(() => ler(g)).toThrow();
  });

  it.each([
    "http://www.bcb.gov.br/en/publications/test-fixture.pdf",
    "https://www.bcb.gov.br.example.org/test.pdf",
    "https://bcb.gov.br@attacker.example/test.pdf",
    "https://reader:password@www.bcb.gov.br/test.pdf",
    "https://www.ibge.gov.br/en/test.pdf",
  ])("rejeita URL incompatível com fonte BCB: %s", (url) => {
    const g = glossario();
    g.fontes.bcb_fixture.url = url;
    expect(() => ler(g)).toThrow();
  });

  it("confere o órgão também na URL portuguesa opcional", () => {
    const g = glossario();
    g.fontes.bcb_fixture.url_pt = "https://www.ibge.gov.br/fixture";
    expect(() => ler(g)).toThrow();
  });

  it("aceita gov.br somente sob o prefixo completo do órgão", () => {
    const g = glossario();
    Object.assign(g.fontes.bcb_fixture, {
      orgao: "ANP",
      url: "https://www.gov.br/anp/en/test-fixture.pdf",
      url_pt: "https://www.gov.br/anp/pt-br/fixture",
    });
    expect(ler(g)).toStrictEqual(g);
    for (const url of ["https://www.gov.br/aneel/en/test.pdf", "https://www.gov.br/anp-falso/en/test.pdf"]) {
      g.fontes.bcb_fixture.url = url;
      expect(() => ler(g)).toThrow();
    }
  });

  const textosVazios: [string, Alteracao][] = [
    ["termo inglês", (g) => { g.entradas["teste.termo"].en = " \t\n "; }],
    ["termo português", (g) => { g.entradas["teste.termo"].pt = ""; }],
    ["contexto", (g) => { g.entradas["teste.termo"].contexto = " \n "; }],
    ["citação", (g) => { g.entradas["teste.termo"].evidencias[0].trecho = " \t "; }],
    ["origem da pendência", (g) => { g.pendencias[0].origens = [" "]; }],
  ];
  it.each(textosVazios)("rejeita %s vazio ou composto somente por whitespace", (_, alterar) => {
    const g = glossario();
    alterar(g);
    expect(() => ler(g)).toThrow();
  });

  it.each(["–", "—"])("rejeita %s no inglês editorial e preserva esse caractere na citação", (traco) => {
    const g = glossario();
    g.entradas["teste.termo"].evidencias[0].trecho = `Original ${traco} quotation.`;
    expect(ler(g)).toStrictEqual(g);
    g.entradas["teste.termo"].en = `Synthetic ${traco} term`;
    expect(() => ler(g)).toThrow();
    g.entradas["teste.termo"].en = "Synthetic term";
    g.entradas["teste.nome"].explicacao_en = `Synthetic ${traco} explanation.`;
    expect(() => ler(g)).toThrow();
  });

  const pendenciasInvalidas: [string, Alteracao][] = [
    ["ID repetido", (g) => { g.pendencias.push(pendencia()); }],
    ["ID já traduzido", (g) => { g.pendencias[0].id = "teste.termo"; }],
    ["tradução inglesa", (g) => { Object.assign(g.pendencias[0], { en: "Pending term" }); }],
    ["nenhuma origem", (g) => { g.pendencias[0].origens = []; }],
    ["dependência desconhecida", (g) => { g.pendencias[0].depende_de = "automatico"; }],
  ];
  it.each(pendenciasInvalidas)("rejeita pendência com %s", (_, alterar) => {
    const g = glossario();
    alterar(g);
    expect(() => ler(g)).toThrow();
  });
});
