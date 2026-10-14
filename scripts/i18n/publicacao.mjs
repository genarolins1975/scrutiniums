/** Mantém o relatório derivado junto dos dados publicados, inclusive após rebase.
 * Não coleta dados, emite previsões, faz fetch ou push. Os workflows mantêm esses passos.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const RELATORIO = "docs/i18n/cobertura.json";
const PREVISOES = [
  "public/energia/gold/previsoes.json",
  "public/energia/gold/modelos.json",
  "public/energia/gold/previsoes_desempenho.json",
  "public/energia/series/previsoes_*",
];

function git(raiz, argumentos, exigirSucesso = true) {
  const r = spawnSync("git", argumentos, {
    cwd: raiz, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_EDITOR: "true", GIT_TERMINAL_PROMPT: "0" },
  });
  if (r.error) throw r.error;
  if (exigirSucesso && r.status !== 0) throw new Error(`git ${argumentos[0]} falhou: ${r.stderr || r.stdout}`);
  return r;
}

const nomes = (r) => r.stdout.split("\0").filter(Boolean);
const alvo = (ref, raiz) => {
  if (typeof ref !== "string" || !ref || ref.startsWith("-")) throw new Error("Referência de publicação inválida.");
  return git(raiz, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).stdout.trim();
};
const emRebase = (raiz) => ["rebase-merge", "rebase-apply"].some((nome) =>
  existsSync(resolve(raiz, git(raiz, ["rev-parse", "--git-path", nome]).stdout.trim())));

export function prepararCobertura(raiz = RAIZ) {
  for (const script of [
    "scripts/materializar-assistencia.mjs",
    "scripts/materializar-seguranca-alimentar.mjs",
    "scripts/materializar-trabalho-renda.mjs",
    "scripts/cobertura-i18n.mjs",
  ]) {
    const r = spawnSync(process.execPath, [script], { cwd: raiz, stdio: "inherit" });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`Preparação da cobertura falhou em ${script}.`);
  }
}

/** Somente o relatório pode ser descartado em favor de upstream e depois regenerado. */
export function rebaseComCobertura(ref, raiz = RAIZ) {
  if (emRebase(raiz)) throw new Error("Há um rebase anterior em andamento; nenhuma resolução foi aplicada.");
  const destino = alvo(ref, raiz);
  let r = git(raiz, ["rebase", destino], false);
  try {
    for (let tentativas = 0; r.status !== 0; tentativas++) {
      const conflitos = nomes(git(raiz, ["diff", "--name-only", "--diff-filter=U", "-z"]));
      if (tentativas >= 100 || !emRebase(raiz) || conflitos.length !== 1 || conflitos[0] !== RELATORIO) {
        throw new Error(`Rebase retido; conflito fora do relatório ou erro de Git: ${conflitos.join(", ") || r.stderr || r.stdout}`);
      }
      if (git(raiz, ["cat-file", "-e", `:2:${RELATORIO}`], false).status === 0) {
        git(raiz, ["checkout", "--ours", "--", RELATORIO]);
        git(raiz, ["add", "--", RELATORIO]);
      } else {
        git(raiz, ["rm", "-f", "--", RELATORIO]);
      }
      r = git(raiz, ["rebase", "--continue"], false);
      if (r.status !== 0 && emRebase(raiz)
        && nomes(git(raiz, ["diff", "--name-only", "--diff-filter=U", "-z"])).length === 0
        && git(raiz, ["diff", "--cached", "--quiet"], false).status === 0
        && git(raiz, ["diff", "--quiet"], false).status === 0) {
        // Git pode parar quando a resolução esvazia um commit só do derivado.
        // Nunca pular por essa via um patch que também registra dados ou código.
        const arquivos = nomes(git(raiz, ["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "REBASE_HEAD"]));
        if (arquivos.length === 1 && arquivos[0] === RELATORIO) r = git(raiz, ["rebase", "--skip"], false);
      }
    }
  } catch (erro) {
    if (emRebase(raiz)) git(raiz, ["rebase", "--abort"]);
    throw erro;
  }
  return git(raiz, ["rev-parse", "HEAD"]).stdout.trim();
}

function exigirFontesNoIndice(raiz) {
  if (git(raiz, ["diff", "--quiet"], false).status !== 0) {
    throw new Error("Há alterações versionadas fora do índice; a cobertura deve representar os arquivos destinados ao commit.");
  }
  const m = JSON.parse(readFileSync(join(raiz, "config/i18n-inventario.json"), "utf8"));
  const prefixos = ["config/i18n-inventario.json", ...(m.observar ?? []), ...m.ui.raizes,
    ...m.dominios.flatMap((d) => d.gold ?? []), ...(m.conteudo ?? []).map((c) => c.path)];
  const fora = nomes(git(raiz, ["ls-files", "--others", "--exclude-standard", "-z"]))
    .filter((path) => prefixos.some((p) => path === p || path.startsWith(`${p}/`)));
  if (fora.length) throw new Error(`Fontes novas fora do índice: ${fora.join(", ")}`);
}

/** O callback permite exercitar concorrência com um gerador real sobre fixtures pequenas.
 * @param {string} ref
 * @param {string} [raiz]
 * @param {(raiz: string) => void} [preparar]
 */
export function registrarCobertura(ref, raiz = RAIZ, preparar = prepararCobertura) {
  if (emRebase(raiz)) throw new Error("Conclua o rebase antes de registrar cobertura.");
  const destino = alvo(ref, raiz);
  if (git(raiz, ["merge-base", "--is-ancestor", destino, "HEAD"], false).status !== 0) {
    throw new Error("Atualize a publicação sobre a referência recebida antes de registrar cobertura.");
  }
  preparar(raiz);
  git(raiz, ["add", "--", RELATORIO]);
  exigirFontesNoIndice(raiz);
  const diferenca = git(raiz, ["diff", "--cached", "--quiet"], false).status;
  if (diferenca === 0) return git(raiz, ["rev-parse", "HEAD"]).stdout.trim();
  if (diferenca !== 1) throw new Error("Não foi possível conferir o índice para publicar cobertura.");
  const locais = Number(git(raiz, ["rev-list", "--count", `${destino}..HEAD`]).stdout.trim());
  if (locais > 0) git(raiz, ["commit", "--amend", "--no-edit"]);
  else git(raiz, ["commit", "-m", "Atualiza cobertura i18n das fontes publicadas"]);
  return git(raiz, ["rev-parse", "HEAD"]).stdout.trim();
}

/** Retém somente as saídas reprovadas; o registro factual das emissões permanece. */
export function reterPrevisoes(raiz = RAIZ) {
  const versionados = [...new Set([
    ...nomes(git(raiz, ["ls-files", "-z", "--", ...PREVISOES])),
    ...nomes(git(raiz, ["diff", "--no-renames", "--name-only", "--cached", "--diff-filter=D", "-z", "--", ...PREVISOES])),
  ])];
  if (versionados.length) git(raiz, ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...versionados]);
  git(raiz, ["clean", "-fd", "--", ...PREVISOES]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [modo, ref, ...extras] = process.argv.slice(2);
    if (extras.length || (["preparar", "reter-previsoes"].includes(modo) && ref)) throw new Error("Argumentos inválidos.");
    if (modo === "preparar") prepararCobertura();
    else if (modo === "rebase" && ref) rebaseComCobertura(ref);
    else if (modo === "registrar" && ref) registrarCobertura(ref);
    else if (modo === "reter-previsoes") reterPrevisoes();
    else throw new Error("Uso: node scripts/i18n/publicacao.mjs preparar|reter-previsoes|rebase <ref>|registrar <ref>");
  } catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
