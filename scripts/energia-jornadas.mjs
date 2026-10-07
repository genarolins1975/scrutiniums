/* Executa as jornadas de usuário da seção 15.2 da especificação num servidor já no ar e registra,
   por jornada, cada passo, o resultado e o que foi observado. Cada jornada é um módulo em
   scripts/jornadas/jNN.mjs com este formato:

     export default {
       id: "J1", titulo: "...", perfil: "...", largura: 1440, movel: false,
       async executar(j) {            // j.p (Page), j.BASE, j.passo, j.clicar, j.nota, j.baixar
         await j.passo("Abre a página inicial", async () => { await j.p.goto(j.BASE + "/setor-eletrico"); return "ok"; });
       },
     };

   Um passo que lança erro interrompe a jornada ("interrompida no passo N"); os seguintes ficam
   como não executados. O valor devolvido pelo passo vira o campo "observado". "Cliques" conta
   as ações do leitor (clique, toque, digitação, seleção), não as navegações por URL.

   Uso:
     PW_CORE=/caminho/node_modules/playwright-core node scripts/energia-jornadas.mjs \
       --base http://localhost:3100 --saida /tmp/jornadas [--so J1,J4]

   É execução de roteiro por script, em Chromium headless: não é teste com pessoas. */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const BASE = (args.base || "http://localhost:3100").replace(/\/$/, "");
const SAIDA = args.saida || "jornadas-energia";
const SO = args.so ? args.so.split(",") : null;
const CHROMIUM = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || "playwright-core");

await mkdir(join(SAIDA, "capturas"), { recursive: true });
const dir = join(import.meta.dirname, "jornadas");
const arquivos = (await readdir(dir)).filter((f) => /^j\d+\.mjs$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
const navegador = await chromium.launch({ executablePath: CHROMIUM });
const resultados = [];

for (const arq of arquivos) {
  const mod = (await import(pathToFileURL(join(dir, arq)).href)).default;
  if (SO && !SO.includes(mod.id)) continue;
  const ctx = await navegador.newContext({
    viewport: { width: mod.largura ?? 1440, height: mod.movel ? 780 : 900 },
    deviceScaleFactor: 1,
    isMobile: !!mod.movel,
    hasTouch: !!mod.movel,
    locale: "pt-BR",
    acceptDownloads: true,
  });
  const p = await ctx.newPage();
  const erros = [];
  p.on("console", (m) => m.type() === "error" && erros.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => erros.push(`pageerror: ${String(e.message).slice(0, 200)}`));
  const passos = [];
  const visitadas = new Set();
  p.on("framenavigated", (f) => {
    if (f === p.mainFrame()) {
      try {
        visitadas.add(new URL(f.url()).pathname);
      } catch {
        /* about:blank */
      }
    }
  });
  let cliques = 0;
  let interrompida = false;
  const t0 = Date.now();
  const j = {
    p,
    ctx,
    BASE,
    passo: async (descricao, fn) => {
      if (interrompida) {
        passos.push({ descricao, resultado: "nao_executado" });
        return undefined;
      }
      try {
        const observado = await fn();
        passos.push({ descricao, resultado: "ok", observado: observado === undefined ? undefined : String(typeof observado === "object" ? JSON.stringify(observado) : observado).slice(0, 400) });
        return observado;
      } catch (e) {
        interrompida = true;
        passos.push({ descricao, resultado: "falhou", observado: String(e.message).split("\n")[0].slice(0, 300) });
        return undefined;
      }
    },
    /** ação do leitor (clique ou toque); conta como interação */
    clicar: async (loc, opcoes = {}) => {
      cliques++;
      if (mod.movel) await loc.tap({ timeout: 8000, ...opcoes });
      else await loc.click({ timeout: 8000, ...opcoes });
    },
    /** digitação, seleção ou tecla; conta como interação */
    agir: async (fn) => {
      cliques++;
      return fn();
    },
    esperar: (ms = 350) => p.waitForTimeout(ms),
    url: () => p.url().replace(BASE, ""),
    afirmar: (cond, msg) => {
      if (!cond) throw new Error(msg);
    },
    /** baixa um arquivo pelo próprio navegador (mesmos cookies e cabeçalhos do leitor) */
    baixar: async (url) => {
      const r = await ctx.request.get(url.startsWith("http") ? url : BASE + url);
      return { status: r.status(), tipo: r.headers()["content-type"] ?? "", corpo: await r.text() };
    },
    captura: async (nome) => p.screenshot({ path: join(SAIDA, "capturas", `${mod.id}_${nome}.png`) }),
  };
  try {
    await mod.executar(j);
  } catch (e) {
    passos.push({ descricao: "Erro fora de passo", resultado: "falhou", observado: String(e.message).slice(0, 300) });
    interrompida = true;
  }
  const ok = passos.filter((s) => s.resultado === "ok").length;
  const falhou = passos.find((s) => s.resultado === "falhou");
  const r = {
    id: mod.id,
    titulo: mod.titulo,
    perfil: mod.perfil,
    largura: mod.largura ?? 1440,
    movel: !!mod.movel,
    resultado: falhou ? (ok > 0 ? "interrompida" : "falhou") : "cumprida",
    passos_ok: ok,
    passos_total: passos.length,
    cliques,
    duracao_ms: Date.now() - t0,
    erros_console: erros,
    paginas_visitadas: [...visitadas].filter((x) => x.startsWith("/setor-eletrico")).sort(),
    passos,
    ...(mod.limite ? { limite: mod.limite } : {}),
  };
  if (falhou) await j.captura("falha").catch(() => {});
  resultados.push(r);
  console.log(`${r.id} · ${r.resultado} · ${ok}/${passos.length} passos · ${cliques} interações · erros ${erros.length}${falhou ? ` · ${falhou.descricao}: ${falhou.observado}` : ""}`);
  await ctx.close();
}
await navegador.close();
await writeFile(
  join(SAIDA, "jornadas.json"),
  JSON.stringify({ base: BASE, gerado_em: new Date().toISOString(), navegador: "Chromium headless (Playwright); roteiro por script, sem pessoas", jornadas: resultados }, null, 1),
);
console.log(`${resultados.length} jornadas; relatório em ${join(SAIDA, "jornadas.json")}`);
