import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executar } from "../../scripts/cobertura-i18n.mjs";
import { rebaseComCobertura, registrarCobertura, reterPrevisoes } from "../../scripts/i18n/publicacao.mjs";

const RELATORIO = "docs/i18n/cobertura.json";
const FONTE_A = "public/energia/gold/produtor-a.json";
const FONTE_B = "public/energia/gold/produtor-b.json";
const REF = "origin/main";
const temporarios: string[] = [];

afterEach(() => {
  for (const raiz of temporarios.splice(0)) rmSync(raiz, { recursive: true, force: true });
});

function git(raiz: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd: raiz,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_EDITOR: "true", GIT_SEQUENCE_EDITOR: "true" },
  }).trim();
}

function escrever(raiz: string, path: string, texto: string) {
  mkdirSync(dirname(join(raiz, path)), { recursive: true });
  writeFileSync(join(raiz, path), texto);
}

function ler(raiz: string, path: string) {
  return readFileSync(join(raiz, path), "utf8");
}

function configurar(raiz: string) {
  git(raiz, "config", "user.name", "Teste de publicação");
  git(raiz, "config", "user.email", "publicacao@example.invalid");
  git(raiz, "config", "commit.gpgsign", "false");
}

function preparar(raiz: string) {
  executar([], raiz);
}

function dados(raiz: string, fonte: string, valor: number) {
  escrever(raiz, fonte, JSON.stringify({ nome: "Série sintética", valor }) + "\n");
}

function commit(raiz: string, mensagem: string, ...paths: string[]) {
  git(raiz, "add", "--", ...paths);
  git(raiz, "commit", "--quiet", "-m", mensagem);
  return git(raiz, "rev-parse", "HEAD");
}

function publicar(raiz: string, fonte: string, valor: number, comRelatorio = true) {
  dados(raiz, fonte, valor);
  if (comRelatorio) preparar(raiz);
  return commit(raiz, `Atualiza ${fonte} para ${valor}`, fonte, ...(comRelatorio ? [RELATORIO] : []));
}

function fixture(coberturaDesatualizada = false) {
  const base = mkdtempSync(join(tmpdir(), "i18n-publicacao-"));
  temporarios.push(base);
  const remoto = join(base, "remoto.git");
  const produtor = join(base, "produtor");
  const concorrente = join(base, "concorrente");
  git(base, "init", "--quiet", "--bare", "--initial-branch=main", remoto);
  git(base, "init", "--quiet", "--initial-branch=main", produtor);
  configurar(produtor);
  escrever(produtor, "config/i18n-inventario.json", JSON.stringify({
    schema_version: 1,
    ui: { raizes: ["src/app"] },
    dominios: [{ id: "energia", nome: "Energia", ui: ["src/app"], gold: ["public/energia/gold"] }],
    observar: ["src/app", "public/energia/gold"],
  }));
  escrever(produtor, "src/app/page.tsx", "export default function Pagina() { return <h1>Energia</h1>; }\n");
  escrever(produtor, "README.md", "Fixture de publicação.\n");
  dados(produtor, FONTE_A, 1);
  dados(produtor, FONTE_B, 1);
  preparar(produtor);
  if (coberturaDesatualizada) dados(produtor, FONTE_A, 2);
  commit(produtor, "Base sintética", ".");
  git(produtor, "remote", "add", "origin", remoto);
  git(produtor, "push", "--quiet", "--set-upstream", "origin", "main");
  git(base, "clone", "--quiet", remoto, concorrente);
  configurar(concorrente);
  return { produtor, concorrente, remoto };
}

function conferir(raiz: string, valorA: number, valorB: number) {
  expect(JSON.parse(ler(raiz, FONTE_A)).valor).toBe(valorA);
  expect(JSON.parse(ler(raiz, FONTE_B)).valor).toBe(valorB);
  expect(executar(["--check"], raiz)).toContain("confere");
}

function conferirRebaseEncerrado(raiz: string) {
  expect(existsSync(join(raiz, ".git/rebase-merge"))).toBe(false);
  expect(existsSync(join(raiz, ".git/rebase-apply"))).toBe(false);
  expect(git(raiz, "diff", "--name-only", "--diff-filter=U")).toBe("");
}

