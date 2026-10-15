import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { getURLFromRedirectError, isRedirectError } from "next/dist/client/components/redirect";
import { PerfilForm } from "@/components/conta/PerfilForm";
import type { OnboardingStatus, User } from "@/lib/schema";

const jarra = vi.hoisted(() => new Map<string, string>());
// Somente transporte: emissão, assinatura, consulta da sessão e banco são reais.
// Página/layout/handler são chamados diretamente; isto não simula navegação HTTP.
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (nome: string) => jarra.has(nome) ? { name: nome, value: jarra.get(nome)! } : undefined,
    set: (nome: string, valor: string) => { jarra.set(nome, valor); },
    delete: (nome: string) => { jarra.delete(nome); },
  }),
}));

const COOKIE = "scrutiniums_session";
const CONFIRMADO = new Date("2026-01-01T12:00:00Z");
const INICIAL = Object.freeze({ orgType: "outra", orgArea: "outra", orgRole: "outro", uf: "SP" });
const ALTERADO = Object.freeze({ orgType: "academia", orgArea: "pesquisa", orgRole: "professor", uf: "EX" });
type EstadoUsuario = Partial<Pick<User, "phoneE164" | "phoneVerifiedAt" | "cpf">> & { onboardingStatus?: OnboardingStatus };

let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let sessao: typeof import("@/lib/session");
let verificarCookie: typeof import("@/lib/sessionCookie").verifySessionCookie;
let hashToken: typeof import("@/lib/crypto").hashToken;
let ContaPage: typeof import("@/app/app/(foco)/conta/page").default;
let AppLayout: typeof import("@/app/app/layout").default;
let POST: typeof import("@/app/api/conta/perfil/route").POST;
let serial = 0;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "pglite-memory:");
  vi.stubEnv("COOKIE_SECRET", "segredo-sintetico-do-teste-conta-cpf");
  vi.stubEnv("SMS_PAISES_PERMITIDOS", "BR,PT");
  const modulo = await import("@/lib/db");
  schema = modulo.schema;
  db = await modulo.getDb();
  sessao = await import("@/lib/session");
  ({ verifySessionCookie: verificarCookie } = await import("@/lib/sessionCookie"));
  ({ hashToken } = await import("@/lib/crypto"));
  ({ default: ContaPage } = await import("@/app/app/(foco)/conta/page"));
  ({ default: AppLayout } = await import("@/app/app/layout"));
  ({ POST } = await import("@/app/api/conta/perfil/route"));
});

async function limpar() {
  jarra.clear();
  await db.delete(schema.sessions);
  await db.delete(schema.users);
}
beforeEach(limpar);
afterAll(async () => {
  try { if (db) await limpar(); }
  finally { vi.unstubAllEnvs(); }
});

async function usuario(estado: EstadoUsuario = {}): Promise<User> {
  const id = `conta-cpf-${++serial}`;
  const [user] = await db.insert(schema.users).values({
    id, email: `${id}@example.invalid`, ...INICIAL,
    phoneE164: "+351912345678", phoneVerifiedAt: CONFIRMADO,
    onboardingStatus: "COMPLETE", createdAt: CONFIRMADO, updatedAt: CONFIRMADO,
    ...estado,
  }).returning();
  return user;
}

async function ler(id: string): Promise<User> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!user) throw new Error("Usuário sintético não encontrado");
  return user;
}

function cookieEmitido(): string {
  const valor = jarra.get(COOKIE);
  if (!valor) throw new Error("createSession não emitiu o cookie esperado");
  return valor;
}

function salvar(corpo: unknown) {
  return POST(new Request("http://localhost/api/conta/perfil", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  }));
}

/** Inspeciona a composição real; não executa nem substitui componentes cliente. */
function elementos(no: ReactNode): ReactElement<Record<string, unknown>>[] {
  const encontrados: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(no, (filho) => {
    if (!isValidElement<Record<string, unknown>>(filho)) return;
    encontrados.push(filho, ...elementos(filho.props.children as ReactNode));
  });
  return encontrados;
}

async function propsPerfil() {
  const formularios = elementos(await ContaPage()).filter((no) => no.type === PerfilForm);
  expect(formularios).toHaveLength(1);
  return formularios[0].props;
}

