import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AREAS_SET,
  NIVEIS_SET,
  PERFIS_PROFISSIONAIS,
  PERFIS_USO,
  PERFIS_USO_SET,
  TIPOS_SET,
  corpoPerfil,
  ehPerfilProfissional,
  errosPerfil,
  normalizarPerfil,
} from "@/lib/perfilOpcoes";
import { errosPerfilForm } from "@/components/onboarding/regrasPerfil";
import { destinoDoCadastro } from "@/lib/destinoCadastro";

/**
 * Cadastro com informações básicas obrigatórias (decisão 2 do dono, 19/10/2026,
 * docs/BANCA_2026-10-19.md): senha uma vez, CPF e UF como antes, perfil de uso
 * novo e obrigatório; tipo de instituição, área e cargo só nos perfis
 * profissionais. A mesma regra vale no formulário e no servidor.
 */

process.env.DATABASE_URL = "pglite-memory:";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.session }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, delete: vi.fn() }) }));
vi.mock("@/lib/events", () => ({ trackEvent: vi.fn(async () => undefined) }));

const PROFISSIONAL = { orgType: "banco", orgArea: "dados", orgRole: "analista" };

describe("perfil de uso: lista fechada da decisão do dono", () => {
  it("tem exatamente os oito perfis, na ordem aprovada", () => {
    expect(PERFIS_USO.map((p) => p.label)).toEqual([
      "Cidadão", "Estudante", "Imprensa", "Pesquisa acadêmica", "Setor público", "Mercado financeiro", "Empresa", "Outro",
    ]);
    expect(PERFIS_USO_SET.size).toBe(8);
  });

  it("profissionais são Setor público, Mercado financeiro, Empresa e Pesquisa acadêmica", () => {
    const rotulos = PERFIS_USO.filter((p) => PERFIS_PROFISSIONAIS.has(p.value)).map((p) => p.label).sort();
    expect(rotulos).toEqual(["Empresa", "Mercado financeiro", "Pesquisa acadêmica", "Setor público"]);
    for (const p of PERFIS_PROFISSIONAIS) expect(PERFIS_USO_SET.has(p)).toBe(true);
    expect(ehPerfilProfissional("cidadao")).toBe(false);
    expect(ehPerfilProfissional(undefined)).toBe(false);
    expect(ehPerfilProfissional(42)).toBe(false);
  });

  it("nenhum valor já gravado sai das listas (o banco tem usuários)", () => {
    // Valores publicados até 18/10/2026; rótulos podem mudar, valores não.
    const tipos = ["banco", "cooperativa", "fintech_ip", "gestora", "seguradora", "consultoria", "regulador", "academia", "imprensa", "varejo_industria", "autonomo", "outra"];
    const areas = ["risco_credito", "tesouraria", "regulatorio", "produtos", "dados", "pesquisa", "auditoria", "tecnologia", "gestao", "ensino", "outra"];
    const niveis = ["analista", "especialista", "coordenador", "gerente", "superintendente", "diretor", "socio", "conselheiro", "professor", "estudante", "outro"];
    for (const v of tipos) expect(TIPOS_SET.has(v), v).toBe(true);
    for (const v of areas) expect(AREAS_SET.has(v), v).toBe(true);
    for (const v of niveis) expect(NIVEIS_SET.has(v), v).toBe(true);
  });
});

