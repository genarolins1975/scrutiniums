import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { medirTextoMinimo } from "../../scripts/ux-texto-minimo-medida.mjs";

/**
 * Piso de 12 px (Iniciativa 5 do parecer de UX de 21/10/2026, docs/PARECER_UX_2026-10-21.md): nenhum texto visível abaixo de 12 px nas
 * rotas da seção 5 do parecer (37), mais /cadastro, a 1440 e a 390 px. A medida é a de scripts/ux-medidas.mjs (elemento visível com
 * texto próprio e corpo calculado abaixo de 12 px), em scripts/ux-texto-minimo-medida.mjs. Medido no build de produção, com sessão
 * (fixture local, como ux-orcamentos-cromo.test.ts) e sem sessão nas páginas abertas.
 *
 * Sem build (.next/BUILD_ID) o teste não roda; com EXIGIR_BUILD_HTML=1 (CI), a falta do build reprova.
 */
const raiz = process.cwd();
const temBuild = existsSync(join(raiz, ".next/BUILD_ID"));
const exigir = process.env.EXIGIR_BUILD_HTML === "1";

/** Abertas, sem sessão (seção 5 do parecer, mais o cadastro). */
const ABERTAS = [
  "/", "/perguntas/familias", "/perguntas/energia-e-infraestrutura", "/setor-eletrico/conta-de-luz", "/saneamento/municipio",
  "/eficiencia-estatal", "/gas-natural/gas-de-cozinha", "/observatorio-do-credito", "/combustiveis/no-meu-estado",
  "/contas-publicas/previdencia", "/conectividade", "/educacao-municipal", "/entrar", "/glossario", "/sobre", "/cadastro",
];
/** Com conta (seção 5 do parecer), inclusive a aplicação do Crédito. */
const COM_CONTA = [
  "/app/observatorios", "/observatorios/familias", "/observatorios/economia", "/setor-eletrico", "/setor-eletrico/pld", "/saneamento",
  "/saneamento/acesso", "/gas-natural", "/combustiveis", "/eficiencia-estatal", "/eficiencia-estatal/saude-capitais",
  "/eficiencia-estatal/trabalho-renda", "/contas-publicas", "/contas-publicas-estaduais", "/agronegocio", "/territorio", "/custo-de-vida",
  "/conectividade", "/educacao-municipal", "/observatorio/map", "/observatorio/interest-rates", "/app/conta",
  // páginas no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026, painel-molde.test.ts): a conta de luz aqui é o painel completo
  "/setor-eletrico/qualidade", "/setor-eletrico/conta-de-luz",
  // PR 1 da Iniciativa 1: as demais páginas do Grupo 1 no molde de painel (as outras já estavam na lista)
  "/agronegocio/atlas", "/agronegocio/clima-ambiente", "/agronegocio/prato", "/agronegocio/tamanho", "/contas-publicas/metas",
  "/contas-publicas/por-area", "/eficiencia-estatal/assistencia-social/necessidades", "/eficiencia-estatal/cultura/rede",
  "/eficiencia-estatal/educacao-municipal-capitais", "/eficiencia-estatal/energia-conectividade", "/eficiencia-estatal/habitacao/deficit",
  "/eficiencia-estatal/indice-de-resultados", "/eficiencia-estatal/judiciario/panorama", "/eficiencia-estatal/meio-ambiente-clima/riscos",
  "/eficiencia-estatal/mobilidade-transporte/tempo", "/eficiencia-estatal/saude-capitais/gastos",
  "/eficiencia-estatal/seguranca-publica/estados", "/eficiencia-estatal/trabalho-renda/acesso-ao-trabalho",
  "/gas-natural/gnv-e-gas-encanado", "/observatorio-do-credito/quanto-meu-banco-cobra", "/observatorio-do-credito/simulador-da-parcela",
  "/saneamento/preco-regulado/simulador", "/saneamento/tarifa-social", "/setor-eletrico/inclusao-energetica/tarifa-social",
  "/territorio/desastres", "/territorio/queimadas",
  // PR 2b da Iniciativa 1 (Grupo 2, Eficiência Estatal)
  "/eficiencia-estatal/acesso-justica", "/eficiencia-estatal/acesso-justica/cobertura", "/eficiencia-estatal/acesso-justica/conciliacao",
  "/eficiencia-estatal/acesso-justica/recursos", "/eficiencia-estatal/acesso-justica/tempo-resposta",
  "/eficiencia-estatal/educacao-municipal-capitais/atendimento", "/eficiencia-estatal/educacao-municipal-capitais/comparar",
  "/eficiencia-estatal/educacao-municipal-capitais/gastos", "/eficiencia-estatal/educacao-municipal-capitais/resultados",
  "/eficiencia-estatal/energia-conectividade/acesso", "/eficiencia-estatal/energia-conectividade/continuidade",
  "/eficiencia-estatal/energia-conectividade/custo", "/eficiencia-estatal/energia-conectividade/internet", "/eficiencia-estatal/judiciario",
  "/eficiencia-estatal/judiciario/internacional", "/eficiencia-estatal/judiciario/recursos", "/eficiencia-estatal/judiciario/tempo",
  "/eficiencia-estatal/judiciario/filas", "/eficiencia-estatal/judiciario/entrega", "/eficiencia-estatal/judiciario/consistencia",
  "/eficiencia-estatal/judiciario/criminal", "/eficiencia-estatal/judiciario/acesso", "/eficiencia-estatal/judiciario/comparar",
  "/eficiencia-estatal/meio-ambiente-clima", "/eficiencia-estatal/mobilidade-transporte", "/eficiencia-estatal/mobilidade-transporte/oportunidades",
  "/eficiencia-estatal/saneamento", "/eficiencia-estatal/saneamento/agua", "/eficiencia-estatal/saneamento/drenagem",
  "/eficiencia-estatal/saneamento/esgoto", "/eficiencia-estatal/saneamento/recursos", "/eficiencia-estatal/saneamento/residuos",
  "/eficiencia-estatal/saude-capitais/comparar", "/eficiencia-estatal/seguranca-publica", "/eficiencia-estatal/seguranca-publica/letalidade",
  "/eficiencia-estatal/seguranca-publica/mulheres", "/eficiencia-estatal/seguranca-publica/patrimonio",
  "/eficiencia-estatal/seguranca-publica/resposta", "/eficiencia-estatal/seguranca-publica/recursos",
];

