import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import inventario from "../../config/i18n-inventario.json";
import { PADROES_DE_IDIOMA, PARES_DE_IDIOMA, parDeIdioma } from "@/lib/i18n-rotas";
import { executar, gerarCobertura, gerarCoberturaGold } from "../../scripts/cobertura-i18n.mjs";
import { descobrirFontes } from "../../scripts/i18n/fontes.mjs";
import { validarRotasLiterais } from "../../scripts/i18n/rotas.mjs";

const INVENTARIO = "config/i18n-inventario.json";
const RELATORIO = "docs/i18n/cobertura.json";
const PT = "src/app/sobre/page.tsx";
const EN = "src/app/en/sobre/page.tsx";
const rotas = { schema_version: 1, literais: [{ pt: "/sobre", conteudo: "portugues_marcado" }] };
const manifesto = {
  schema_version: 1,
  catalogo: { schema_version: 1, dominio: "plataforma", pt: "src/i18n/pt.ts", en: "src/i18n/en.ts" },
  ui: { raizes: ["src/app"] },
  dominios: [
    { id: "plataforma", nome: "Plataforma", ui: ["src/app"], gold: ["gold"] },
    { id: "energia", nome: "Energia", ui: ["src/app/setor-eletrico"], gold: [] },
  ],
  observar: ["src/app", "src/i18n", "gold"],
};
const temporarios: string[] = [];
afterEach(() => { for (const path of temporarios.splice(0)) rmSync(path, { recursive: true, force: true }); });

