import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EntrarPage from "@/app/entrar/page";
import EntrarEnPage from "@/app/en/entrar/page";
import CadastroPage from "@/app/cadastro/page";
import CadastroEnPage from "@/app/en/cadastro/page";
import CadastroLayout from "@/app/cadastro/layout";
import CadastroEnLayout from "@/app/en/cadastro/layout";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { EntrarSenhaForm } from "@/components/onboarding/EntrarSenhaForm";
import { CadastroEmailForm } from "@/components/onboarding/CadastroEmailForm";
import { ONBOARDING_EMAIL_COOKIE } from "@/components/onboarding/signedEmailCookie";
import type { OnboardingStatus, User } from "@/lib/schema";

const dependencias = vi.hoisted(() => ({
  sessao: vi.fn<() => Promise<User | null>>(),
  emailPendente: vi.fn<(nome: string) => string | null>(),
  redirect: vi.fn<(url: string) => never>(),
}));
vi.mock("@/lib/session", () => ({ getSessionUser: dependencias.sessao }));
vi.mock("@/components/onboarding/signedEmailCookie", () => ({
  ONBOARDING_EMAIL_COOKIE: "onboarding_email",
  readSignedEmailCookie: dependencias.emailPendente,
}));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  redirect: dependencias.redirect,
}));

const REDIRECT = new Error("Interrupção sintética do redirect do Next");
const ETAPAS = [
  ["EMAIL_PENDING", "/cadastro"],
  ["PHONE_PENDING", "/cadastro/telefone"],
  ["PROFILE_PENDING", "/cadastro/perfil"],
  ["ACCESS_PENDING", "/cadastro/acesso"],
  ["WAITLIST", "/cadastro/acesso"],
] as const;
const DESTINOS = [
  [undefined, undefined],
  ["/setor-eletrico/pld?mes=2026-08&filtro=a%2Bb#serie", "/setor-eletrico/pld?mes=2026-08&filtro=a%2Bb#serie"],
  ["/en/app/conta?aba=perfil&aba=contato#telefone", "/en/app/conta?aba=perfil&aba=contato#telefone"],
  ["https://externo.invalid/", undefined],
  ["//externo.invalid/", undefined],
  ["/api/auth/eu", undefined],
  ["/\t/externo.invalid", undefined],
  ["/\\externo.invalid", undefined],
] as const;

function usuario(onboardingStatus: OnboardingStatus): User {
  return {
    id: "usuario-sintetico-auth-i18n", email: "auth@example.invalid", onboardingStatus,
    emailVerifiedAt: null, phoneE164: null, phoneVerifiedAt: null,
    company: null, jobTitle: null, cpf: null, orgType: null, orgArea: null, orgRole: null,
    uf: null, passwordHash: null, termsAcceptedAt: null, privacyVersion: null, marketingOptIn: false,
    createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z"),
  };
}

/** Inspeção de JSX: não executa componentes cliente nem simula o React. */
function elementos(children: ReactNode): ReactElement<Record<string, unknown>>[] {
  const encontrados: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(children, (filho) => {
    if (!isValidElement<Record<string, unknown>>(filho)) return;
    encontrados.push(filho, ...elementos(filho.props.children as ReactNode));
  });
  return encontrados;
}

async function entrar(idioma: "pt" | "en", searchParams?: { de?: string }) {
  if (idioma === "pt") return EntrarPage({ searchParams });
  const moldura = EntrarEnPage({ searchParams });
  expect(moldura.type).toBe(PortuguesApenas);
  const filha = moldura.props.children as ReactElement<{ searchParams?: { de?: string } }>;
  expect(filha.type).toBe(EntrarPage);
  expect(filha.props.searchParams).toBe(searchParams);
  // Executa somente a filha conhecida, cuja identidade e props foram provadas.
  // Isto testa a decisão do servidor, não uma sessão HTTP autenticada.
  return EntrarPage(filha.props);
}

async function cadastrar(idioma: "pt" | "en") {
  if (idioma === "pt") return CadastroPage();
  const filha = CadastroEnPage();
  expect(filha.type).toBe(CadastroPage);
  expect(filha.props).toEqual({});
  return CadastroPage();
}

beforeEach(() => {
  dependencias.sessao.mockReset().mockResolvedValue(null);
  dependencias.emailPendente.mockReset().mockReturnValue(null);
  dependencias.redirect.mockReset().mockImplementation(() => { throw REDIRECT; });
});

