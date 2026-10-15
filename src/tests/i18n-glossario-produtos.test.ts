import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFragment } from "parse5";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lerGlossario, lerNomesPreservados } from "../../scripts/i18n/glossario.mjs";
import { criarContextoProdutos, REGISTRO_PRODUTOS } from "../../scripts/i18n/produtos.mjs";
import { vazamentos } from "./suporte/i18n-dom";

const NOME = "Observatório de Dados Sintéticos";
const CHAVE = "nome.observatorio_sintetico";
const temporarios: string[] = [];
afterEach(() => {
  for (const raiz of temporarios.splice(0)) rmSync(raiz, { recursive: true, force: true });
});
function raizTemporaria() {
  const raiz = mkdtempSync(join(tmpdir(), "i18n-glossario-produtos-"));
  temporarios.push(raiz);
  return raiz;
}
function escrever(raiz: string, path: string, conteudo: string) {
  const arquivo = join(raiz, path);
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, conteudo);
}
function registro(id = "sintetico", nome = NOME) {
  return `export const DOMINIOS = ${JSON.stringify([{ id, nomeCurto: nome }])};`;
}
function contexto(nomes: [string, string][] = [["sintetico", NOME], ["outro", "Outro Produto"]]) {
  return { carregarProdutos: vi.fn(() => ({ arquivo: REGISTRO_PRODUTOS, nomes: new Map(nomes) })) };
}
function evidencia() {
  return { fonte: "bcb_fixture", trecho: "  Synthetic quotation – original — preserved.\nSecond line.  ", localizacao: "Synthetic section", pagina: 4 };
}
function fonte() {
  return {
    orgao: "BCB", titulo: "Synthetic publication", url: "https://www.bcb.gov.br/fixture.pdf",
    idioma: "en", formato: "pdf", sha256_consultado: "ab".repeat(32),
  };
}
function produto(id = "sintetico", nome = NOME) {
  return {
    tipo: "nome_proprio_produto", pt: nome, en: nome,
    origem_nome: { arquivo: REGISTRO_PRODUTOS, id, campo: "nomeCurto" },
    explicacao_en: "The observatory uses public data with stated limitations.",
    contexto: "Produto sintético, sem alterar o registro publicado.",
    evidencias_explicacao: [evidencia()], nota: "Nota sintética.",
  };
}
function glossarioProduto() {
  return { schema_version: 1, fontes: { bcb_fixture: fonte() }, entradas: { [CHAVE]: produto() }, pendencias: [] };
}
function glossarioAntigo() {
  return {
    schema_version: 1, fontes: { bcb_fixture: fonte() },
    entradas: {
      "teste.termo": { tipo: "termo", pt: "dados públicos", en: "public data", contexto: "Termo sintético.", evidencias: [evidencia()] },
      "nome.instituto": {
        tipo: "nome_proprio", pt: "Instituto Sintético", en: "Instituto Sintético",
        explicacao_en: "The synthetic institution.", formas_preservadas: ["IS"],
        contexto: "Nome institucional sintético.", evidencias: [evidencia()],
      },
    },
    pendencias: [{ id: "teste.pendente", pt: "Dados pendentes", contexto: "Pendência sintética.", motivo: "Fonte pendente.", origens: ["src/fixture.ts"], depende_de: "pesquisa" }],
  };
}
type Fixture = ReturnType<typeof glossarioProduto>;
type Alteracao = (g: Fixture) => void;

