/**
 * Roda a suíte Vitest e imprime os 30 arquivos mais lentos, em tabela pronta para colar no PR.
 *
 * Uso: npm run testes:lentos [-- <filtros do vitest>] [-- --top 50]
 *
 * O tempo de cada arquivo soma ambiente, preparo, importação (collect), setup e corpo dos testes,
 * pelo reporter scripts/vitest-tempos.mjs. A soma dos arquivos é tempo de CPU por worker; o tempo
 * de parede é o da execução inteira, medido aqui.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const SAIDA = join(RAIZ, "vitest-tempos.json");
const args = process.argv.slice(2);
const i = args.indexOf("--top");
const top = i >= 0 ? Number(args.splice(i, 2)[1]) : 30;

const preparo = spawnSync(process.execPath, [join(RAIZ, "scripts/preparar.mjs")], { cwd: RAIZ, stdio: "inherit" });
if (preparo.status !== 0) process.exit(preparo.status ?? 1);

// A tabela vai para o PR: um arquivo de uma execução anterior não pode passar pelo desta. Se o Vitest abortar antes
// do fim (worker que não sobe, erro no reporter), o arquivo não existe e o script diz isso.
rmSync(SAIDA, { force: true });
const inicio = Date.now();
const r = spawnSync(process.execPath, [join(RAIZ, "node_modules/vitest/vitest.mjs"), "run", "--reporter=default", "--reporter=./scripts/vitest-tempos.mjs", ...args],
  { cwd: RAIZ, stdio: "inherit", env: { ...process.env, TEMPOS_SAIDA: SAIDA } });
const paredeS = (Date.now() - inicio) / 1000;

if (!existsSync(SAIDA)) {
  console.error(`\nO Vitest terminou sem gravar ${SAIDA} (código ${r.status ?? "sem código"}): não há tempos desta execução para mostrar.`);
  process.exit(r.status || 1);
}
const { arquivos } = JSON.parse(readFileSync(SAIDA, "utf8"));
const total = (a) => a.ambiente_ms + a.preparo_ms + a.importacao_ms + a.setup_ms + a.corpo_ms;
const soma = (campo) => arquivos.reduce((s, a) => s + (campo === "total" ? total(a) : a[campo]), 0) / 1000;
const s = (ms) => (ms / 1000).toFixed(1).replace(".", ",");
const fmt = (x) => x.toFixed(0);

console.log(`\n### Vitest: ${arquivos.length} arquivos, ${arquivos.reduce((n, a) => n + a.testes, 0)} testes executados`);
console.log(`Máquina: ${cpus().length} vCPU, ${Math.round(totalmem() / 2 ** 30)} GB. Data: ${new Date().toISOString().slice(0, 10)}. Comando: npm run testes:lentos ${args.join(" ")}`.trimEnd());
console.log(`\n| Medida | Segundos |\n|---|---|`);
console.log(`| Tempo de parede | ${fmt(paredeS)} |`);
console.log(`| Soma por arquivo (CPU dos workers) | ${fmt(soma("total"))} |`);
console.log(`| ... importação (collect) | ${fmt(soma("importacao_ms"))} |`);
console.log(`| ... corpo dos testes | ${fmt(soma("corpo_ms"))} |`);
console.log(`| ... ambiente, preparo e setup | ${fmt(soma("ambiente_ms") + soma("preparo_ms") + soma("setup_ms"))} |`);
console.log(`\n| # | Arquivo | Total (s) | Importação (s) | Corpo (s) | Testes |\n|---|---|---|---|---|---|`);
[...arquivos].sort((a, b) => total(b) - total(a)).slice(0, top).forEach((a, n) => {
  console.log(`| ${n + 1} | \`${a.arquivo.replace(/^src\/tests\//, "")}\` | ${s(total(a))} | ${s(a.importacao_ms)} | ${s(a.corpo_ms)} | ${a.testes} |`);
});
process.exitCode = r.status ?? 1;