function escrever(raiz: string, path: string, texto: string) {
  mkdirSync(dirname(join(raiz, path)), { recursive: true });
  writeFileSync(join(raiz, path), texto);
}
function declarar(raiz: string, declaracao: unknown = rotas, extra = {}) {
  escrever(raiz, INVENTARIO, JSON.stringify({ ...manifesto, rotas: declaracao, ...extra }));
}
function git(raiz: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function fixture(comIrma = true) {
  const raiz = mkdtempSync(join(tmpdir(), "i18n-rotas-cobertura-"));
  temporarios.push(raiz);
  git(raiz, "init", "--quiet");
  declarar(raiz, rotas, comIrma ? {} : { rotas: undefined });
  escrever(raiz, "src/app/page.tsx", "export default () => <h1>Dados</h1>;\n");
  escrever(raiz, PT, "export default () => <p>Dados publicados: 1234.5</p>;\n");
  escrever(raiz, "gold/base.json", '{"nome":"Série portuguesa","valor":1234.5}\n');
  escrever(raiz, manifesto.catalogo.pt, 'export const pt = { "traducao.portugues_apenas": "Somente em português" } as const;\n');
  escrever(raiz, manifesto.catalogo.en, 'export const en = { "traducao.portugues_apenas": { estado: "traduzido", texto: "Portuguese only" } } as const;\n');
  // A mera presença da fonte, mesmo sem marcador, não pode virar prova de HTML.
  if (comIrma) escrever(raiz, EN, 'export { default } from "../../sobre/page";\n');
  return raiz;
}

describe("irmãs literais declaradas no inventário", () => {
  it("conta fontes, pares e pendências sem afirmar tradução, acesso ou fallback renderizado", () => {
    const raiz = fixture();
    escrever(raiz, "src/app/dados/[slug]/page.tsx", "export default () => <p>Dados</p>;");
    escrever(raiz, "src/app/app/(foco)/conta/page.tsx", "export default () => <p>Conta</p>;");
    escrever(raiz, "src/app/en/layout.tsx", "export default ({ children }) => children;");
    const originais = [PT, "gold/base.json"].map((path) => readFileSync(join(raiz, path)));
    const r = gerarCobertura(raiz);
    expect(gerarCobertura(raiz).dominios.plataforma.gold).toBeUndefined();
    expect(gerarCoberturaGold(raiz).dominios.plataforma.campos_catalogados.com_ingles).toBe(0);
    expect(r.irmas_declaradas).toEqual({
      schema_version: 1,
      pares: [{ pt: "/sobre", en: "/en/sobre", dominio: "plataforma", conteudo_declarado: "portugues_marcado",
        fontes: { pt: PT, en: EN }, arquivos_presentes: true }],
      pares_estruturais: 1, fallbacks_declarados: 1,
      html_verificado_pelo_inventario: false, acesso_verificado_pelo_inventario: false,
    });
    expect(r.dominios.plataforma).toMatchObject({
      rotas: { paginas_pt: 4, paginas_en: 1, paginas_pt_literais: 2, paginas_pt_fora_do_adaptador: 2,
        paginas_pt_literais_sem_irma: 1, pares_estruturais: 1, fallbacks_declarados: 1, paridade_verificada: false },
      interface: { chaves_catalogadas: { traduzidas: 0, portugues_marcado: 0 }, percentual_traduzido: null },
      cobertura_completa: false,
    });
    expect([PT, "gold/base.json"].map((path) => readFileSync(join(raiz, path)))).toEqual(originais);
  });

  it("deriva a raiz inglesa e ordena pares sem depender da ordem das fontes", () => {
    const raiz = fixture();
    declarar(raiz, { schema_version: 1, literais: [...rotas.literais, { pt: "/", conteudo: "portugues_marcado" }] });
    escrever(raiz, "src/app/en/page.tsx", 'export { default } from "../page";');
    const m = JSON.parse(readFileSync(join(raiz, INVENTARIO), "utf8"));
    const fontes = descobrirFontes(raiz, m);
    const a = validarRotasLiterais(raiz, m, fontes);
    const b = validarRotasLiterais(raiz, m, { ...fontes, ui: [...fontes.ui].reverse() });
    expect(a).toEqual(b);
    expect(a?.pares.map(({ pt, en }: { pt: string; en: string }) => [pt, en])).toEqual([["/", "/en"], ["/sobre", "/en/sobre"]]);
  });

  it("atribui a irmã ao domínio português sem publicar o observatório real", () => {
    const raiz = fixture();
    declarar(raiz, { schema_version: 1, literais: [{ pt: "/setor-eletrico/metodologia", conteudo: "portugues_marcado" }] });
    rmSync(join(raiz, EN));
    escrever(raiz, "src/app/setor-eletrico/metodologia/page.tsx", "export default () => <p>Metodologia</p>;");
    escrever(raiz, "src/app/en/setor-eletrico/metodologia/page.tsx", "export default () => <p>Metodologia</p>;");
    const r = gerarCobertura(raiz);
    expect(r.dominios.energia.rotas).toMatchObject({ paginas_pt: 1, paginas_en: 1, pares_estruturais: 1, paginas_pt_literais_sem_irma: 0 });
    expect(r.dominios.plataforma.rotas.paginas_en).toBe(0);
    expect(r.irmas_declaradas?.pares[0].dominio).toBe("energia");
  });

  it.each([
    {}, { ...rotas, schema_version: 2 }, { ...rotas, ignorar: true }, { ...rotas, literais: [] },
    { ...rotas, literais: [...rotas.literais, ...rotas.literais] },
    ...["/sobre/", "/en/sobre", "/sobre?x=1", "/sobre#x", "/sobre//erros", "/./sobre", "/%73obre", "/[slug]", "/(grupo)/sobre", "/sobre\\erros"].map((pt) => ({ ...rotas, literais: [{ pt, conteudo: "portugues_marcado" }] })),
    { ...rotas, literais: [{ pt: "/sobre", conteudo: "automatico" }] },
    { ...rotas, literais: [{ ...rotas.literais[0], aberta: true }] },
  ])("recusa declaração inválida ou ainda não suportada %#", (declaracao) => {
    const raiz = fixture();
    declarar(raiz, declaracao);
    expect(() => gerarCobertura(raiz)).toThrow(/inválida|não suportado|duplicada/);
  });

  it.each([PT, EN])("exige a fonte da irmã: %s", (path) => {
    const raiz = fixture();
    rmSync(join(raiz, path));
    expect(() => gerarCobertura(raiz)).toThrow();
  });

  it.each([
    "src/app/en/nova/page.tsx", "src/app/en/sobre/page.jsx", "src/app/en/sobre/route.ts",
    "src/app/en/[slug]/page.tsx", "src/app/en/(grupo)/nova/page.tsx",
    "src/app/en/sobre/opengraph-image.tsx", "src/app/en/icon.png",
  ])("não aceita endpoints ingleses fora da declaração: %s", (path) => {
    const raiz = fixture();
    escrever(raiz, path, path.endsWith(".png") ? "imagem sintética" : "export default () => null;");
    expect(() => gerarCobertura(raiz)).toThrow(/não declarada|fora do adaptador|Metadata route/);
  });

  it("não deixa exclusões ocultarem uma página inglesa nova", () => {
    const raiz = fixture();
    const nova = "src/app/en/nova/page.tsx";
    escrever(raiz, nova, "export default () => null;");
    declarar(raiz, rotas, { exclusoes: [{ prefixo: nova, motivo: "Fixture" }] });
    expect(() => gerarCobertura(raiz)).toThrow("Página inglesa não declarada");
  });

  it("recusa uma irmã fora do repositório e uma fonte declarada excluída", () => {
    const raiz = fixture();
    declarar(raiz, rotas, { exclusoes: [{ prefixo: EN, motivo: "Fixture" }] });
    expect(() => gerarCobertura(raiz)).toThrow("ausente do inventário");
    declarar(raiz);
    const externa = mkdtempSync(join(tmpdir(), "i18n-rota-externa-"));
    temporarios.push(externa);
    escrever(externa, "page.tsx", "export default () => null;");
    rmSync(join(raiz, EN));
    symlinkSync(join(externa, "page.tsx"), join(raiz, EN));
    expect(() => gerarCobertura(raiz)).toThrow("fora do repositório");
  });

  it("conserva as guardas para EN sem declaração e declaração sem catálogo", () => {
    const raiz = fixture();
    declarar(raiz, rotas, { rotas: undefined });
    expect(() => gerarCobertura(raiz)).toThrow("precisa integrar");
    declarar(raiz, rotas, { catalogo: undefined });
    rmSync(join(raiz, "src/i18n"), { recursive: true });
    expect(() => gerarCobertura(raiz)).toThrow("precisa integrar o catálogo");
  });

  it("assina mudanças em cada irmã sem regravar o relatório durante --check", () => {
    const raiz = fixture();
    executar([], raiz);
    const original = readFileSync(join(raiz, RELATORIO));
    for (const path of [PT, EN]) {
      const fonte = readFileSync(join(raiz, path), "utf8");
      escrever(raiz, path, fonte + "\n// alteração sintética\n");
      expect(() => executar(["--check"], raiz)).toThrow("desatualizada");
      expect(readFileSync(join(raiz, RELATORIO))).toEqual(original);
      escrever(raiz, path, fonte);
    }
    expect(executar(["--check"], raiz)).toContain("confere");
  });

  it("mantém runtime e inventário com os mesmos pares e estados", () => {
    const raiz = process.cwd();
    const resumo = validarRotasLiterais(raiz, inventario, descobrirFontes(raiz, inventario));
    type Resumo = { pt: string; en: string; conteudo_declarado: string; padrao?: boolean };
    const pares = (resumo?.pares ?? []) as Resumo[];
    expect(PARES_DE_IDIOMA).toEqual(pares.filter((par) => !par.padrao).map((par) => ({ pt: par.pt, en: par.en, conteudo: par.conteudo_declarado })));
    // padrões com parâmetro: o runtime reconhece o mesmo conjunto declarado no inventário
    expect(PADROES_DE_IDIOMA.map((p) => ({ pt: p.pt, conteudo: p.conteudo }))).toEqual(pares.filter((par) => par.padrao).map((par) => ({ pt: par.pt, conteudo: par.conteudo_declarado })));
    for (const par of PARES_DE_IDIOMA) {
      expect(parDeIdioma(par.pt)).toEqual(par);
      expect(parDeIdioma(par.en)).toEqual(par);
    }
  });
});
