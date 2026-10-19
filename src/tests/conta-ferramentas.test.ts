import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { User } from "@/lib/schema";

/**
 * Recursos da conta da Onda 2 (docs/BANCA_2026-10-19.md, "O que a conta precisa ganhar"): recorte salvo e
 * compartilhável, pacote para citar e alerta de atualização por fonte de dados. O que se trava:
 * - as APIs exigem sessão, respeitam o limite e isolam as contas (nenhuma lê, renomeia ou apaga o que é de outra);
 * - a migração das duas tabelas é idempotente;
 * - a referência ABNT, o BibTeX e o RIS saem no formato esperado, com o DOI só quando existe;
 * - a barra de ferramentas não aparece sem sessão (nem nas consultas abertas) e aparece com sessão;
 * - o disparo dos alertas só envia quando a referência publicada avança, uma vez, e devolve a reserva se o envio falha;
 * - a interface só diz que o e-mail sai quando o disparo diário de fato rodou.
 */

const sessao = vi.hoisted(() => ({ atual: null as User | null }));
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn(async () => sessao.atual) }));
const correio = vi.hoisted(() => ({ enviados: [] as { to: string; subject: string; text: string; headers?: Record<string, string> }[], falhar: false }));
vi.mock("@/lib/mailer", () => ({
  sendTransactionalEmail: vi.fn(async (m: { to: string; subject: string; text: string; headers?: Record<string, string> }) => {
    if (correio.falhar) return { sent: false, error: "simulado" };
    correio.enviados.push(m);
    return { sent: true };
  }),
}));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/setor-eletrico/conta-de-luz",
}));

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const SEGREDO = "segredo-sintetico-do-disparo-1234";

let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let mod: typeof import("@/lib/db");
let recortesApi: typeof import("@/app/api/conta/recortes/route");
let recorteApi: typeof import("@/app/api/conta/recortes/[id]/route");
let alertasApi: typeof import("@/app/api/conta/alertas/route");
let alertaApi: typeof import("@/app/api/conta/alertas/[dominio]/route");
let citacaoApi: typeof import("@/app/api/conta/citacao/route");
let enviarApi: typeof import("@/app/api/alertas/enviar/route");
let sairApi: typeof import("@/app/api/alertas/sair/route");
let alertas: typeof import("@/lib/conta/alertas");
let serial = 0;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "pglite-memory:");
  vi.stubEnv("COOKIE_SECRET", "segredo-sintetico-do-teste-ferramentas");
  vi.stubEnv("BOLETIM_SECRET", SEGREDO);
  mod = await import("@/lib/db");
  db = await mod.getDb();
  recortesApi = await import("@/app/api/conta/recortes/route");
  recorteApi = await import("@/app/api/conta/recortes/[id]/route");
  alertasApi = await import("@/app/api/conta/alertas/route");
  alertaApi = await import("@/app/api/conta/alertas/[dominio]/route");
  citacaoApi = await import("@/app/api/conta/citacao/route");
  enviarApi = await import("@/app/api/alertas/enviar/route");
  sairApi = await import("@/app/api/alertas/sair/route");
  alertas = await import("@/lib/conta/alertas");
});

beforeEach(async () => {
  sessao.atual = null;
  correio.enviados = [];
  correio.falhar = false;
  await db.delete(mod.schema.recortesSalvos);
  await db.delete(mod.schema.alertasAtualizacao);
  await db.delete(mod.schema.productEvents);
  await db.delete(mod.schema.users);
});
afterAll(() => vi.unstubAllEnvs());

async function usuario(): Promise<User> {
  const id = `ferramentas-${++serial}`;
  const agora = new Date("2026-10-19T12:00:00Z");
  const [u] = await db
    .insert(mod.schema.users)
    .values({ id, email: `${id}@example.invalid`, onboardingStatus: "COMPLETE", createdAt: agora, updatedAt: agora })
    .returning();
  return u;
}

