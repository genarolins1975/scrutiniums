/**
 * Roda (ou lista) os testes do Vitest afetados pelas mudanças da branch em relação a uma base.
 *
 * Uso: node scripts/testes-afetados.mjs [--base <ref>] [--listar]
 *      --base    ref de comparação; padrão origin/main (ou main, se não houver remoto)
 *      --listar  mostra a seleção e o motivo de cada teste, sem rodar
 *
 * Seleção, em três camadas:
 *  1. arquivos de teste alterados entram direto;
 *  2. arquivos de código alterados vão para `vitest related`, que segue o grafo de importação;
 *  3. muitos testes (165 de 361 em 22/10/2026) leem dados de public/ ou fontes por caminho, sem
 *     import. Para eles vale o inventário lexical de scripts/mapear-testes-gold.mjs: um teste
 *     que cita o caminho alterado (ou a pasta dele) entra direto, e um módulo de src/lib que o
 *     cita entra na camada 2, levando junto os testes que o importam.
 * Mudança em configuração que afeta todos os testes (package.json, lockfile, vitest.config.ts,
 * setup global, materializadores) roda a suíte inteira.
 *
 * Limitação: é um filtro para antes do push, não a verdade. Caminho montado em pedaços
 * (join("public", "energia", "gold")) ou só pelo nome do arquivo não é reconhecido, e
 * teste que lê o build (.next) é pulado sem build local, como em `npx vitest run`. O CI roda
 * a suíte inteira.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));

/** Mudança aqui altera o ambiente de todos os testes: suíte inteira. */
export const GATILHOS_SUITE_INTEIRA = [
  "package.json", "package-lock.json", "vitest.config.ts", "tsconfig.json",
  "scripts/vitest-worktree-setup.mjs", "scripts/git-worktree-guard.mjs", "scripts/preparar.mjs",
  "scripts/materializar-assistencia.mjs", "scripts/materializar-seguranca-alimentar.mjs",
  "scripts/materializar-trabalho-renda.mjs",
];

const ehTeste = (p) => /^src\/tests\/.+\.test\.tsx?$/.test(p);
const ehCodigo = (p) => /\.(ts|tsx|js|jsx|mjs|cjs|json|css)$/.test(p);

