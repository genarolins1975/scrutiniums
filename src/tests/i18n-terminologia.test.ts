import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lerCatalogo } from "../../scripts/i18n/catalogo.mjs";
import { lerGlossario } from "../../scripts/i18n/glossario.mjs";
import { criarContextoProdutos, REGISTRO_PRODUTOS } from "../../scripts/i18n/produtos.mjs";
import { assinaturaMensagem, lerTerminologia } from "../../scripts/i18n/terminologia.mjs";

type Catalogo = ReturnType<typeof lerCatalogo>;
type EntradaEn = Catalogo["en"][string];
type Referencia = { id: string; forma: string; ocorrencias: number; explicacao?: "na_mensagem" | "no_glossario" };
type Declaracao =
  | { classificacao: "vinculada"; sha256_revisado: string; referencias: Referencia[] }
  | { classificacao: "sem_termos_tecnicos"; sha256_revisado: string; justificativa: string };
type Contrato = { schema_version: number; mensagens: Record<string, Declaracao> };
type Forma = { pt: string; en: string; contexto: string };
const CHAVE = "teste.mensagem";
const GERAL = "teste.geral";
const EXPLICACAO = "Brazil's federal government";

// Citações e nomes sintéticos só exercitam os contratos; não documentam traduções publicadas.
const evidencia = () => ({ fonte: "fixture", trecho: "Synthetic terminology.", localizacao: "Synthetic section" });
function termo(pt: string, en: string, formas?: Record<string, Forma>) {
  return {
    tipo: "termo", pt, en, contexto: "Conceito sintético.", evidencias: [evidencia()],
    ...(formas ? { formas_contextuais: formas } : {}),
  };
}
function nome(pt = "União", explicacao = EXPLICACAO) {
  return {
    tipo: "nome_proprio", pt, en: pt, contexto: "Nome sintético preservado.",
    explicacao_en: explicacao, evidencias: [evidencia()],
  };
}
function produto() {
  return {
    tipo: "nome_proprio_produto", pt: "Crédito", en: "Crédito",
    origem_nome: { arquivo: REGISTRO_PRODUTOS, id: "sintetico", campo: "nomeCurto" },
    contexto: "Produto sintético.", explicacao_en: "Synthetic credit observatory.",
    evidencias_explicacao: [evidencia()],
  };
}
function glossario(entradas: Record<string, unknown>) {
  return lerGlossario(JSON.stringify({
    schema_version: 1,
    fontes: { fixture: {
      orgao: "IEA", titulo: "Synthetic publication", url: "https://www.iea.org/reports/fixture",
      idioma: "en", formato: "html", sha256_consultado: "ab".repeat(32),
    } },
    entradas,
    pendencias: [{
      id: "teste.pendente", pt: "Conceito pendente", contexto: "Pendência sintética.",
      motivo: "Sem evidência.", origens: ["src/fixture.ts"], depende_de: "pesquisa",
    }],
  }), { carregarProdutos: () => ({ arquivo: REGISTRO_PRODUTOS, nomes: new Map([["sintetico", "Crédito"]]) }) });
}
const forma = (pt: string, en: string): Forma => ({ pt, en, contexto: "Forma contextual sintética." });
const ref = (id = "teste.contas", forma = "curta", ocorrencias = 1): Referencia => ({ id, forma, ocorrencias });
const refNome = (explicacao: Referencia["explicacao"] = "na_mensagem", ocorrencias = 1, id = "nome.uniao"): Referencia =>
  ({ id, forma: "canonica", ocorrencias, explicacao });