const json = (corpo: unknown, metodo = "POST") =>
  new Request("http://localhost/api", { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
const recorte = (caminho = "/setor-eletrico/preco?sub=SE#serie", titulo = "PLD do Sudeste") =>
  recortesApi.POST(json({ titulo, caminho, observatorio: "energia" }));

describe("migração", () => {
  it("é idempotente: reaplicada, mantém as tabelas e os dados", async () => {
    const u = await usuario();
    sessao.atual = u;
    expect((await recorte()).status).toBe(201);
    await mod.migrate(db);
    await mod.migrate(db);
    const n = await db.execute(sql.raw("SELECT count(*)::int AS n FROM recortes_salvos"));
    expect((n as unknown as { rows: { n: number }[] }).rows[0].n).toBe(1);
    await db.execute(sql.raw("SELECT id, user_id, dominio, referencia_avisada, ultimo_envio_em, criado_em FROM alertas_atualizacao"));
  });
});

describe("autenticação obrigatória", () => {
  it("sem sessão, todas as rotas da conta respondem 401 e nada é gravado", async () => {
    const respostas = [
      await recortesApi.GET(),
      await recortesApi.POST(json({ titulo: "x", caminho: "/setor-eletrico", observatorio: "energia" })),
      await recorteApi.PATCH(json({ titulo: "y" }, "PATCH"), { params: { id: "qualquer" } }),
      await recorteApi.DELETE(new Request("http://localhost/api", { method: "DELETE" }), { params: { id: "qualquer" } }),
      await alertasApi.GET(),
      await alertasApi.POST(json({ dominio: "energia" })),
      await alertaApi.DELETE(new Request("http://localhost/api", { method: "DELETE" }), { params: { dominio: "energia" } }),
      await citacaoApi.GET(new Request("http://localhost/api/conta/citacao?dominios=energia")),
    ];
    expect(respostas.map((r) => r.status)).toEqual(Array(respostas.length).fill(401));
    expect(await db.select().from(mod.schema.recortesSalvos)).toHaveLength(0);
    expect(await db.select().from(mod.schema.alertasAtualizacao)).toHaveLength(0);
  });

  it("o disparo dos alertas exige o segredo do workflow ou sessão de administrador", async () => {
    const r = await enviarApi.POST(new Request("http://localhost/api/alertas/enviar", { method: "POST" }));
    expect(r.status).toBe(403);
    const errado = await enviarApi.POST(new Request("http://localhost/api/alertas/enviar", { method: "POST", headers: { Authorization: "Bearer outro-segredo-qualquer-123" } }));
    expect(errado.status).toBe(403);
  });
});

describe("recortes salvos", () => {
  it("salva o caminho com consulta e âncora, não duplica e lista só os da conta", async () => {
    const a = await usuario();
    sessao.atual = a;
    const r1 = await recorte();
    expect(r1.status).toBe(201);
    const { recorte: salvo } = await r1.json();
    expect(salvo).toMatchObject({ caminho: "/setor-eletrico/preco?sub=SE#serie", titulo: "PLD do Sudeste", observatorio: "energia", userId: a.id });
    const r2 = await recorte();
    expect(r2.status).toBe(200);
    expect((await r2.json()).existente).toBe(true);
    expect((await (await recortesApi.GET()).json()).recortes).toHaveLength(1);
  });

  it("recusa endereço externo, da API, da conta e título vazio ou longo", async () => {
    sessao.atual = await usuario();
    for (const caminho of ["https://exemplo.invalid/x", "//exemplo.invalid", "/api/conta/recortes", "/app/conta", "setor-eletrico", "/a\\b", "/" + "x".repeat(2001)]) {
      const r = await recorte(caminho);
      expect(r.status, caminho).toBe(400);
      expect((await r.json()).campo).toBe("caminho");
    }
    expect((await recorte("/setor-eletrico", "   ")).status).toBe(400);
    expect((await recorte("/setor-eletrico", "x".repeat(121))).status).toBe(400);
    const obs = await recortesApi.POST(json({ titulo: "x", caminho: "/setor-eletrico", observatorio: "inexistente" }));
    expect(obs.status).toBe(400);
  });

  it("limite de 50 por conta: o 51º responde 409 e não grava", async () => {
    const { LIMITE_RECORTES } = await import("@/lib/conta/recortes");
    expect(LIMITE_RECORTES).toBe(50);
    sessao.atual = await usuario();
    for (let i = 0; i < LIMITE_RECORTES; i++) expect((await recorte(`/setor-eletrico/preco?d=${i}`, `Recorte ${i}`)).status).toBe(201);
    const extra = await recorte("/setor-eletrico/preco?d=extra");
    expect(extra.status).toBe(409);
    expect((await extra.json()).error).toMatch(/50 recortes/);
    expect((await (await recortesApi.GET()).json()).recortes).toHaveLength(LIMITE_RECORTES);
    // outra conta não é afetada pelo limite da primeira
    sessao.atual = await usuario();
    expect((await recorte("/setor-eletrico/preco?d=extra")).status).toBe(201);
  });

  it("isolamento: outra conta não vê, não renomeia e não apaga", async () => {
    const a = await usuario();
    const b = await usuario();
    sessao.atual = a;
    const { recorte: r } = await (await recorte()).json();
    sessao.atual = b;
    expect((await (await recortesApi.GET()).json()).recortes).toHaveLength(0);
    expect((await recorteApi.PATCH(json({ titulo: "Invadido" }, "PATCH"), { params: { id: r.id } })).status).toBe(404);
    expect((await recorteApi.DELETE(new Request("http://localhost/api", { method: "DELETE" }), { params: { id: r.id } })).status).toBe(404);
    sessao.atual = a;
    const lista = (await (await recortesApi.GET()).json()).recortes;
    expect(lista).toHaveLength(1);
    expect(lista[0].titulo).toBe("PLD do Sudeste");
    // o dono renomeia e apaga
    const ren = await recorteApi.PATCH(json({ titulo: "  PLD   Sudeste, 2026 " }, "PATCH"), { params: { id: r.id } });
    expect((await ren.json()).recorte.titulo).toBe("PLD Sudeste, 2026");
    expect((await recorteApi.DELETE(new Request("http://localhost/api", { method: "DELETE" }), { params: { id: r.id } })).status).toBe(200);
    expect((await (await recortesApi.GET()).json()).recortes).toHaveLength(0);
  });
});

describe("alertas de atualização", () => {
  it("assinar é idempotente, guarda a referência publicada e isola as contas", async () => {
    const a = await usuario();
    const b = await usuario();
    sessao.atual = a;
    expect((await alertasApi.POST(json({ dominio: "inexistente" }))).status).toBe(400);
    const r = await alertasApi.POST(json({ dominio: "energia" }));
    expect(r.status).toBe(201);
    const { alerta } = await r.json();
    expect(alerta.referenciaAvisada).toBe(JSON.parse(ler("public/energia/gold/pld.json")).dia_referencia);
    await alertasApi.POST(json({ dominio: "energia" }));
    expect((await (await alertasApi.GET()).json()).alertas).toHaveLength(1);
    sessao.atual = b;
    expect((await (await alertasApi.GET()).json()).alertas).toHaveLength(0);
    expect((await alertaApi.DELETE(new Request("http://localhost/api", { method: "DELETE" }), { params: { dominio: "energia" } })).status).toBe(404);
    sessao.atual = a;
    expect((await (await alertasApi.GET()).json()).alertas).toHaveLength(1);
    expect((await alertaApi.DELETE(new Request("http://localhost/api", { method: "DELETE" }), { params: { dominio: "energia" } })).status).toBe(200);
    expect((await (await alertasApi.GET()).json()).alertas).toHaveLength(0);
  });

  it("referência que avança gera aviso; igual, ausente ou menor não", () => {
    expect(alertas.referenciaAvancou("2026-09-29", "2026-09-30")).toBe(true);
    expect(alertas.referenciaAvancou(null, "2026-09")).toBe(true);
    expect(alertas.referenciaAvancou("2026-09-30", "2026-09-30")).toBe(false);
    expect(alertas.referenciaAvancou("2026-09-30", null)).toBe(false);
    expect(alertas.referenciaAvancou("2026-09-30", "2026-09-01")).toBe(false);
  });

  it("o disparo avisa uma vez quando a referência avançou, não repete e devolve a reserva se o envio falha", async () => {
    const a = await usuario();
    const b = await usuario();
    sessao.atual = a;
    await alertasApi.POST(json({ dominio: "energia" }));
    sessao.atual = b;
    await alertasApi.POST(json({ dominio: "energia" }));
    sessao.atual = null;
    const disparo = () => enviarApi.POST(new Request("http://localhost/api/alertas/enviar", { method: "POST", headers: { Authorization: `Bearer ${SEGREDO}` } }));

    // ninguém recebe: a referência publicada é a mesma da assinatura
    expect(await (await disparo()).json()).toMatchObject({ assinaturas: 2, destinatarios: 0, enviados: 0 });

    // a conta A conhecia uma referência anterior: recebe um aviso, com o descadastro em um clique
    const atual = JSON.parse(ler("public/energia/gold/pld.json")).dia_referencia as string;
    await db.execute(sql`UPDATE alertas_atualizacao SET referencia_avisada = '2026-01-01' WHERE user_id = ${a.id}`);
    correio.falhar = true;
    expect(await (await disparo()).json()).toMatchObject({ destinatarios: 1, enviados: 0, falhas: 1 });
    const [devolvida] = await db.execute(sql`SELECT referencia_avisada FROM alertas_atualizacao WHERE user_id = ${a.id}`).then((r) => (r as unknown as { rows: { referencia_avisada: string }[] }).rows);
    expect(devolvida.referencia_avisada).toBe("2026-01-01");

    correio.falhar = false;
    expect(await (await disparo()).json()).toMatchObject({ destinatarios: 1, enviados: 1 });
    expect(correio.enviados).toHaveLength(1);
    const m = correio.enviados[0];
    expect(m.to).toBe(a.email);
    expect(m.subject).toContain("Setor Elétrico");
    expect(m.text).toContain("Referência mais recente (PLD)");
    expect(m.text).toContain("antes: 01/01/2026");
    expect(m.text).toContain("https://scrutiniums.com/setor-eletrico");
    expect(m.text).toContain("https://scrutiniums.com/app/conta#alertas");
    expect(m.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(m.text).not.toMatch(/—/);

    // idempotente: o mesmo disparo de novo não repete o aviso
    expect(await (await disparo()).json()).toMatchObject({ destinatarios: 0, enviados: 0 });
    const [gravada] = await db.execute(sql`SELECT referencia_avisada FROM alertas_atualizacao WHERE user_id = ${a.id}`).then((r) => (r as unknown as { rows: { referencia_avisada: string }[] }).rows);
    expect(gravada.referencia_avisada).toBe(atual);

    // descadastro em um clique pelo cabeçalho do e-mail
    const url = m.headers!["List-Unsubscribe"].slice(1, -1);
    expect((await sairApi.POST(new Request(url.replace("https://scrutiniums.com", "http://localhost"), { method: "POST" }))).status).toBe(204);
    expect((await sairApi.POST(new Request("http://localhost/api/alertas/sair?token=forjado.abc", { method: "POST" }))).status).toBe(400);
    const restantes = await db.select().from(mod.schema.alertasAtualizacao);
    expect(restantes.map((r) => r.userId)).toEqual([b.id]);
  });

  it("a interface só diz que o e-mail sai quando há provedor e o disparo rodou nos últimos três dias", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await alertas.envioLigado()).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_sintetico");
    expect(await alertas.envioLigado()).toBe(false);
    await enviarApi.POST(new Request("http://localhost/api/alertas/enviar", { method: "POST", headers: { Authorization: `Bearer ${SEGREDO}` } }));
    expect(await alertas.envioLigado()).toBe(true);
    expect(await alertas.envioLigado(new Date(Date.now() + 4 * 86_400_000))).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "");
  });
});

