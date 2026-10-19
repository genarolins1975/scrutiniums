import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sql } from "drizzle-orm";

// Banco PGlite EM MEMÓRIA exclusivo deste processo de teste (pool "forks").
process.env.DATABASE_URL = "pglite-memory:";
delete process.env.USO_ANONIMO_ATIVO;

const sessao = vi.hoisted(() => ({ usuario: null as null | { id: string; email: string } }));
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn(async () => sessao.usuario) }));

import { rotasDoSistemaDeArquivos } from "@/lib/uso/varredura";
import { ROTAS_ACEITAS, grupoDaRota, normalizarRota } from "@/lib/uso/rotas";
import { cabecalhosRecusamRastreio, navegadorRecusaRastreio } from "@/lib/uso/sinais";
import { chaveDeTaxa, decidirColeta, diaDeBrasilia, usoAnonimoAtivo } from "@/lib/uso/coleta";
import { UsoPaginas } from "@/components/admin/UsoPaginas";
import type { UsoDoPeriodo } from "@/lib/uso/painel";
import ROTAS_DO_APP from "@/lib/uso/rotas-do-app.json";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const semCabecalhos = new Headers();

describe("lista fechada de rotas", () => {
  it("a lista versionada é igual às páginas de src/app (rode node scripts/rotas-do-app.mjs)", () => {
    expect(ROTAS_DO_APP).toEqual(rotasDoSistemaDeArquivos(RAIZ + "src/app"));
  });

  it("não traz rotas de servidor, API nem grupos de rota", () => {
    for (const r of ROTAS_DO_APP as string[]) {
      expect(r.startsWith("/api/") || r === "/api", r).toBe(false);
      expect(r, r).not.toMatch(/\(|\)|@|\/_/);
    }
    expect(ROTAS_DO_APP).toContain("/");
    expect(ROTAS_DO_APP).toContain("/app/admin");
    expect(ROTAS_DO_APP).not.toContain("/observatorio");
  });

  it("toda rota aceita normaliza para ela mesma, e todo modelo recebe um valor no lugar do parâmetro", () => {
    for (const r of ROTAS_ACEITAS) {
      const concreta = r.replace(/\[\[\.\.\.[^\]]+\]\]/g, "a/b").replace(/\[\.\.\.[^\]]+\]/g, "a/b").replace(/\[[^\]]+\]/g, "valor-de-teste-1");
      expect(normalizarRota(concreta), r).toBe(r);
      if (!r.includes("[")) expect(normalizarRota(r), r).toBe(r);
    }
  });
});

describe("normalização de rotas", () => {
  it("troca o identificador pelo modelo da pasta", () => {
    expect(normalizarRota("/saneamento/municipio/4314902")).toBe("/saneamento/municipio/[id]");
    expect(normalizarRota("/saneamento/municipio")).toBe("/saneamento/municipio");
    expect(normalizarRota("/setor-eletrico/empresas/listadas")).toBe("/setor-eletrico/empresas/listadas");
    expect(normalizarRota("/setor-eletrico/empresas/cemig")).toBe("/setor-eletrico/empresas/[entidade]");
    expect(normalizarRota("/en/setor-eletrico/aprenda/pld")).toBe("/en/setor-eletrico/aprenda/[conceito]");
  });

  it("descarta consulta, fragmento e barra final", () => {
    expect(normalizarRota("/setor-eletrico/conta-de-luz?uf=SP&cpf=123#topo")).toBe("/setor-eletrico/conta-de-luz");
    expect(normalizarRota("/saneamento/")).toBe("/saneamento");
    expect(normalizarRota("/?utm_source=x")).toBe("/");
  });

  it("resolve o resto opcional, inclusive sem segmento", () => {
    expect(normalizarRota("/eficiencia-estatal/cultura")).toBe("/eficiencia-estatal/cultura/[[...painel]]");
    expect(normalizarRota("/eficiencia-estatal/cultura/bibliotecas/capitais")).toBe("/eficiencia-estatal/cultura/[[...painel]]");
  });

  it("entradas dos observatórios contam pelo endereço concreto; id desconhecido fica no modelo", () => {
    expect(normalizarRota("/observatorios/familias")).toBe("/observatorios/familias");
    expect(normalizarRota("/observatorios/inexistente")).toBe("/observatorios/[id]");
  });

  it("reprova rota fora da lista fechada", () => {
    for (const fora of [
      "/wp-admin",
      "/api/uso",
      "/api/telemetria",
      "/observatorio",
      "/observatorio/pix",
      "/saneamento/municipio/1/2",
      "/setor-eletrico/inexistente",
      "https://scrutiniums.com/",
      "//outro.site/x",
      "/saneamento/../app/admin",
      "/saneamento/%E0%A4%A",
      "saneamento",
      "",
      "/" + "a/".repeat(20),
      "/" + "x".repeat(600),
    ]) {
      expect(normalizarRota(fora), fora).toBeNull();
    }
    expect(normalizarRota(undefined)).toBeNull();
    expect(normalizarRota(42)).toBeNull();
    expect(normalizarRota({ rota: "/" })).toBeNull();
  });
});

