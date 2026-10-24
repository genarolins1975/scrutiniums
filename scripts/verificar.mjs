/**
 * Verificação local antes do push, em dois níveis. Rodar na raiz.
 *
 *   npm run verificar:rapido            lint e tipos em paralelo, cobertura bilíngue e testes afetados
 *   npm run verificar:pr                o que o CI (.github/workflows/ci.yml) roda, na mesma ordem
 *   npm run verificar:pr -- --listar    mostra as etapas sem rodar
 *   npm run verificar:pr -- --etapas build,vitest   roda só as etapas nomeadas
 *   npm run verificar:pr -- --agro      acrescenta a verificação do Agronegócio (agro-interface.yml)
 *
 * Por que existe: até 22/10/2026 não havia comando único, e o padrão era empurrar, esperar
 * 20 minutos de CI, empurrar uma correção e recomeçar; 4 dos 12 últimos runs de PR tinham
 * sido cancelados por novo push no meio. `verificar:rapido` é o filtro de três minutos; o
 * `verificar:pr` reproduz uma falha de CI sem commit atrás de commit.
 *
 * Diferenças deliberadas em relação ao CI, todas para o lado de checar o mesmo:
 * - o tsc e o build recebem heap de 4 GB quando NODE_OPTIONS não define outro. Num contêiner
 *   de 15 GB o limite padrão do Node é 2 GB, e `tsc --noEmit` e `next build` (etapa de tipos)
 *   abortam por memória (medido em 22/10/2026); o runner do CI, com 16 GB, tem limite maior;
 * - a árvore limpa no fim compara com o estado do início (o CI começa de clone limpo): a
 *   verificação falha se alguma etapa alterou arquivo versionado ou criou arquivo não ignorado;
 * - `pip install` das dependências de energia só acontece se o pyarrow faltar.
 * Retratos (testes que fixam números de um retrato datado da fonte) ficam fora das etapas de teste com
 * TESTES_SEM_RETRATO=1, como no CI, e rodam na etapa informativa "retratos", que relata e não reprova (decisão do
 * dono de 24/10/2026; no CI, job "Retratos da gold publicada", fora do CI verde).
 * src/tests/verificar-ci.test.ts confere que todo comando de verificação do ci.yml está aqui.
 */
import { spawn, spawnSync } from "node:child_process";
import { cpus, totalmem } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { assertWorktreeUnchanged, captureWorktree } from "./git-worktree-guard.mjs";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const HEAP = "--max-old-space-size=4096";

const TESTES_EFICIENCIA = [
  "test_motor", "test_expansao", "test_saude_municipal", "test_precisao_saude", "test_captura_recaptura",
  "test_habitacao", "test_habitacao_cenarios", "test_conectividade", "test_cesta_conjunta",
  "test_precisao_candidatas", "test_revisao_v3",
].map((t) => `pipeline.eficiencia_resultados.${t}`);