describe("pacote para citar", () => {
  const dados = (doi: string | null) => ({
    titulo: "Preço da energia: PLD & 100% {teste}",
    observatorio: "Observatório Brasileiro do Setor Elétrico",
    url: "https://scrutiniums.com/setor-eletrico/preco?sub=SE#serie",
    acesso: new Date(2026, 9, 19, 10, 0),
    fontes: [{ id: "energia" as const, referencia: "2026-09-30", publicadoEm: "2026-10-01T02:00:00Z", idPublicacao: "a".repeat(64) }],
    doi,
  });

  it("referência ABNT com autor entidade, título, observatório, URL e data de acesso", async () => {
    const c = await import("@/lib/conta/citar");
    expect(c.referenciaAbnt(dados(null))).toBe(
      "SCRUTINIUMS. Preço da energia: PLD & 100% {teste}. In: SCRUTINIUMS. Observatório Brasileiro do Setor Elétrico. [S. l.], [2026]. " +
        "Disponível em: https://scrutiniums.com/setor-eletrico/preco?sub=SE#serie. Acesso em: 19 out. 2026.",
    );
    expect(c.dataAbnt(new Date(2026, 4, 3))).toBe("3 maio 2026");
    expect(c.tituloDaPagina("Preço · Setor Elétrico · Scrutiniums")).toBe("Preço");
    const texto = c.pacoteTexto(dados(null));
    expect(texto).toContain("Setor Elétrico. Dados diários de preço e operação. Referência mais recente (PLD): 30/09/2026. Publicado na plataforma em 30/09/2026.");
    expect(texto).toContain(`Setor Elétrico: sha256 ${"a".repeat(64)}`);
    expect(texto).toContain("O depósito mensal no Zenodo ainda não tem DOI publicado.");
    expect(c.pacoteTexto(dados("10.5281/zenodo.123"))).toContain("DOI do depósito mensal das séries: https://doi.org/10.5281/zenodo.123");
    const ingles = c.pacoteTexto(dados(null), "en");
    expect(ingles).toContain("The monthly deposit on Zenodo does not have a published DOI yet.");
    expect(ingles).toContain("Available at: https://scrutiniums.com/setor-eletrico/preco?sub=SE#serie. Accessed: 19 Oct. 2026.");
    expect(ingles).toContain("Power sector. Daily price and operation data. Latest reference (PLD): Sep 30, 2026.");
    expect(texto).not.toMatch(/—/);
  });

  it("BibTeX com chave estável, caracteres especiais escapados e DOI só quando existe", async () => {
    const c = await import("@/lib/conta/citar");
    const b = c.bibtex(dados(null));
    expect(b.startsWith("@misc{scrutiniums_20261019_preco_da_energia_pld_100_teste,\n")).toBe(true);
    expect(b).toContain("  author = {{Scrutiniums}},");
    expect(b).toContain("  title = {Preço da energia: PLD \\& 100\\% \\{teste\\}},");
    expect(b).toContain("  year = {2026},");
    expect(b).toContain("  url = {https://scrutiniums.com/setor-eletrico/preco?sub=SE#serie},");
    expect(b).toContain("  urldate = {2026-10-19},");
    expect(b).not.toContain("doi =");
    expect(b.trimEnd().endsWith("}")).toBe(true);
    expect(c.bibtex(dados("10.5281/zenodo.123"))).toContain("  doi = {10.5281/zenodo.123}");
    // chaves balanceadas
    const abre = (b.match(/(?<!\\)\{/g) ?? []).length;
    const fecha = (b.match(/(?<!\\)\}/g) ?? []).length;
    expect(abre).toBe(fecha);
  });

  it("RIS de documento eletrônico com data de acesso e fim de registro", async () => {
    const c = await import("@/lib/conta/citar");
    const r = c.ris(dados(null)).split("\r\n");
    expect(r[0]).toBe("TY  - ELEC");
    expect(r).toContain("AU  - Scrutiniums");
    expect(r).toContain("UR  - https://scrutiniums.com/setor-eletrico/preco?sub=SE#serie");
    expect(r).toContain("Y2  - 2026/10/19");
    expect(r.filter((l) => l.startsWith("DO  -"))).toHaveLength(0);
    expect(r.at(-2)).toBe("ER  - ");
  });

  it("a rota devolve a referência e o id da publicação do manifesto e o DOI nulo enquanto não houver", async () => {
    sessao.atual = await usuario();
    expect((await citacaoApi.GET(new Request("http://localhost/api/conta/citacao?dominios=energia,inexistente"))).status).toBe(400);
    const r = await citacaoApi.GET(new Request("http://localhost/api/conta/citacao?dominios=energia,gas"));
    expect(r.status).toBe(200);
    const j = await r.json();
    const man = JSON.parse(ler("public/energia/gold/manifesto.json"));
    expect(j.fontes[0]).toMatchObject({ id: "energia", idPublicacao: man.id_publicacao, referencia: JSON.parse(ler("public/energia/gold/pld.json")).dia_referencia });
    expect(j.fontes[1]).toMatchObject({ id: "gas", idPublicacao: null });
    const doi = JSON.parse(ler("config/institucional.json")).zenodo.doi_conceito;
    expect(j.doi).toBe(doi.trim() ? doi.trim() : null);
  });

  it("as rotas que leem as datas em tempo de requisição levam esses arquivos no pacote da Vercel", async () => {
    const { arquivosLidos } = await import("@/lib/conta/metadados");
    const config = (await import("../../next.config.mjs")).default as { experimental: { outputFileTracingIncludes: Record<string, string[]> } };
    const esperado = arquivosLidos().map((a) => `./${a}`);
    for (const rota of ["/api/conta/citacao", "/api/conta/alertas", "/api/alertas/enviar"]) {
      expect([...config.experimental.outputFileTracingIncludes[rota]].sort(), rota).toEqual(esperado);
    }
  });
});