describe("regra única do perfil (cliente e servidor)", () => {
  it.each(PERFIS_USO.map((p) => p.value))("perfil %s: UF obrigatória e campos profissionais só quando pede", (perfilUso) => {
    const profissional = PERFIS_PROFISSIONAIS.has(perfilUso);
    const semCampos = errosPerfil({ perfilUso, uf: "SP" });
    expect(Object.keys(semCampos).sort()).toEqual(profissional ? ["orgArea", "orgRole", "orgType"] : []);
    expect(errosPerfil({ perfilUso, uf: "SP", ...PROFISSIONAL })).toEqual({});
    expect(errosPerfil({ perfilUso, ...PROFISSIONAL })).toHaveProperty("uf");
  });

  it("perfil de uso ausente, vazio ou fora da lista é recusado", () => {
    for (const perfilUso of [undefined, null, "", "hacker", 3]) {
      expect(errosPerfil({ perfilUso, uf: "SP", ...PROFISSIONAL })).toHaveProperty("perfilUso");
      expect(normalizarPerfil({ perfilUso, uf: "SP", ...PROFISSIONAL })).toBeNull();
    }
  });

  it("campos profissionais fora da lista são recusados nos perfis profissionais", () => {
    expect(errosPerfil({ perfilUso: "empresa", uf: "SP", ...PROFISSIONAL, orgType: "inventado" })).toHaveProperty("orgType");
  });

  it("fora dos perfis profissionais, instituição, área e cargo não são gravados", () => {
    expect(normalizarPerfil({ perfilUso: "cidadao", uf: "RJ", ...PROFISSIONAL })).toEqual({
      perfilUso: "cidadao", orgType: null, orgArea: null, orgRole: null, uf: "RJ",
    });
    expect(normalizarPerfil({ perfilUso: "setor_publico", uf: "DF", ...PROFISSIONAL })).toEqual({
      perfilUso: "setor_publico", ...PROFISSIONAL, uf: "DF",
    });
  });

  it("o formulário só envia os campos profissionais quando o perfil os pede", () => {
    const estado = { orgType: "banco", orgArea: "dados", orgRole: "analista", uf: "SP" };
    expect(corpoPerfil({ perfilUso: "estudante", ...estado })).toEqual({ perfilUso: "estudante", uf: "SP" });
    expect(corpoPerfil({ perfilUso: "empresa", ...estado })).toEqual({ perfilUso: "empresa", ...estado });
  });

  it("formulário: senha digitada uma vez (8 a 72), CPF quando exigido e a regra do perfil", () => {
    const base = { password: "senha-boa-123", cpf: "529.982.247-25", exigeCpf: true, perfilUso: "cidadao", orgType: "", orgArea: "", orgRole: "", uf: "SP" };
    expect(Object.values(errosPerfilForm(base)).filter(Boolean)).toEqual([]);
    expect(errosPerfilForm({ ...base, password: "curta" }).password).toMatch(/8 e 72/);
    expect(errosPerfilForm({ ...base, password: "x".repeat(73) }).password).toMatch(/8 e 72/);
    expect(errosPerfilForm({ ...base, cpf: "529.982.247-26" }).cpf).toMatch(/CPF inválido/);
    expect(errosPerfilForm({ ...base, cpf: "", exigeCpf: false }).cpf).toBeUndefined();
    expect(errosPerfilForm({ ...base, perfilUso: "" }).perfilUso).toBeTruthy();
    expect(errosPerfilForm({ ...base, perfilUso: "mercado_financeiro" })).toMatchObject({
      orgType: expect.any(String), orgArea: expect.any(String), orgRole: expect.any(String),
    });
  });
});

describe("formulário renderizado da etapa 3", () => {
  it("pede a senha uma vez, com botão Mostrar acessível, e não mostra campos profissionais antes da escolha", async () => {
    const { PerfilForm } = await import("@/components/onboarding/PerfilForm");
    const html = renderToStaticMarkup(createElement(PerfilForm, { exigeCpf: true }));
    expect(html.match(/type="password"/g)).toHaveLength(1);
    expect(html).not.toMatch(/Confirmar senha|confirm-password/);
    expect(html).toMatch(/<button type="button" aria-controls="[^"]+" aria-label="Mostrar senha"[^>]*>Mostrar<\/button>/);
    expect(html).toContain("Usado apenas para garantir uma conta por pessoa. Nunca é exibido nem compartilhado.");
    expect(html.match(/type="radio"/g)).toHaveLength(8);
    for (const p of PERFIS_USO) expect(html).toContain(`>${p.label}</span>`);
    expect(html).toContain("Como você vai usar a Scrutiniums?");
    expect(html).toContain('name="uf"');
    for (const campo of ["org-type", "org-area", "org-role"]) expect(html).not.toContain(`name="${campo}"`);
  });
});

describe("nome do painel de destino (cookie scrutiniums_destino)", () => {
  it("nomeia o painel pedido pelo registro dos observatórios", () => {
    expect(destinoDoCadastro("/setor-eletrico/conta-de-luz")).toEqual({ tipo: "painel", nome: "Conta de luz", colecao: "Setor Elétrico" });
    expect(destinoDoCadastro("/setor-eletrico")).toEqual({ tipo: "painel", nome: "Setor Elétrico", colecao: null });
    expect(destinoDoCadastro("/saneamento/municipio/3550308?x=1")).toMatchObject({ tipo: "painel", nome: "Meu município" });
    expect(destinoDoCadastro("/observatorios/familias")).toEqual({ tipo: "observatorio", nome: "Observatório das Famílias" });
  });

  it("sem destino vai para a escolha; destino sem nome registrado não ganha nome inventado", () => {
    expect(destinoDoCadastro(undefined)).toEqual({ tipo: "escolha" });
    expect(destinoDoCadastro("/app/observatorios")).toEqual({ tipo: "escolha" });
    expect(destinoDoCadastro("//malicioso.example/x")).toEqual({ tipo: "escolha" });
    expect(destinoDoCadastro("/app/conta")).toEqual({ tipo: "pagina" });
  });
});