const traduzido = (texto: string): Extract<EntradaEn, { estado: "traduzido" }> => ({ estado: "traduzido", texto });
function catalogo(pt: Record<string, string>, en: Record<string, EntradaEn>) {
  return lerCatalogo(`export const pt = ${JSON.stringify(pt)} as const;`, `export const en = ${JSON.stringify(en)} as const;`);
}
function fixture({
  pt = "contas", en = traduzido("public accounts"), referencias = [ref()],
  entradas = { "teste.contas": termo("contas públicas", "public accounts", { curta: forma("contas", "public accounts") }) },
}: { pt?: string; en?: EntradaEn; referencias?: Referencia[]; entradas?: Record<string, unknown> } = {}) {
  const c = catalogo({ [CHAVE]: pt, [GERAL]: "Mensagem simples" }, { [CHAVE]: en, [GERAL]: traduzido("Simple message") });
  const contrato: Contrato = { schema_version: 1, mensagens: {
    [CHAVE]: { classificacao: "vinculada", sha256_revisado: assinaturaMensagem(c.pt[CHAVE], c.en[CHAVE]), referencias },
    [GERAL]: { classificacao: "sem_termos_tecnicos", sha256_revisado: assinaturaMensagem(c.pt[GERAL], c.en[GERAL]), justificativa: "Prosa comum sintética." },
  } };
  return { catalogo: c, glossario: glossario(entradas), contrato };
}
type Fixture = ReturnType<typeof fixture>;
function vinculada(f: Fixture) {
  const d = f.contrato.mensagens[CHAVE];
  if (d.classificacao !== "vinculada") throw new Error("Fixture sem referências");
  return d;
}
const ler = (f: Fixture) => lerTerminologia(JSON.stringify(f.contrato), f.catalogo, f.glossario);
function trocarTexto(f: Fixture, pt: string, en: EntradaEn, chave = CHAVE, revisar = true) {
  f.catalogo = catalogo({ ...f.catalogo.pt, [chave]: pt }, { ...f.catalogo.en, [chave]: en });
  if (revisar) {
    f.contrato.mensagens[chave].sha256_revisado = assinaturaMensagem(f.catalogo.pt[chave], f.catalogo.en[chave]);
    expect(f.contrato.mensagens[chave].sha256_revisado).toBe(assinaturaMensagem(pt, en));
  }
}
function fixtureNome(explicacao: Referencia["explicacao"] = "na_mensagem", ocorrencias = 1) {
  return fixture({
    pt: ocorrencias === 1 ? "União" : "União e União",
    en: traduzido(`União (${EXPLICACAO})${ocorrencias === 1 ? "" : " and União"}`),
    referencias: [refNome(explicacao, ocorrencias)], entradas: { "nome.uniao": nome() },
  });
}

describe("assinatura dos textos revisados", () => {
  it("assina os literais decodificados, incluindo espaço final, acentos e placeholder", () => {
    const pt = "{observatorios} União\n ", en = traduzido("{observatorios} União\n ");
    const esperado = createHash("sha256").update(JSON.stringify([pt, "traduzido", en.texto]), "utf8").digest("hex");
    expect(assinaturaMensagem(pt, en)).toBe(esperado);
    expect(assinaturaMensagem(pt.trimEnd(), en)).not.toBe(esperado);
    expect(assinaturaMensagem(pt.normalize("NFD"), en)).not.toBe(esperado);
    expect(assinaturaMensagem(pt, traduzido("{observatorios} união\n "))).not.toBe(esperado);
  });

  it("inclui o estado e o motivo do fallback sem inventar texto inglês", () => {
    const en: EntradaEn = { estado: "portugues_marcado", motivo: "Revisão pendente." };
    const esperado = createHash("sha256").update(JSON.stringify(["Original", en.estado, en.motivo]), "utf8").digest("hex");
    expect(assinaturaMensagem("Original", en)).toBe(esperado);
    expect(assinaturaMensagem("Original", traduzido(en.motivo))).not.toBe(esperado);
    expect(assinaturaMensagem("Original", { ...en, motivo: "Outro motivo." })).not.toBe(esperado);
  });

  it.each([CHAVE, GERAL])("reprova alteração não revisada, inclusive em prosa geral: %s", (chave) => {
    const f = fixture();
    expect(ler(f).mensagens).toBe(2);
    trocarTexto(f, `${f.catalogo.pt[chave]}.`, traduzido(chave === CHAVE ? "public accounts." : "Simple message."), chave, false);
    expect(() => ler(f)).toThrow("Assinatura de mensagem desatualizada");
    trocarTexto(f, f.catalogo.pt[chave], f.catalogo.en[chave], chave);
    expect(ler(f).mensagens).toBe(2);
  });
});