describe("publicação concorrente do relatório i18n", () => {
  it("resolve somente o relatório e regenera a cobertura com os dados dos dois produtores", () => {
    const { produtor, concorrente } = fixture();
    publicar(produtor, FONTE_A, 2);
    publicar(concorrente, FONTE_B, 3);
    git(concorrente, "push", "--quiet");
    git(produtor, "fetch", "--quiet", "origin");
    const upstream = git(produtor, "rev-parse", REF);
    const relatorioUpstream = ler(concorrente, RELATORIO);

    rebaseComCobertura(REF, produtor);

    expect(ler(produtor, RELATORIO)).toBe(relatorioUpstream);
    expect(() => executar(["--check"], produtor)).toThrow("desatualizada");
    escrever(produtor, "anotacao.txt", "Arquivo fora da publicação.\n");
    const fontes = [ler(produtor, FONTE_A), ler(produtor, FONTE_B)];
    registrarCobertura(REF, produtor, preparar);

    conferir(produtor, 2, 3);
    expect([ler(produtor, FONTE_A), ler(produtor, FONTE_B)]).toEqual(fontes);
    expect(git(produtor, "rev-parse", "HEAD^")).toBe(upstream);
    expect(git(produtor, "show", "--format=", "--name-only", "HEAD").split("\n").sort()).toEqual([RELATORIO, FONTE_A].sort());
    expect(git(produtor, "show", "HEAD:README.md")).toBe("Fixture de publicação.");
    expect(git(produtor, "status", "--porcelain")).toContain("?? anotacao.txt");
    conferirRebaseEncerrado(produtor);
  });

  it("aborta se gold também conflita e conserva integralmente o commit local", () => {
    const { produtor, concorrente } = fixture();
    const original = publicar(produtor, FONTE_A, 2);
    const fonteOriginal = ler(produtor, FONTE_A);
    const coberturaOriginal = ler(produtor, RELATORIO);
    publicar(concorrente, FONTE_A, 3);
    git(concorrente, "push", "--quiet");
    git(produtor, "fetch", "--quiet", "origin");

    expect(() => rebaseComCobertura(REF, produtor)).toThrow();

    expect(git(produtor, "rev-parse", "HEAD")).toBe(original);
    expect(ler(produtor, FONTE_A)).toBe(fonteOriginal);
    expect(ler(produtor, RELATORIO)).toBe(coberturaOriginal);
    expect(git(produtor, "status", "--porcelain")).toBe("");
    conferirRebaseEncerrado(produtor);
  });

  it("regenera após rebase sem conflito quando upstream mudou uma fonte sem atualizar cobertura", () => {
    const { produtor, concorrente } = fixture();
    publicar(produtor, FONTE_A, 2);
    const coberturaLocal = ler(produtor, RELATORIO);
    publicar(concorrente, FONTE_B, 3, false);
    git(concorrente, "push", "--quiet");
    git(produtor, "fetch", "--quiet", "origin");

    rebaseComCobertura(REF, produtor);

    expect(ler(produtor, RELATORIO)).toBe(coberturaLocal);
    expect(() => executar(["--check"], produtor)).toThrow("desatualizada");
    registrarCobertura(REF, produtor, preparar);

    conferir(produtor, 2, 3);
    expect(git(produtor, "rev-list", "--count", `${REF}..HEAD`)).toBe("1");
    expect(git(produtor, "rev-parse", "HEAD^")).toBe(git(produtor, "rev-parse", REF));
    expect(git(produtor, "status", "--porcelain")).toBe("");
  });

  it("cria um commit após descartar um patch equivalente, sem amendar upstream", () => {
    const { produtor, concorrente } = fixture();
    publicar(produtor, FONTE_A, 2);
    publicar(concorrente, FONTE_A, 2);
    const upstream = publicar(concorrente, FONTE_B, 3, false);
    git(concorrente, "push", "--quiet");
    git(produtor, "fetch", "--quiet", "origin");

    rebaseComCobertura(REF, produtor);

    expect(git(produtor, "rev-parse", "HEAD")).toBe(upstream);
    registrarCobertura(REF, produtor, preparar);

    conferir(produtor, 2, 3);
    expect(git(produtor, "rev-parse", "HEAD^")).toBe(upstream);
    expect(git(produtor, "rev-list", "--count", `${REF}..HEAD`)).toBe("1");
    expect(git(produtor, "show", "--format=", "--name-only", "HEAD")).toBe(RELATORIO);
    expect(git(produtor, "merge-base", "HEAD", REF)).toBe(upstream);
  });

  it("encerra rebase quando a resolução esvazia um commit que só atualizava cobertura", () => {
    const { produtor, concorrente } = fixture(true);
    preparar(produtor);
    commit(produtor, "Corrige apenas a cobertura atrasada", RELATORIO);
    const upstream = publicar(concorrente, FONTE_A, 3);
    git(concorrente, "push", "--quiet");
    git(produtor, "fetch", "--quiet", "origin");

    rebaseComCobertura(REF, produtor);
    registrarCobertura(REF, produtor, preparar);

    expect(git(produtor, "rev-parse", "HEAD")).toBe(upstream);
    conferir(produtor, 3, 1);
    expect(git(produtor, "status", "--porcelain")).toBe("");
    conferirRebaseEncerrado(produtor);
  });

  it("repete fetch, rebase e regeneração depois de uma rejeição real de push", () => {
    const { produtor, concorrente, remoto } = fixture();
    publicar(produtor, FONTE_A, 2);
    publicar(concorrente, FONTE_B, 3);
    git(concorrente, "push", "--quiet");
    git(produtor, "fetch", "--quiet", "origin");
    rebaseComCobertura(REF, produtor);
    registrarCobertura(REF, produtor, preparar);

    publicar(concorrente, FONTE_B, 4);
    git(concorrente, "push", "--quiet");
    expect(() => git(produtor, "push", "--quiet")).toThrow();

    git(produtor, "fetch", "--quiet", "origin");
    rebaseComCobertura(REF, produtor);
    registrarCobertura(REF, produtor, preparar);
    git(produtor, "push", "--quiet");

    conferir(produtor, 2, 4);
    expect(git(remoto, "rev-parse", "main")).toBe(git(produtor, "rev-parse", "HEAD"));
    expect(git(remoto, "show", `main:${RELATORIO}`)).toBe(ler(produtor, RELATORIO).trim());
    expect(git(remoto, "show", `main:${FONTE_A}`)).toBe(ler(produtor, FONTE_A).trim());
    expect(git(remoto, "show", `main:${FONTE_B}`)).toBe(ler(produtor, FONTE_B).trim());
  });

  it("não cria nem amenda commit se a preparação real do relatório falha", () => {
    const { produtor } = fixture();
    escrever(produtor, FONTE_A, "{ JSON inválido\n");
    const original = commit(produtor, "Fonte inválida deve bloquear publicação", FONTE_A);
    const indice = git(produtor, "write-tree");
    const cobertura = ler(produtor, RELATORIO);

    expect(() => registrarCobertura(REF, produtor, preparar)).toThrow();

    expect(git(produtor, "rev-parse", "HEAD")).toBe(original);
    expect(git(produtor, "write-tree")).toBe(indice);
    expect(ler(produtor, RELATORIO)).toBe(cobertura);
    expect(git(produtor, "status", "--porcelain")).toBe("");
  });

  it("publica uma fonte nova explicitamente stageada junto do relatório sem amendar upstream", () => {
    const { produtor } = fixture();
    const upstream = git(produtor, "rev-parse", REF);
    const novaFonte = "public/energia/gold/produtor-c.json";
    dados(produtor, novaFonte, 5);
    git(produtor, "add", "--", novaFonte);

    registrarCobertura(REF, produtor, preparar);

    expect(git(produtor, "rev-parse", "HEAD^")).toBe(upstream);
    expect(git(produtor, "show", "--format=", "--name-only", "HEAD").split("\n").sort()).toEqual([RELATORIO, novaFonte].sort());
    expect(JSON.parse(git(produtor, "show", `HEAD:${novaFonte}`)).valor).toBe(5);
    expect(JSON.parse(ler(produtor, RELATORIO)).dominios.energia.gold.arquivos).toBe(3);
    conferir(produtor, 1, 1);
    expect(git(produtor, "status", "--porcelain")).toBe("");
  });

  it.each([
    ["alterada", FONTE_A],
    ["nova", "public/energia/gold/produtor-c.json"],
  ])("bloqueia cobertura de fonte %s que não entraria no commit", (_tipo, fonte) => {
    const { produtor } = fixture();
    const original = git(produtor, "rev-parse", "HEAD");
    dados(produtor, fonte, 5);

    expect(() => registrarCobertura(REF, produtor, preparar)).toThrow(/fora do índice/);

    expect(git(produtor, "rev-parse", "HEAD")).toBe(original);
    expect(git(produtor, "diff", "--cached", "--name-only", "--", fonte)).toBe("");
    expect(JSON.parse(ler(produtor, fonte)).valor).toBe(5);
  });
});

