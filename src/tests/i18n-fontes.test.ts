import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { descobrirFontes } from "../../scripts/i18n/fontes.mjs";

let temporario: string;
let raiz: string;
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function gravar(path: string, bytes: string | Buffer) {
  const destino = join(raiz, path);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, bytes);
}

function manifesto(alteracoes: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    ui: { raizes: ["src"] },
    dominios: [{ id: "plataforma", ui: ["src"], gold: ["public/gold"] }],
    observar: ["src", "public", "pipeline"],
    exclusoes: [{ sufixo: ".min.js", motivo: "Bundle já representado pelo fonte." }],
    ...alteracoes,
  };
}

function seed(opcoes: { base64?: boolean; identica?: boolean; porUf?: boolean } = {}) {
  const payload = Buffer.from('{"titulo":"Fonte canônica","valor":12}\n');
  const comprimido = gzipSync(payload);
  const origem = opcoes.base64 ? "pipeline/seed.gz.b64" : "pipeline/seed.json.gz";
  const bytes = opcoes.base64 ? Buffer.from(comprimido.toString("base64") + "\n") : comprimido;
  gravar(origem, bytes);
  gravar("scripts/materializar.mjs", 'throw new Error("Gerador não deve ser executado pelo inventário");');
  gravar(".gitignore", "public/gold/*\n");
  gravar("public/gold/saida.json", payload);
  const registro = opcoes.base64
    ? { arquivo: "scripts/materializar.mjs", constante: "SHA256_SEED", bytes: "descomprimidos" }
    : { arquivo: "pipeline/manifesto.json", campo: "sha256", bytes: "originais" };
  if (opcoes.base64) gravar(registro.arquivo, `export const SHA256_SEED = '${sha256(payload)}';\nthrow new Error('Não executar');`);
  else gravar(registro.arquivo, JSON.stringify({ sha256: sha256(bytes) }));
  const item = {
    id: "fixture", dominio: "plataforma", origem,
    encoding: opcoes.base64 ? "gzip-base64" : "gzip",
    hash: registro, gerador: "scripts/materializar.mjs", diretorio: "public/gold",
    arquivos: ["saida.json"],
    ...(opcoes.identica ? { saida_identica: "saida.json" } : {}),
    ...(opcoes.porUf ? { por_uf: "uf-{uf}.json" } : {}),
  };
  return { item, payload, manifesto: manifesto({ materializados: [item] }) };
}

beforeEach(() => {
  temporario = mkdtempSync(join(tmpdir(), "scrutiniums-i18n-fontes-"));
  raiz = join(temporario, "repo");
  mkdirSync(join(raiz, "src"), { recursive: true });
  mkdirSync(join(raiz, "public/gold"), { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: raiz, stdio: "ignore" });
});

afterEach(() => rmSync(temporario, { recursive: true, force: true }));

describe("descoberta Git das fontes de i18n", () => {
  it("inclui fontes rastreadas e novas sem lista manual por arquivo", () => {
    gravar("src/existente.tsx", "export default () => <h1>Existente</h1>;");
    execFileSync("git", ["add", "src/existente.tsx"], { cwd: raiz });
    const antes = descobrirFontes(raiz, manifesto());
    gravar("src/nova.tsx", "export default () => <h1>Nova</h1>;");
    gravar("public/gold/novo.json", '{"nome":"Indicador"}');
    const depois = descobrirFontes(raiz, manifesto());
    expect(antes.ui.map((f: { path: string }) => f.path)).toEqual(["src/existente.tsx"]);
    expect(depois.ui.map((f: { path: string }) => f.path)).toEqual(["src/existente.tsx", "src/nova.tsx"]);
    expect(depois.gold).toEqual([{ path: "public/gold/novo.json", dominio: "plataforma" }]);
  });

  it("ignora arquivo rastreado que foi apagado da pasta de trabalho (gold do dia com rsync --delete)", () => {
    gravar("public/gold/fica.json", '{"nome":"Fica"}');
    gravar("public/gold/sai.json", '{"nome":"Sai"}');
    execFileSync("git", ["add", "public/gold"], { cwd: raiz });
    rmSync(join(raiz, "public/gold/sai.json"));
    expect(descobrirFontes(raiz, manifesto()).gold).toEqual([{ path: "public/gold/fica.json", dominio: "plataforma" }]);
  });

  it("separa exclusões justificadas e arquivos observados sem extrator", () => {
    gravar("src/app.js", 'const titulo = "Aplicativo";');
    gravar("src/app.min.js", 'const titulo="Aplicativo";');
    gravar("src/legenda.json", '{"titulo":"Ainda não catalogado"}');
    gravar("public/relatorio.csv", "nome,valor\nLinha,1\n");
    gravar("fora.md", "Não está nas raízes observadas.");
    const r = descobrirFontes(raiz, manifesto());
    expect(r.ui).toEqual([{ path: "src/app.js", dominio: "plataforma", formato: "ts" }]);
    expect(r.excluidas).toEqual([{ path: "src/app.min.js", motivo: "Bundle já representado pelo fonte." }]);
    expect(r.naoClassificadas.map((f: { path: string }) => f.path)).toEqual(["public/relatorio.csv", "src/legenda.json"]);
  });

  it("usa o domínio de prefixo mais específico e não aceita ambiguidade", () => {
    gravar("src/energia/pagina.tsx", "export default () => null;");
    gravar("src/energiavelha.tsx", "export default () => null;");
    const dominios = [
      { id: "geral", ui: ["src"], gold: ["public/gold"] },
      { id: "energia", ui: ["src/energia"], gold: [] },
    ];
    expect(descobrirFontes(raiz, manifesto({ dominios })).ui.map((f: { dominio: string }) => f.dominio)).toEqual(["energia", "geral"]);
    expect(() => descobrirFontes(raiz, manifesto({ dominios: [...dominios, { id: "duplicado", ui: ["src/energia"] }] }))).toThrow(/ambíguo/);
  });

  it("inclui conteúdo declarado fora das raízes e exige sua existência", () => {
    gravar("docs/institucional.md", "Conteúdo institucional.");
    const m = manifesto({ conteudo: [{ path: "docs/institucional.md", dominio: "plataforma", formato: "markdown" }] });
    expect(descobrirFontes(raiz, m).conteudo).toEqual([{ path: "docs/institucional.md", dominio: "plataforma", formato: "markdown" }]);
    rmSync(join(raiz, "docs/institucional.md"));
    expect(() => descobrirFontes(raiz, m)).toThrow();
  });

  it("não transforma raiz de interface ou de dados ausente em inventário vazio", () => {
    expect(() => descobrirFontes(raiz, manifesto({ ui: { raizes: ["ausente"] } }))).toThrow();
    expect(() => descobrirFontes(raiz, manifesto({ dominios: [{ id: "plataforma", ui: ["src"], gold: ["public/inexistente"] }] }))).toThrow();
    gravar("src/arquivo.ts", "export {};");
    expect(() => descobrirFontes(raiz, manifesto({ ui: { raizes: ["src/arquivo.ts"] } }))).toThrow(/Raiz de interface inválida/);
  });

  it.each(["../fora", "./src", "src/", "src//sub"])("rejeita caminho não normalizado: %s", (path) => {
    expect(() => descobrirFontes(raiz, manifesto({ ui: { raizes: [path] } }))).toThrow(/Caminho i18n inválido/);
  });

  it("rejeita arquivo simbólico fora do repositório", () => {
    const externo = join(temporario, "externo.ts");
    writeFileSync(externo, 'const segredo = "Não ler";');
    symlinkSync(externo, join(raiz, "src/externo.ts"));
    expect(() => descobrirFontes(raiz, manifesto())).toThrow(/Fonte fora do repositório/);
  });
});

