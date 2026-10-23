import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executar, gerarCobertura, gerarCoberturaGold } from "../../scripts/cobertura-i18n.mjs";
import { assinaturaMensagem } from "../../scripts/i18n/terminologia.mjs";

const INVENTARIO = "config/i18n-inventario.json";
const CONTRATO = "config/i18n-terminologia.json";
const GLOSSARIO = "config/glossario-en.json";
const PT = "src/i18n/pt.ts";
const EN = "src/i18n/en.ts";
const GOLD = "gold/base.json";
const RELATORIO = "docs/i18n/cobertura.json";
const temporarios: string[] = [];
afterEach(() => { for (const path of temporarios.splice(0)) rmSync(path, { recursive: true, force: true }); });

type EntradaEn = { estado: "traduzido"; texto: string } | { estado: "portugues_marcado"; motivo: string };
type Chave = "teste.abertura" | "teste.energia" | "teste.captura" | "teste.resumo";
type Catalogo = { pt: Record<Chave, string>; en: Record<Chave, EntradaEn> };
type Opcoes = { comTerminologia?: boolean; comCatalogo?: boolean; comGlossario?: boolean; observarConfig?: boolean };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

function gitBytes(raiz: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: raiz, stdio: ["ignore", "pipe", "pipe"] });
}
function git(raiz: string, ...args: string[]) { return gitBytes(raiz, ...args).toString("utf8").trim(); }
function escrever(raiz: string, path: string, texto: string) {
  mkdirSync(dirname(join(raiz, path)), { recursive: true });
  writeFileSync(join(raiz, path), texto);
}
function escreverJson(raiz: string, path: string, valor: unknown) {
  escrever(raiz, path, JSON.stringify(valor, null, 2) + "\n");
}
function manifesto({ comTerminologia = true, comCatalogo = true, comGlossario = true, observarConfig = false }: Opcoes = {}) {
  return {
    schema_version: 1,
    ...(comTerminologia ? { terminologia_catalogo: CONTRATO } : {}),
    ...(comCatalogo ? { catalogo: { schema_version: 1, dominio: "plataforma", pt: PT, en: EN } } : {}),
    ...(comGlossario ? { glossario: GLOSSARIO } : {}),
    ui: { raizes: ["src/app"] },
    dominios: [{ id: "plataforma", nome: "Plataforma", ui: ["src/app"], gold: ["gold"] }],
    observar: ["src/app", "src/i18n", "gold", ...(observarConfig ? ["config"] : [])],
  };
}

// Evidências e mensagens sintéticas: não dependem dos catálogos publicados ou de DOMINIOS.
const glossario = {
  schema_version: 1,
  fontes: { exemplo: {
    orgao: "IEA", titulo: "Documento sintético de integração", url: "https://www.iea.org/reports/electricity-2026",
    idioma: "en", formato: "html", sha256_consultado: "0".repeat(64),
  } },
  entradas: {
    "teste.eletricidade": {
      tipo: "termo", pt: "energia elétrica", en: "electricity", contexto: "Conceito sintético para integração.",
      evidencias: [{ fonte: "exemplo", trecho: "electricity", localizacao: "Trecho sintético" }],
    },
    "teste.fonte": {
      tipo: "termo", pt: "fonte de dados", en: "data source", contexto: "Fonte estatística da fixture.",
      evidencias: [{ fonte: "exemplo", trecho: "data source", localizacao: "Trecho sintético" }],
      formas_contextuais: { curta: { pt: "fonte", en: "data source", contexto: "Forma curta nas mensagens da fixture." } },
    },
  },
  pendencias: [],
};