async function redireciona(acao: () => Promise<unknown>, destino: string) {
  let erro: unknown;
  try { await acao(); } catch (e) { erro = e; }
  if (!isRedirectError(erro)) throw new Error(`Esperado redirect real para ${destino}`, { cause: erro });
  expect(getURLFromRedirectError(erro)).toBe(destino);
}

describe("Conta: autoridade da sessão assinada e do PGlite reais", () => {
  it("emite a sessão, consulta o hash persistido e permite o layout de COMPLETE", async () => {
    const user = await usuario();
    await sessao.createSession(user.id);
    const cookie = await verificarCookie(cookieEmitido());
    expect(cookie).not.toBeNull();
    if (!cookie) throw new Error("Cookie emitido não passou pela verificação real");
    const registros = await db.select().from(schema.sessions);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ userId: user.id, tokenHash: hashToken(cookie.token), revokedAt: null });
    expect(registros[0].tokenHash).not.toBe(cookie.token);
    expect(await sessao.getSessionUser()).toEqual(user);
    const child = createElement("span", null, "Área autenticada sintética");
    expect((await AppLayout({ children: child })).props.children).toBe(child);
  });

  it.each(["sem cookie", "linha ausente", "revogada", "expirada no banco"] as const)("recusa sessão %s na página, layout e API", async (estado) => {
    const user = await usuario();
    await sessao.createSession(user.id);
    const emitido = cookieEmitido();
    if (estado === "sem cookie") jarra.clear();
    else if (estado === "linha ausente") await db.delete(schema.sessions);
    else await db.update(schema.sessions).set(estado === "revogada"
      ? { revokedAt: new Date() } : { expiresAt: new Date(Date.now() - 60_000) });

    // O cookie originalmente emitido continua válido; a linha também é autoridade.
    expect(await verificarCookie(emitido)).not.toBeNull();
    expect(await sessao.getSessionUser()).toBeNull();
    await redireciona(ContaPage, "/entrar");
    await redireciona(() => AppLayout({ children: "não autorizado" }), "/entrar");
    const resposta = await salvar(ALTERADO);
    expect(resposta.status).toBe(401);
    expect(await ler(user.id)).toEqual(user);
  });

  it("mantém no layout a guarda da etapa pendente, mesmo com sessão válida", async () => {
    const user = await usuario({ onboardingStatus: "PROFILE_PENDING" });
    await sessao.createSession(user.id);
    expect((await sessao.getSessionUser())?.id).toBe(user.id);
    await redireciona(() => AppLayout({ children: "não concluído" }), "/cadastro/perfil");
    expect(await ler(user.id)).toEqual(user);
  });
});

describe("Conta: prop de CPF vem do telefone persistido e confirmado", () => {
  const casos: readonly { nome: string; estado: EstadoUsuario; obrigatorio: boolean; temCpf: boolean }[] = [
    { nome: "estrangeiro confirmado", estado: {}, obrigatorio: false, temCpf: false },
    { nome: "brasileiro confirmado sem CPF legado", estado: { phoneE164: "+5511987654321" }, obrigatorio: true, temCpf: false },
    { nome: "estrangeiro não confirmado", estado: { phoneVerifiedAt: null }, obrigatorio: true, temCpf: false },
    { nome: "telefone ausente", estado: { phoneE164: null, phoneVerifiedAt: null }, obrigatorio: true, temCpf: false },
    { nome: "telefone não canônico", estado: { phoneE164: "+351 912345678" }, obrigatorio: true, temCpf: false },
    { nome: "telefone inválido", estado: { phoneE164: "+999" }, obrigatorio: true, temCpf: false },
    { nome: "estrangeiro com CPF existente", estado: { cpf: "52998224725" }, obrigatorio: false, temCpf: true },
    { nome: "brasileiro com CPF existente", estado: { phoneE164: "+5511987654321", cpf: "52998224725" }, obrigatorio: true, temCpf: true },
  ];

  it.each(casos)("deriva a prop real para $nome", async ({ estado, obrigatorio, temCpf }) => {
    const user = await usuario(estado);
    await sessao.createSession(user.id);
    expect(await propsPerfil()).toEqual({
      orgTypeInicial: "outra", orgAreaInicial: "outra", orgRoleInicial: "outro", ufInicial: "SP",
      cpfObrigatorio: obrigatorio, temCpf,
    });
  });

  it("relê telefone e confirmação no banco sem emitir outro cookie ou usar o primeiro snapshot", async () => {
    const user = await usuario();
    await sessao.createSession(user.id);
    const emitido = cookieEmitido();
    expect((await propsPerfil()).cpfObrigatorio).toBe(false);
    await db.update(schema.users).set({ phoneE164: "+5511987654321" }).where(eq(schema.users.id, user.id));
    expect((await propsPerfil()).cpfObrigatorio).toBe(true);
    await db.update(schema.users).set({ phoneE164: "+351912345678", phoneVerifiedAt: null }).where(eq(schema.users.id, user.id));
    expect((await propsPerfil()).cpfObrigatorio).toBe(true);
    await db.update(schema.users).set({ phoneVerifiedAt: CONFIRMADO }).where(eq(schema.users.id, user.id));
    expect((await propsPerfil()).cpfObrigatorio).toBe(false);
    expect(cookieEmitido()).toBe(emitido);
    expect(await db.select().from(schema.sessions)).toHaveLength(1);
  });
});

