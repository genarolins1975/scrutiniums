import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executar, gerarCobertura, gerarCoberturaGold } from "../../scripts/cobertura-i18n.mjs";

const temporarios: string[] = [];
afterEach(() => { for (const path of temporarios.splice(0)) rmSync(path, { recursive: true, force: true }); });
const INVENTARIO = "config/i18n-inventario.json";
const RELATORIO = "docs/i18n/cobertura.json";
const declaracao = { schema_version: 1, dominio: "plataforma", pt: "src/i18n/pt.ts", en: "src/i18n/en.ts" };
const manifesto = {
  schema_version: 1,
  catalogo: declaracao,
  ui: { raizes: ["src/app"] },
  dominios: [{ id: "plataforma", nome: "Plataforma", ui: ["src/app"], gold: ["gold"] }],
  observar: ["src/app", "src/i18n", "gold"],
};
const pt = 'export const pt = { "idioma.seletor": "Idioma" } as const;\n';
const en = 'export const en = { "idioma.seletor": { estado: "traduzido", texto: "Language" } } as const;\n';

function git(raiz: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function escreverManifesto(raiz: string, valor: unknown) {
  writeFileSync(join(raiz, INVENTARIO), JSON.stringify(valor) + "\n");
}
function fixture(comCatalogo = true) {
  const raiz = mkdtempSync(join(tmpdir(), "i18n-catalogo-cobertura-"));
  temporarios.push(raiz);
  for (const path of ["src/app", "src/i18n", "config", "gold"]) mkdirSync(join(raiz, path), { recursive: true });
  git(raiz, "init", "--quiet");
  escreverManifesto(raiz, comCatalogo ? manifesto : { ...manifesto, catalogo: undefined });
  writeFileSync(join(raiz, "src/app/page.tsx"), "export default () => <h1>Dados</h1>;\n");
  writeFileSync(join(raiz, "gold/base.json"), '{"nome":"Série portuguesa","valor":1234.5}\n');
  if (comCatalogo) {
    writeFileSync(join(raiz, declaracao.pt), pt);
    writeFileSync(join(raiz, declaracao.en), en);
  }
  return raiz;
}

describe("catálogo disponível separado da cobertura efetiva", () => {
  it("conta e assina mensagens sem declarar página, gold ou marcador traduzido", () => {
    const raiz = fixture();
    const gold = readFileSync(join(raiz, "gold/base.json"));
    executar([], raiz);
    const original = readFileSync(join(raiz, RELATORIO));
    const relatorio = gerarCobertura(raiz);
    expect(gerarCobertura(raiz).dominios.plataforma.gold).toBeUndefined();
    expect(gerarCoberturaGold(raiz).dominios.plataforma.campos_catalogados.com_ingles).toBe(0);
    expect(relatorio).toMatchObject({
      etapa: "inventario_com_catalogo_de_infraestrutura",
      catalogo: { dominio: "plataforma", chaves: 1, traducoes_disponiveis: 1, portugues_marcado_declarado: 0, uso_na_interface_verificado: false },
      dominios: { plataforma: {
        interface: { arquivos: 1, chaves_catalogadas: { traduzidas: 0, portugues_marcado: 0 }, percentual_traduzido: null },

        rotas: { paginas_pt: 1, paginas_en: 0, paridade_verificada: false },
        cobertura_completa: false,
      } },
    });
    expect(relatorio.escopo.nao_classificadas).toEqual([]);
    expect(executar(["--check"], raiz)).toContain("confere");

    writeFileSync(join(raiz, declaracao.en), 'export const en = { "idioma.seletor": { estado: "portugues_marcado", motivo: "Revisão pendente" } } as const;\n');
    expect(() => executar(["--check"], raiz)).toThrow("desatualizada");
    expect(readFileSync(join(raiz, RELATORIO))).toEqual(original);
    const atualizado = gerarCobertura(raiz);
    expect(atualizado.catalogo).toMatchObject({ traducoes_disponiveis: 0, portugues_marcado_declarado: 1, uso_na_interface_verificado: false });
    expect(atualizado.catalogo?.arquivos.en.sha256).not.toBe(relatorio.catalogo?.arquivos.en.sha256);
    expect(atualizado.dominios.plataforma.interface.chaves_catalogadas.portugues_marcado).toBe(0);
    expect(readFileSync(join(raiz, "gold/base.json"))).toEqual(gold);
  });

  it.each([declaracao.pt, declaracao.en])("recusa par incompleto: falta %s", (path) => {
    const raiz = fixture();
    rmSync(join(raiz, path));
    expect(() => gerarCobertura(raiz)).toThrow();
  });

  it.each([
    undefined,
    { ...declaracao, pt: "../pt.ts" },
    { ...declaracao, dominio: "desconhecido" },
    { ...declaracao, ignorar: true },
  ])("recusa declaração ausente ou inválida %#", (catalogo) => {
    const raiz = fixture();
    escreverManifesto(raiz, { ...manifesto, catalogo });
    expect(() => gerarCobertura(raiz)).toThrow("catálogo único");
  });

  it.each(["src/app/en", "src/app/[lang]", "public/obs/i18n/en.json", "public/i18n/en"])("mantém a guarda de suporte ainda ausente em %s", (path) => {
    const raiz = fixture();
    mkdirSync(join(raiz, path), { recursive: true });
    expect(() => gerarCobertura(raiz)).toThrow("precisa integrar");
  });

  it("recusa dicionário que resolve fora do repositório", () => {
    const raiz = fixture();
    const externa = mkdtempSync(join(tmpdir(), "i18n-catalogo-externo-"));
    temporarios.push(externa);
    writeFileSync(join(externa, "en.ts"), en);
    rmSync(join(raiz, declaracao.en));
    symlinkSync(join(externa, "en.ts"), join(raiz, declaracao.en));
    expect(() => gerarCobertura(raiz)).toThrow("fora do repositório");
  });
});