// ------------------------------------------------- servidor com PGlite real

let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let profile: typeof import("@/app/api/onboarding/profile/route").POST;
let conta: typeof import("@/app/api/conta/perfil/route").POST;
let serial = 0;

beforeAll(async () => {
  const modulo = await import("@/lib/db");
  db = await modulo.getDb();
  schema = modulo.schema;
  ({ POST: profile } = await import("@/app/api/onboarding/profile/route"));
  ({ POST: conta } = await import("@/app/api/conta/perfil/route"));
});
beforeEach(async () => {
  mocks.session.mockReset();
  await db.delete(schema.users);
});

const req = (body: unknown) =>
  new Request("http://localhost/api/teste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function usuario(valores: Partial<typeof schema.users.$inferInsert> = {}) {
  const id = `perfil-uso-${++serial}`;
  const [user] = await db.insert(schema.users).values({
    id, email: `${id}@example.invalid`, phoneE164: `+55119876${String(serial).padStart(5, "0")}`, phoneVerifiedAt: new Date(),
    onboardingStatus: "PROFILE_PENDING", createdAt: new Date(), updatedAt: new Date(), ...valores,
  }).returning();
  mocks.session.mockResolvedValue(user);
  return user;
}
const ler = async (id: string) => (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];
const cpfs = ["52998224725", "11144477735", "93541134780"];
const senha = "senha-de-teste-123";

describe("API do cadastro aplica a mesma regra", () => {
  it("conclui Cidadão sem instituição, área e cargo, gravando null", async () => {
    const user = await usuario();
    const r = await profile(req({ password: senha, cpf: cpfs[0], perfilUso: "cidadao", uf: "PE" }));
    expect(r.status).toBe(200);
    expect(await ler(user.id)).toMatchObject({
      onboardingStatus: "COMPLETE", perfilUso: "cidadao", uf: "PE", orgType: null, orgArea: null, orgRole: null, cpf: cpfs[0],
    });
  });

  it("descarta campos profissionais enviados por um perfil não profissional", async () => {
    const user = await usuario();
    expect((await profile(req({ password: senha, cpf: cpfs[0], perfilUso: "imprensa", uf: "SP", ...PROFISSIONAL }))).status).toBe(200);
    expect(await ler(user.id)).toMatchObject({ perfilUso: "imprensa", orgType: null, orgArea: null, orgRole: null });
  });

  it("exige instituição, área e cargo do perfil profissional e grava os três", async () => {
    const user = await usuario();
    const recusa = await profile(req({ password: senha, cpf: cpfs[0], perfilUso: "setor_publico", uf: "DF" }));
    expect(recusa.status).toBe(400);
    expect((await recusa.json()).error).toBe("Selecione o tipo de instituição.");
    expect((await ler(user.id)).onboardingStatus).toBe("PROFILE_PENDING");
    expect((await profile(req({ password: senha, cpf: cpfs[0], perfilUso: "setor_publico", uf: "DF", ...PROFISSIONAL }))).status).toBe(200);
    expect(await ler(user.id)).toMatchObject({ perfilUso: "setor_publico", ...PROFISSIONAL, uf: "DF", onboardingStatus: "COMPLETE" });
  });

  it.each([
    ["sem perfil de uso", { uf: "SP" }],
    ["perfil de uso fora da lista", { perfilUso: "robô", uf: "SP" }],
    ["sem UF", { perfilUso: "estudante" }],
    ["UF fora da lista", { perfilUso: "estudante", uf: "XX" }],
  ])("recusa %s sem concluir o cadastro", async (_nome, perfil) => {
    const user = await usuario();
    const r = await profile(req({ password: senha, cpf: cpfs[0], ...perfil }));
    expect(r.status).toBe(400);
    expect(await ler(user.id)).toMatchObject({ onboardingStatus: "PROFILE_PENDING", perfilUso: null, passwordHash: null });
  });

  it("a senha continua exigida no servidor (uma vez, 8 a 72)", async () => {
    const user = await usuario();
    expect((await profile(req({ password: "curta", cpf: cpfs[0], perfilUso: "cidadao", uf: "SP" }))).status).toBe(400);
    expect((await ler(user.id)).onboardingStatus).toBe("PROFILE_PENDING");
  });
});