describe("nome de produto com origem interna e explicação documentada", () => {
  it("documenta na configuração real todos os produtos do registro, sem uma segunda tabela de IDs", () => {
    const raiz = fileURLToPath(new URL("../../", import.meta.url));
    const c = criarContextoProdutos(raiz);
    const registroReal = c.carregarProdutos();
    const g = lerGlossario(readFileSync(join(raiz, "config/glossario-en.json"), "utf8"), c);
    const produtos = new Map<string, string>();
    for (const entrada of Object.values(g.entradas)) {
      if (entrada.tipo === "nome_proprio_produto") produtos.set(entrada.origem_nome.id, entrada.pt);
    }
    expect(produtos).toEqual(registroReal.nomes);
  });

  it("preserva todos os textos e consulta uma única vez o registro para dois produtos", () => {
    const g = glossarioProduto();
    Object.assign(g.entradas, { "nome.observatorio_outro": produto("outro", "Outro Produto") });
    const c = contexto();
    expect(lerGlossario(JSON.stringify(g), c)).toStrictEqual(g);
    expect(c.carregarProdutos).toHaveBeenCalledExactlyOnceWith();
    c.carregarProdutos.mockClear();
    expect(lerNomesPreservados(JSON.stringify(g), c).sort()).toEqual([NOME, "Outro Produto"].sort());
    expect(c.carregarProdutos).toHaveBeenCalledExactlyOnceWith();
  });

  it("mantém as APIs de um argumento e não consulta contexto para variantes antigas", () => {
    const g = glossarioAntigo();
    const c = { carregarProdutos: vi.fn(() => { throw new Error("Registro não deve ser consultado"); }) };
    expect(lerGlossario(JSON.stringify(g))).toStrictEqual(g);
    expect(lerGlossario(JSON.stringify(g), c)).toStrictEqual(g);
    expect(lerNomesPreservados(JSON.stringify(g), c).sort()).toEqual(["IS", "Instituto Sintético"]);
    expect(c.carregarProdutos).not.toHaveBeenCalled();
  });

  it("exige contexto para produtos e propaga falha do carregador sem fallback", () => {
    const bytes = JSON.stringify(glossarioProduto());
    expect(() => lerGlossario(bytes)).toThrow("contexto");
    expect(() => lerNomesPreservados(bytes)).toThrow("contexto");
    const c = { carregarProdutos: () => { throw new Error("Falha sintética da origem"); } };
    expect(() => lerGlossario(bytes, c)).toThrow("Falha sintética da origem");
  });

  const invalidos: [string, Alteracao][] = [
    ["nome inglês renomeado", (g) => { g.entradas[CHAVE].en = "Data Observatory"; }],
    ["nomes iguais mas diferentes da origem", (g) => { Object.assign(g.entradas[CHAVE], { pt: "Outro nome", en: "Outro nome" }); }],
    ["ID ausente no registro", (g) => {
      g.entradas[CHAVE].origem_nome.id = "inexistente";
      Object.assign(g.entradas, { "nome.observatorio_inexistente": g.entradas[CHAVE] });
      Reflect.deleteProperty(g.entradas, CHAVE);
    }],
    ["ID inválido", (g) => { g.entradas[CHAVE].origem_nome.id = "Sintetico-Invalido"; }],
    ["chave diferente da origem", (g) => { Object.assign(g.entradas, { "nome.alias": g.entradas[CHAVE] }); Reflect.deleteProperty(g.entradas, CHAVE); }],
    ["mesma origem sob duas chaves", (g) => { Object.assign(g.entradas, { "nome.alias": structuredClone(g.entradas[CHAVE]) }); }],
    ["arquivo alternativo", (g) => { g.entradas[CHAVE].origem_nome.arquivo = "src/lib/outros.ts"; }],
    ["caminho que sobe diretório", (g) => { g.entradas[CHAVE].origem_nome.arquivo = "../src/lib/dominios.ts"; }],
    ["campo diferente", (g) => { g.entradas[CHAVE].origem_nome.campo = "nome"; }],
    ["campo extra na origem", (g) => { Object.assign(g.entradas[CHAVE].origem_nome, { linha: 1 }); }],
    ["origem ausente", (g) => { Reflect.deleteProperty(g.entradas[CHAVE], "origem_nome"); }],
    ["alias não comprovado", (g) => { Object.assign(g.entradas[CHAVE], { formas_preservadas: ["Dados"] }); }],
    ["evidências da variante antiga", (g) => { Object.assign(g.entradas[CHAVE], { evidencias: [evidencia()] }); }],
    ["explicação ausente", (g) => { Reflect.deleteProperty(g.entradas[CHAVE], "explicacao_en"); }],
    ["explicação vazia", (g) => { g.entradas[CHAVE].explicacao_en = " \n "; }],
    ["explicação com travessão", (g) => { g.entradas[CHAVE].explicacao_en = "Synthetic — explanation."; }],
    ["nenhuma evidência da explicação", (g) => { g.entradas[CHAVE].evidencias_explicacao = []; }],
    ["referência inexistente", (g) => { g.entradas[CHAVE].evidencias_explicacao[0].fonte = "ausente"; }],
    ["PDF sem página", (g) => { Reflect.deleteProperty(g.entradas[CHAVE].evidencias_explicacao[0], "pagina"); }],
  ];
  it.each(invalidos)("rejeita produto com %s também na lista preservada", (_, alterar) => {
    const g = glossarioProduto();
    alterar(g);
    const bytes = JSON.stringify(g);
    expect(() => lerGlossario(bytes, contexto())).toThrow();
    expect(() => lerNomesPreservados(bytes, contexto())).toThrow();
  });

  it.each(["termo", "nome_proprio"])("não permite origem de produto ou evidência alternativa em %s", (tipo) => {
    const g = glossarioAntigo();
    const entrada = tipo === "termo" ? g.entradas["teste.termo"] : g.entradas["nome.instituto"];
    Object.assign(entrada, { origem_nome: produto().origem_nome, evidencias_explicacao: [evidencia()] });
    expect(() => lerGlossario(JSON.stringify(g), contexto())).toThrow();
  });

  it.each(['"id":"sintetico"', '"\\u0069d":"sintetico"'])("rejeita bytes JSON com origem duplicada: %s", (segunda) => {
    const bytes = JSON.stringify(glossarioProduto()).replace('"id":"sintetico"', `"id":"sintetico",${segunda}`);
    expect(() => lerGlossario(bytes, contexto())).toThrow("Chave JSON duplicada");
    expect(() => lerNomesPreservados(bytes, contexto())).toThrow("Chave JSON duplicada");
  });
});