describe("piso de 12 px", () => {
  it("o build existe quando o CI exige", () => {
    if (exigir) expect(temBuild, "rodar npm run build antes dos testes").toBe(true);
  });
});

describe.skipIf(!temBuild)("piso de 12 px no navegador (build de produção)", () => {
  let temporario = "";
  let filho: ChildProcess | undefined;
  let navegador: Browser | undefined;
  let origem = "";
  let cookie = "";

  beforeAll(async () => {
    temporario = await mkdtemp(join(tmpdir(), "scrutiniums-texto-"));
    const segredo = randomBytes(32).toString("hex");
    const token = randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 3_600_000);
    const exp = Math.floor(expira.getTime() / 1000);
    cookie = `${exp}.${token}.${createHmac("sha256", segredo).update(`${exp}.${token}`).digest("hex")}`;
    process.env.DATABASE_URL = `pglite://${join(temporario, "db")}`;
    const { getDb, schema } = await import("@/lib/db");
    const db = await getDb();
    const agora = new Date();
    await db.insert(schema.users).values({ id: "texto-qa", email: "texto-qa@example.invalid", emailVerifiedAt: agora, phoneVerifiedAt: agora, onboardingStatus: "COMPLETE", createdAt: agora, updatedAt: agora });
    await db.insert(schema.sessions).values({ id: "texto-qa-sessao", userId: "texto-qa", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: expira, createdAt: agora });
    await (db as unknown as { $client: { close: () => Promise<void> } }).$client.close();
    const ambiente: NodeJS.ProcessEnv = { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: process.env.DATABASE_URL, COOKIE_SECRET: segredo };
    for (const k of ["PATH", "LANG", "LC_ALL", "TZ", "TMPDIR", "TEMP", "TMP", "NODE_EXTRA_CA_CERTS"]) if (process.env[k] !== undefined) ambiente[k] = process.env[k];
    filho = spawn(process.execPath, [join(raiz, "node_modules/next/dist/bin/next"), "start", "--hostname", "localhost", "--port", "0"], { cwd: raiz, env: ambiente, stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    const juntar = (c: Buffer) => { logs = (logs + c.toString()).slice(-64_000); };
    filho.stdout!.on("data", juntar);
    filho.stderr!.on("data", juntar);
    for (let i = 0; i < 150 && !origem; i++) {
      if (filho.exitCode !== null) throw new Error(`Next encerrou: ${logs}`);
      const achado = logs.match(/http:\/\/localhost:\d+/);
      if (achado) {
        try {
          if ((await fetch(`${achado[0]}/api/auth/eu`)).status === 401) origem = achado[0];
        } catch { /* ainda subindo */ }
      }
      if (!origem) await new Promise((r) => setTimeout(r, 300));
    }
    if (!origem) throw new Error(`Next não ficou pronto: ${logs}`);
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
  }, 120_000);

  afterAll(async () => {
    await navegador?.close();
    if (filho && filho.exitCode === null) filho.kill("SIGTERM");
    if (temporario) await rm(temporario, { recursive: true, force: true });
  });

  async function medir(largura: 1440 | 390, rotas: string[], comSessao: boolean) {
    const ctx = await navegador!.newContext({ viewport: { width: largura, height: largura === 1440 ? 900 : 844 } });
    if (comSessao) await ctx.addCookies([{ name: "scrutiniums_session", value: cookie, url: origem, httpOnly: true, sameSite: "Lax", secure: false }]);
    const abaixo: string[] = [];
    try {
      for (const rota of rotas) {
        const page = await ctx.newPage();
        const resp = await page.goto(origem + rota, { waitUntil: "load", timeout: 60_000 });
        expect(resp?.status(), rota).toBe(200);
        expect(new URL(page.url()).pathname, `${rota} não pode cair no login`).toBe(rota);
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const m = await page.evaluate(medirTextoMinimo);
        for (const p of m.pequenos.slice(0, 5)) abaixo.push(`${rota}: <${p.tag}> ${p.px} px "${p.texto}" (${p.classe})`);
        if (m.total > 5) abaixo.push(`${rota}: mais ${m.total - 5}`);
        await page.close();
      }
    } finally {
      await ctx.close();
    }
    return abaixo;
  }

  for (const largura of [1440, 390] as const) {
    it(`${largura} px, sem sessão: nenhum texto abaixo de 12 px nas páginas abertas`, async () => {
      expect(await medir(largura, ABERTAS, false)).toEqual([]);
    }, 300_000);

    it(`${largura} px, com sessão: nenhum texto abaixo de 12 px nos painéis e na aplicação do Crédito`, async () => {
      expect(await medir(largura, COM_CONTA, true)).toEqual([]);
    }, 420_000);
  }
});