/** Etapas do CI, na ordem do job serial original. `cmds`: comandos de shell executados em sequência. */
export const ETAPAS_PR = [
  { id: "minify", nome: "Gerar app.min.js", cmds: ["node scripts/minify-obs.mjs"] },
  { id: "lint", nome: "Lint", cmds: ["npm run lint"] },
  { id: "tipos", nome: "Tipos", cmds: ["npx tsc --noEmit"], heap: true },
  { id: "gold-grupos", nome: "Contrato de grupos e publicação seletiva da gold", cmds: ["python3 -m unittest pipeline.tests.test_publicar_gold"] },
  { id: "compileall", nome: "Módulos Python compilam", cmds: ["python3 -m compileall -q pipeline"] },
  { id: "pyarrow", nome: "Dependências do pipeline de energia", cmds: ['python3 -c "import pyarrow" 2>/dev/null || pip install -r pipeline/energia/requirements.txt'] },
  { id: "python", nome: "Testes Python (pipeline e camada de pesquisa)", env: { TESTES_SEM_RETRATO: "1" }, cmds: [
    "python3 -m unittest discover -s pipeline/tests -t .",
    "python3 -m unittest discover -s pesquisa/tests -t .",
    `python3 -m unittest ${TESTES_EFICIENCIA.join(" ")}`,
  ] },
  { id: "obee-reconciliacao", nome: "Reconciliação aritmética alternativa do OBEE", cmds: [
    "python3 -m unittest scripts.test_auditar_cesta_obee_v3",
    `python3 scripts/auditar-cesta-obee-v3.py | python3 -c "import json,sys; sys.exit(json.load(sys.stdin) != json.load(open('docs/obee/resultados/reconciliacao-aritmetica-v3.json')))"`,
    "python3 -m unittest scripts.test_obee_sensibilidade_pares scripts.test_obee_robustez_ampliada",
    "python3 docs/obee/resultados/review-ui/generate.py",
    "git diff --exit-code docs/obee/resultados/revisao-interativa-v3.html",
  ] },
  { id: "obee-precisao", nome: "Precisão complementar da cesta OBEE", cmds: [
    "python3 -m unittest scripts.test_obee_precisao_cesta",
    "python3 scripts/obee_precisao_cesta.py --check",
    "python3 -m unittest scripts.test_obee_renda_sensibilidade",
    "python3 scripts/obee_renda_sensibilidade.py --check",
  ] },
  { id: "obee-v4", nome: "Índice de resultados v4 do OBEE", cmds: [
    "python3 -m unittest pipeline.eficiencia_resultados.test_indice_v4",
    "python3 -m pipeline.eficiencia_resultados.indice_v4 --check",
    "python3 -m pipeline.eficiencia_resultados.indice_v4 --verificar",
    "python3 scripts/obee_interface_v4.py --check",
    "python3 scripts/obee_contornos_capitais.py --check",
  ] },
  { id: "build", nome: "Build de produção", cmds: ["npm run build"], heap: true },
  { id: "judiciario", nome: "Fluxos e telas do Judiciário com sessão local", cmds: ["node scripts/obee/judiciario-verificacao.mjs"] },
  { id: "cobertura", nome: "Cobertura bilíngue confere com as fontes de código", cmds: ["node scripts/cobertura-i18n.mjs --check"] },
  { id: "vitest", nome: "Testes (inclui a verificação obrigatória do HTML gerado)", cmds: ["npx vitest run"], env: { EXIGIR_BUILD_HTML: "1", TESTES_SEM_RETRATO: "1" } },
  { id: "retratos", nome: "Retratos da gold publicada (informativo, não reprova)", cmds: ["node scripts/testes-retrato.mjs"], informativa: true },
];

/** Verificação do Agronegócio (agro-interface.yml), opcional porque é outro workflow. */
export const ETAPAS_AGRO = [
  { id: "agro-derivadas", nome: "Agronegócio: derivadas reproduzíveis", cmds: [
    "python3 -m pipeline.agro.run --check",
    "python3 -m pipeline.agro.dicionario --check",
    "node scripts/agro/catalogo.mjs --check",
  ] },
  { id: "agro-build", nome: "Agronegócio: build de produção", cmds: ["npm run build"], heap: true },
  { id: "agro", nome: "Agronegócio: verificação da interface", cmds: ["node scripts/agro/verificacao.mjs"] },
];

function ambiente(etapa) {
  const env = { ...process.env, ...(etapa.env ?? {}) };
  if (etapa.heap && !/max-old-space-size/.test(env.NODE_OPTIONS ?? "")) env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} ${HEAP}`.trim();
  return env;
}

const tempo = (ms) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`; };

function rodarSerial(etapa) {
  const inicio = Date.now();
  for (const cmd of etapa.cmds) {
    console.log(`\n▶ ${etapa.nome}: ${cmd}`);
    const r = spawnSync(cmd, { cwd: RAIZ, env: ambiente(etapa), shell: "/bin/bash", stdio: "inherit" });
    if (r.status !== 0) return { etapa, ok: false, ms: Date.now() - inicio, falhou: cmd };
  }
  return { etapa, ok: true, ms: Date.now() - inicio };
}