describe("fontes materializadas e seus limites de integridade", () => {
  it("valida seed e inclui saída ignorada pelo Git sem executar o materializador", () => {
    const f = seed();
    const r = descobrirFontes(raiz, f.manifesto);
    expect(r.gold).toEqual([{ path: "public/gold/saida.json", dominio: "plataforma" }]);
    expect(r.materializados).toEqual([{
      id: "fixture", dominio: "plataforma", origem: f.item.origem,
      sha256: sha256(gzipSync(f.payload)), alvo_hash: "originais",
      gerador_sha256: sha256(Buffer.from('throw new Error("Gerador não deve ser executado pelo inventário");')),
      saidas: ["public/gold/saida.json"], verificacao: "hash_seed_presenca_json_saidas",
    }]);
    expect(r.excluidas.map((x: { path: string }) => x.path)).toEqual(["pipeline/manifesto.json", "pipeline/seed.json.gz"]);
  });

  it("rejeita seed alterado mesmo quando ainda é gzip e JSON válido", () => {
    const f = seed();
    gravar(f.item.origem, gzipSync(Buffer.from('{"titulo":"Mudou"}')));
    expect(() => descobrirFontes(raiz, f.manifesto)).toThrow(/Hash incompatível/);
  });

  it("rejeita saída ausente ou JSON inválido sem tentar produzi-la", () => {
    const f = seed();
    rmSync(join(raiz, "public/gold/saida.json"));
    expect(() => descobrirFontes(raiz, f.manifesto)).toThrow(/Saída esperada ausente ou inválida.*materializar/);
    expect(existsSync(join(raiz, "public/gold/saida.json"))).toBe(false);
    gravar("public/gold/saida.json", "{inválido}");
    expect(() => descobrirFontes(raiz, f.manifesto)).toThrow(SyntaxError);
  });

  it("distingue presença de JSON de equivalência ao payload quando não contratada", () => {
    const f = seed();
    gravar("public/gold/saida.json", '{"titulo":"Recorte derivado"}');
    expect(descobrirFontes(raiz, f.manifesto).materializados).toEqual([
      expect.objectContaining({ verificacao: "hash_seed_presenca_json_saidas" }),
    ]);
  });

  it("confere base64, hash descomprimido e igualdade da saída quando contratada", () => {
    const f = seed({ base64: true, identica: true });
    expect(descobrirFontes(raiz, f.manifesto).materializados[0]).toMatchObject({ alvo_hash: "descomprimidos", verificacao: "payload_e_saida_identicos", sha256: sha256(f.payload) });
    gravar("public/gold/saida.json", '{"titulo":"Outro JSON válido"}');
    expect(() => descobrirFontes(raiz, f.manifesto)).toThrow(/Saída diverge do payload canônico/);
    gravar(f.item.origem, "não-é-base64");
    expect(() => descobrirFontes(raiz, f.manifesto)).toThrow(/Base64 inválido/);
  });

  it("exige todas as saídas por UF declaradas no contrato", () => {
    const f = seed({ porUf: true });
    const ufs = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
    for (const uf of ufs) gravar(`public/gold/uf-${uf}.json`, JSON.stringify({ uf }));
    const r = descobrirFontes(raiz, f.manifesto);
    expect(r.gold).toHaveLength(28);
    rmSync(join(raiz, "public/gold/uf-PE.json"));
    expect(() => descobrirFontes(raiz, f.manifesto)).toThrow(/uf-PE.json/);
  });
});