describe("registro canônico de produtos por AST e raiz explícita", () => {
  it("extrai strings decodificadas sem normalizar ou executar as declarações do módulo", () => {
    const raiz = raizTemporaria();
    escrever(raiz, REGISTRO_PRODUTOS, String.raw`
      type Dominio = { id: string; nomeCurto: string; chips: readonly string[] };
      export const DOMINIOS: readonly Dominio[] = ([
        { id: "produto_novo", nomeCurto: "  Observat\u00f3rio de Dados Sintéticos  ", chips: ["Sintético"] },
        { "id": "outro", "nomeCurto": "Outro Produto", chips: [] }
      ] as const) satisfies readonly Dominio[];
      export const COOKIE_OBSERVATORIO = "cookie-sintetico";
      export function dominio() { throw new Error("Não executar função"); }
      throw new Error("Não executar módulo");
    `);
    expect(criarContextoProdutos(raiz).carregarProdutos()).toEqual({
      arquivo: "src/lib/dominios.ts",
      nomes: new Map([["produto_novo", "  Observatório de Dados Sintéticos  "], ["outro", "Outro Produto"]]),
    });
  });

  it("lê cada raiz e cada estado atual do arquivo sem cache ou fallback no checkout", () => {
    const a = raizTemporaria(), b = raizTemporaria();
    escrever(a, REGISTRO_PRODUTOS, registro("sintetico", "Nome da raiz A"));
    escrever(b, REGISTRO_PRODUTOS, registro("sintetico", "Nome da raiz B"));
    const ca = criarContextoProdutos(a), cb = criarContextoProdutos(b);
    expect(ca.carregarProdutos().nomes.get("sintetico")).toBe("Nome da raiz A");
    expect(cb.carregarProdutos().nomes.get("sintetico")).toBe("Nome da raiz B");
    escrever(a, REGISTRO_PRODUTOS, registro());
    expect(ca.carregarProdutos().nomes.get("sintetico")).toBe(NOME);
    expect(lerGlossario(JSON.stringify(glossarioProduto()), ca)).toStrictEqual(glossarioProduto());
    expect(() => lerGlossario(JSON.stringify(glossarioProduto()), cb)).toThrow("diverge");
  });

  const item = '{ id: "sintetico", nomeCurto: "Nome" }';
  const array = (conteudo: string) => `export const DOMINIOS = [${conteudo}];`;
  it.each([
    ["declaração ausente", 'export const OUTRO = [];'],
    ["declaração repetida", `${array(item)} ${array(item)}`],
    ["sem export", `const DOMINIOS = [${item}];`],
    ["let", `export let DOMINIOS = [${item}];`],
    ["array por chamada", `export const DOMINIOS = criarProdutos();`],
    ["array vazio", array("")],
    ["elemento dinâmico", array("produto")],
    ["spread de elementos", array(`...[${item}]`)],
    ["spread de propriedades", array('{ ...outro, id: "sintetico", nomeCurto: "Nome" }')],
    ["propriedade computada", array('{ ["id"]: "sintetico", nomeCurto: "Nome" }')],
    ["getter", array('{ id: "sintetico", get nomeCurto() { return "Nome"; } }')],
    ["método", array('{ id: "sintetico", nomeCurto() { return "Nome"; } }')],
    ["shorthand", array('{ id: "sintetico", nomeCurto }')],
    ["campo repetido com escape", array('{ id: "sintetico", "\\u0069d": "sintetico", nomeCurto: "Nome" }')],
    ["ID repetido", array(`${item}, ${item}`)],
    ["ID ausente", array('{ nomeCurto: "Nome" }')],
    ["nome ausente", array('{ id: "sintetico" }')],
    ["ID vazio", array('{ id: " ", nomeCurto: "Nome" }')],
    ["nome vazio", array('{ id: "sintetico", nomeCurto: " " }')],
    ["concatenação", array('{ id: "sintetico", nomeCurto: "No" + "me" }')],
    ["nome por chamada", array('{ id: "sintetico", nomeCurto: String("Nome") }')],
    ["sintaxe inválida", 'export const DOMINIOS = [{ id:'],
  ])("rejeita AST com %s", (_, codigo) => {
    const raiz = raizTemporaria();
    escrever(raiz, REGISTRO_PRODUTOS, codigo);
    expect(() => criarContextoProdutos(raiz).carregarProdutos()).toThrow();
  });

  it.each(["ausente", "diretório"])("rejeita origem %s sem usar o registro real", (caso) => {
    const raiz = raizTemporaria();
    if (caso === "diretório") mkdirSync(join(raiz, REGISTRO_PRODUTOS), { recursive: true });
    expect(() => criarContextoProdutos(raiz).carregarProdutos()).toThrow();
  });

  it.each(["arquivo", "diretório ancestral"])("rejeita escape por symlink de %s, inclusive raiz irmã com prefixo igual", (caso) => {
    const raiz = raizTemporaria(), exterior = `${raiz}-vizinha`;
    temporarios.push(exterior);
    escrever(exterior, REGISTRO_PRODUTOS, registro());
    if (caso === "arquivo") {
      mkdirSync(join(raiz, "src/lib"), { recursive: true });
      symlinkSync(join(exterior, REGISTRO_PRODUTOS), join(raiz, REGISTRO_PRODUTOS));
    } else symlinkSync(join(exterior, "src"), join(raiz, "src"), "dir");
    expect(() => criarContextoProdutos(raiz).carregarProdutos()).toThrow("dentro do repositório");
  });
});

