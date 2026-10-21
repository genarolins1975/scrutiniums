import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { construirRelatorio, executar, gerarCobertura, serializarRelatorio } from "../../scripts/cobertura-i18n.mjs";

const temporarios: string[] = [];
afterEach(() => { for (const dir of temporarios.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const manifesto = {
  schema_version: 1,
  ui: { raizes: ["src/app"] },
  dominios: [{ id: "plataforma", nome: "Plataforma", ui: ["src/app"], gold: ["gold"] }],
  observar: ["src/app", "gold"],
};
const fontes = {
  ui: [{ path: "src/app/page.tsx", dominio: "plataforma", formato: "ts" }],
  gold: [{ path: "gold/base.json", dominio: "plataforma" }],
  conteudo: [], naoClassificadas: [], excluidas: [], materializados: [],
};
const textos: Record<string, string> = {
  "src/app/page.tsx": "export default function Home() { return <h1>Dados</h1>; }",
  "gold/base.json": JSON.stringify({ itens: [{ nome: "Uma série", valor: 10 }, { nome: "Outra série", valor: 0 }] }),
};
const ler = (path: string) => Buffer.from(textos[path]);

function fixture() {
  const raiz = mkdtempSync(join(tmpdir(), "i18n-cobertura-"));
  temporarios.push(raiz);
  for (const dir of ["src/app", "gold", "config"]) mkdirSync(join(raiz, dir), { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: raiz });
  writeFileSync(join(raiz, "config/i18n-inventario.json"), JSON.stringify(manifesto));
  for (const [path, texto] of Object.entries(textos)) writeFileSync(join(raiz, path), texto);
  return raiz;
}

describe("relatório inicial de cobertura i18n", () => {
  it("não transforma candidatos em traduções, fallbacks verificados ou percentuais", () => {
    const copia = JSON.stringify(textos);
    const r = construirRelatorio(manifesto, fontes, ler);
    const d = r.dominios.plataforma;
    expect(d.interface.candidatos_nao_catalogados).toBeGreaterThan(0);
    expect(d.interface.chaves_catalogadas).toEqual({ traduzidas: 0, portugues_marcado: 0, sem_traducao: 0, nomes_preservados: 0 });
    expect(d.interface.percentual_traduzido).toBeNull();
    expect(d.gold).toMatchObject({ arquivos: 1, ocorrencias_textuais: 2, campos_candidatos_nao_catalogados: 1 });
    expect(d.gold.campos_catalogados).toEqual({ com_ingles: 0, sem_ingles: 0, hash_incompativel: 0 });
    expect(d.rotas).toMatchObject({ paginas_pt: 1, paginas_en: 0, paridade_verificada: false });
    expect(d.cobertura_completa).toBe(false);
    expect(JSON.stringify(textos)).toBe(copia);
  });

  it("rejeita contagem duplicada, domínio desconhecido e sintaxe não analisável", () => {
    expect(() => construirRelatorio(manifesto, { ...fontes, ui: [...fontes.ui, ...fontes.ui] }, ler)).toThrow("duas vezes");
    expect(() => construirRelatorio(manifesto, { ...fontes, gold: [{ path: "gold/base.json", dominio: "outro" }] }, ler)).toThrow("Domínio desconhecido");
    expect(() => construirRelatorio(manifesto, fontes, () => Buffer.from("const x = <h1>"))).toThrow("Sintaxe não analisada");
  });

  it("produz os mesmos bytes para a mesma fonte, independentemente da ordem de descoberta", () => {
    const outra = { path: "src/app/sobre/page.tsx", dominio: "plataforma", formato: "ts" };
    const leitura = (path: string) => path === outra.path ? Buffer.from("export default () => <p>Sobre</p>") : ler(path);
    const a = construirRelatorio(manifesto, { ...fontes, ui: [...fontes.ui, outra] }, leitura);
    const b = construirRelatorio(manifesto, { ...fontes, ui: [outra, ...fontes.ui] }, leitura);
    expect(serializarRelatorio(a)).toBe(serializarRelatorio(b));
    const alterado = construirRelatorio(manifesto, fontes, (path: string) => path.endsWith(".json") ? Buffer.from(textos[path].replace('"valor":10', '"valor":11')) : ler(path));
    expect(alterado.escopo.fontes_sha256).not.toBe(construirRelatorio(manifesto, fontes, ler).escopo.fontes_sha256);
  });

  it("confere o arquivo versionado sem reescrevê-lo e detecta uma fonte nova", () => {
    const raiz = fixture();
    executar([], raiz);
    const arquivo = join(raiz, "docs/i18n/cobertura.json");
    const original = readFileSync(arquivo);
    expect(executar(["--check"], raiz)).toContain("confere");
    writeFileSync(join(raiz, "src/app/novo.tsx"), 'export const aviso = "Novo texto";');
    expect(() => executar(["--check"], raiz)).toThrow("desatualizada");
    expect(readFileSync(arquivo)).toEqual(original);
    executar([], raiz);
    expect(executar(["--check"], raiz)).toContain("confere");
    expect(readFileSync(join(raiz, "gold/base.json"), "utf8")).toBe(textos["gold/base.json"]);
  });

  it("exige integrar o catálogo antes de medir as futuras fontes inglesas", () => {
    const raiz = fixture();
    mkdirSync(join(raiz, "src/app/[lang]"));
    expect(() => gerarCobertura(raiz)).toThrow("integrar o catálogo");
    expect(() => executar(["--check", "--stdout"], raiz)).toThrow("Uso:");
  });
});