describe("atribuição ao observatório", () => {
  it("usa o registro dos observatórios, a irmã inglesa e as entradas próprias", () => {
    expect(grupoDaRota("/saneamento/municipio/[id]")).toBe("energia-e-infraestrutura");
    expect(grupoDaRota("/setor-eletrico")).toBe("energia-e-infraestrutura");
    expect(grupoDaRota("/en/setor-eletrico/pld")).toBe("energia-e-infraestrutura");
    expect(grupoDaRota("/observatorios/familias")).toBe("familias");
    expect(grupoDaRota("/territorio")).toBe("territorio-e-clima");
    expect(grupoDaRota("/territorio/metodologia")).toBe("territorio-e-clima");
    expect(grupoDaRota("/observatorio-do-credito")).toBe("economia");
    expect(grupoDaRota("/eficiencia-estatal")).toBe("servicos-publicos");
  });

  it("páginas gerais ficam fora dos observatórios", () => {
    for (const r of ["/", "/en", "/entrar", "/privacidade", "/perguntas/[porta]", "/app/admin", "/observatorios/[id]"]) {
      expect(grupoDaRota(r), r).toBe("plataforma");
    }
  });
});

describe("Do Not Track e Global Privacy Control", () => {
  it("no navegador, qualquer um dos sinais impede o envio", () => {
    expect(navegadorRecusaRastreio({ doNotTrack: "1" })).toBe(true);
    expect(navegadorRecusaRastreio({ globalPrivacyControl: true })).toBe(true);
    expect(navegadorRecusaRastreio({ doNotTrack: "0" }, { doNotTrack: "1" })).toBe(true);
    expect(navegadorRecusaRastreio({ doNotTrack: "unspecified", globalPrivacyControl: false })).toBe(false);
    expect(navegadorRecusaRastreio({})).toBe(false);
  });

  it("no servidor, DNT: 1 ou Sec-GPC: 1 impedem a contagem, com ou sem conta", () => {
    expect(cabecalhosRecusamRastreio(new Headers({ DNT: "1" }))).toBe(true);
    expect(cabecalhosRecusamRastreio(new Headers({ "Sec-GPC": "1" }))).toBe(true);
    expect(cabecalhosRecusamRastreio(new Headers({ DNT: "0" }))).toBe(false);
    for (const comConta of [true, false]) {
      expect(
        decidirColeta({ caminho: "/", comConta, cabecalhos: new Headers({ "Sec-GPC": "1" }), env: { USO_ANONIMO_ATIVO: "1" } }),
      ).toEqual({ contar: false, motivo: "nao-rastrear" });
    }
  });
});