describe("retenção seletiva das previsões PLD", () => {
  it("restaura PLD versionado e remove PLD inédito preservando emissões e outros dados", () => {
    const { produtor } = fixture();
    const origemRenomeada = "public/energia/series/previsoes_centro.csv";
    const retidos = [
      "public/energia/gold/previsoes.json",
      "public/energia/gold/previsoes_desempenho.json",
      "public/energia/series/previsoes_sudeste.json",
      "public/energia/series/previsoes_norte.csv",
      "public/energia/series/previsoes_sul.csv",
      origemRenomeada,
    ];
    const preservados = [
      "pipeline/energia/previsoes/emissoes/base.json",
      "public/energia/gold/emissoes.json",
      "public/energia/gold/geracao.json",
      "public/energia/gold/previsoes_novo.json",
      "public/energia/series/carga.json",
      "public/energia/series/previsoes.json",
    ];
    for (const path of [...retidos, ...preservados]) escrever(produtor, path, "{\"valor\":1}\n");
    const original = commit(produtor, "Previsões e outras séries sintéticas", ...retidos, ...preservados);
    for (const path of [...retidos, ...preservados].filter((path) => path !== origemRenomeada)) escrever(produtor, path, "{\"valor\":2}\n");
    git(produtor, "add", "--", ...retidos, ...preservados);
    rmSync(join(produtor, "public/energia/series/previsoes_norte.csv"));
    git(produtor, "rm", "--force", "--", "public/energia/series/previsoes_sul.csv");
    const destinoRenomeado = "public/energia/series/previsoes_centro_novo.csv";
    git(produtor, "mv", "--", origemRenomeada, destinoRenomeado);
    expect(git(produtor, "diff", "--cached", "--name-status", "--diff-filter=R", "--", origemRenomeada, destinoRenomeado))
      .toBe(`R100\t${origemRenomeada}\t${destinoRenomeado}`);
    const novosRetidos = ["public/energia/gold/modelos.json", "public/energia/series/previsoes_nova.json"];
    const novosPreservados = ["pipeline/energia/previsoes/emissoes/nova.json", "public/energia/gold/outra.json"];
    for (const path of [...novosRetidos, ...novosPreservados]) escrever(produtor, path, "{\"valor\":3}\n");

    reterPrevisoes(produtor);

    expect(git(produtor, "rev-parse", "HEAD")).toBe(original);
    for (const path of retidos) {
      expect(ler(produtor, path)).toBe("{\"valor\":1}\n");
      expect(git(produtor, "show", `:${path}`)).toBe("{\"valor\":1}");
    }
    expect(existsSync(join(produtor, destinoRenomeado))).toBe(false);
    for (const path of novosRetidos) expect(existsSync(join(produtor, path))).toBe(false);
    for (const path of preservados) {
      expect(ler(produtor, path)).toBe("{\"valor\":2}\n");
      expect(git(produtor, "show", `:${path}`)).toBe("{\"valor\":2}");
    }
    for (const path of novosPreservados) expect(ler(produtor, path)).toBe("{\"valor\":3}\n");
    expect(git(produtor, "diff", "--cached", "--name-only").split("\n").sort()).toEqual([...preservados].sort());
  });
});