function catalogoSintetico(abertura = "An overview."): Catalogo {
  return {
    pt: {
      "teste.abertura": "Uma apresentação.",
      "teste.energia": "energia elétrica e energia elétrica.",
      "teste.captura": "fonte",
      "teste.resumo": "A fonte.",
    },
    en: {
      "teste.abertura": { estado: "traduzido", texto: abertura },
      "teste.energia": { estado: "traduzido", texto: "electricity and electricity." },
      "teste.captura": { estado: "traduzido", texto: "data source" },
      "teste.resumo": { estado: "traduzido", texto: "The data source." },
    },
  };
}
function contratoSintetico(catalogo: Catalogo) {
  const assinatura = (chave: Chave) => assinaturaMensagem(catalogo.pt[chave], catalogo.en[chave]);
  return {
    schema_version: 1,
    mensagens: {
      "teste.abertura": { classificacao: "sem_termos_tecnicos", sha256_revisado: assinatura("teste.abertura"), justificativa: "Prosa comum de apresentação." },
      "teste.energia": { classificacao: "vinculada", sha256_revisado: assinatura("teste.energia"), referencias: [{ id: "teste.eletricidade", forma: "canonica", ocorrencias: 2 }] },
      "teste.captura": { classificacao: "vinculada", sha256_revisado: assinatura("teste.captura"), referencias: [{ id: "teste.fonte", forma: "curta", ocorrencias: 1 }] },
      "teste.resumo": { classificacao: "vinculada", sha256_revisado: assinatura("teste.resumo"), referencias: [{ id: "teste.fonte", forma: "curta", ocorrencias: 1 }] },
    },
  };
}
function escreverCatalogo(raiz: string, catalogo: Catalogo) {
  escrever(raiz, PT, `export const pt = ${JSON.stringify(catalogo.pt)} as const;\n`);
  escrever(raiz, EN, `export const en = ${JSON.stringify(catalogo.en)} as const;\n`);
}
function fixture(opcoes: Opcoes = {}, catalogo = catalogoSintetico()) {
  const raiz = mkdtempSync(join(tmpdir(), "i18n-terminologia-cobertura-"));
  temporarios.push(raiz);
  for (const path of ["src/app", "src/i18n", "config", "gold"]) mkdirSync(join(raiz, path), { recursive: true });
  git(raiz, "init", "--quiet");
  escreverJson(raiz, INVENTARIO, manifesto(opcoes));
  escrever(raiz, "src/app/page.tsx", "export default () => <h1>Apresentação sintética</h1>;\n");
  escrever(raiz, GOLD, '{"nome":"Série portuguesa","valor":1234.5,"ausente":null}\n');
  if (opcoes.comCatalogo !== false) escreverCatalogo(raiz, catalogo);
  if (opcoes.comGlossario !== false) escreverJson(raiz, GLOSSARIO, glossario);
  const contrato = contratoSintetico(catalogo);
  if (opcoes.comTerminologia !== false) escreverJson(raiz, CONTRATO, contrato);
  return { raiz, catalogo, contrato };
}

