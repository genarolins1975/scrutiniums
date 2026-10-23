/**
 * Pacote de evidências de página para o PR, com um comando, sobre o build existente.
 *
 *   npm run evidencias -- --rotas /setor-eletrico/conta-de-luz /saneamento/municipio --saida docs/ux-AAAA-MM-DD/minha-mudanca
 *   opções: --larguras 390,768,1440 (padrão)   --modos sem,com (padrão: os dois)
 *           --conta nova|volta (padrão: nova). "volta" é a conta que já usou a plataforma: um recorte salvo, um aviso de
 *           atualização e o último acesso no Setor Elétrico (cookie do middleware), para o mapa da conta com a fatia "retomar".
 *
 * Para cada rota, sem sessão e com sessão, em cada largura: captura da página inteira, medida de
 * cromo (scripts/ux-cromo-medida.mjs, o mesmo contrato de src/tests/ux-orcamentos-cromo.test.ts),
 * auditoria axe WCAG 2.1 A e AA (axe-core de node_modules), erros de console e requisições que
 * caíram no login. Grava as capturas, evidencias.json e evidencias.md, uma tabela pronta para o PR.
 *
 * Antes de 22/10/2026 isso vivia em scripts dispersos (ux-medidas, ux-cromo, auditoria-wcag), cada
 * um pedindo um servidor e um cookie montados à mão. O servidor e a sessão vêm de
 * scripts/servidor-local.mjs: next start sobre o build, banco PGlite temporário e sessão real.
 * Chromium: I18N_CHROMIUM_EXECUTABLE ou CHROMIUM_PATH, senão o de PLAYWRIGHT_BROWSERS_PATH, senão o
 * padrão do Playwright.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ORCAMENTO, TOPO_H1_MAXIMO, aguardarHidratacao, aguardarSessaoResolvida, medirCromo } from "./ux-cromo-medida.mjs";
import { subirServidorLocal } from "./servidor-local.mjs";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const ALTURAS = { 390: 844, 768: 1024, 1440: 900 };

export function lerArgumentos(argv) {
  const opcoes = { rotas: [], saida: null, larguras: [390, 768, 1440], modos: ["sem", "com"] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--rotas") { while (argv[i + 1] && !argv[i + 1].startsWith("--")) opcoes.rotas.push(argv[++i]); }
    else if (a === "--saida") opcoes.saida = argv[++i];
    else if (a === "--larguras") opcoes.larguras = argv[++i].split(",").map(Number);
    else if (a === "--modos") opcoes.modos = argv[++i].split(",");
    else if (a === "--conta") opcoes.conta = argv[++i];
    else throw new Error(`Opção desconhecida: ${a}`);
  }
  if (!opcoes.rotas.length || !opcoes.saida) throw new Error("Uso: npm run evidencias -- --rotas /a /b --saida <pasta> [--larguras 390,768,1440] [--modos sem,com]");
  if (opcoes.rotas.some((r) => !r.startsWith("/"))) throw new Error("Cada rota começa com /.");
  if (opcoes.larguras.some((l) => !ALTURAS[l])) throw new Error(`Larguras aceitas: ${Object.keys(ALTURAS).join(", ")}.`);
  if (opcoes.modos.some((m) => !["sem", "com"].includes(m))) throw new Error("Modos aceitos: sem, com.");
  if (opcoes.conta !== undefined && !["nova", "volta"].includes(opcoes.conta)) throw new Error("Contas aceitas: nova, volta.");
  return opcoes;
}

const nomeDaRota = (rota) => (rota === "/" ? "inicio" : rota.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_"));

/**
 * Nome base das capturas de cada rota, no padrão de docs/ux-2026-10-21. Rotas que dariam o mesmo nome (/a-b e /a/b)
 * ganham sufixo pela ordem pedida, para uma captura não sobrescrever a outra.
 */
export function nomesDasRotas(rotas) {
  const usados = new Map();
  const nomes = new Map();
  for (const rota of rotas) {
    if (nomes.has(rota)) continue;
    const nome = nomeDaRota(rota);
    const vez = (usados.get(nome) ?? 0) + 1;
    usados.set(nome, vez);
    nomes.set(rota, vez === 1 ? nome : `${nome}-${vez}`);
  }
  return nomes;
}

export const nomeArquivo = (rota, largura, modo, sufixo = "", base = nomeDaRota(rota)) => `${base}-${largura}-${modo}-sessao${sufixo}.jpg`;

/**
 * Requisição da página (arquivo, dado, API) que caiu no login: a resposta 3xx que manda para /entrar, ou um pedido
 * direto a /entrar. A requisição a /entrar que segue um redirecionamento já contado não conta de novo.
 */
