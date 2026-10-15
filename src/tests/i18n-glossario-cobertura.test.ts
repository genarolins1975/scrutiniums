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
