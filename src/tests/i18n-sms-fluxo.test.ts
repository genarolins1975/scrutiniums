import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EntrarSmsPage from "@/app/entrar/sms/page";
import EntrarSmsEnPage from "@/app/en/entrar/sms/page";
import VerificarSmsPage from "@/app/entrar/sms/verificar/page";
import VerificarSmsEnPage from "@/app/en/entrar/sms/verificar/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";
import { EntrarForm } from "@/components/onboarding/EntrarForm";
import { EntrarVerificarForm } from "@/components/onboarding/EntrarVerificarForm";
import { LOGIN_PHONE_COOKIE } from "@/components/onboarding/signedEmailCookie";
import type { OnboardingStatus, User } from "@/lib/schema";

const dependencias = vi.hoisted(() => ({
  sessao: vi.fn<() => Promise<User | null>>(),
  telefonePendente: vi.fn<(nome: string) => string | null>(),
  redirect: vi.fn<(url: string) => never>(),
}));
vi.mock("@/lib/session", () => ({ getSessionUser: dependencias.sessao }));
vi.mock("@/components/onboarding/signedEmailCookie", () => ({
  LOGIN_PHONE_COOKIE: "login_phone",
  readSignedPhoneCookie: dependencias.telefonePendente,
}));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  redirect: dependencias.redirect,
}));

const REDIRECT = new Error("Interrupção sintética do redirect do Next");
const TELEFONE = "+5511912345678";
const ETAPAS = [
  ["EMAIL_PENDING", "/cadastro"],
  ["PHONE_PENDING", "/cadastro/telefone"],
  ["PROFILE_PENDING", "/cadastro/perfil"],
  ["ACCESS_PENDING", "/cadastro/acesso"],
  ["WAITLIST", "/cadastro/acesso"],
  ["COMPLETE", "/app/observatorios"],
] as const;
const PAGINAS = [
  { caminho: "/entrar/sms", pt: EntrarSmsPage, en: EntrarSmsEnPage, formulario: EntrarForm, exigeCookie: false },
  { caminho: "/entrar/sms/verificar", pt: VerificarSmsPage, en: VerificarSmsEnPage, formulario: EntrarVerificarForm, exigeCookie: true },
] as const;
type Pagina = typeof PAGINAS[number];

function usuario(onboardingStatus: OnboardingStatus): User {
  return {
    id: "usuario-sintetico-sms-i18n", email: "sms@example.invalid", onboardingStatus,
    emailVerifiedAt: null, phoneE164: null, phoneVerifiedAt: null,
    company: null, jobTitle: null, cpf: null, orgType: null, orgArea: null, orgRole: null,
    uf: null, passwordHash: null, termsAcceptedAt: null, privacyVersion: null, marketingOptIn: false,
    createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z"),
  };
}

/** Inspeção de JSX: não executa os formulários cliente nem o seletor. */
function elementos(children: ReactNode): ReactElement<Record<string, unknown>>[] {
  const encontrados: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(children, (filho) => {
    if (!isValidElement<Record<string, unknown>>(filho)) return;
    encontrados.push(filho, ...elementos(filho.props.children as ReactNode));
  });
  return encontrados;
}

async function abrir(pagina: Pagina, idioma: "pt" | "en") {
  if (idioma === "pt") return pagina.pt();
  const moldura = pagina.en();
  expect(moldura.type).toBe(PortuguesApenas);
  const filha = moldura.props.children as ReactElement;
  expect(filha.type).toBe(pagina.pt);
  expect(filha.props).toEqual({});
  expect(elementos(moldura).filter((e) => e.type === PortuguesApenas)).toHaveLength(1);
  // Executa apenas a página conhecida, depois de provar sua composição real.
  // Decisões com sessão mockada não constituem autenticação HTTP completa.
  return pagina.pt();
}

beforeEach(() => {
  dependencias.sessao.mockReset().mockResolvedValue(null);
  dependencias.telefonePendente.mockReset().mockReturnValue(TELEFONE);
  dependencias.redirect.mockReset().mockImplementation(() => { throw REDIRECT; });
});

