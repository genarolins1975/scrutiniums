import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { signSessionCookie } from "@/lib/sessionCookie";
import { DESTINO_DO_ENDERECO_ANTIGO, PAINEIS_REDIRECIONADOS, PAINEIS_REESCRITOS, PREFIXO_APLICACAO } from "@/lib/observatorios/reescritos";
import { vistasSubstituidas } from "@/lib/observatorios/barraSpa";
import { GRUPOS_CREDITO } from "@/lib/credito/navegacao";
import { ABAS_OBSERVATORIO, enderecoDaAba } from "@/lib/data/observatorioAbas";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

/**
 * Redirecionamento das vistas antigas das Famílias (decisão do dono de 10/11/2026). Nove painéis foram reescritos como páginas
 * Next; o dono mandou redirecionar já, de forma permanente, os seis cujo painel novo não tem perda declarada e manter no
 * endereço antigo os três com perda (Consignado, Crédito imobiliário, Emprego formal) até os mapas serem migrados.
 *
 * O que se trava:
 * - a lista é uma só (src/lib/observatorios/paineis-reescritos.json): o redirects() do next.config.mjs, o registro, o índice
 *   que a aplicação do Crédito lê e os grupos do "Início do painel" saem dela;
 * - redirecionamento permanente, do endereço exato, sem regra que reescreva a consulta (o Next a repassa ao destino);
 * - quem não tem sessão continua indo ao login, agora com o destino novo: no Next 14 os redirects() rodam antes do
 *   middleware, então o endereço antigo responde 308 e é o middleware, já no endereço novo, que leva a /entrar?de=<novo>;
 * - nenhum caminho da plataforma volta a apontar para um endereço redirecionado.
 * Os dois primeiros blocos rodam sem build; o último confere a cadeia inteira no servidor de produção e fica para o CI.
 */
const raiz = process.cwd();
const ORIGEM = "http://localhost:3000";
type Regra = { source: string; destination: string; permanent: boolean; missing?: unknown; has?: unknown };
const regras = async (): Promise<Regra[]> => ((await import("../../next.config.mjs")).default as { redirects: () => Promise<Regra[]> }).redirects();

/** Decisão do dono de 10/11/2026, escrita aqui de propósito: mudar a lista exige nova decisão. */
const REDIRECIONADOS: Record<string, string> = {
  "/observatorio/desenrola": "/divida-das-familias/desenrola",
  "/observatorio/bets-financial-risk": "/divida-das-familias/apostas",
  "/observatorio/financial-fraud": "/divida-das-familias/golpes-e-fraudes",
  "/observatorio/lawsuits": "/divida-das-familias/clientes-contra-bancos",
  "/observatorio/debt-collection-lawsuits": "/divida-das-familias/bancos-cobrando-na-justica",
  "/observatorio/conduct-enforcement": "/divida-das-familias/sancoes-e-reclamacoes",
};
const MANTIDOS = ["/observatorio/payroll-lending-aging", "/observatorio/housing-credit", "/observatorio/formal-employment"];