describe("contagem sem conta atrás da variável de ambiente", () => {
  it("desligada por padrão; liga só com USO_ANONIMO_ATIVO=1", () => {
    expect(usoAnonimoAtivo({})).toBe(false);
    expect(usoAnonimoAtivo({ USO_ANONIMO_ATIVO: "0" })).toBe(false);
    expect(usoAnonimoAtivo({ USO_ANONIMO_ATIVO: "true" })).toBe(false);
    expect(usoAnonimoAtivo({ USO_ANONIMO_ATIVO: "1" })).toBe(true);
    expect(decidirColeta({ caminho: "/", comConta: false, cabecalhos: semCabecalhos, env: {} })).toEqual({
      contar: false,
      motivo: "anonimo-desligado",
    });
    expect(decidirColeta({ caminho: "/", comConta: false, cabecalhos: semCabecalhos, env: { USO_ANONIMO_ATIVO: "1" } })).toEqual({
      contar: true,
      rota: "/",
    });
    expect(decidirColeta({ caminho: "/", comConta: true, cabecalhos: semCabecalhos, env: {} })).toEqual({ contar: true, rota: "/" });
  });

  it("a chave do limite de taxa não contém o IP", () => {
    const chave = chaveDeTaxa("203.0.113.7");
    expect(chave).not.toContain("203.0.113.7");
    expect(chave).toBe(chaveDeTaxa("203.0.113.7"));
    expect(chave).not.toBe(chaveDeTaxa("203.0.113.8"));
  });
});

// ------------------------------------------------------------- banco

let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let registrarVisita: typeof import("@/lib/uso/coleta").registrarVisita;
let getUsoDoPeriodo: typeof import("@/lib/uso/painel").getUsoDoPeriodo;
let POST: typeof import("@/app/api/uso/route").POST;

beforeAll(async () => {
  const dbModule = await import("@/lib/db");
  db = await dbModule.getDb();
  schema = dbModule.schema;
  ({ registrarVisita } = await import("@/lib/uso/coleta"));
  ({ getUsoDoPeriodo } = await import("@/lib/uso/painel"));
  ({ POST } = await import("@/app/api/uso/route"));
});

async function linhas() {
  return db.select().from(schema.usoPaginasDia);
}