/** Roda etapas em paralelo, com a saída de cada uma retida e impressa ao fim para não intercalar. */
function rodarParalelo(etapas) {
  return Promise.all(etapas.map((etapa) => new Promise((ok) => {
    const inicio = Date.now();
    const cmd = etapa.cmds.join(" && ");
    let saida = "";
    const filho = spawn(cmd, { cwd: RAIZ, env: ambiente(etapa), shell: "/bin/bash" });
    filho.stdout.on("data", (b) => { saida += b; });
    filho.stderr.on("data", (b) => { saida += b; });
    filho.on("close", (status) => {
      console.log(`\n▶ ${etapa.nome}: ${cmd}\n${saida.trimEnd()}`);
      ok({ etapa, ok: status === 0, ms: Date.now() - inicio, falhou: status === 0 ? undefined : cmd });
    });
  })));
}

function resumo(titulo, resultados, totalMs) {
  console.log(`\n${titulo} (${cpus().length} vCPU, ${Math.round(totalmem() / 2 ** 30)} GB, ${new Date().toISOString().slice(0, 10)})`);
  for (const r of resultados) console.log(`  ${r.ok ? "ok   " : r.etapa.informativa ? "AVISO" : "FALHA"}  ${tempo(r.ms).padStart(10)}  ${r.etapa.nome}${r.ok ? "" : `  (${r.falhou})`}`);
  console.log(`  tempo de parede: ${tempo(totalMs)}`);
  return resultados.every((r) => r.ok || r.etapa.informativa) ? 0 : 1;
}

export async function rapido(argv) {
  const inicio = Date.now();
  const base = argv.includes("--base") ? ["--base", argv[argv.indexOf("--base") + 1]] : [];
  // os derivados (app.min.js e materializados) vêm junto: sem eles, três testes de exportação caem em ENOENT
  const preparar = { id: "preparar", nome: "Derivados (npm run preparar)", cmds: ["node scripts/preparar.mjs"] };
  const resultados = await rodarParalelo([ETAPAS_PR.find((e) => e.id === "lint"), ETAPAS_PR.find((e) => e.id === "tipos"), preparar]);
  resultados.push(rodarSerial(ETAPAS_PR.find((e) => e.id === "cobertura")));
  resultados.push(rodarSerial({ id: "afetados", nome: "Testes afetados", cmds: [["node scripts/testes-afetados.mjs", ...base].join(" ")], env: { TESTES_SEM_RETRATO: "1" } }));
  return resumo("verificar:rapido", resultados, Date.now() - inicio);
}

export function pr(argv) {
  const todas = argv.includes("--agro") ? [...ETAPAS_PR, ...ETAPAS_AGRO] : ETAPAS_PR;
  const i = argv.indexOf("--etapas");
  const pedidas = i >= 0 ? argv[i + 1].split(",") : null;
  const desconhecidas = (pedidas ?? []).filter((id) => !todas.some((e) => e.id === id));
  if (desconhecidas.length) throw new Error(`Etapa desconhecida: ${desconhecidas.join(", ")}. Use --listar.`);
  const etapas = pedidas ? todas.filter((e) => pedidas.includes(e.id)) : todas;
  if (argv.includes("--listar")) {
    for (const e of todas) console.log(`${e.id.padEnd(20)} ${e.nome}\n${e.cmds.map((c) => `${" ".repeat(21)}${c}`).join("\n")}`);
    return 0;
  }
  const inicio = Date.now();
  const antes = captureWorktree(RAIZ);
  const resultados = [];
  for (const etapa of etapas) {
    const r = rodarSerial(etapa);
    resultados.push(r);
    if (!r.ok && !etapa.informativa) break;
  }
  if (resultados.every((r) => r.ok || r.etapa.informativa)) {
    const t0 = Date.now();
    try { assertWorktreeUnchanged(RAIZ, antes); resultados.push({ etapa: { nome: "Árvore versionada igual à do início" }, ok: true, ms: Date.now() - t0 }); }
    catch (erro) { console.error(erro.message); resultados.push({ etapa: { nome: "Árvore versionada igual à do início" }, ok: false, ms: Date.now() - t0, falhou: "git status" }); }
  }
  return resumo("verificar:pr", resultados, Date.now() - inicio);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [modo, ...resto] = process.argv.slice(2);
  try {
    if (modo === "rapido") process.exitCode = await rapido(resto);
    else if (modo === "pr") process.exitCode = pr(resto);
    else throw new Error("Uso: node scripts/verificar.mjs <rapido|pr> [opções]");
  } catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