describe("vistas antigas das Famílias: uma lista só", () => {
  it("os seis painéis sem perda declarada redirecionam e os três com perda ficam no endereço antigo", () => {
    expect(Object.fromEntries(DESTINO_DO_ENDERECO_ANTIGO)).toEqual(REDIRECIONADOS);
    expect(PAINEIS_REESCRITOS.filter((p) => !p.redirecionar).map((p) => PREFIXO_APLICACAO + p.abaAntiga).sort()).toEqual([...MANTIDOS].sort());
  });

  it("o next.config.mjs redireciona exatamente os painéis marcados, de forma permanente e sem tocar na consulta", async () => {
    const todas = await regras();
    const dasVistas = todas.filter((r) => PAINEIS_REESCRITOS.some((p) => r.source === PREFIXO_APLICACAO + p.abaAntiga));
    expect(Object.fromEntries(dasVistas.map((r) => [r.source, r.destination]))).toEqual(REDIRECIONADOS);
    for (const r of dasVistas) {
      expect(r.permanent, r.source).toBe(true);
      // sem condição (vale com e sem sessão) e sem consulta escrita no destino: o Next repassa a que veio
      expect(r.missing ?? r.has, r.source).toBeUndefined();
      expect(r.destination, r.source).not.toMatch(/[?#:*]/);
      expect(r.source, r.source).not.toMatch(/[?#:*(]/);
    }
    for (const m of MANTIDOS) expect(todas.some((r) => r.source === m), m).toBe(false);
  });

  it("a lista não está escrita em outro lugar: o config lê o JSON e o registro tipa o mesmo JSON", () => {
    const config = readFileSync(join(raiz, "next.config.mjs"), "utf-8");
    expect(config).toContain("./src/lib/observatorios/paineis-reescritos.json");
    expect(config).toContain("...REDIRECIONAMENTOS_REESCRITOS");
    for (const antigo of Object.keys(REDIRECIONADOS)) expect(config, antigo).not.toContain(antigo);
    const registro = readFileSync(join(raiz, "src/lib/observatorios/reescritos.ts"), "utf-8");
    expect(registro).toContain('from "./paineis-reescritos.json"');
    for (const p of PAINEIS_REESCRITOS) expect(registro, p.abaAntiga).not.toContain(`"${p.abaAntiga}"`);
  });

  it("todo destino é uma página que existe e exige conta", () => {
    for (const p of PAINEIS_REDIRECIONADOS) {
      expect(existsSync(join(raiz, "src/app", p.rota, "page.tsx")), p.rota).toBe(true);
      expect(ehRotaPublica(p.rota), p.rota).toBe(false);
    }
  });
});

describe("sem sessão, o destino novo é o que chega ao login", () => {
  const requisicao = (caminho: string, cookie?: string) =>
    new NextRequest(ORIGEM + caminho, { headers: new Headers({ accept: "text/html", ...(cookie ? { cookie: `scrutiniums_session=${cookie}` } : {}) }) });
  /** O que o Next 14 faz com o endereço antigo antes de chamar o middleware: aplica a regra de redirects() e repassa a consulta. */
  const aposRedirects = async (caminho: string) => {
    const url = new URL(caminho, ORIGEM);
    const regra = (await regras()).find((r) => r.source === url.pathname && !r.missing && !r.has);
    return regra ? regra.destination + url.search : null;
  };

  it("endereço antigo com consulta → página nova com a mesma consulta → /entrar com o destino novo em `de`", async () => {
    for (const [antigo, novo] of Object.entries(REDIRECIONADOS)) {
      const passo1 = await aposRedirects(`${antigo}?sec=serie&uf=PE`);
      expect(passo1, antigo).toBe(`${novo}?sec=serie&uf=PE`);
      const r = await middleware(requisicao(passo1!));
      expect(r.status, antigo).toBe(307);
      const login = new URL(r.headers.get("location") ?? "", ORIGEM);
      expect(login.pathname, antigo).toBe("/entrar");
      expect(login.searchParams.get("de"), antigo).toBe(`${novo}?sec=serie&uf=PE`);
      // o destino guardado para quem ainda vai se cadastrar também é o novo
      expect(decodeURIComponent(r.headers.get("set-cookie") ?? ""), antigo).toContain(novo);
      expect(decodeURIComponent(r.headers.get("set-cookie") ?? ""), antigo).not.toContain(`${PREFIXO_APLICACAO}/`);
    }
  });

  it("com sessão, a página nova abre sem desvio", async () => {
    const cookie = await signSessionCookie("cd".repeat(32), new Date(Date.now() + 60 * 60 * 1000));
    for (const novo of Object.values(REDIRECIONADOS)) {
      const r = await middleware(requisicao(`${novo}?sec=serie`, cookie));
      expect(r.headers.get("x-middleware-next"), novo).toBe("1");
      expect(r.headers.get("location"), novo).toBeNull();
    }
  });

  it("as três vistas mantidas continuam no endereço antigo, com login para quem não tem sessão", async () => {
    for (const m of MANTIDOS) {
      expect(await aposRedirects(m), m).toBeNull();
      const r = await middleware(requisicao(m));
      expect(new URL(r.headers.get("location") ?? "", ORIGEM).searchParams.get("de"), m).toBe(m);
    }
  });
});

describe("nenhum caminho da plataforma volta ao endereço redirecionado", () => {
  const antigos = Object.keys(REDIRECIONADOS);

  it("os grupos do Crédito guardam a página nova e o índice da aplicação a entrega ao app.js", () => {
    const paginas = GRUPOS_CREDITO.flatMap((g) => g.paginas);
    for (const [antigo, novo] of Object.entries(REDIRECIONADOS)) {
      expect(paginas, antigo).not.toContain(antigo);
      expect(paginas.filter((p) => p === novo).length, novo).toBe(1);
    }
    // as três mantidas continuam nos grupos pelo endereço da aplicação
    for (const m of MANTIDOS) expect(paginas, m).toContain(m);
    const sub = vistasSubstituidas();
    expect(Object.keys(sub).map((c) => PREFIXO_APLICACAO + c).sort()).toEqual([...antigos].sort());
    for (const p of PAINEIS_REDIRECIONADOS) expect(sub[p.abaAntiga]).toEqual({ rota: p.rota, titulo: p.titulo, pergunta: p.resumo });
    // a casca gravada no index.html traz a mesma tabela (node scripts/barra-spa.mjs)
    const html = readFileSync(join(raiz, "public/obs/index.html"), "utf-8");
    const indice = JSON.parse(html.match(/<script type="application\/json" id="navColecaoIndice">([\s\S]*?)<\/script>/)![1]);
    expect(indice.substituidas).toEqual(sub);
    for (const antigo of antigos) expect(html, antigo).not.toContain(`"${antigo}"`);
  });

  it("o app.js sai da aplicação em todo caminho interno que levava à vista substituída", () => {
    const app = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
    // navegação interna (nav, pontes, botões) e histórico: os dois roteadores consultam a tabela antes de desenhar
    expect(app).toMatch(/window\.showView = \(v, \{ replace = false \} = \{\}\) => \{\n[^\n]*\n  const sub = substituta\(v\);\n  if \(sub\) \{ location\[replace \? "replace" : "assign"\]\(sub\.rota\); return; \}/);
    expect(app).toMatch(/function showViewSilent\(v\) \{\n[^\n]*\n  const sub = substituta\(v\);\n  if \(sub\) \{ location\.replace\(sub\.rota\); return; \}/);
    // links do "Início do painel", da tabela de fontes e dos alertas: endereço e título da página nova, sem onclick
    expect(app).toMatch(/function mapaLink\(v, extra\) \{\n[^\n]*\n  return linkDaVista\(v\) \+ \(extra \|\| ""\);/);
    expect(app).toContain('return d.externo ? `<a href="${d.href}">${t}</a>`');
    // nenhum endereço antigo escrito à mão fora do mapa ROUTES (que o código de render ainda usa como chave)
    const semRoutes = app.replace(/const ROUTES = \{[\s\S]*?\};/, "");
    for (const antigo of antigos) expect(semRoutes, antigo).not.toContain(antigo);
  });

  it("o catálogo das abas entrega o endereço novo a quem monta link (boletim, sitemap)", () => {
    for (const p of PAINEIS_REDIRECIONADOS) expect(enderecoDaAba(p.abaAntiga)).toBe(p.rota);
    for (const m of MANTIDOS) expect(enderecoDaAba(m.slice(PREFIXO_APLICACAO.length))).toBe(m);
    // as abas continuam no catálogo (espelho de ROUTES), mas quem lê o catálogo para ligar não escreve o endereço à mão
    for (const p of PAINEIS_REDIRECIONADOS) expect(ABAS_OBSERVATORIO.some((a) => a.caminho === p.abaAntiga), p.abaAntiga).toBe(true);
    for (const arq of ["src/lib/boletim.ts", "src/app/sitemap.ts"]) {
      const fonte = readFileSync(join(raiz, arq), "utf-8");
      expect(fonte, arq).toContain("enderecoDaAba(");
      expect(fonte, arq).not.toMatch(/observatorio\$\{a(ba)?\.caminho\}/);
      for (const antigo of antigos) expect(fonte, `${arq} ${antigo}`).not.toContain(antigo);
    }
  });
});

describe.skipIf(!temBuild && !exigirBuild)("no servidor de produção, a cadeia inteira", () => {
  let s: ServidorProducao;
  beforeAll(async () => {
    if (!temBuild) throw new Error("EXIGIR_BUILD_HTML=1 sem build em .next: rode npm run build antes");
    s = await subirServidor("redirecionamento");
  }, 120_000);
  afterAll(async () => {
    await s?.parar();
  });
  const pedir = (caminho: string, comSessao: boolean) =>
    fetch(s.origem + caminho, { redirect: "manual", headers: { accept: "text/html", ...(comSessao ? { cookie: `scrutiniums_session=${s.cookie}` } : {}) } });

  it("endereço antigo responde 308 para a página nova com a consulta, com e sem sessão", async () => {
    for (const [antigo, novo] of Object.entries(REDIRECIONADOS)) {
      for (const comSessao of [false, true]) {
        const r = await pedir(`${antigo}?sec=serie`, comSessao);
        expect(r.status, `${antigo} sessão=${comSessao}`).toBe(308);
        const destino = new URL(r.headers.get("location") ?? "", s.origem);
        expect(destino.pathname + destino.search, antigo).toBe(`${novo}?sec=serie`);
      }
    }
  }, 60_000);

  it("sem sessão, a página nova leva ao login com o destino novo; com sessão, abre", async () => {
    for (const novo of Object.values(REDIRECIONADOS)) {
      const sem = await pedir(`${novo}?sec=serie`, false);
      expect(sem.status, novo).toBe(307);
      const login = new URL(sem.headers.get("location") ?? "", s.origem);
      expect(login.pathname, novo).toBe("/entrar");
      expect(login.searchParams.get("de"), novo).toBe(`${novo}?sec=serie`);
      const com = await pedir(novo, true);
      expect(com.status, novo).toBe(200);
    }
  }, 120_000);

  it("as três vistas mantidas continuam servindo a aplicação a quem tem sessão", async () => {
    for (const m of MANTIDOS) expect((await pedir(m, true)).status, m).toBe(200);
  }, 60_000);
});