function pedido(corpo: unknown, cabecalhos: Record<string, string> = {}, ip = "198.51.100.1") {
  return new Request("http://localhost/api/uso", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...cabecalhos },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

describe("tabela uso_paginas_dia", () => {
  beforeEach(async () => {
    await db.delete(schema.usoPaginasDia);
    sessao.usuario = null;
    delete process.env.USO_ANONIMO_ATIVO;
  });

  it("não tem coluna que identifique pessoa", async () => {
    const r = await db.execute(
      sql.raw("SELECT column_name FROM information_schema.columns WHERE table_name = 'uso_paginas_dia' ORDER BY ordinal_position"),
    );
    const colunas = (r as unknown as { rows: { column_name: string }[] }).rows.map((c) => c.column_name);
    expect(colunas).toEqual(["dia", "rota", "observatorio", "com_conta", "visitas"]);
  });

  it("o upsert agrega no mesmo dia, rota e presença de conta", async () => {
    const agora = new Date("2026-10-19T15:00:00Z");
    for (let i = 0; i < 3; i++) expect(await registrarVisita("/saneamento/municipio/[id]", true, agora)).toBe(true);
    expect(await registrarVisita("/saneamento/municipio/[id]", false, agora)).toBe(true);
    expect(await registrarVisita("/saneamento/municipio/[id]", true, new Date("2026-10-20T15:00:00Z"))).toBe(true);
    const r = await linhas();
    expect(r).toHaveLength(3);
    expect(r.find((l) => l.dia === "2026-10-19" && l.comConta)).toMatchObject({ visitas: 3, observatorio: "energia-e-infraestrutura" });
    expect(r.find((l) => l.dia === "2026-10-19" && !l.comConta)?.visitas).toBe(1);
    expect(r.find((l) => l.dia === "2026-10-20")?.visitas).toBe(1);
  });

  it("o dia segue o fuso de Brasília", () => {
    expect(diaDeBrasilia(new Date("2026-10-20T02:30:00Z"))).toBe("2026-10-19");
    expect(diaDeBrasilia(new Date("2026-10-20T03:30:00Z"))).toBe("2026-10-20");
  });

  it("registrarVisita recusa caminho concreto ou fora da lista", async () => {
    expect(await registrarVisita("/saneamento/municipio/4314902", true)).toBe(false);
    expect(await registrarVisita("/inventada", true)).toBe(false);
    expect(await linhas()).toHaveLength(0);
  });

  it("rota de servidor: sem conta e com a contagem desligada, nada é gravado", async () => {
    const res = await POST(pedido({ rota: "/saneamento/municipio/4314902" }));
    expect(res.status).toBe(204);
    expect(await linhas()).toHaveLength(0);
  });

  it("rota de servidor: sem conta e com a contagem ligada, grava como sem conta", async () => {
    process.env.USO_ANONIMO_ATIVO = "1";
    await POST(pedido({ rota: "/saneamento/municipio/4314902?aba=agua" }));
    const r = await linhas();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ rota: "/saneamento/municipio/[id]", comConta: false, visitas: 1 });
  });

  it("rota de servidor: com conta grava sem associar a pessoa; DNT e GPC não gravam", async () => {
    sessao.usuario = { id: "u-123", email: "pessoa@exemplo.com" };
    await POST(pedido({ rota: "/setor-eletrico/conta-de-luz" }));
    await POST(pedido({ rota: "/setor-eletrico/conta-de-luz" }, { DNT: "1" }));
    await POST(pedido({ rota: "/setor-eletrico/conta-de-luz" }, { "Sec-GPC": "1" }));
    await POST(pedido({ rota: "/rota/inventada" }));
    await POST(pedido("isto não é json"));
    const r = await linhas();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ rota: "/setor-eletrico/conta-de-luz", comConta: true, visitas: 1 });
    expect(JSON.stringify(r)).not.toMatch(/u-123|pessoa@|198\.51\.100\.1/);
  });

  it("painel: janela exata de 30 dias, sem conta não medido com a contagem desligada", async () => {
    const agora = new Date("2026-10-19T15:00:00Z");
    await registrarVisita("/setor-eletrico", true, agora);
    await registrarVisita("/setor-eletrico", true, new Date("2026-09-20T15:00:00Z"));
    await registrarVisita("/setor-eletrico", true, new Date("2026-09-19T15:00:00Z")); // fora da janela
    await registrarVisita("/", true, agora);
    const uso = await getUsoDoPeriodo(agora, {});
    expect(uso).toMatchObject({ inicio: "2026-09-20", fim: "2026-10-19", dias: 30, anonimoAtivo: false, semContaMedido: false });
    expect(uso.primeiroRegistro).toBe("2026-09-19");
    expect(uso.primeiroSemConta).toBeNull();
    expect(uso.porPagina[0]).toMatchObject({ rota: "/setor-eletrico", comConta: 2, semConta: 0 });
    const energia = uso.porObservatorio.find((o) => o.observatorio === "energia-e-infraestrutura");
    expect(energia).toMatchObject({ comConta: 2, paginas: 1 });
    expect(uso.porObservatorio.at(-1)).toMatchObject({ observatorio: "plataforma", comConta: 1 });
    expect(uso.porObservatorio).toHaveLength(7);
  });

  it("painel: o primeiro dia com visita sem conta é o início da medição sem conta", async () => {
    const agora = new Date("2026-10-19T15:00:00Z");
    await registrarVisita("/setor-eletrico/conta-de-luz", false, new Date("2026-10-12T15:00:00Z"));
    await registrarVisita("/setor-eletrico/conta-de-luz", false, agora);
    const uso = await getUsoDoPeriodo(agora, { USO_ANONIMO_ATIVO: "1" });
    expect(uso.primeiroSemConta).toBe("2026-10-12");
    expect(uso.semContaMedido).toBe(true);
  });
});

// ------------------------------------------------------------- painel

function usoDeExemplo(parcial: Partial<UsoDoPeriodo> = {}): UsoDoPeriodo {
  return {
    inicio: "2026-09-20",
    fim: "2026-10-19",
    dias: 30,
    primeiroRegistro: "2026-10-19",
    anonimoAtivo: false,
    semContaMedido: false,
    primeiroSemConta: null,
    porObservatorio: [
      { observatorio: "energia-e-infraestrutura", nome: "Energia e Infraestrutura", comConta: 12, semConta: 0, paginas: 2 },
      { observatorio: "plataforma", nome: "Fora dos observatórios", comConta: 3, semConta: 0, paginas: 1 },
    ],
    porPagina: [
      { rota: "/saneamento/municipio/[id]", observatorio: "energia-e-infraestrutura", nomeObservatorio: "Energia e Infraestrutura", comConta: 10, semConta: 0 },
      { rota: "/", observatorio: "plataforma", nomeObservatorio: "Fora dos observatórios", comConta: 3, semConta: 0 },
    ],
    ...parcial,
  };
}

