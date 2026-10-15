import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executar, gerarCobertura, gerarCoberturaGold } from "../../scripts/cobertura-i18n.mjs";

const temporarios: string[] = [];
afterEach(() => { for (const raiz of temporarios.splice(0)) rmSync(raiz, { recursive: true, force: true }); });
const ARQUIVO = "config/glossario-en.json";
const INVENTARIO = "config/i18n-inventario.json";
const RELATORIO = "docs/i18n/cobertura.json";
const manifesto = {
  schema_version: 1,
  glossario: ARQUIVO,
  ui: { raizes: ["src/app"] },
  dominios: [{ id: "plataforma", nome: "Plataforma", ui: ["src/app"], gold: ["gold"] }],
  observar: ["src/app", "gold"],
};
// Evidência sintética apenas para exercitar a integração; não é o glossário publicado.
const glossario = {
  schema_version: 1,
  fontes: { exemplo: { orgao: "IEA", titulo: "Documento de teste", url: "https://www.iea.org/reports/electricity-2026", idioma: "en", formato: "html", sha256_consultado: "0".repeat(64) } },
  entradas: { "energia.eletricidade": { tipo: "termo", pt: "energia elétrica", en: "electricity", contexto: "Conceito de teste", evidencias: [{ fonte: "exemplo", trecho: "electricity", localizacao: "Seção de teste" }] } },
  pendencias: [{ id: "editorial.pendente", pt: "Nome pendente", contexto: "Nome de teste", motivo: "Decisão ainda não registrada", origens: ["src/app/page.tsx"], depende_de: "mantenedor" }],
};
function escrever(raiz: string, path: string, valor: unknown) {
  writeFileSync(join(raiz, path), JSON.stringify(valor) + "\n");
}
function git(raiz: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function fixture(comGlossario = true) {
  const raiz = mkdtempSync(join(tmpdir(), "i18n-glossario-cobertura-"));
  temporarios.push(raiz);
  for (const path of ["src/app", "config", "gold"]) mkdirSync(join(raiz, path), { recursive: true });
  git(raiz, "init", "--quiet");
  escrever(raiz, INVENTARIO, comGlossario ? manifesto : { ...manifesto, glossario: undefined });
  if (comGlossario) escrever(raiz, ARQUIVO, glossario);
  writeFileSync(join(raiz, "src/app/page.tsx"), "export default () => <h1>Dados</h1>;\n");
  escrever(raiz, "gold/base.json", { nome: "Série portuguesa", valor: 1234.5 });
  return raiz;
}

describe("glossário no relatório de cobertura", () => {
  it("assina mudanças sem contar termos como interface ou gold traduzidas", () => {
    const raiz = fixture();
    const gold = readFileSync(join(raiz, "gold/base.json"));
    executar([], raiz);
    const original = readFileSync(join(raiz, RELATORIO));
    expect(gerarCobertura(raiz).dominios.plataforma.gold).toBeUndefined();
    expect(gerarCoberturaGold(raiz).dominios.plataforma.campos_catalogados.com_ingles).toBe(0);
    expect(gerarCobertura(raiz)).toMatchObject({
      glossario: { path: ARQUIVO, fontes: 1, termos: 1, nomes_preservados: 0, pendencias: [{ id: "editorial.pendente", pt: "Nome pendente", depende_de: "mantenedor" }], uso_na_interface_verificado: false, uso_no_pipeline_verificado: false },
      dominios: { plataforma: { interface: { chaves_catalogadas: { traduzidas: 0 }, percentual_traduzido: null }, cobertura_completa: false } },
    });
    expect(executar(["--check"], raiz)).toContain("confere");
    escrever(raiz, ARQUIVO, { ...glossario, entradas: { "energia.eletricidade": { ...glossario.entradas["energia.eletricidade"], nota: "Contexto documental atualizado." } } });
    expect(() => executar(["--check"], raiz)).toThrow("desatualizada");
    expect(readFileSync(join(raiz, RELATORIO))).toEqual(original);
    executar([], raiz);
    const atualizado = JSON.parse(readFileSync(join(raiz, RELATORIO), "utf8"));
    expect(atualizado.glossario.sha256).not.toBe(JSON.parse(original.toString()).glossario.sha256);
    expect(readFileSync(join(raiz, "gold/base.json"))).toEqual(gold);
  });

  it("recusa glossário ausente, inválido ou retirado do inventário", () => {
    const raiz = fixture();
    rmSync(join(raiz, ARQUIVO));
    expect(() => gerarCobertura(raiz)).toThrow();
    escrever(raiz, ARQUIVO, { ...glossario, entradas: { "energia.eletricidade": { ...glossario.entradas["energia.eletricidade"], en: "" } } });
    expect(() => gerarCobertura(raiz)).toThrow();
    escrever(raiz, ARQUIVO, glossario);
    escrever(raiz, INVENTARIO, { ...manifesto, glossario: undefined });
    expect(() => gerarCobertura(raiz)).toThrow("glossário único");
  });
});

const ORIGEM_PRODUTO = "src/lib/dominios.ts";
const NOME_PRODUTO_SINTETICO = "Dados da Vitrine Sintética";
type ClassificacaoProduto = "ui" | "nao_observada" | "excluida" | "somente_observada";

// Fixtures próprias da proveniência: o ID existe no projeto, mas estes nomes
// não são os do checkout. Nenhuma evidência sintética é incorporada ao glossário real.
function glossarioComProduto(nome: string) {
  return {
    ...glossario,
    entradas: {
      ...glossario.entradas,
      "nome.observatorio_credito": {
        tipo: "nome_proprio_produto",
        pt: nome,
        en: nome,
        origem_nome: { arquivo: ORIGEM_PRODUTO, id: "credito", campo: "nomeCurto" },
        explicacao_en: "Scrutiniums observatory on electricity.",
        contexto: "Produto sintético para testar a origem, sem renomear o produto publicado.",
        evidencias_explicacao: [{ fonte: "exemplo", trecho: "electricity", localizacao: "Seção de teste" }],
      },
    },
  };
}

function manifestoComProduto(classificacao: ClassificacaoProduto = "ui") {
  const ui = classificacao === "somente_observada" ? ["src/app"] : ["src/app", "src/lib"];
  return {
    ...manifesto,
    ui: { raizes: ui },
    dominios: [{ ...manifesto.dominios[0], ui }],
    observar: classificacao === "nao_observada" ? ["src/app", "gold"] : ["src/app", "src/lib", "gold"],
    ...(classificacao === "excluida" ? { exclusoes: [{ prefixo: ORIGEM_PRODUTO, motivo: "Exclusão sintética da origem." }] } : {}),
  };
}

function escreverRegistroProduto(raiz: string, nome: string) {
  writeFileSync(join(raiz, ORIGEM_PRODUTO), `export const DOMINIOS = [{ id: "credito", nomeCurto: ${JSON.stringify(nome)} }];\n`);
}

function fixtureProduto({
  nome = NOME_PRODUTO_SINTETICO,
  classificacao = "ui",
  comProduto = true,
  comOrigem = true,
}: {
  nome?: string;
  classificacao?: ClassificacaoProduto;
  comProduto?: boolean;
  comOrigem?: boolean;
} = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "i18n-glossario-produto-cobertura-"));
  temporarios.push(raiz);
  for (const path of ["src/app", "src/lib", "config", "gold"]) mkdirSync(join(raiz, path), { recursive: true });
  git(raiz, "init", "--quiet");
  escrever(raiz, INVENTARIO, manifestoComProduto(classificacao));
  escrever(raiz, ARQUIVO, comProduto ? glossarioComProduto(nome) : glossario);
  writeFileSync(join(raiz, "src/app/page.tsx"), "export default () => <h1>Vitrine sintética</h1>;\n");
  escrever(raiz, "gold/base.json", { nome: "Série portuguesa preservada", valor: 1234.5 });
  if (comOrigem) escreverRegistroProduto(raiz, nome);
  return raiz;
}

