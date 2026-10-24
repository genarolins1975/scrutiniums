/**
 * Testes de retrato, à parte da barreira (decisão do dono de 24/10/2026). Retrato confere números de um retrato datado
 * da fonte (pipeline/tests/retrato.py, src/tests/suporte/retrato.ts); quando a fonte se atualiza, ele diverge sem que o
 * código esteja errado. Por isso fica fora da barreira de publicação e dos jobs bloqueantes do CI (TESTES_SEM_RETRATO=1)
 * e roda aqui, que relata a divergência para reconferência.
 *
 *   npm run testes:retrato                         roda os retratos do pipeline e da interface
 *   npm run testes:retrato -- --saida retratos.md  grava a lista em Markdown (para a issue do workflow de energia)
 *
 * Saída: 0 = todos passam; 1 = algum retrato diverge da gold publicada; 2 = os retratos não rodaram (erro de ferramenta).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const MARCA = "[retrato]";

/** Arquivos de teste da interface com algum itRetrato (o helper em suporte/ fica de fora). */
function arquivosDaInterface() {
  const dir = join(RAIZ, "src/tests");
  return readdirSync(dir)
    .filter((n) => n.endsWith(".test.ts") || n.endsWith(".test.tsx"))
    .filter((n) => readFileSync(join(dir, n), "utf8").includes("itRetrato("))
    .map((n) => `src/tests/${n}`);
}

function rodar(cmd, args) {
  const env = { ...process.env };
  delete env.TESTES_SEM_RETRATO;
  return spawnSync(cmd, args, { cwd: RAIZ, env, stdio: ["ignore", "inherit", "inherit"] });
}

export function principal(argv) {
  const tmp = mkdtempSync(join(tmpdir(), "retratos-"));
  const divergentes = [];
  const erros = [];

  const jsonPy = join(tmp, "python.json");
  const py = rodar("python3", ["scripts/testes_retrato.py", "--json", jsonPy]);
  if (!existsSync(jsonPy)) erros.push({ teste: "pipeline", mensagem: `scripts/testes_retrato.py terminou com ${py.status} sem relatório` });
  else {
    const r = JSON.parse(readFileSync(jsonPy, "utf8"));
    divergentes.push(...r.divergentes.map((d) => ({ teste: d.teste, retrato: d.retrato, mensagem: d.mensagem })));
    erros.push(...r.erros);
    console.log(`Retratos do pipeline: ${r.rodados} rodados, ${r.divergentes.length} divergentes, ${r.erros.length} com erro.`);
  }

  const arquivos = arquivosDaInterface();
  if (arquivos.length) {
    const jsonTs = join(tmp, "vitest.json");
    rodar("npx", ["vitest", "run", ...arquivos, "-t", "\\[retrato\\]", "--reporter=default", "--reporter=json", `--outputFile.json=${jsonTs}`]);
    if (!existsSync(jsonTs)) erros.push({ teste: "interface", mensagem: "o Vitest terminou sem relatório" });
    else {
      const r = JSON.parse(readFileSync(jsonTs, "utf8"));
      let rodados = 0;
      for (const f of r.testResults ?? []) {
        if (f.status === "failed" && !(f.assertionResults ?? []).length) erros.push({ teste: f.name, mensagem: (f.message ?? "").slice(0, 400) });
        for (const a of f.assertionResults ?? []) {
          if (!a.fullName?.includes(MARCA) || a.status === "skipped" || a.status === "pending") continue;
          rodados++;
          if (a.status === "failed") divergentes.push({ teste: `${f.name.replace(RAIZ, "")} > ${a.fullName}`, mensagem: (a.failureMessages?.[0] ?? "").split("\n")[0].slice(0, 400) });
        }
      }
      console.log(`Retratos da interface: ${rodados} rodados.`);
    }
  } else console.log("Retratos da interface: nenhum teste marcado.");

  const linhas = [
    ...divergentes.map((d) => `- \`${d.teste}\`${d.retrato ? ` (retrato: ${d.retrato})` : ""}: ${d.mensagem}`),
    ...erros.map((e) => `- não rodou: \`${e.teste}\`: ${e.mensagem}`),
  ];
  const i = argv.indexOf("--saida");
  if (i >= 0) writeFileSync(argv[i + 1], linhas.join("\n") + (linhas.length ? "\n" : ""));
  if (linhas.length) console.log(`\n${linhas.join("\n")}`);
  console.log(`\nRetratos: ${divergentes.length} divergentes, ${erros.length} sem rodar.`);
  return erros.length ? 2 : divergentes.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = principal(process.argv.slice(2));