describe("contrato literal e exaustivo por mensagem", () => {
  it("conta referências e formas distintas, preserva os insumos e não declara uso no DOM", () => {
    const f = fixture();
    const antes = JSON.stringify(f);
    expect(ler(f)).toEqual({
      schema_version: 1, mensagens: 2, mensagens_vinculadas: 1, mensagens_sem_termos_tecnicos: 1,
      referencias: 1, ids_distintos: 1, formas_contextuais_usadas: 1,
      referencias_pt_verificadas: 1, referencias_en_verificadas: 1, referencias_en_pendentes: 0,
      uso_na_interface_verificado: false,
    });
    expect(JSON.stringify(f)).toBe(antes);
  });

  it("conta um vínculo com duas ocorrências como uma referência", () => {
    const f = fixture({ pt: "contas e contas", en: traduzido("public accounts and public accounts"), referencias: [ref("teste.contas", "curta", 2)] });
    expect(ler(f)).toMatchObject({ referencias: 1, ids_distintos: 1, formas_contextuais_usadas: 1, referencias_pt_verificadas: 1, referencias_en_verificadas: 1 });
  });

  it.each([
    ["topo", '"schema_version":1', '"schema_version":1,"schema_version":1'],
    ["classificação", '"classificacao":"vinculada"', '"classificacao":"vinculada","classificacao":"vinculada"'],
    ["referência", '"ocorrencias":1', '"ocorrencias":1,"ocorrencias":1'],
    ["chave escapada", '"ocorrencias":1', '"ocorrencias":1,"\\u006fcorrencias":1'],
  ])("rejeita chave JSON duplicada antes da sobrescrita: %s", (_, antes, depois) => {
    const f = fixture(), original = JSON.stringify(f.contrato), adulterado = original.replace(antes, depois);
    expect(adulterado).not.toBe(original);
    expect(() => lerTerminologia(adulterado, f.catalogo, f.glossario)).toThrow("Chave JSON duplicada");
  });

  it("rejeita mensagem duplicada com escape equivalente", () => {
    const f = fixture(), original = JSON.stringify(f.contrato);
    const adulterado = original.replace(`"${CHAVE}":`, `"${CHAVE}":${JSON.stringify(f.contrato.mensagens[CHAVE])},"\\u0074este.mensagem":`);
    expect(adulterado).not.toBe(original);
    expect(() => lerTerminologia(adulterado, f.catalogo, f.glossario)).toThrow("Chave JSON duplicada");
  });

  const alteracoes: [string, (f: Fixture) => void, string?][] = [
    ["versão desconhecida", (f) => { f.contrato.schema_version = 2; }],
    ["campo extra no topo", (f) => { Object.assign(f.contrato, { ignorar: true }); }],
    ["mensagem faltante", (f) => { Reflect.deleteProperty(f.contrato.mensagens, GERAL); }, "mesmas chaves"],
    ["mensagem adicional", (f) => { f.contrato.mensagens["teste.extra"] = f.contrato.mensagens[GERAL]; }, "mesmas chaves"],
    ["mensagem substituída", (f) => { f.contrato.mensagens["teste.extra"] = f.contrato.mensagens[GERAL]; Reflect.deleteProperty(f.contrato.mensagens, GERAL); }, "mesmas chaves"],
    ["classificação desconhecida", (f) => { Object.assign(vinculada(f), { classificacao: "automatica" }); }],
    ["justificativa adicional em vínculo", (f) => { Object.assign(vinculada(f), { justificativa: "Indevida" }); }],
    ["referências em prosa geral", (f) => { Object.assign(f.contrato.mensagens[GERAL], { referencias: [] }); }],
    ["justificativa vazia", (f) => { Object.assign(f.contrato.mensagens[GERAL], { justificativa: " \n " }); }],
    ["assinatura ausente", (f) => { Reflect.deleteProperty(vinculada(f), "sha256_revisado"); }],
    ["assinatura inválida", (f) => { vinculada(f).sha256_revisado = "INVALIDA"; }],
    ["referências vazias", (f) => { vinculada(f).referencias = []; }],
    ["referência repetida", (f) => { vinculada(f).referencias.push({ ...vinculada(f).referencias[0] }); }, "Referência terminológica duplicada"],
    ["tradução alternativa no metadata", (f) => { Object.assign(vinculada(f).referencias[0], { en: "public finances" }); }],
    ["regex no metadata", (f) => { Object.assign(vinculada(f).referencias[0], { regex: ".*" }); }],
    ["ocorrências zero", (f) => { vinculada(f).referencias[0].ocorrencias = 0; }],
    ["ocorrências negativas", (f) => { vinculada(f).referencias[0].ocorrencias = -1; }],
    ["ocorrências fracionárias", (f) => { vinculada(f).referencias[0].ocorrencias = 1.5; }],
    ["ocorrências string", (f) => { Object.assign(vinculada(f).referencias[0], { ocorrencias: "1" }); }],
    ["ID inexistente", (f) => { vinculada(f).referencias[0].id = "teste.ausente"; }, "ID de glossário ausente"],
    ["ID somente em pendência", (f) => { vinculada(f).referencias[0].id = "teste.pendente"; }, "ID de glossário ausente"],
    ["ID fora do formato constructor", (f) => { vinculada(f).referencias[0].id = "constructor"; }],
    ["ID fora do formato toString", (f) => { vinculada(f).referencias[0].id = "toString"; }],
    ["forma inexistente", (f) => { vinculada(f).referencias[0].forma = "ausente"; }, "Forma contextual inexistente"],
    ["forma herdada constructor", (f) => { vinculada(f).referencias[0].forma = "constructor"; }, "Forma contextual inexistente"],
    ["forma fora do formato toString", (f) => { vinculada(f).referencias[0].forma = "toString"; }],
  ];
  it.each(alteracoes)("rejeita %s", (_, alterar, erro) => {
    const f = fixture();
    expect(ler(f).referencias).toBe(1);
    alterar(f);
    expect(() => ler(f)).toThrow(erro);
  });

  it("não confunde um ID sintaticamente válido herdado com entrada própria do glossário", () => {
    const f = fixture();
    expect(ler(f).referencias).toBe(1);
    const entradaValidada = f.glossario.entradas["teste.contas"];
    // Ataque ao objeto entregue pelo chamador; não altera Object.prototype nem a fixture vizinha.
    Reflect.deleteProperty(f.glossario.entradas, "teste.contas");
    Object.setPrototypeOf(f.glossario.entradas, { "teste.contas": entradaValidada });
    expect(() => ler(f)).toThrow("ID de glossário ausente");
  });

  it.each(["", "{", "[]", "null", '{"schema_version":1,"mensagens":{}}'])("rejeita documento ausente, malformado ou incompleto: %s", (bytes) => {
    const f = fixture();
    expect(() => lerTerminologia(bytes, f.catalogo, f.glossario)).toThrow();
  });
});