export function caiuNoLogin({ status, location, caminho, redirecionada }) {
  if (status >= 300 && status < 400) return /\/entrar(\?|$)/.test(location ?? "");
  return caminho === "/entrar" && !redirecionada;
}

/** Uma linha da tabela por página medida. */
export function linhaTabela(r) {
  // as 12 colunas do cabeçalho; o erro fica na coluna HTTP, e as medidas que não existiram ficam vazias
  if (r.erro) return `| ${[`\`${r.rota}\``, r.modo, r.largura, `**erro**: ${r.erro.replace(/\|/g, "/")}`, ...Array(8).fill("")].join(" | ")} |`;
  const orc = ORCAMENTO[r.largura];
  const cromo = !r.barra ? "sem barra comum" : `${r.cromo}${orc ? (r.cromo <= orc ? ` (até ${orc})` : ` **acima de ${orc}**`) : ""}`;
  const h1 = r.topoH1 === null ? "**sem H1**" : r.topoH1 <= (TOPO_H1_MAXIMO[r.largura] ?? ALTURAS[r.largura]) ? "sim" : "**não**";
  const final = r.final === r.rota ? "" : `\`${r.final}\``;
  return `| \`${r.rota}\` | ${r.modo} | ${r.largura} | ${r.status} | ${final} | ${cromo} | ${h1} | ${r.rolagemHorizontal ? "**sim**" : "não"} | ${r.axe.length ? `**${r.axe.map((v) => `${v.id} (${v.nos})`).join(", ")}**` : "0"} | ${r.console.length ? `**${r.console.length}**` : "0"} | ${r.login.length ? `**${r.login.length}**` : "0"} | [página](${r.captura}) · [1ª tela](${r.primeiraTela}) |`;
}

export function tabelaMarkdown(resultados, meta) {
  const cabecalho = [
    `### Evidências de página (${meta.data})`,
    "",
    `Build ${meta.build}, \`next start\` local com banco temporário e sessão de teste. Máquina: ${meta.maquina}. Comando: \`${meta.comando}\`. Tempo: ${meta.tempo}.`,
    "",
    "Cromo: do topo da barra comum ao início do conteúdo, em px, com o orçamento da Iniciativa 2 a 390 e 1440 px. Axe: violações WCAG 2.1 A e AA (regra e número de nós). Login: requisições feitas pela página (arquivos, dados, APIs) que caíram em /entrar; o redirecionamento da própria página aparece na coluna Endereço final.",
    "",
    "| Rota | Sessão | Largura | HTTP | Endereço final | Cromo (px) | H1 na 1ª tela | Rolagem horizontal | Axe | Erros de console | Login | Captura |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const detalhes = resultados.filter((r) => !r.erro && (r.console.length || r.login.length)).flatMap((r) => [
    "", `**${r.rota}**, ${r.modo} sessão, ${r.largura} px:`,
    ...r.console.slice(0, 5).map((m) => `- console: ${m.slice(0, 200)}`),
    ...r.login.slice(0, 5).map((u) => `- caiu no login: \`${u}\``),
  ]);
  return [...cabecalho, ...resultados.map(linhaTabela), ...detalhes, ""].join("\n");
}

function chromiumExecutavel() {
  const candidato = process.env.I18N_CHROMIUM_EXECUTABLE ?? process.env.CHROMIUM_PATH
    ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : null);
  return candidato && existsSync(candidato) ? candidato : undefined;
}