describe("terminologia do catálogo no relatório de cobertura", () => {
  it("assina o contrato e conta vínculos, IDs e formas distintos sem comprovar uso de UI ou gold", () => {
    const { raiz, contrato } = fixture({ comTerminologia: false });
    const antes = gerarCobertura(raiz);
    const intactos = [GOLD, PT, EN, GLOSSARIO].map((path) => ({ path, bytes: readFileSync(join(raiz, path)) }));
    escreverJson(raiz, INVENTARIO, manifesto());
    escreverJson(raiz, CONTRATO, contrato);
    const depois = gerarCobertura(raiz);

    expect(antes).not.toHaveProperty("terminologia_catalogo");
    expect(depois.terminologia_catalogo).toEqual({
      path: CONTRATO, sha256: hash(readFileSync(join(raiz, CONTRATO))), schema_version: 1,
      mensagens: 4, mensagens_vinculadas: 3, mensagens_sem_termos_tecnicos: 1,
      // A primeira referência tem duas ocorrências; a mesma forma aparece em duas mensagens.
      referencias: 3, ids_distintos: 2, formas_contextuais_usadas: 1,
      referencias_pt_verificadas: 3, referencias_en_verificadas: 3, referencias_en_pendentes: 0,
      uso_na_interface_verificado: false,
    });
    expect(depois.catalogo).toEqual(antes.catalogo);
    expect(depois.glossario).toEqual(antes.glossario);
    expect(depois.dominios).toEqual(antes.dominios);
    expect(depois.dominios.plataforma.interface.chaves_catalogadas.traduzidas).toBe(0);
    expect(gerarCoberturaGold(raiz).dominios.plataforma.campos_catalogados.com_ingles).toBe(0);
    expect(depois.dominios.plataforma.cobertura_completa).toBe(false);
    for (const { path, bytes } of intactos) expect(readFileSync(join(raiz, path))).toEqual(bytes);
  });

  it("usa os insumos de cada raiz recebida, sem contrato global ou cache entre fixtures", () => {
    const primeira = fixture();
    const segunda = fixture({}, catalogoSintetico("Another overview."));
    const a = gerarCobertura(primeira.raiz).terminologia_catalogo;
    const b = gerarCobertura(segunda.raiz).terminologia_catalogo;
    expect(a?.mensagens).toBe(4);
    expect(b?.mensagens).toBe(4);
    expect(a?.sha256).not.toBe(b?.sha256);
    expect(gerarCobertura(primeira.raiz).terminologia_catalogo).toEqual(a);
    escreverJson(segunda.raiz, CONTRATO, primeira.contrato);
    expect(() => gerarCobertura(segunda.raiz)).toThrow();
    expect(gerarCobertura(primeira.raiz).terminologia_catalogo).toEqual(a);
  });

  it.each(["catálogo", "glossário"])("exige %s mesmo quando sua declaração e seus arquivos estão ausentes", (insumo) => {
    const { raiz } = fixture({ comCatalogo: insumo !== "catálogo", comGlossario: insumo !== "glossário" });
    expect(() => gerarCobertura(raiz)).toThrow("exige catálogo e glossário validados no inventário");
  });

  it.each([CONTRATO, PT, EN, GLOSSARIO])("recusa insumo declarado ausente: %s", (path) => {
    const { raiz } = fixture();
    rmSync(join(raiz, path));
    expect(() => gerarCobertura(raiz)).toThrow();
  });

  it.each([undefined, null, "", "config/outro.json", "config/./i18n-terminologia.json", "../i18n-terminologia.json", { path: CONTRATO }])
    ("recusa declaração ausente ou não canônica com contrato presente %#", (terminologia_catalogo) => {
      const { raiz } = fixture();
      escreverJson(raiz, INVENTARIO, { ...manifesto(), terminologia_catalogo });
      expect(() => gerarCobertura(raiz)).toThrow(`declarar a terminologia do catálogo em ${CONTRATO}`);
    });

  it("não trata symlink quebrado sem declaração como ausência legítima do contrato", () => {
    const { raiz } = fixture({ comTerminologia: false });
    symlinkSync(join(raiz, "arquivo-ausente.json"), join(raiz, CONTRATO));
    expect(() => gerarCobertura(raiz)).toThrow(`declarar a terminologia do catálogo em ${CONTRATO}`);
  });

  it("recusa diretório no lugar do arquivo canônico", () => {
    const { raiz } = fixture();
    rmSync(join(raiz, CONTRATO));
    mkdirSync(join(raiz, CONTRATO));
    expect(() => gerarCobertura(raiz)).toThrow("deve ser arquivo dentro do repositório");
  });

  it("recusa contrato válido por symlink para raiz irmã com prefixo igual", () => {
    const { raiz, contrato } = fixture();
    const externa = `${raiz}-vizinha`;
    temporarios.push(externa);
    escreverJson(externa, CONTRATO, contrato);
    rmSync(join(raiz, CONTRATO));
    symlinkSync(join(externa, CONTRATO), join(raiz, CONTRATO));
    expect(() => gerarCobertura(raiz)).toThrow("deve ser arquivo dentro do repositório");
  });

  it("resolve a raiz real recebida quando seu caminho é um symlink", () => {
    const { raiz } = fixture();
    const atalho = `${raiz}-atalho`;
    temporarios.push(atalho);
    symlinkSync(raiz, atalho, "dir");
    expect(gerarCobertura(atalho)).toEqual(gerarCobertura(raiz));
  });

  it.each([
    { comCatalogo: false, comGlossario: false },
    { comCatalogo: true, comGlossario: false },
    { comCatalogo: false, comGlossario: true },
    { comCatalogo: true, comGlossario: true },
  ])("preserva fixtures antigas sem declaração nem arquivo de terminologia %#", (opcoes) => {
    const { raiz } = fixture({ ...opcoes, comTerminologia: false });
    expect(gerarCobertura(raiz)).not.toHaveProperty("terminologia_catalogo");
    executar([], raiz);
    expect(executar(["--comparar", "docs/i18n/cobertura.json"], raiz)).toContain("confere");
  });

  it("encaminha os bytes originais do contrato e rejeita chaves JSON duplicadas", () => {
    const { raiz, contrato } = fixture();
    const bytes = JSON.stringify(contrato).replace('"schema_version":1', '"schema_version":0,"schema_version":1');
    escrever(raiz, CONTRATO, bytes);
    expect(() => gerarCobertura(raiz)).toThrow();
  });

  it("detecta mudança nos bytes válidos sem regravar relatório, assinaturas revisadas ou fontes portuguesas", () => {
    const { raiz, contrato } = fixture();
    executar([], raiz);
    const relatorio = readFileSync(join(raiz, RELATORIO));
    const antes = gerarCobertura(raiz);
    const intactos = [GOLD, PT, EN, GLOSSARIO].map((path) => ({ path, bytes: readFileSync(join(raiz, path)) }));
    const novoTexto = JSON.stringify(contrato) + "\n\n";
    escrever(raiz, CONTRATO, novoTexto);

    expect(() => executar(["--comparar", "docs/i18n/cobertura.json"], raiz)).toThrow("desatualizada");
    expect(readFileSync(join(raiz, RELATORIO))).toEqual(relatorio);
    expect(readFileSync(join(raiz, CONTRATO), "utf8")).toBe(novoTexto);
    expect(JSON.parse(novoTexto)).toEqual(contrato);
    const depois = gerarCobertura(raiz);
    expect(depois.terminologia_catalogo).toEqual({ ...antes.terminologia_catalogo, sha256: hash(novoTexto) });
    expect(depois.terminologia_catalogo?.sha256).not.toBe(antes.terminologia_catalogo?.sha256);
    expect(depois.catalogo).toEqual(antes.catalogo);
    expect(depois.glossario).toEqual(antes.glossario);
    for (const { path, bytes } of intactos) expect(readFileSync(join(raiz, path))).toEqual(bytes);

    executar([], raiz);
    expect(executar(["--comparar", "docs/i18n/cobertura.json"], raiz)).toContain("confere");
    expect(readFileSync(join(raiz, CONTRATO), "utf8")).toBe(novoTexto);
  });

  it("não revisa automaticamente a assinatura quando uma mensagem geral é alterada", () => {
    const { raiz, catalogo } = fixture();
    executar([], raiz);
    const relatorio = readFileSync(join(raiz, RELATORIO));
    const contrato = readFileSync(join(raiz, CONTRATO));
    const gold = readFileSync(join(raiz, GOLD));
    catalogo.en["teste.abertura"] = { estado: "traduzido", texto: "Another introduction." };
    escreverCatalogo(raiz, catalogo);

    expect(() => executar([], raiz)).toThrow();
    expect(readFileSync(join(raiz, RELATORIO))).toEqual(relatorio);
    expect(readFileSync(join(raiz, CONTRATO))).toEqual(contrato);
    expect(readFileSync(join(raiz, GOLD))).toEqual(gold);
  });

  it("separa referências PT verificadas das referências EN pendentes no fallback revisado", () => {
    const catalogo = catalogoSintetico();
    catalogo.en["teste.energia"] = { estado: "portugues_marcado", motivo: "Tradução em revisão." };
    const { raiz } = fixture({}, catalogo);
    const relatorio = gerarCobertura(raiz);
    expect(relatorio.terminologia_catalogo).toMatchObject({
      mensagens: 4, mensagens_vinculadas: 3, mensagens_sem_termos_tecnicos: 1,
      referencias: 3, ids_distintos: 2, formas_contextuais_usadas: 1,
      referencias_pt_verificadas: 3, referencias_en_verificadas: 2, referencias_en_pendentes: 1,
      uso_na_interface_verificado: false,
    });
    expect(relatorio.catalogo).toMatchObject({ traducoes_disponiveis: 3, portugues_marcado_declarado: 1, uso_na_interface_verificado: false });
    expect(relatorio.dominios.plataforma.interface.chaves_catalogadas.portugues_marcado).toBe(0);
    expect(gerarCoberturaGold(raiz).dominios.plataforma.campos_catalogados.com_ingles).toBe(0);
  });
});