describe("Conta: persistência do perfil pela API real", () => {
  it("salva estrangeiro sem CPF e altera apenas a conta da sessão", async () => {
    const user = await usuario();
    const outro = await usuario({ phoneE164: "+12025550123" });
    await sessao.createSession(user.id);
    const resposta = await salvar(ALTERADO);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
    expect(await ler(user.id)).toEqual({ ...user, ...ALTERADO, cpf: null, updatedAt: expect.any(Date) });
    expect(await ler(outro.id)).toEqual(outro);
  });

  it("permite incluir CPF opcional válido, normaliza e preserva o valor ao salvar novamente", async () => {
    const user = await usuario();
    await sessao.createSession(user.id);
    expect((await salvar({ ...ALTERADO, cpf: "529.982.247-25" })).status).toBe(200);
    expect(await ler(user.id)).toEqual({ ...user, ...ALTERADO, cpf: "52998224725", updatedAt: expect.any(Date) });
    expect(await propsPerfil()).toMatchObject({ temCpf: true, cpfObrigatorio: false });
    expect((await salvar(INICIAL)).status).toBe(200);
    expect(await ler(user.id)).toEqual({ ...user, cpf: "52998224725", updatedAt: expect.any(Date) });
  });

  it("recusa CPF opcional inválido sem gravar o perfil", async () => {
    const user = await usuario();
    await sessao.createSession(user.id);
    expect((await salvar({ ...ALTERADO, cpf: "529.982.247-26" })).status).toBe(400);
    expect(await ler(user.id)).toEqual(user);
  });

  it.each(["+351912345678", "+5511987654321"])("preserva CPF registrado com telefone %s e recusa substituição", async (phoneE164) => {
    const user = await usuario({ phoneE164, cpf: "52998224725" });
    await sessao.createSession(user.id);
    expect((await salvar({ ...ALTERADO, cpf: "111.444.777-35" })).status).toBe(400);
    expect(await ler(user.id)).toEqual(user);
    expect((await salvar(ALTERADO)).status).toBe(200);
    expect(await ler(user.id)).toEqual({ ...user, ...ALTERADO, cpf: "52998224725", updatedAt: expect.any(Date) });
  });

  it("recusa CPF já vinculado a outra conta sem alterar nenhuma delas", async () => {
    const user = await usuario();
    const titular = await usuario({ phoneE164: "+5511987654321", cpf: "52998224725" });
    await sessao.createSession(user.id);
    expect((await salvar({ ...ALTERADO, cpf: "529.982.247-25" })).status).toBe(409);
    expect(await ler(user.id)).toEqual(user);
    expect(await ler(titular.id)).toEqual(titular);
  });

  it("preserva a omissão direta já permitida na API para brasileiro legado, sem dispensá-lo na UI", async () => {
    const user = await usuario({ phoneE164: "+5511987654321" });
    await sessao.createSession(user.id);
    expect((await propsPerfil()).cpfObrigatorio).toBe(true);
    expect((await salvar(ALTERADO)).status).toBe(200);
    expect(await ler(user.id)).toEqual({ ...user, ...ALTERADO, cpf: null, updatedAt: expect.any(Date) });
    expect(await propsPerfil()).toMatchObject({ temCpf: false, cpfObrigatorio: true });
  });
});