async function medirPagina(contexto, origem, rota, largura, modo, saida, base) {
  const pagina = await contexto.newPage();
  const consoleErros = [];
  const login = [];
  pagina.on("console", (m) => { if (m.type() === "error") consoleErros.push(m.text()); });
  pagina.on("pageerror", (e) => consoleErros.push(e.message));
  pagina.on("response", (r) => {
    // a navegação da própria página fica de fora: o redirecionamento dela aparece no endereço final
    if (r.request().isNavigationRequest() && r.frame() === pagina.mainFrame()) return;
    if (caiuNoLogin({ status: r.status(), location: r.headers().location, caminho: new URL(r.url()).pathname, redirecionada: !!r.request().redirectedFrom() })) {
      login.push(r.url().replace(origem, ""));
    }
  });
  try {
    const resposta = await pagina.goto(origem + rota, { waitUntil: "networkidle", timeout: 120_000 });
    await aguardarSessaoResolvida(pagina, modo === "com");
    await pagina.evaluate(() => document.fonts.ready.then(() => undefined));
    await aguardarHidratacao(pagina);
    await pagina.waitForTimeout(400);
    const cromo = await pagina.evaluate(medirCromo);
    const barra = await pagina.evaluate(() => { const e = document.querySelector(".bp"); return !!e && e.getBoundingClientRect().height > 0; });
    const axe = await pagina.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
      return r.violations.map((v) => ({ id: v.id, impacto: v.impact, nos: v.nodes.length, alvos: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
    });
    const captura = nomeArquivo(rota, largura, modo, "", base);
    const primeiraTela = nomeArquivo(rota, largura, modo, "-primeira-tela", base);
    await pagina.screenshot({ path: join(saida, primeiraTela), type: "jpeg", quality: 80 });
    await pagina.screenshot({ path: join(saida, captura), fullPage: true, type: "jpeg", quality: 70 });
    return { rota, modo, largura, status: resposta?.status() ?? null, final: pagina.url().replace(origem, ""), barra, cromo: cromo.cromo, topoH1: cromo.topoH1,
      rolagemHorizontal: cromo.rolagemHorizontal, axe, console: consoleErros, login: [...new Set(login)], captura, primeiraTela };
  } catch (erro) {
    return { rota, modo, largura, erro: String(erro.message ?? erro).split("\n")[0].slice(0, 200), console: consoleErros, login };
  } finally {
    await pagina.close();
  }
}

/** A conta que volta: um recorte salvo e um aviso de atualização (o último acesso vai no cookie, como o middleware grava). */
async function contaQueVolta(db, schema, usuario) {
  const agora = new Date();
  await db.insert(schema.recortesSalvos).values({ id: `${usuario}-r1`, userId: usuario, titulo: "PLD do Sudeste", caminho: "/setor-eletrico/pld?submercado=SE", observatorio: "energia", criadoEm: agora });
  await db.insert(schema.alertasAtualizacao).values({ id: `${usuario}-a1`, userId: usuario, dominio: "energia", referenciaAvisada: null, criadoEm: agora });
}

export async function executar(argv) {
  const opcoes = lerArgumentos(argv);
  const saida = resolve(opcoes.saida);
  mkdirSync(saida, { recursive: true });
  const inicio = Date.now();
  const servidor = await subirServidorLocal(opcoes.conta === "volta" ? { preparar: contaQueVolta } : {});
  const nomes = nomesDasRotas(opcoes.rotas);
  const resultados = [];
  let navegador;
  try {
    // dentro do try: se o Chromium não abrir, o next start e as pastas temporárias são encerrados do mesmo jeito
    navegador = await chromium.launch({ executablePath: chromiumExecutavel() });
    for (const modo of opcoes.modos) for (const largura of opcoes.larguras) {
      const contexto = await navegador.newContext({ viewport: { width: largura, height: ALTURAS[largura] }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      await contexto.addInitScript({ path: require.resolve("axe-core/axe.min.js") });
      if (modo === "com") await contexto.addCookies([servidor.cookie]);
      if (modo === "com" && opcoes.conta === "volta") await contexto.addCookies([{ ...servidor.cookie, name: "scrutiniums_observatorio", value: "c:setor-eletrico" }]);
      for (const rota of opcoes.rotas) {
        const r = await medirPagina(contexto, servidor.origem, rota, largura, modo, saida, nomes.get(rota));
        resultados.push(r);
        console.log(`${modo} sessão ${String(largura).padStart(4)} ${rota}  ${r.erro ? "ERRO " + r.erro : `HTTP ${r.status} cromo=${r.cromo} axe=${r.axe.length} console=${r.console.length} login=${r.login.length}`}`);
      }
      await contexto.close();
    }
  } finally {
    await navegador?.close();
    await servidor.encerrar();
  }
  const ordem = (r) => [opcoes.rotas.indexOf(r.rota), opcoes.modos.indexOf(r.modo), opcoes.larguras.indexOf(r.largura)];
  resultados.sort((a, b) => { const x = ordem(a), y = ordem(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  const segundos = Math.round((Date.now() - inicio) / 1000);
  const meta = {
    data: new Date().toISOString().slice(0, 10),
    build: readFileSync(join(RAIZ, ".next/BUILD_ID"), "utf8").trim(),
    maquina: `${cpus().length} vCPU, ${Math.round(totalmem() / 2 ** 30)} GB`,
    comando: `npm run evidencias -- ${argv.join(" ")}`,
    tempo: `${Math.floor(segundos / 60)} min ${String(segundos % 60).padStart(2, "0")} s`,
  };
  writeFileSync(join(saida, "evidencias.json"), JSON.stringify({ ...meta, resultados }, null, 1) + "\n");
  writeFileSync(join(saida, "evidencias.md"), tabelaMarkdown(resultados, meta));
  console.log(`\n${resultados.length} páginas em ${meta.tempo}. Tabela em ${join(saida, "evidencias.md")}`);
  return resultados.some((r) => r.erro) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await executar(process.argv.slice(2)); }
  catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
