/**
 * Prova que a divisão da skill observatorio-layout em núcleo e anexos não perdeu nem alterou texto.
 *
 * Uso: node scripts/skill-cobertura.mjs [<ref do original>]   (padrão: origin/main, ou main se não houver remoto)
 *
 * Cada linha não vazia do SKILL.md original (frases, itens de lista, linhas de tabela, títulos) tem de
 * aparecer, idêntica, como linha do novo SKILL.md ou de um arquivo em anexos/. Também confere o teto do
 * núcleo (15 KB) e lista as linhas novas, que só podem ser cabeçalhos de anexo e o índice.
 * Proposta P7 do ciclo de 22/10/2026; nada disso entra sem aprovação do dono.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PASTA = ".claude/skills/observatorio-layout";
const TETO_NUCLEO = 15 * 1024;
/** Como scripts/testes-afetados.mjs: origin/main, ou main num checkout sem remoto; com argumento, o ref pedido. */
function refOriginal(pedido) {
  if (pedido) return pedido;
  for (const candidato of ["origin/main", "main"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", `${candidato}^{commit}`], { stdio: "ignore" });
      return candidato;
    } catch { /* tenta o próximo */ }
  }
  throw new Error("Sem origin/main nem main: informe o ref do original como argumento.");
}
const ref = refOriginal(process.argv[2]);
const original = execFileSync("git", ["show", `${ref}:${PASTA}/SKILL.md`], { encoding: "utf8" });
const arquivos = [join(PASTA, "SKILL.md"), ...readdirSync(join(PASTA, "anexos")).map((f) => join(PASTA, "anexos", f))];
const novas = new Map();
for (const a of arquivos) for (const l of readFileSync(a, "utf8").split("\n")) if (l.trim()) novas.set(l, a);
const linhasOriginais = original.split("\n").filter((l) => l.trim());
const faltando = linhasOriginais.filter((l) => !novas.has(l));
const conjuntoOriginal = new Set(linhasOriginais);
const acrescentadas = [...novas.keys()].filter((l) => !conjuntoOriginal.has(l));
const nucleo = statSync(join(PASTA, "SKILL.md")).size;
console.log(`Original (${ref}): ${Buffer.byteLength(original)} bytes, ${linhasOriginais.length} linhas não vazias.`);
for (const a of arquivos) console.log(`  ${String(statSync(a).size).padStart(6)}  ${a}`);
console.log(`Linhas do original ausentes ou alteradas: ${faltando.length}`);
for (const l of faltando) console.log(`  - ${l.slice(0, 160)}`);
console.log(`Linhas novas (cabeçalhos de anexo e índice): ${acrescentadas.length}`);
for (const l of acrescentadas) console.log(`  + ${l.slice(0, 160)}`);
console.log(`Núcleo: ${nucleo} bytes (teto ${TETO_NUCLEO}).`);
process.exitCode = faltando.length || nucleo > TETO_NUCLEO ? 1 : 0;