/** Formas de um literal que podem nomear um arquivo do repositório. "/energia/x.json" é URL de public/. */
export function formasDoLiteral(texto) {
  const t = String(texto).trim();
  if (!t.includes("/") || /\s/.test(t) || /^[a-z]+:\/\//i.test(t)) return [];
  const limpo = t.replace(/^\.\//, "");
  if (limpo.startsWith("/")) {
    const semBarra = limpo.replace(/^\/+/, "");
    return semBarra ? [semBarra, "public/" + semBarra] : [];
  }
  return limpo ? [limpo] : [];
}

/**
 * O literal cita o caminho alterado? Igual, prefixo de pasta ("src/components/" ou
 * "src/components"), cabeça de template ("public/energia/gold/previsoes_") ou sufixo com pasta
 * ("energia/gold/conta.json").
 */
export function literalCita(texto, caminho) {
  for (const s of formasDoLiteral(texto)) {
    if (caminho === s) return true;
    if (s.endsWith("/") && caminho.startsWith(s)) return true;
    if (caminho.startsWith(s + "/")) return true;
    if (/[_\-.]$/.test(s) && s.includes("/") && caminho.startsWith(s)) return true;
    if (s.includes("/") && !s.startsWith("..") && caminho.endsWith("/" + s)) return true;
  }
  return false;
}

/**
 * Decide a seleção a partir dos alterados e do inventário lexical
 * ({ "<arquivo>": { strings: [{ texto }] } }, de scripts/mapear-testes-gold.mjs).
 */
export function selecionar(alterados, inventario) {
  const gatilho = alterados.find((a) => GATILHOS_SUITE_INTEIRA.includes(a));
  if (gatilho) return { suiteInteira: gatilho, testes: new Map(), fontes: new Map() };
  const testes = new Map();
  const fontes = new Map();
  const anota = (mapa, arquivo, motivo) => { if (!mapa.has(arquivo)) mapa.set(arquivo, motivo); };
  for (const a of alterados) {
    if (ehTeste(a)) anota(testes, a, "teste alterado");
    else if (ehCodigo(a)) anota(fontes, a, "código alterado");
  }
  for (const [arquivo, { strings }] of Object.entries(inventario)) {
    const citado = alterados.find((a) => a !== arquivo && strings.some((s) => literalCita(s.texto, a)));
    if (!citado) continue;
    if (ehTeste(arquivo)) anota(testes, arquivo, `cita ${citado}`);
    else anota(fontes, arquivo, `cita ${citado}`);
  }
  return { suiteInteira: null, testes, fontes };
}

function git(args, raiz) {
  return execFileSync("git", args, { cwd: raiz, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
}

export function baseResolvida(raiz = RAIZ, pedida) {
  if (pedida) return pedida;
  for (const ref of ["origin/main", "main"]) {
    try { git(["rev-parse", "--verify", "--quiet", ref], raiz); return ref; } catch { /* tenta a próxima */ }
  }
  throw new Error("Sem origin/main nem main: informe --base <ref>.");
}

/** Commits da branch desde a base, mais o que está alterado e não versionado na árvore. */
export function alteradosDesde(base, raiz = RAIZ) {
  const [mergeBase] = git(["merge-base", base, "HEAD"], raiz);
  const lista = new Set([
    ...git(["diff", "--name-only", "--no-renames", mergeBase], raiz),
    ...git(["ls-files", "--others", "--exclude-standard"], raiz),
  ]);
  return [...lista].sort();
}

function inventarioLexical(raiz) {
  const dir = mkdtempSync(join(tmpdir(), "testes-afetados-"));
  try {
    const saida = join(dir, "inventario.json");
    execFileSync(process.execPath, [join(raiz, "scripts/mapear-testes-gold.mjs"), saida], { cwd: raiz, stdio: "inherit" });
    return JSON.parse(readFileSync(saida, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function vitest(args, raiz) {
  const r = spawnSync(process.execPath, [join(raiz, "node_modules/vitest/vitest.mjs"), ...args], { cwd: raiz, stdio: "inherit" });
  return r.status ?? 1;
}

export function executar(argv, raiz = RAIZ) {
  const i = argv.indexOf("--base");
  const base = baseResolvida(raiz, i >= 0 ? argv[i + 1] : undefined);
  const listar = argv.includes("--listar");
  const alterados = alteradosDesde(base, raiz);
  console.log(`Base ${base}: ${alterados.length} arquivo(s) alterado(s).`);
  if (!alterados.length) { console.log("Nenhuma mudança: nenhum teste a rodar."); return 0; }
  const { suiteInteira, testes, fontes } = selecionar(alterados, inventarioLexical(raiz));
  if (suiteInteira) {
    console.log(`${suiteInteira} muda o ambiente de todos os testes: suíte inteira.`);
    return listar ? 0 : vitest(["run"], raiz);
  }
  const fontesExistentes = [...fontes.keys()].filter((f) => existsSync(join(raiz, f)));
  const testesExistentes = [...testes.keys()].filter((f) => existsSync(join(raiz, f)));
  for (const [arquivo, motivo] of testes) console.log(`  teste  ${arquivo}  (${motivo})`);
  for (const [arquivo, motivo] of fontes) console.log(`  fonte  ${arquivo}  (${motivo}; testes que o importam)`);
  if (!fontesExistentes.length && !testesExistentes.length) { console.log("Nenhum teste alcançado pelas mudanças."); return 0; }
  if (listar) return 0;
  // `related` roda os testes que importam as fontes e também os testes passados diretamente.
  return vitest(["related", "--run", "--passWithNoTests", ...testesExistentes, ...fontesExistentes], raiz);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = executar(process.argv.slice(2)); }
  catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
