/**
 * Conta consultas de esquema no processo novo de `next start`, sobre o build
 * existente. O auxiliar cria antes um banco local em dia e uma sessão sintética.
 * O primeiro /api/auth/eu autenticado abre a conexão; mede-se depois o mapa
 * aquecido. Não confundir esse tempo de página com TTFB frio em produção.
 *
 * node scripts/medir-esquema.mjs --esperado 1 --saida /tmp/esquema-depois.json
 * Para a linha de base, use o build anterior e --esperado 29.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { subirServidorLocal } from "./servidor-local.mjs";

const argumentos = process.argv.slice(2);
const opcao = (nome) => argumentos[argumentos.indexOf(nome) + 1];
assert(argumentos.includes("--esperado") && argumentos.includes("--saida"), "Informe --esperado e --saida.");
const esperado = Number(opcao("--esperado"));
assert(Number.isInteger(esperado) && esperado > 0, "Contagem esperada inválida.");
const preload = fileURLToPath(new URL("./suporte/medir-esquema-preload.mjs", import.meta.url));
const anterior = process.env.NODE_OPTIONS;
process.env.NODE_OPTIONS = `${anterior ?? ""} --import=${JSON.stringify(preload)}`;
let servidor;
try {
  servidor = await subirServidorLocal();
  const consultas = [...servidor.logs().matchAll(/MEDICAO_ESQUEMA (\{[^\n]+\})/g)].map((m) => JSON.parse(m[1]));
  assert.equal(consultas.length, esperado, "Consultas de esquema na primeira conexão do processo novo");
  const semSessao = await fetch(servidor.origem + "/app/observatorios", { redirect: "manual" });
  assert.equal(semSessao.status, 307);
  assert(semSessao.headers.get("location")?.includes("/entrar"));
  const amostras = [];
  for (let i = 0; i < 5; i++) {
    const inicio = performance.now();
    const resposta = await fetch(servidor.origem + "/app/observatorios", {
      headers: { cookie: `${servidor.cookie.name}=${servidor.cookie.value}` }, redirect: "manual",
    });
    const ttfb = performance.now() - inicio;
    const html = await resposta.text();
    assert.equal(resposta.status, 200);
    assert(html.includes("Encontre o painel"), "Mapa deve renderizar com a sessão sintética");
    amostras.push({ ttfb_ms: Math.round(ttfb * 100) / 100, total_ms: Math.round((performance.now() - inicio) * 100) / 100 });
  }
  const consultasDepois = [...servidor.logs().matchAll(/MEDICAO_ESQUEMA (\{[^\n]+\})/g)].length;
  assert.equal(consultasDepois, esperado, "Navegação aquecida não repete a conferência do esquema");
  const resultado = {
    data: new Date().toISOString(),
    checkout_commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    build_id: (await readFile(".next/BUILD_ID", "utf8")).trim(),
    ambiente: "Next start local; PGlite temporário previamente inicializado; sessão sintética; sem latência de rede simulada",
    consultas_esquema_primeira_conexao: consultas,
    total_consultas_esquema: consultas.length,
    mapa_aquecido: amostras,
    sem_sessao_status: semSessao.status,
    com_sessao_status: 200,
    contas_legadas: [],
    limite: "O build pode anteceder o HEAD: confira sua procedência no relatório. Os tempos locais não medem o Postgres nem o TTFB frio da Vercel.",
  };
  await servidor.encerrar();
  servidor = null;
  // No build corrigido, a partida não promove a conta: quem faz isso é a
  // rota legada. Verifica o efeito colateral descrito no prompt ponta a ponta.
  if (esperado === 1) {
    for (const status of ["ACCESS_PENDING", "WAITLIST"]) {
      // O auxiliar fecha o PGlite que preparou. Cada cenário usa outro banco;
      // descarta-se aqui apenas o singleton do processo de medição já fechado.
      delete globalThis.__scrutiniumsDb;
      servidor = await subirServidorLocal({ preparar: async (db, _schema, usuario) => {
        await db.execute(sql`UPDATE users SET onboarding_status = ${status} WHERE id = ${usuario}`);
      } });
      const headers = { cookie: `${servidor.cookie.name}=${servidor.cookie.value}` };
      const antes = await fetch(servidor.origem + "/app/observatorios", { headers, redirect: "manual" });
      assert.equal(antes.status, 307);
      assert(antes.headers.get("location")?.includes("/cadastro/acesso"));
      const promover = await fetch(servidor.origem + "/cadastro/acesso", { headers, redirect: "manual" });
      assert.equal(promover.status, 307);
      assert(promover.headers.get("location")?.includes("/app/observatorios"));
      const depois = await fetch(servidor.origem + "/app/observatorios", { headers, redirect: "manual" });
      assert.equal(depois.status, 200);
      await depois.text();
      resultado.contas_legadas.push({ status_inicial: status, antes: antes.status, promocao: promover.status, mapa_depois: depois.status });
      await servidor.encerrar();
      servidor = null;
    }
  }
  await writeFile(opcao("--saida"), JSON.stringify(resultado, null, 2) + "\n");
  console.log(JSON.stringify(resultado, null, 2));
} finally {
  if (servidor) await servidor.encerrar();
  if (anterior === undefined) delete process.env.NODE_OPTIONS;
  else process.env.NODE_OPTIONS = anterior;
}