describe.each(["pt", "en"] as const)("entrada %s: fluxo real da página", (idioma) => {
  it.each(DESTINOS)("anônimo recebe somente o destino seguro, sem converter o idioma: %s", async (de, esperado) => {
    const arvore = elementos(await entrar(idioma, { de }));
    const formularios = arvore.filter((e) => e.type === EntrarSenhaForm);
    expect(formularios).toHaveLength(1);
    expect(formularios[0].props).toEqual({ de: esperado });
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.redirect).not.toHaveBeenCalled();
    expect(dependencias.emailPendente).not.toHaveBeenCalled();
  });

  it.each(DESTINOS)("COMPLETE respeita o destino seguro ou mantém a escolha de observatório: %s", async (de, esperado) => {
    dependencias.sessao.mockResolvedValue(usuario("COMPLETE"));
    await expect(entrar(idioma, { de })).rejects.toBe(REDIRECT);
    expect(dependencias.redirect).toHaveBeenCalledExactlyOnceWith(esperado ?? "/app/observatorios");
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.emailPendente).not.toHaveBeenCalled();
  });

  it.each(ETAPAS)("%s mantém a etapa obrigatória %s antes do destino solicitado", async (estado, destino) => {
    dependencias.sessao.mockResolvedValue(usuario(estado));
    await expect(entrar(idioma, { de: "/en/app/conta?aba=perfil#telefone" })).rejects.toBe(REDIRECT);
    expect(dependencias.redirect).toHaveBeenCalledExactlyOnceWith(destino);
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.emailPendente).not.toHaveBeenCalled();
  });

  it("propaga a falha de sessão sem exibir formulário anônimo", async () => {
    const falha = new Error("Falha sintética de sessão");
    dependencias.sessao.mockRejectedValue(falha);
    await expect(entrar(idioma)).rejects.toBe(falha);
    expect(dependencias.redirect).not.toHaveBeenCalled();
    expect(dependencias.emailPendente).not.toHaveBeenCalled();
  });
});

describe.each(["pt", "en"] as const)("cadastro %s: retomada real da página", (idioma) => {
  it("exibe o formulário de contato anônimo somente depois da consulta de sessão", async () => {
    const arvore = elementos(await cadastrar(idioma));
    expect(arvore.filter((e) => e.type === CadastroEmailForm)).toHaveLength(1);
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.emailPendente).toHaveBeenCalledExactlyOnceWith(ONBOARDING_EMAIL_COOKIE);
    expect(dependencias.sessao.mock.invocationCallOrder[0]).toBeLessThan(dependencias.emailPendente.mock.invocationCallOrder[0]);
    expect(dependencias.redirect).not.toHaveBeenCalled();
  });

  it("retoma o telefone com e-mail pendente válido e sem sessão", async () => {
    dependencias.emailPendente.mockReturnValue("contato@example.invalid");
    await expect(cadastrar(idioma)).rejects.toBe(REDIRECT);
    expect(dependencias.redirect).toHaveBeenCalledExactlyOnceWith("/cadastro/telefone");
    expect(dependencias.emailPendente).toHaveBeenCalledExactlyOnceWith(ONBOARDING_EMAIL_COOKIE);
    expect(dependencias.sessao.mock.invocationCallOrder[0]).toBeLessThan(dependencias.emailPendente.mock.invocationCallOrder[0]);
  });

  it("EMAIL_PENDING exibe o contato e não lê cookie de retomada", async () => {
    dependencias.sessao.mockResolvedValue(usuario("EMAIL_PENDING"));
    dependencias.emailPendente.mockImplementation(() => { throw new Error("Não deve ler cookie com sessão"); });
    const arvore = elementos(await cadastrar(idioma));
    expect(arvore.filter((e) => e.type === CadastroEmailForm)).toHaveLength(1);
    expect(dependencias.emailPendente).not.toHaveBeenCalled();
    expect(dependencias.redirect).not.toHaveBeenCalled();
  });

  it.each([...ETAPAS.slice(1), ["COMPLETE", "/app/observatorios"] as const])("%s interrompe no destino %s, sem consultar cookie", async (estado, destino) => {
    dependencias.sessao.mockResolvedValue(usuario(estado));
    await expect(cadastrar(idioma)).rejects.toBe(REDIRECT);
    expect(dependencias.redirect).toHaveBeenCalledExactlyOnceWith(destino);
    expect(dependencias.emailPendente).not.toHaveBeenCalled();
  });

  it("aguarda a sessão antes de ler o cookie ou decidir o destino", async () => {
    let resolver!: (user: User | null) => void;
    dependencias.sessao.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const pendente = cadastrar(idioma);
    expect(dependencias.sessao).toHaveBeenCalledOnce();
    expect(dependencias.emailPendente).not.toHaveBeenCalled();
    expect(dependencias.redirect).not.toHaveBeenCalled();
    resolver(null);
    await pendente;
    expect(dependencias.emailPendente).toHaveBeenCalledExactlyOnceWith(ONBOARDING_EMAIL_COOKIE);
  });

  it.each(["sessao", "emailPendente"] as const)("propaga falha de %s sem criar retorno alternativo", async (origem) => {
    const falha = new Error("Falha sintética da dependência");
    if (origem === "sessao") dependencias.sessao.mockRejectedValue(falha);
    else dependencias.emailPendente.mockImplementation(() => { throw falha; });
    await expect(cadastrar(idioma)).rejects.toBe(falha);
    expect(dependencias.redirect).not.toHaveBeenCalled();
    if (origem === "sessao") expect(dependencias.emailPendente).not.toHaveBeenCalled();
  });
});

it("a moldura EN do cadastro envolve o shell completo e conserva a identidade dos filhos", () => {
  const children = "Conteúdo sintético da etapa";
  const moldura = CadastroEnLayout({ children });
  expect(moldura.type).toBe(PortuguesApenas);
  const shell = moldura.props.children as ReactElement<{ children: ReactNode }>;
  expect(shell.type).toBe(CadastroLayout);
  expect(shell.props.children).toBe(children);
  expect(elementos(moldura).filter((e) => e.type === PortuguesApenas)).toHaveLength(1);
});