describe.each(PAGINAS)("$caminho: decisões reais da página", (pagina) => {
  describe.each(["pt", "en"] as const)("idioma %s", (idioma) => {
    it("mantém o shell inteiro e o formulário real após a guarda anônima", async () => {
      if (!pagina.exigeCookie) dependencias.telefonePendente.mockImplementation(() => {
        throw new Error("A solicitação de SMS não lê o cookie de verificação.");
      });
      const arvore = elementos(await abrir(pagina, idioma));
      const cabecalhos = arvore.filter((e) => e.type === "header");
      expect(cabecalhos).toHaveLength(1);
      expect(elementos(cabecalhos[0]).filter((e) => e.type === SeletorIdiomaPublico)).toHaveLength(1);
      expect(arvore.filter((e) => e.type === SeletorIdiomaPublico)).toHaveLength(1);
      expect(arvore.filter((e) => e.type === "main")).toHaveLength(1);
      expect(arvore.filter((e) => e.type === "footer")).toHaveLength(1);
      expect(arvore.filter((e) => e.type === PortuguesApenas)).toHaveLength(0);
      const formularios = arvore.filter((e) => e.type === EntrarForm || e.type === EntrarVerificarForm);
      expect(formularios).toHaveLength(1);
      expect(formularios[0].type).toBe(pagina.formulario);
      // A máscara esperada é literal, não calculada pelo helper sob teste.
      expect(formularios[0].props).toEqual(pagina.exigeCookie ? { maskedPhone: "+55 •• •••••-5678" } : {});
      expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
      expect(dependencias.redirect).not.toHaveBeenCalled();
      if (pagina.exigeCookie) {
        expect(dependencias.telefonePendente).toHaveBeenCalledExactlyOnceWith(LOGIN_PHONE_COOKIE);
        expect(dependencias.sessao.mock.invocationCallOrder[0]).toBeLessThan(dependencias.telefonePendente.mock.invocationCallOrder[0]);
      } else expect(dependencias.telefonePendente).not.toHaveBeenCalled();
    });

    it.each(ETAPAS)("%s redireciona para %s antes de ler cookie ou renderizar o formulário", async (estado, destino) => {
      dependencias.sessao.mockResolvedValue(usuario(estado));
      dependencias.telefonePendente.mockImplementation(() => { throw new Error("Sessão existente não consulta cookie de fluxo."); });
      await expect(abrir(pagina, idioma)).rejects.toBe(REDIRECT);
      expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
      expect(dependencias.redirect).toHaveBeenCalledExactlyOnceWith(destino);
      expect(dependencias.telefonePendente).not.toHaveBeenCalled();
      expect(dependencias.sessao.mock.invocationCallOrder[0]).toBeLessThan(dependencias.redirect.mock.invocationCallOrder[0]);
    });

    it("aguarda a sessão antes de continuar para cookie ou corpo", async () => {
      let resolver!: (user: User | null) => void;
      dependencias.sessao.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
      const pendente = abrir(pagina, idioma);
      expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
      expect(dependencias.telefonePendente).not.toHaveBeenCalled();
      expect(dependencias.redirect).not.toHaveBeenCalled();
      resolver(null);
      const arvore = elementos(await pendente);
      expect(arvore.filter((e) => e.type === pagina.formulario)).toHaveLength(1);
      if (pagina.exigeCookie) expect(dependencias.telefonePendente).toHaveBeenCalledExactlyOnceWith(LOGIN_PHONE_COOKIE);
      else expect(dependencias.telefonePendente).not.toHaveBeenCalled();
    });

    it("propaga falha da sessão sem ler cookie nem criar retorno anônimo", async () => {
      const falha = new Error("Falha sintética da sessão");
      dependencias.sessao.mockRejectedValue(falha);
      await expect(abrir(pagina, idioma)).rejects.toBe(falha);
      expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
      expect(dependencias.telefonePendente).not.toHaveBeenCalled();
      expect(dependencias.redirect).not.toHaveBeenCalled();
    });
  });
});

describe.each(["pt", "en"] as const)("verificação SMS %s: decisão após leitura do cookie", (idioma) => {
  it("retorna à solicitação portuguesa quando o leitor não fornece um telefone válido", async () => {
    // O leitor retorna null para ausência ou assinatura rejeitada. A validade
    // criptográfica e o redirect por streaming pertencem à prova HTTP/browser.
    dependencias.telefonePendente.mockReturnValue(null);
    await expect(abrir(PAGINAS[1], idioma)).rejects.toBe(REDIRECT);
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.telefonePendente).toHaveBeenCalledExactlyOnceWith(LOGIN_PHONE_COOKIE);
    expect(dependencias.redirect).toHaveBeenCalledExactlyOnceWith("/entrar/sms");
    expect(dependencias.sessao.mock.invocationCallOrder[0]).toBeLessThan(dependencias.telefonePendente.mock.invocationCallOrder[0]);
    expect(dependencias.telefonePendente.mock.invocationCallOrder[0]).toBeLessThan(dependencias.redirect.mock.invocationCallOrder[0]);
  });

  it("propaga falha da leitura do cookie sem redirecionamento alternativo", async () => {
    const falha = new Error("Falha sintética da leitura de cookie");
    dependencias.telefonePendente.mockImplementation(() => { throw falha; });
    await expect(abrir(PAGINAS[1], idioma)).rejects.toBe(falha);
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.telefonePendente).toHaveBeenCalledExactlyOnceWith(LOGIN_PHONE_COOKIE);
    expect(dependencias.redirect).not.toHaveBeenCalled();
  });
});
