import { afterAll, beforeAll, describe, expect, it, type ExpectStatic } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { ORCAMENTO, TOPO_H1_MAXIMO, aguardarHidratacao, aguardarSessaoResolvida, medirCromo } from "../../scripts/ux-cromo-medida.mjs";

/**
 * Orçamento de cromo (Iniciativa 2 do parecer de UX de 21/10/2026, docs/PARECER_UX_2026-10-21.md): do topo da barra comum até o
 * início do conteúdo, com a faixa de frescor incluída, no máximo 230 px a 1440 px e 200 px a 390 px; o topo do H1 abaixo de 600 px
 * no desktop e dentro da primeira tela (844 px) no celular. Medido no build de produção, com sessão (fixture local, como
 * scripts/obee/judiciario-verificacao.mjs) e sem sessão nas páginas aperitivo. A medida é a mesma de scripts/ux-cromo.mjs.
 *
 * As coleções passam a ser cobradas à medida que recebem a NavegacaoColecao (um PR por bloco da iniciativa): `ENTRADAS` cresce a
 * cada bloco até as 28 entradas. Sem build (.next/BUILD_ID) o teste não roda; com EXIGIR_BUILD_HTML=1 (CI), a falta do build reprova.
 */
const raiz = process.cwd();
const temBuild = existsSync(join(raiz, ".next/BUILD_ID"));
const exigir = process.env.EXIGIR_BUILD_HTML === "1";

/** Entradas de coleção já na navegação única, com sessão. */
const ENTRADAS: Record<string, string> = {
  conectividade: "/conectividade",
  federais: "/contas-publicas",
  fogo: "/territorio/queimadas",
  desastres: "/territorio/desastres",
  // bloco 2
  gas: "/gas-natural",
  combustiveis: "/combustiveis",
  "custo-de-vida": "/custo-de-vida",
  educacao: "/educacao-municipal",
  // a apresentação do Crédito (/observatorio-do-credito) tem casca própria até a Iniciativa 4; a navegação mora nas páginas Next
  credito: "/observatorio-do-credito/quanto-meu-banco-cobra",
  estaduais: "/contas-publicas-estaduais",
  // bloco 3
  saneamento: "/saneamento",
  agro: "/agronegocio",
  // bloco 4
  "setor-eletrico": "/setor-eletrico",
  // bloco 5: as coleções da Eficiência Estatal
  renda: "/eficiencia-estatal/trabalho-renda",
  protecao: "/eficiencia-estatal/assistencia-social",
  moradia: "/eficiencia-estatal/habitacao",
  saude: "/eficiencia-estatal/saude-capitais",
  seguranca: "/eficiencia-estatal/seguranca-publica",
  justica: "/eficiencia-estatal/judiciario",
  cultura: "/eficiencia-estatal/cultura",
  sintese: "/eficiencia-estatal",
  mobilidade: "/eficiencia-estatal/mobilidade-transporte",
  "cidades-clima": "/eficiencia-estatal/meio-ambiente-clima",
  // bloco 6: o Desmatamento e emissões entra pela página ambiental do Agro
  desmatamento: "/agronegocio/ambiente",
  // as quatro coleções servidas pela aplicação do Crédito, desde que ela ganhou a navegação da plataforma no lugar da barra lateral
  // (Iniciativa 2 do parecer de UX de 23/10/2026; antes, 727 px de cromo a 390 px)
  divida: "/observatorio/payroll-lending-aging",
  "divida-governos": "/observatorio/subnational-credit",
  pagamentos: "/observatorio/pix",
  empresas: "/observatorio/sectors",
};
/** Entradas dos seis observatórios e as páginas da conta, com a mesma barra comum. */
const SUPERFICIES = ["/observatorios/familias", "/observatorios/servicos-publicos", "/observatorios/contas-publicas", "/observatorios/energia-e-infraestrutura", "/observatorios/economia", "/app/observatorios", "/app/conta"];
/** Subpáginas e superfícies da mesma navegação. */
const OUTRAS = ["/observatorio/credit", "/observatorio/interest-rates", "/territorio", "/territorio/emissoes", "/contas-publicas/execucao", "/contas-publicas/previdencia", "/gas-natural/importacao", "/gas-natural/metodologia", "/observatorio-do-credito/simulador-da-parcela", "/saneamento/esgoto", "/saneamento/prestadores/divida", "/agronegocio/producao", "/agronegocio/ambiente", "/setor-eletrico/geracao", "/setor-eletrico/pld", "/setor-eletrico/dados", "/en/setor-eletrico", "/en/setor-eletrico/geracao", "/eficiencia-estatal/seguranca-alimentar", "/eficiencia-estatal/saude-capitais/gastos", "/eficiencia-estatal/educacao-municipal-capitais/gastos", "/eficiencia-estatal/acesso-justica", "/eficiencia-estatal/saneamento", "/eficiencia-estatal/energia-conectividade"];
/** Páginas aperitivo das mesmas coleções, sem sessão. */
const ABERTAS = ["/conectividade", "/contas-publicas/previdencia", "/contas-publicas/metodologia", "/territorio/metodologia", "/gas-natural/gas-de-cozinha", "/combustiveis/no-meu-estado", "/educacao-municipal", "/saneamento/municipio", "/saneamento/metodologia", "/agronegocio/metodologia", "/setor-eletrico/conta-de-luz", "/setor-eletrico/metodologia", "/setor-eletrico/aprenda", "/en/setor-eletrico/conta-de-luz", "/eficiencia-estatal", "/buscar"];