describe("seção do painel de administração", () => {
  it("mostra o período exato, o estado desligado e 'não medido' no lugar de zero", () => {
    const html = renderToStaticMarkup(createElement(UsoPaginas, { uso: usoDeExemplo() }));
    expect(html).toContain("Uso por observatório e por página, últimos 30 dias");
    expect(html).toContain("20/09/2026 a 19/10/2026, 30 dias no fuso de Brasília");
    expect(html).toContain("Contagem desligada");
    expect(html).toContain("USO_ANONIMO_ATIVO=1");
    expect(html).toContain("A medição começou em 19/10/2026");
    expect(html).toContain("/saneamento/municipio/[id]");
    expect(html).toContain("não medido");
    expect(html).not.toMatch(/—/);
  });

  it("com a contagem ligada mostra os números sem conta", () => {
    const uso = usoDeExemplo({ anonimoAtivo: true, semContaMedido: true });
    uso.porPagina[0].semConta = 7;
    const html = renderToStaticMarkup(createElement(UsoPaginas, { uso }));
    expect(html).toContain("Contagem ligada no servidor");
    expect(html).not.toContain("não medido");
    expect(html).toContain(">7<");
  });

  it("contagem sem conta ligada no meio da janela: a coluna diz desde quando mede, e os dias anteriores não viram zero", () => {
    const meio = renderToStaticMarkup(
      createElement(UsoPaginas, { uso: usoDeExemplo({ primeiroRegistro: "2026-09-01", anonimoAtivo: true, semContaMedido: true, primeiroSemConta: "2026-10-10" }) }),
    );
    expect(meio).toContain("A coluna sem conta só mede a partir de 10/10/2026");
    expect(meio).toContain("não equivale a zero visitas");
    const semVisita = renderToStaticMarkup(
      createElement(UsoPaginas, { uso: usoDeExemplo({ anonimoAtivo: true, semContaMedido: true, primeiroSemConta: null }) }),
    );
    expect(semVisita).toContain("ainda não registrou nenhuma visita");
    const inteira = renderToStaticMarkup(
      createElement(UsoPaginas, { uso: usoDeExemplo({ anonimoAtivo: true, semContaMedido: true, primeiroSemConta: "2026-09-01" }) }),
    );
    expect(inteira).not.toContain("só mede a partir de");
  });

  it("sem registros declara a ausência em vez de tabela de zeros", () => {
    const html = renderToStaticMarkup(
      createElement(UsoPaginas, { uso: usoDeExemplo({ primeiroRegistro: null, porPagina: [], porObservatorio: [] }) }),
    );
    expect(html).toContain("Nenhuma visita registrada nos últimos 30 dias");
    expect(html).toContain("Nenhuma visita registrada até agora");
    expect(html).not.toContain("<table");
  });

  it("o painel /app/admin monta a seção", () => {
    const fonte = readFileSync(RAIZ + "src/app/app/(foco)/admin/page.tsx", "utf8");
    expect(fonte).toContain("<UsoPaginas uso={uso}");
    expect(fonte).toContain("getUsoDoPeriodo()");
  });

  it("o layout raiz monta a coleta, que manda só o caminho", () => {
    const layout = readFileSync(RAIZ + "src/app/layout.tsx", "utf8");
    expect(layout).toContain("<MedeUso />");
    const componente = readFileSync(RAIZ + "src/components/telemetria/MedeUso.tsx", "utf8");
    expect(componente).toContain("usePathname");
    expect(componente).not.toMatch(/useSearchParams|document\.cookie|localStorage|sessionStorage/);
  });

  it("as páginas de autenticação ficam fora da coleta, também nas irmãs /en", async () => {
    const { FORA_DA_MEDICAO } = await import("@/components/telemetria/MedeUso");
    for (const r of ["/entrar", "/entrar/sms", "/entrar/sms/verificar", "/cadastro", "/en/entrar", "/en/cadastro"]) expect(FORA_DA_MEDICAO.test(r), r).toBe(true);
    for (const r of ["/", "/entrarx", "/setor-eletrico", "/en/setor-eletrico", "/app/conta"]) expect(FORA_DA_MEDICAO.test(r), r).toBe(false);
  });
});