describe("lista validada e exceção lexical restrita", () => {
  it("inclui somente nomes próprios comprovados e aliases institucionais, nunca explicações ou termos", () => {
    const g = { ...glossarioAntigo(), entradas: { ...glossarioAntigo().entradas, ...glossarioProduto().entradas } };
    const nomes = lerNomesPreservados(JSON.stringify(g), contexto());
    expect([...nomes].sort()).toEqual(["IS", "Instituto Sintético", NOME].sort());
    const antes = [...nomes];
    expect(vazamentos(parseFragment(`<p>${NOME}</p>`), "en", nomes)).toEqual([]);
    expect(vazamentos(parseFragment(`<p>${NOME}: não são dados públicos.</p>`), "en", nomes))
      .toEqual([`portugues-sem-marca: ${NOME}: não são dados públicos.`]);
    for (const valor of [`Super${NOME}`, `${NOME}Extra`, `_${NOME}`, "Observatório dos Dados Sintéticos"]) {
      expect(vazamentos(parseFragment(`<p>${valor}</p>`), "en", nomes)).toEqual([`portugues-sem-marca: ${valor}`]);
    }
    expect(vazamentos(parseFragment(`<p>${produto().explicacao_en}</p>`), "pt", nomes))
      .toEqual([`ingles-na-pagina-portuguesa: ${produto().explicacao_en}`]);
    expect(nomes).toEqual(antes);
  });
});

const CLI = fileURLToPath(new URL("../../scripts/i18n/glossario.mjs", import.meta.url));
function executarCli(cwd: string, argumentos: string[] = []) {
  const resultado = spawnSync(process.execPath, [CLI, ...argumentos], { cwd, encoding: "utf8", timeout: 10_000 });
  expect(resultado.error).toBeUndefined();
  expect(resultado.signal).toBeNull();
  return resultado;
}
describe("CLI com origem ancorada no próprio checkout", () => {
  it("lê o glossário padrão mesmo diante de configuração e registro falsos no cwd", () => {
    const raiz = raizTemporaria();
    escrever(raiz, "config/glossario-en.json", "JSON falso");
    escrever(raiz, REGISTRO_PRODUTOS, "TypeScript falso");
    const r = executarCli(raiz);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("Glossário válido:");
  }, 15_000);

  it("continua aceitando JSON externo antigo sem registro adjacente", () => {
    const raiz = raizTemporaria();
    escrever(raiz, "antigo.json", JSON.stringify(glossarioAntigo()));
    const r = executarCli(raiz, ["antigo.json"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("Glossário válido: 2 entradas, 1 pendências;");
  }, 15_000);

  it("confere um produto de JSON externo contra o registro do checkout, não o adjacente", () => {
    const raiz = raizTemporaria();
    const g = glossarioProduto();
    Reflect.deleteProperty(g.entradas, CHAVE);
    Object.assign(g.entradas, { "nome.observatorio_credito": produto("credito", "Crédito") });
    escrever(raiz, "produto.json", JSON.stringify(g));
    escrever(raiz, REGISTRO_PRODUTOS, registro("credito", "Nome falso do cwd"));
    const r = executarCli(raiz, ["produto.json"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("Glossário válido: 1 entradas, 0 pendências;");
  }, 15_000);

  it("rejeita produto que só existe na raiz do JSON externo", () => {
    const raiz = raizTemporaria();
    escrever(raiz, "produto.json", JSON.stringify(glossarioProduto()));
    escrever(raiz, REGISTRO_PRODUTOS, registro());
    const r = executarCli(raiz, ["produto.json"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("diverge do registro canônico");
  }, 15_000);
});
