import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executar, gerarCoberturaGold } from "../../scripts/cobertura-i18n.mjs";

const CREDITO = "public/obs/data/gold/report.html";
const OBEE = "docs/obee/resultados/revisao-interativa-v3.html";
const DINAMICO_UI = "public/obs/relatorio-dinamico.html";
const PREFIXO_PARECIDO = "public/obs/data/gold-anexo/report.html";
const HELPER = "public/obs/data/gold/helper.ts";
const UI = "public/obs/index.html";
const RELATORIO = "docs/i18n/cobertura.json";
const HTML_CREDITO = '<h1 aria-label="Título acessível">Relatório 100</h1><template><p>Detalhe</p></template><noscript>Alternativa</noscript>';
const HTML_OBEE = "<p>Resumo</p>";
const temporarios: string[] = [];

afterEach(() => {
  for (const pasta of temporarios.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

type Conteudo = {
  path: string;
  dominio: "plataforma" | "credito" | "eficiencia";
  formato: "html" | "json" | "markdown";
  dinamico?: boolean;
};

function fixture(dinamicoNaUi = false) {
  const temporario = mkdtempSync(join(tmpdir(), "i18n-gold-html-"));
  temporarios.push(temporario);
  const raiz = join(temporario, "repo");
  mkdirSync(raiz);
  execFileSync("git", ["init", "--quiet"], { cwd: raiz, stdio: "ignore" });
  const gravar = (path: string, texto: string) => {
    mkdirSync(dirname(join(raiz, path)), { recursive: true });
    writeFileSync(join(raiz, path), texto);
  };
  const ler = (path: string) => readFileSync(join(raiz, path), "utf8");
  const originais: Record<string, string> = {
    "src/pagina.tsx": "export default () => <h1>Interface da plataforma</h1>;",
    "public/obs/data/gold/base.json": '{"titulo":"Indicador","valor":100}',
    [CREDITO]: HTML_CREDITO,
    [OBEE]: HTML_OBEE,
    [UI]: "<p>Sentinela da interface</p>",
    [HELPER]: 'export const rotulo = "Helper legítimo";',
    [PREFIXO_PARECIDO]: "<p>Sentinela estática em prefixo parecido</p>",
    "config/institucional-fixture.json": '{"nome":"Sentinela institucional"}',
    "docs/editorial-fixture.md": "# Sentinela editorial\nTexto institucional.\n",
    ...(dinamicoNaUi ? { [DINAMICO_UI]: "<p>Relatório dinâmico na raiz UI</p>" } : {}),
  };
  const conteudo: Conteudo[] = [
    { path: CREDITO, dominio: "credito", formato: "html" },
    { path: OBEE, dominio: "eficiencia", formato: "html", dinamico: true },
    { path: PREFIXO_PARECIDO, dominio: "credito", formato: "html" },
    { path: "config/institucional-fixture.json", dominio: "plataforma", formato: "json" },
    { path: "docs/editorial-fixture.md", dominio: "plataforma", formato: "markdown" },
  ];
  if (dinamicoNaUi) conteudo.push({ path: DINAMICO_UI, dominio: "credito", formato: "html", dinamico: true });
  const manifesto = {
    schema_version: 1,
    ui: { raizes: ["src", "public/obs"] },
    dominios: [
      { id: "plataforma", nome: "Plataforma", ui: ["src"], gold: [] },
      { id: "credito", nome: "Crédito", ui: ["public/obs"], gold: ["public/obs/data/gold"] },
      { id: "eficiencia", nome: "Eficiência", ui: [], gold: [] },
    ],
    observar: ["src", "public/obs"],
    conteudo,
  };
  originais["config/i18n-inventario.json"] = JSON.stringify(manifesto);
  for (const [path, texto] of Object.entries(originais)) gravar(path, texto);
  return { raiz, temporario, gravar, ler, originais, relatorio: join(raiz, RELATORIO) };
}

const JSON_VAZIO = {
  arquivos: 0,
  ocorrencias_textuais: 0,
  campos_candidatos_nao_catalogados: 0,
  strings_vazias: 0,
  campos_catalogados: { com_ingles: 0, sem_ingles: 0, hash_incompativel: 0 },
};

describe("diagnóstico de HTML derivado, separado da gold JSON e do código", () => {
  it("conta HTML sob gold e HTML dinâmico fora das raízes nos domínios declarados", () => {
    const f = fixture();
    const r = gerarCoberturaGold(f.raiz);
    expect(r.schema_version).toBe(1);
    expect(r.natureza).toBe("diagnostico_gold_nao_versionado");
    expect(r.dominios).toEqual({
      plataforma: JSON_VAZIO,
      credito: { ...JSON_VAZIO, arquivos: 1, ocorrencias_textuais: 1, campos_candidatos_nao_catalogados: 1 },
      eficiencia: JSON_VAZIO,
    });
    expect(r.html_derivado).toEqual({
      plataforma: { arquivos: 0, candidatos_nao_catalogados: 0, scripts_embutidos: {} },
      credito: { arquivos: 1, candidatos_nao_catalogados: 4, scripts_embutidos: { inlinePendentes: 0, externos: 0, dadosPendentes: 0 } },
      eficiencia: { arquivos: 1, candidatos_nao_catalogados: 1, scripts_embutidos: { inlinePendentes: 0, externos: 0, dadosPendentes: 0 } },
    });
    expect(r.escopo.arquivos_analisados).toBe(3);
    expect(existsSync(f.relatorio)).toBe(false);
    for (const [path, texto] of Object.entries(f.originais)) expect(f.ler(path)).toBe(texto);
  });

  it("registra scripts externos, inline, JSON-LD e eventos como pendências sem executá-los", () => {
    const f = fixture();
    const html = '<script src="/nao-carregar.js"></script><script>throw new Error("não executar")</script><script type="application/ld+json">{"valor":100}</script><button onclick="falhar()">Abrir</button>';
    f.gravar(CREDITO, html);
    const r = JSON.parse(executar(["--gold"], f.raiz));
    expect(r.html_derivado.credito).toEqual({
      arquivos: 1,
      candidatos_nao_catalogados: 4,
      scripts_embutidos: { inlinePendentes: 2, externos: 1, dadosPendentes: 1 },
    });
    expect(r.dominios.credito).toEqual({ ...JSON_VAZIO, arquivos: 1, ocorrencias_textuais: 1, campos_candidatos_nao_catalogados: 1 });
    expect(f.ler(CREDITO)).toBe(html);
    expect(existsSync(f.relatorio)).toBe(false);
  });

  it("assina os bytes de cada HTML e recupera a mesma saída ao restaurá-los", () => {
    const f = fixture();
    const original = executar(["--gold"], f.raiz);
    const antes = JSON.parse(original);
    expect(original.endsWith("\n")).toBe(true);
    for (const [path, alterado] of [
      [CREDITO, HTML_CREDITO.replace("Relatório 100", "Relatório 200")],
      [OBEE, "<p>Resumo atualizado</p>"],
    ]) {
      f.gravar(path, alterado);
      const depois = JSON.parse(executar(["--gold"], f.raiz));
      expect(depois.escopo.fontes_sha256).not.toBe(antes.escopo.fontes_sha256);
      expect(depois.html_derivado).toEqual(antes.html_derivado);
      expect(depois.dominios).toEqual(antes.dominios);
      f.gravar(path, f.originais[path]);
      expect(executar(["--gold"], f.raiz)).toBe(original);
    }
  });

  it("mantém schema 2 independente dos HTML de dados sem excluir UI, prefixo parecido ou helper legítimo", () => {
    const f = fixture(true);
    let diagnostico = JSON.parse(executar(["--gold"], f.raiz));
    expect(existsSync(f.relatorio)).toBe(false);
    executar([], f.raiz);
    const bytes = readFileSync(f.relatorio);
    const codigo = JSON.parse(bytes.toString("utf8"));
    expect(codigo.schema_version).toBe(2);
    expect(codigo.escopo.tipo).toBe("fontes_de_codigo");
    for (const id of ["plataforma", "credito", "eficiencia"]) expect(codigo.dominios[id]).not.toHaveProperty("gold");
    expect(codigo).not.toHaveProperty("html_derivado");
    // index.html e helper.ts; os dois HTML derivados dentro de public/obs ficam fora.
    expect(codigo.dominios.credito.interface.arquivos).toBe(2);
    // O HTML em gold-anexo é conteúdo estático, não filho do prefixo gold.
    expect(codigo.dominios.credito.conteudo_adicional.arquivos).toBe(1);
    expect(codigo.dominios.eficiencia.conteudo_adicional.arquivos).toBe(0);

    for (const path of [CREDITO, OBEE, DINAMICO_UI]) {
      f.gravar(path, "<p>Outro relatório: 200</p>");
      expect(executar(["--check"], f.raiz)).toContain("confere");
      const proximo = JSON.parse(executar(["--gold"], f.raiz));
      expect(proximo.escopo.fontes_sha256).not.toBe(diagnostico.escopo.fontes_sha256);
      diagnostico = proximo;
      expect(readFileSync(f.relatorio)).toEqual(bytes);
    }
    for (const path of [CREDITO, OBEE, DINAMICO_UI]) rmSync(join(f.raiz, path));
    expect(executar(["--check"], f.raiz)).toContain("confere");
    expect(readFileSync(f.relatorio)).toEqual(bytes);

    for (const [path, alterado] of [
      [HELPER, 'export const rotulo = "Helper alterado";'],
      [UI, "<p>Interface alterada</p>"],
      [PREFIXO_PARECIDO, "<p>Conteúdo estático alterado</p>"],
    ]) {
      f.gravar(path, alterado);
      expect(() => executar(["--check"], f.raiz)).toThrow("Cobertura desatualizada");
      expect(readFileSync(f.relatorio)).toEqual(bytes);
      f.gravar(path, f.originais[path]);
    }
    expect(executar(["--check"], f.raiz)).toContain("confere");
  });

  it.each(["ausente", "symlink externo"] as const)("rejeita HTML declarado %s somente no diagnóstico, sem escrever relatório", (caso) => {
    const f = fixture();
    // Exercita tanto a ausência de relatório quanto um relatório existente.
    if (caso === "symlink externo") executar([], f.raiz);
    const anterior = existsSync(f.relatorio) ? readFileSync(f.relatorio) : null;
    rmSync(join(f.raiz, CREDITO));
    if (caso === "symlink externo") {
      const externo = join(f.temporario, "externo.html");
      writeFileSync(externo, "<p>Arquivo fora da raiz da fixture</p>");
      symlinkSync(externo, join(f.raiz, CREDITO));
    }
    expect(() => executar(["--gold"], f.raiz)).toThrow(caso === "ausente" ? /ENOENT/ : /Fonte fora do repositório/);
    if (anterior === null) expect(existsSync(f.relatorio)).toBe(false);
    else {
      expect(readFileSync(f.relatorio)).toEqual(anterior);
      expect(executar(["--check"], f.raiz)).toContain("confere");
    }
  });
});