describe("barra de ferramentas da conta", () => {
  it("sem sessão (ou antes da resposta) nada é desenhado; com sessão, as três ferramentas", async () => {
    const { BarraFerramentasConta } = await import("@/components/conta/FerramentasConta");
    const props = { origem: "energia", observatorio: "Observatório Brasileiro do Setor Elétrico", dominios: ["energia"] as const };
    expect(renderToStaticMarkup(createElement(BarraFerramentasConta, { ...props, logado: false }))).toBe("");
    expect(renderToStaticMarkup(createElement(BarraFerramentasConta, { ...props, logado: null }))).toBe("");
    const h = renderToStaticMarkup(createElement(BarraFerramentasConta, { ...props, logado: true }));
    expect(h).toContain("data-ferramentas-conta");
    for (const rotulo of ["Salvar", " recorte", "Citar", "Avisar", " quando atualizar"]) expect(h).toContain(rotulo);
    expect(h.match(/aria-expanded="false"/g)).toHaveLength(3);
  });

  it("numa rota aberta, sem sessão, o cabeçalho comum sai sem a barra (o HTML do servidor é igual para todos)", async () => {
    const { ehRotaPublica } = await import("@/lib/rotasPublicas");
    expect(ehRotaPublica("/setor-eletrico/conta-de-luz")).toBe(true);
    const { CabecalhoPlataforma } = await import("@/components/layout/CabecalhoPlataforma");
    const h = renderToStaticMarkup(createElement(CabecalhoPlataforma, { colecao: "energia", destinoConta: "/setor-eletrico/conta-de-luz" }));
    expect(h).toContain("data-barra-plataforma");
    expect(h).not.toContain("data-ferramentas-conta");
    expect(h).not.toContain("Salvar recorte");
  });

  it("a origem do cabeçalho define o observatório citado e as fontes oferecidas", async () => {
    const { origemDoCabecalho } = await import("@/lib/conta/origens");
    expect(origemDoCabecalho("energia", null)).toMatchObject({ id: "energia", nome: "Observatório Brasileiro do Setor Elétrico", dominios: ["energia"] });
    expect(origemDoCabecalho("contas", null)?.dominios).toEqual(["contas-federais"]);
    expect(origemDoCabecalho(null, "territorio-e-clima", ["territorio"])?.dominios).toEqual(["territorio"]);
    expect(origemDoCabecalho(null, "familias")?.dominios).toEqual(["credito", "agro", "gas", "eficiencia"]);
    expect(origemDoCabecalho(null, null)).toBeNull();
  });
});