describe("orçamento de cromo", () => {
  it("o build existe quando o CI exige", () => {
    if (exigir) expect(temBuild, "rodar npm run build antes dos testes").toBe(true);
  });
});

describe.skipIf(!temBuild)("orçamento de cromo no navegador (build de produção)", () => {
  let temporario = "";
  let filho: ChildProcess | undefined;
  let navegador: Browser | undefined;
  let origem = "";
  let cookie = "";

  beforeAll(async () => {
    temporario = await mkdtemp(join(tmpdir(), "scrutiniums-cromo-"));
    const segredo = randomBytes(32).toString("hex");
    const token = randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 3_600_000);
    const exp = Math.floor(expira.getTime() / 1000);
    cookie = `${exp}.${token}.${createHmac("sha256", segredo).update(`${exp}.${token}`).digest("hex")}`;
    process.env.DATABASE_URL = `pglite://${join(temporario, "db")}`;
    const { getDb, schema } = await import("@/lib/db");
    const db = await getDb();
    const agora = new Date();
    await db.insert(schema.users).values({ id: "cromo-qa", email: "cromo-qa@example.invalid", emailVerifiedAt: agora, phoneVerifiedAt: agora, onboardingStatus: "COMPLETE", createdAt: agora, updatedAt: agora });
    await db.insert(schema.sessions).values({ id: "cromo-qa-sessao", userId: "cromo-qa", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: expira, createdAt: agora });
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

  async function medir(expect: ExpectStatic, largura: 1440 | 390, rotas: string[], comSessao: boolean) {
    const ctx = await navegador!.newContext({ viewport: { width: largura, height: largura === 1440 ? 900 : 844 } });
    if (comSessao) await ctx.addCookies([{ name: "scrutiniums_session", value: cookie, url: origem, httpOnly: true, sameSite: "Lax", secure: false }]);
    const fora: string[] = [];
    try {
      for (const rota of rotas) {
        const page = await ctx.newPage();
        const resp = await page.goto(origem + rota, { waitUntil: "load", timeout: 60_000 });
        expect(resp?.status(), rota).toBe(200);
        expect(new URL(page.url()).pathname, `${rota} não pode cair no login`).toBe(rota);
        // como scripts/ux-cromo.mjs: mede depois de a rede assentar e, com sessão, depois de o navegador resolvê-la (a faixa de
        // consulta aberta, que vem no HTML, some para quem tem conta). A espera por rede ociosa é um atalho e pode estourar sob
        // carga; a que vale é a do estado, em aguardarSessaoResolvida (run 1255 do main, 23/10/2026).
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        await aguardarSessaoResolvida(page, comSessao);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        // onde não há faixa, a barra ainda se acomoda no cliente; sem esperar, a medida sob carga sai abaixo da real
        await aguardarHidratacao(page);
        const m = await page.evaluate(medirCromo);
        if (m.cromo > ORCAMENTO[largura]) fora.push(`${rota}: cromo ${m.cromo} px (máximo ${ORCAMENTO[largura]})`);
        if (m.topoH1 === null || m.topoH1 >= TOPO_H1_MAXIMO[largura]) fora.push(`${rota}: H1 em ${m.topoH1} px (máximo ${TOPO_H1_MAXIMO[largura]})`);
        if (m.rolagemHorizontal) fora.push(`${rota}: a página rola de lado`);
        await page.close();
      }
    } finally {
      await ctx.close();
    }
    return fora;
  }

  // Os quatro casos só leem o que o beforeAll preparou (servidor, navegador e cookie) e cada um abre o seu contexto: rodam ao
  // mesmo tempo. Até 22/10/2026 corriam em série, 134 páginas uma depois da outra, e o arquivo levava 162 s, o mais lento da
  // suíte. O expect de cada caso vem do contexto do teste, como o Vitest pede em testes concorrentes.
  for (const largura of [1440, 390] as const) {
    it.concurrent(`${largura} px, com sessão: entradas das coleções na navegação única e suas subpáginas`, async ({ expect }) => {
      expect(await medir(expect, largura, [...new Set([...Object.values(ENTRADAS), ...OUTRAS, ...SUPERFICIES])], true)).toEqual([]);
    }, 300_000);

    it.concurrent(`${largura} px, sem sessão: páginas abertas das mesmas coleções`, async ({ expect }) => {
      expect(await medir(expect, largura, ABERTAS, false)).toEqual([]);
    }, 300_000);
  }
});