const ORIGENS_FORA_DA_UI = [
  { caso: "ausente", opcoes: { comOrigem: false } },
  { caso: "não observada", opcoes: { classificacao: "nao_observada" as const } },
  { caso: "excluída", opcoes: { classificacao: "excluida" as const } },
  { caso: "somente observada", opcoes: { classificacao: "somente_observada" as const } },
];

describe("proveniência dos produtos na cobertura", () => {
  it("lê os nomes sintéticos de cada raiz recebida sem recorrer ao checkout ou a outra fixture", () => {
    const primeira = fixtureProduto();
    const segunda = fixtureProduto({ nome: "Dados de Outra Vitrine" });
    expect(gerarCobertura(primeira).glossario?.nomes_preservados).toBe(1);
    expect(gerarCobertura(segunda).glossario?.nomes_preservados).toBe(1);
    expect(gerarCobertura(primeira).glossario?.nomes_preservados).toBe(1);

    // O nome válido em outra raiz não é evidência válida para esta origem.
    escrever(segunda, ARQUIVO, glossarioComProduto(NOME_PRODUTO_SINTETICO));
    expect(() => gerarCobertura(segunda)).toThrow();
    expect(gerarCobertura(primeira).glossario?.nomes_preservados).toBe(1);
  });

  it("conta o produto apenas como nome preservado, sem atribuir tradução à interface ou à gold", () => {
    const raiz = fixtureProduto({ comProduto: false });
    const gold = readFileSync(join(raiz, "gold/base.json"));
    const origem = readFileSync(join(raiz, ORIGEM_PRODUTO));
    const antes = gerarCobertura(raiz);
    escrever(raiz, ARQUIVO, glossarioComProduto(NOME_PRODUTO_SINTETICO));
    const depois = gerarCobertura(raiz);

    expect(antes.glossario).toMatchObject({ termos: 1, nomes_preservados: 0 });
    expect(depois.glossario).toMatchObject({
      path: ARQUIVO, fontes: 1, termos: 1, nomes_preservados: 1,
      uso_na_interface_verificado: false, uso_no_pipeline_verificado: false,
    });
    expect(depois.glossario?.sha256).not.toBe(antes.glossario?.sha256);
    expect(depois.escopo.fontes_sha256).toBe(antes.escopo.fontes_sha256);
    expect(depois.dominios.plataforma.interface).toEqual(antes.dominios.plataforma.interface);
    expect(depois.dominios.plataforma.interface.chaves_catalogadas).toEqual({
      traduzidas: 0, portugues_marcado: 0, sem_traducao: 0, nomes_preservados: 0,
    });
    expect(depois.dominios.plataforma.gold).toBeUndefined();
    expect(gerarCoberturaGold(raiz).dominios.plataforma.campos_catalogados).toEqual({ com_ingles: 0, sem_ingles: 0, hash_incompativel: 0 });
    expect(depois.dominios.plataforma.cobertura_completa).toBe(false);
    expect(readFileSync(join(raiz, "gold/base.json"))).toEqual(gold);
    expect(readFileSync(join(raiz, ORIGEM_PRODUTO))).toEqual(origem);
  });

  it.each(ORIGENS_FORA_DA_UI)("recusa produto com origem $caso", ({ opcoes }) => {
    const raiz = fixtureProduto(opcoes);
    expect(() => gerarCobertura(raiz)).toThrow();
  });

  it.each(ORIGENS_FORA_DA_UI)("não exige origem de produto $caso para glossário sem produtos", ({ opcoes }) => {
    const raiz = fixtureProduto({ ...opcoes, comProduto: false });
    expect(gerarCobertura(raiz).glossario).toMatchObject({ termos: 1, nomes_preservados: 0 });
  });

  it("assina os bytes da origem UI mesmo quando o nome literal não muda", () => {
    const raiz = fixtureProduto();
    executar([], raiz);
    const relatorio = readFileSync(join(raiz, RELATORIO));
    const antes = gerarCobertura(raiz);
    const registro = readFileSync(join(raiz, ORIGEM_PRODUTO), "utf8");
    writeFileSync(join(raiz, ORIGEM_PRODUTO), `${registro}// Contexto editorial atualizado, mantendo o nome.\n`);
    const depois = gerarCobertura(raiz);

    expect(depois.glossario).toEqual(antes.glossario);
    expect(depois.escopo.fontes_sha256).not.toBe(antes.escopo.fontes_sha256);
    expect(depois.escopo.arquivos_analisados).toBe(antes.escopo.arquivos_analisados);
    expect(() => executar(["--check"], raiz)).toThrow("desatualizada");
    expect(readFileSync(join(raiz, RELATORIO))).toEqual(relatorio);
  });

  it("invalida o nome do glossário quando o literal de origem é alterado", () => {
    const raiz = fixtureProduto();
    executar([], raiz);
    const relatorio = readFileSync(join(raiz, RELATORIO));
    const bytesGlossario = readFileSync(join(raiz, ARQUIVO));
    escreverRegistroProduto(raiz, "Dados com Nome Alterado");

    expect(() => gerarCobertura(raiz)).toThrow();
    expect(() => executar(["--check"], raiz)).toThrow();
    expect(readFileSync(join(raiz, RELATORIO))).toEqual(relatorio);
    expect(readFileSync(join(raiz, ARQUIVO))).toEqual(bytesGlossario);
  });
});