describe("equivalentes literais, formas contextuais e quantidades", () => {
  it.each([
    ["contas", "public accounts", "public finances"],
    ["estados", "states", "state"],
    ["bases oficiais", "official databases", "official database"],
    ["Fonte", "Data source", "data source"],
  ])("rejeita equivalente divergente de %s mesmo depois de revisar a assinatura", (pt, en, adulterado) => {
    const f = fixture({ pt, en: traduzido(en), referencias: [ref("teste.conceito", "contextual")], entradas: {
      "teste.conceito": termo("conceito canônico", "canonical concept", { contextual: forma(pt, en) }),
    } });
    expect(ler(f).referencias_en_verificadas).toBe(1);
    trocarTexto(f, pt, traduzido(adulterado));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it.each([
    ["equivalente removido", "contas", "Other content"],
    ["termo português removido", "Outro conteúdo", "public accounts"],
    ["ocorrência inglesa extra", "contas", "public accounts and public accounts"],
    ["ocorrência portuguesa extra", "contas e contas", "public accounts"],
    ["espaço inglês alterado", "contas", "public  accounts"],
    ["caixa portuguesa alterada", "Contas", "public accounts"],
  ])("rejeita %s com assinatura atual", (_, pt, en) => {
    const f = fixture();
    expect(ler(f).referencias).toBe(1);
    trocarTexto(f, pt, traduzido(en));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it("rejeita mudança de equivalente no glossário sem acomodar o consumidor", () => {
    const f = fixture();
    expect(ler(f).referencias).toBe(1);
    f.glossario = glossario({ "teste.contas": termo("contas públicas", "public accounts", { curta: forma("contas", "public finances") }) });
    expect(f.contrato.mensagens[CHAVE].sha256_revisado).toBe(assinaturaMensagem(f.catalogo.pt[CHAVE], f.catalogo.en[CHAVE]));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it.each(["creditor", "xcredit", "credit1", "_credit", "credit_", "credit\u0301", "\u0301credit", "credité", "credit\u{10400}", "\u{10400}credit"])("não aceita fronteira interna de palavra Unicode: %s", (en) => {
    const f = fixture({ pt: "crédito", en: traduzido("credit"), referencias: [ref("teste.credito", "canonica")], entradas: { "teste.credito": termo("crédito", "credit") } });
    expect(ler(f).referencias).toBe(1);
    trocarTexto(f, "crédito", traduzido(en));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it("aceita delimitadores externos e escapa metacaracteres da expressão literal", () => {
    const f = fixture({ pt: "(série A+B.)", en: traduzido("[series A+B.]"), referencias: [ref("teste.serie", "canonica")], entradas: { "teste.serie": termo("série A+B.", "series A+B.") } });
    expect(ler(f).referencias).toBe(1);
    trocarTexto(f, "(série A+B.)", traduzido("[series AAABx]"));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it("valida o português do fallback e separa referências sem comprovação inglesa", () => {
    const f = fixture({ en: { estado: "portugues_marcado", motivo: "Tradução pendente." } });
    expect(ler(f)).toMatchObject({ referencias: 1, referencias_pt_verificadas: 1, referencias_en_verificadas: 0, referencias_en_pendentes: 1, uso_na_interface_verificado: false });
    trocarTexto(f, "Outro conteúdo", f.catalogo.en[CHAVE]);
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });
});

describe("nomes canônicos e modo explícito da explicação", () => {
  it("exige explicação apenas junto à primeira ocorrência da mensagem", () => {
    const f = fixtureNome("na_mensagem", 2);
    expect(ler(f)).toMatchObject({ referencias: 1, referencias_pt_verificadas: 1, referencias_en_verificadas: 1, formas_contextuais_usadas: 0 });
    trocarTexto(f, "União e União", traduzido(`União and União (${EXPLICACAO})`));
    expect(() => ler(f)).toThrow("Explicação ausente na primeira ocorrência");
  });

  it.each(["na_mensagem", "no_glossario"] as const)("não conta o próprio nome dentro da explicação %s como ocorrência autônoma", (modo) => {
    const f = fixture({
      pt: "Instituto", en: traduzido("Instituto (The Instituto uses public data.)"),
      referencias: [refNome(modo, 1, "nome.instituto")],
      entradas: { "nome.instituto": nome("Instituto", "The Instituto uses public data.") },
    });
    expect(ler(f)).toMatchObject({ referencias: 1, referencias_pt_verificadas: 1, referencias_en_verificadas: 1 });
    trocarTexto(f, "Instituto", traduzido("Instituto (The Instituto uses public data.) and Instituto"));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it.each(["nome_proprio", "nome_proprio_produto"])("aceita %s com explicação somente no glossário", (tipo) => {
    const produtoUsado = tipo === "nome_proprio_produto";
    const id = produtoUsado ? "nome.observatorio_sintetico" : "nome.uniao";
    const n = produtoUsado ? "Crédito" : "União";
    const f = fixture({ pt: n, en: traduzido(n), referencias: [refNome("no_glossario", 1, id)], entradas: { [id]: produtoUsado ? produto() : nome() } });
    expect(ler(f)).toMatchObject({ referencias: 1, referencias_en_verificadas: 1 });
    vinculada(f).referencias[0].explicacao = "na_mensagem";
    expect(() => ler(f)).toThrow("Explicação ausente na primeira ocorrência");
  });

  it.each([
    ["nome traduzido", "Union (Brazil's federal government)", "Quantidade de ocorrências"],
    ["caixa alterada", "UNIÃO (Brazil's federal government)", "Quantidade de ocorrências"],
    ["explicação omitida", "União", "Explicação ausente na primeira ocorrência"],
    ["explicação divergente", "União (Brazil's central government)", "Explicação ausente na primeira ocorrência"],
    ["explicação de outro nome", "União (Synthetic credit observatory.)", "Explicação ausente na primeira ocorrência"],
    ["explicação distante", "União and information (Brazil's federal government)", "Explicação ausente na primeira ocorrência"],
    ["explicação antes do nome", "(Brazil's federal government) União", "Explicação ausente na primeira ocorrência"],
    ["nome com normalização diferente", "União".normalize("NFD") + " (Brazil's federal government)", "Quantidade de ocorrências"],
  ])("rejeita %s com assinatura revisada", (_, en, erro) => {
    const f = fixtureNome();
    expect(ler(f).referencias).toBe(1);
    trocarTexto(f, "União", traduzido(en));
    expect(() => ler(f)).toThrow(erro);
  });

  it.each(["xUnião", "União1", "_União", "União_", "União\u0301", "\u0301União", "União\u{10400}", "\u{10400}União"])("não preserva nome como substring: %s", (n) => {
    const f = fixtureNome("no_glossario");
    trocarTexto(f, "União", traduzido(n));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
    trocarTexto(f, n, traduzido("União"));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it("não aceita alias institucional como forma canônica de uma referência", () => {
    const f = fixture({
      pt: "Instituto Sintético", en: traduzido("Instituto Sintético"), referencias: [refNome("no_glossario", 1, "nome.instituto")],
      entradas: { "nome.instituto": { ...nome("Instituto Sintético", "Synthetic institution."), formas_preservadas: ["IS"] } },
    });
    expect(ler(f).referencias).toBe(1);
    trocarTexto(f, "IS", traduzido("IS"));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
    vinculada(f).referencias[0].forma = "alias";
    expect(() => ler(f)).toThrow("Nome próprio exige forma canonica e explicacao");
  });

  it("exige o campo de explicação em nome, proíbe valor desconhecido e forma contextual", () => {
    for (const caso of ["ausente", "desconhecido", "forma"] as const) {
      const f = fixtureNome();
      expect(ler(f).referencias).toBe(1);
      const r = vinculada(f).referencias[0];
      if (caso === "ausente") Reflect.deleteProperty(r, "explicacao");
      else if (caso === "desconhecido") Object.assign(r, { explicacao: "automatica" });
      else r.forma = "contextual";
      expect(() => ler(f), caso).toThrow(caso === "desconhecido" ? undefined : "Nome próprio exige forma canonica e explicacao");
    }
  });

  it.each(["na_mensagem", "no_glossario"])("proíbe explicacao=%s em referência técnica", (explicacao) => {
    const f = fixture();
    Object.assign(vinculada(f).referencias[0], { explicacao });
    expect(() => ler(f)).toThrow("Termo não admite explicacao");
  });

  it("não exige explicação inglesa inline para fallback, mas continua conferindo o nome PT", () => {
    const f = fixtureNome();
    trocarTexto(f, "União", { estado: "portugues_marcado", motivo: "Tradução pendente." });
    expect(ler(f)).toMatchObject({ referencias_pt_verificadas: 1, referencias_en_verificadas: 0, referencias_en_pendentes: 1 });
    trocarTexto(f, "Union", f.catalogo.en[CHAVE]);
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });
});

describe("reserva de explicações e conflitos de intervalos", () => {
  function comTermo(explicacao: Referencia["explicacao"]) {
    return fixture({
      pt: "União e governo federal", en: traduzido(`União (${EXPLICACAO}) and federal government`),
      referencias: [refNome(explicacao), ref("teste.governo", "canonica")],
      entradas: { "nome.uniao": nome(), "teste.governo": termo("governo federal", "federal government") },
    });
  }
  it.each(["na_mensagem", "no_glossario"] as const)("reserva a explicação %s e conta só o termo externo, independentemente da ordem", (modo) => {
    const f = comTermo(modo);
    const esperado = { referencias: 2, referencias_pt_verificadas: 2, referencias_en_verificadas: 2 };
    expect(ler(f)).toMatchObject(esperado);
    vinculada(f).referencias.reverse();
    expect(ler(f)).toMatchObject(esperado);
    trocarTexto(f, "União e governo federal", traduzido(`União (${EXPLICACAO})`));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
    vinculada(f).referencias.reverse();
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it("não usa termo interno à explicação para compensar ausência no português", () => {
    const f = comTermo("na_mensagem");
    expect(ler(f).referencias).toBe(2);
    trocarTexto(f, "União", traduzido(`União (${EXPLICACAO})`));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it("rejeita ocorrência externa extra mesmo havendo uma explicação validada", () => {
    const f = comTermo("no_glossario");
    expect(ler(f).referencias).toBe(2);
    trocarTexto(f, "União e governo federal", traduzido(`União (${EXPLICACAO}) and federal government and federal government`));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it("não reserva prosa arbitrária próxima ao nome", () => {
    const f = comTermo("no_glossario");
    trocarTexto(f, "União e governo federal", traduzido("União and federal government"));
    expect(ler(f).referencias).toBe(2);
    trocarTexto(f, "União e governo federal", traduzido("União (Other federal government) and federal government"));
    expect(() => ler(f)).toThrow("Quantidade de ocorrências");
  });

  it("não conta o mesmo trecho como produto preservado e termo traduzido", () => {
    const f = fixture({
      pt: "Crédito", en: traduzido("Crédito"), referencias: [refNome("no_glossario", 1, "nome.observatorio_sintetico")],
      entradas: { "nome.observatorio_sintetico": produto(), "teste.credito": termo("Crédito", "Crédito") },
    });
    expect(ler(f).referencias).toBe(1);
    vinculada(f).referencias.push(ref("teste.credito", "canonica"));
    expect(() => ler(f)).toThrow("Sobreposição de referências");
    vinculada(f).referencias.reverse();
    expect(() => ler(f)).toThrow("Sobreposição de referências");
  });

  it("rejeita dois termos diferentes que disputam o mesmo intervalo", () => {
    const f = fixture({ pt: "contas públicas", en: traduzido("public accounts"), referencias: [ref("teste.amplo", "canonica")], entradas: {
      "teste.amplo": termo("contas públicas", "public accounts"), "teste.parte": termo("contas", "accounts"),
    } });
    expect(ler(f).referencias).toBe(1);
    vinculada(f).referencias.push(ref("teste.parte", "canonica"));
    expect(() => ler(f)).toThrow("Sobreposição de referências");
    vinculada(f).referencias.reverse();
    expect(() => ler(f)).toThrow("Sobreposição de referências");
  });

  it("não exclui silenciosamente termo que só intersecta parte do bloco explicativo", () => {
    const f = fixture({ pt: "União e recorte", en: traduzido(`União (${EXPLICACAO}) after`), referencias: [refNome()], entradas: {
      "nome.uniao": nome(), "teste.recorte": termo("recorte", "government) after"),
    } });
    expect(ler(f).referencias).toBe(1);
    vinculada(f).referencias.push(ref("teste.recorte", "canonica"));
    expect(() => ler(f)).toThrow("Sobreposição de referências");
    vinculada(f).referencias.reverse();
    expect(() => ler(f)).toThrow("Sobreposição de referências");
  });

  it("rejeita nome de outra referência dentro de uma explicação reservada", () => {
    const f = fixture({
      pt: "Instituto Alfa e Instituto Beta", en: traduzido("Instituto Alfa (Institution containing Instituto Beta)"),
      referencias: [refNome("na_mensagem", 1, "nome.alfa")],
      entradas: { "nome.alfa": nome("Instituto Alfa", "Institution containing Instituto Beta"), "nome.beta": nome("Instituto Beta", "Another institution.") },
    });
    expect(ler(f).referencias).toBe(1);
    vinculada(f).referencias.push(refNome("no_glossario", 1, "nome.beta"));
    expect(() => ler(f)).toThrow("Sobreposição de referências");
    vinculada(f).referencias.reverse();
    expect(() => ler(f)).toThrow("Sobreposição de referências");
  });

  it("localiza ocorrências sobrepostas da mesma forma antes de rejeitar sua reutilização", () => {
    const f = fixture({
      pt: "aba aba; aba aba", en: traduzido("one one; one one"), referencias: [ref("teste.repeticao", "canonica", 2)],
      entradas: { "teste.repeticao": termo("aba aba", "one one") },
    });
    expect(ler(f).referencias).toBe(1);
    trocarTexto(f, "aba aba aba", traduzido("one one one"));
    expect(() => ler(f)).toThrow("Sobreposição de referências");
  });

  it("rejeita dois blocos explicativos sobrepostos em qualquer ordem das referências", () => {
    const alfa = refNome("na_mensagem", 1, "nome.alfa"), beta = refNome("na_mensagem", 1, "nome.beta");
    const f = fixture({
      pt: "Instituto Alfa e Instituto Beta", en: traduzido("Instituto Alfa (Contains Instituto Beta (Second institution.))"),
      referencias: [alfa],
      entradas: {
        "nome.alfa": nome("Instituto Alfa", "Contains Instituto Beta (Second institution.)"),
        "nome.beta": nome("Instituto Beta", "Second institution."),
      },
    });
    expect(ler(f).referencias).toBe(1);
    vinculada(f).referencias = [beta];
    expect(ler(f).referencias).toBe(1);
    vinculada(f).referencias = [alfa, beta];
    expect(() => ler(f)).toThrow("Sobreposição de referências");
    vinculada(f).referencias.reverse();
    expect(() => ler(f)).toThrow("Sobreposição de referências");
  });
});

describe("vínculos reais das 22 mensagens atuais", () => {
  it("confere a relação revisada independentemente da configuração e mantém o escopo do relatório", () => {
    const c = lerCatalogo(readFileSync(new URL("../i18n/pt.ts", import.meta.url), "utf8"), readFileSync(new URL("../i18n/en.ts", import.meta.url), "utf8"));
    const raiz = fileURLToPath(new URL("../../", import.meta.url));
    const g = lerGlossario(readFileSync(new URL("../../config/glossario-en.json", import.meta.url), "utf8"), criarContextoProdutos(raiz));
    const bytes = readFileSync(new URL("../../config/i18n-terminologia.json", import.meta.url), "utf8");
    const contrato = JSON.parse(bytes) as Contrato;
    const gerais = [
      "idioma.portugues", "idioma.ingles", "idioma.seletor", "traducao.portugues_apenas",
      "home.hero.titulo_inicio", "home.hero.titulo_destaque", "acesso.criar_conta", "home.hero.ja_cadastrado",
      "home.hero.rotulo", "home.hero.beneficio_conta", "home.hero.beneficio_gratuidade",
      "home.indice.rotulo", "home.indice.ilustracoes", "home.indice.paginas_tematicas",
      "home.indice.secoes_publicadas", "home.indice.temas_publicados", "home.indice.capitulos_com_dados",
      "home.indice.paginas_por_pergunta", "home.indice.contagem_parcial",
    ];
    const esperadas = {
      "home.hero.introducao": [
        ref("credito.credito", "canonica"), ref("energia.setor_eletrico", "canonica"), ref("gas.gas_natural", "canonica"),
        ref("saneamento.saneamento_basico", "home_curta"), ref("servicos.servicos_publicos", "canonica"), ref("fiscal.contas_publicas", "home_curta"),
        refNome("na_mensagem"), ref("federativo.estado", "plural"), ref("estatistica.base_dados", "home_oficiais_plural"),
        ref("estatistica.fonte_dados", "home_curta"), ref("estatistica.periodo_referencia", "canonica"),
      ],
      "home.hero.beneficio_evidencia": [ref("estatistica.fonte_dados", "home_curta_inicial"), ref("estatistica.periodo_referencia", "home_curta")],
      "home.indice.unidades_federacao": [ref("federativo.unidades_federacao", "canonica")],
    };
    expect(Object.keys(contrato.mensagens).sort()).toEqual([...gerais, ...Object.keys(esperadas)].sort());
    for (const chave of gerais) expect(contrato.mensagens[chave].classificacao, chave).toBe("sem_termos_tecnicos");
    for (const [chave, referencias] of Object.entries(esperadas)) {
      const mensagem = contrato.mensagens[chave];
      expect(mensagem.classificacao, chave).toBe("vinculada");
      if (mensagem.classificacao !== "vinculada") throw new Error(`Mensagem sem vínculos: ${chave}`);
      expect(mensagem.referencias, chave).toEqual(referencias);
    }
    expect(lerTerminologia(bytes, c, g)).toEqual({
      schema_version: 1, mensagens: 22, mensagens_vinculadas: 3, mensagens_sem_termos_tecnicos: 19,
      referencias: 14, ids_distintos: 12, formas_contextuais_usadas: 7,
      referencias_pt_verificadas: 14, referencias_en_verificadas: 14, referencias_en_pendentes: 0,
      uso_na_interface_verificado: false,
    });
  });
});
