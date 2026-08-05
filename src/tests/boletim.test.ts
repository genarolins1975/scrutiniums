import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Banco PGlite EM MEMÓRIA exclusivo deste processo de teste (pool "forks").
process.env.DATABASE_URL = "pglite-memory:";

let boletim: typeof import("@/lib/boletim");
let trackEvent: typeof import("@/lib/events").trackEvent;
let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let newId: typeof import("@/lib/db").newId;

beforeAll(async () => {
  boletim = await import("@/lib/boletim");
  ({ trackEvent } = await import("@/lib/events"));
  const dbModule = await import("@/lib/db");
  db = await dbModule.getDb();
  schema = dbModule.schema;
  newId = dbModule.newId;
}, 60_000); // primeiro boot do PGlite em memória (WASM + migração) pode ser lento

const raiz = process.cwd();

async function criarUsuario(
  email: string,
  onboardingStatus: string,
  marketingOptIn: boolean,
): Promise<string> {
  const id = newId();
  const agora = new Date();
  await db.insert(schema.users).values({
    id,
    email,
    onboardingStatus,
    marketingOptIn,
    createdAt: agora,
    updatedAt: agora,
  });
  return id;
}

describe("conteúdo do boletim", () => {
  it("monta assunto e corpo a partir da central de alertas real", () => {
    const b = boletim.montarBoletim(new Date(2026, 7, 5));
    expect(b).not.toBeNull();
    expect(b!.subject).toMatch(/^Boletim Scrutiniums · agosto de 2026 — \d+ alertas ativos/);
    expect(b!.corpo).toContain("ALERTAS ATIVOS:");
    expect(b!.corpo).toContain("https://scrutiniums.com/observatorio/alerts");
    expect(b!.corpo).toContain("https://scrutiniums.com/observatorio/bets-financial-risk");
    expect(b!.corpo).toContain("https://scrutiniums.com/imprensa");
    // o corpo é único e nunca carrega dado pessoal
    expect(b!.corpo).not.toContain("@");
  });

  it("o corpo é honesto sobre o que os alertas são", () => {
    const b = boletim.montarBoletim(new Date(2026, 7, 5))!;
    expect(b.corpo).toContain("nunca recomendação");
    expect(b.corpo).toContain("fonte e data-base");
  });

  it("rodapé por destinatário inclui o link de saída e o motivo do envio", () => {
    const rodape = boletim.rodapeBoletim("https://scrutiniums.com/boletim/sair?token=abc");
    expect(rodape).toContain("aceitou comunicações");
    expect(rodape).toContain("/boletim/sair?token=abc");
  });
});

describe("token de saída assinado", () => {
  it("assina e verifica em ida e volta", () => {
    const token = boletim.assinarSaidaBoletim("user-123");
    expect(boletim.verificarSaidaBoletim(token)).toBe("user-123");
  });

  it("rejeita token adulterado, truncado ou vazio", () => {
    const token = boletim.assinarSaidaBoletim("user-123");
    expect(boletim.verificarSaidaBoletim(token.slice(0, -2) + "zz")).toBeNull();
    expect(boletim.verificarSaidaBoletim("outro-user." + token.split(".").pop())).toBeNull();
    expect(boletim.verificarSaidaBoletim("semponto")).toBeNull();
    expect(boletim.verificarSaidaBoletim("")).toBeNull();
  });

  it("a URL de saída aponta para a página pública com o token", () => {
    const url = boletim.urlSaidaBoletim("user-123");
    expect(url).toMatch(/^https:\/\/scrutiniums\.com\/boletim\/sair\?token=user-123\./);
  });
});

describe("destinatários e guarda de reenvio", () => {
  it("só recebe quem completou o onboarding E consentiu comunicações", async () => {
    const elegivel = await criarUsuario("sim@exemplo.com", "COMPLETE", true);
    await criarUsuario("sem-consentimento@exemplo.com", "COMPLETE", false);
    await criarUsuario("incompleto@exemplo.com", "PROFILE_PENDING", true);

    const destinatarios = await boletim.destinatariosBoletim();
    const ids = destinatarios.map((d) => d.id);
    expect(ids).toContain(elegivel);
    expect(destinatarios.map((d) => d.email)).not.toContain("sem-consentimento@exemplo.com");
    expect(destinatarios.map((d) => d.email)).not.toContain("incompleto@exemplo.com");
  });

  it("um envio por mês-calendário", async () => {
    const agora = new Date();
    expect(await boletim.boletimEnviadoNoMes(agora)).toBe(false);
    await trackEvent("boletim_enviado", newId());
    expect(await boletim.boletimEnviadoNoMes(agora)).toBe(true);
  });
});

describe("superfícies do boletim", () => {
  it("o disparo exige BOLETIM_SECRET (Bearer) ou sessão de admin", () => {
    const rota = readFileSync(join(raiz, "src/app/api/boletim/enviar/route.ts"), "utf-8");
    expect(rota).toContain("BOLETIM_SECRET");
    expect(rota).toContain("timingSafeEqual");
    expect(rota).toContain("isAdmin");
    expect(rota).toContain("boletimEnviadoNoMes");
    expect(rota).toContain("maxDuration");
  });

  it("a saída só muda estado no POST de confirmação, nunca no GET do link", () => {
    const pagina = readFileSync(join(raiz, "src/app/boletim/sair/page.tsx"), "utf-8");
    expect(pagina).toContain("ConfirmarSaidaBoletim");
    expect(pagina).not.toContain("updateUser");
    const rota = readFileSync(join(raiz, "src/app/api/boletim/sair/route.ts"), "utf-8");
    expect(rota).toContain("export async function POST");
    expect(rota).not.toContain("export async function GET");
  });

  it("a preferência é gerenciável na conta", () => {
    const conta = readFileSync(join(raiz, "src/app/app/(foco)/conta/page.tsx"), "utf-8");
    expect(conta).toContain("BoletimPreferencia");
    expect(existsSync(join(raiz, "src/app/api/conta/boletim/route.ts"))).toBe(true);
  });

  it("o workflow mensal existe e usa o segredo, nunca credenciais no clear", () => {
    const wf = readFileSync(join(raiz, ".github/workflows/boletim-mensal.yml"), "utf-8");
    expect(wf).toContain('cron: "0 12 1 * *"');
    expect(wf).toContain("secrets.BOLETIM_SECRET");
    expect(wf).toContain("/api/boletim/enviar");
  });
});