describe("API da conta aplica a mesma regra", () => {
  it("quem deixa de ser perfil profissional perde instituição, área e cargo", async () => {
    const user = await usuario({ onboardingStatus: "COMPLETE", perfilUso: "empresa", ...PROFISSIONAL, uf: "SP" });
    expect((await conta(req({ perfilUso: "cidadao", uf: "MG" }))).status).toBe(200);
    expect(await ler(user.id)).toMatchObject({ perfilUso: "cidadao", uf: "MG", orgType: null, orgArea: null, orgRole: null });
  });

  it("conta anterior ao perfil de uso continua válida e escolhe um ao salvar", async () => {
    const legado = await usuario({ onboardingStatus: "COMPLETE", ...PROFISSIONAL, uf: "SP", cpf: cpfs[1] });
    expect(legado.perfilUso).toBeNull();
    const recusa = await conta(req({ ...PROFISSIONAL, uf: "SP" }));
    expect(recusa.status).toBe(400);
    expect((await recusa.json()).error).toBe("Escolha como você vai usar a plataforma.");
    expect(await ler(legado.id)).toEqual(legado);
    expect((await conta(req({ perfilUso: "mercado_financeiro", ...PROFISSIONAL, uf: "SP" }))).status).toBe(200);
    expect(await ler(legado.id)).toMatchObject({ perfilUso: "mercado_financeiro", ...PROFISSIONAL, cpf: cpfs[1] });
  });
});

describe("migração do perfil de uso em PGlite", () => {
  let dir: string;
  afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  it("acrescenta a coluna anulável a um banco anterior sem tocar nas contas existentes, e repete sem erro", { timeout: 120_000 }, async () => {
    dir = await mkdtemp(join(tmpdir(), "scrutiniums-perfil-uso-"));
    const { PGlite } = await import("@electric-sql/pglite");
    // Banco como estava em produção antes desta versão: users sem perfil_uso, com uma conta completa.
    const antigo = new PGlite(dir);
    await antigo.exec(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, email_verified_at TIMESTAMPTZ, phone_e164 TEXT UNIQUE,
      phone_verified_at TIMESTAMPTZ, company TEXT, job_title TEXT, password_hash TEXT, cpf TEXT, org_type TEXT,
      org_area TEXT, org_role TEXT, uf TEXT, onboarding_status TEXT NOT NULL DEFAULT 'EMAIL_PENDING',
      terms_accepted_at TIMESTAMPTZ, privacy_version TEXT, marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`);
    await antigo.exec(`INSERT INTO users (id, email, org_type, org_area, org_role, uf, onboarding_status, created_at, updated_at)
      VALUES ('legado', 'legado@example.invalid', 'banco', 'dados', 'analista', 'SP', 'COMPLETE', now(), now())`);
    await antigo.close();

    const global = globalThis as { __scrutiniumsDb?: unknown };
    const anterior = global.__scrutiniumsDb;
    const urlAnterior = process.env.DATABASE_URL;
    try {
      for (let rodada = 0; rodada < 2; rodada++) {
        global.__scrutiniumsDb = undefined;
        process.env.DATABASE_URL = `pglite://${dir}`;
        vi.resetModules();
        const modulo = await import("@/lib/db");
        const banco = await modulo.getDb();
        const [legado] = await banco.select().from(modulo.schema.users).where(eq(modulo.schema.users.id, "legado"));
        expect(legado).toMatchObject({ perfilUso: null, orgType: "banco", orgArea: "dados", orgRole: "analista", uf: "SP", onboardingStatus: "COMPLETE" });
        const cliente = (banco as unknown as { $client: { query(q: string): Promise<{ rows: { is_nullable: string; column_default: string | null }[] }>; close(): Promise<void> } }).$client;
        const { rows } = await cliente.query(`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'perfil_uso'`);
        expect(rows).toEqual([{ is_nullable: "YES", column_default: null }]);
        await cliente.close();
      }
    } finally {
      global.__scrutiniumsDb = anterior;
      process.env.DATABASE_URL = urlAnterior;
    }
  });
});
