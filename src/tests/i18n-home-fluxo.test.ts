import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import type { ResolvingMetadata } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage, { generateMetadata as metadataPt } from "@/app/page";
import HomeEnPage, { generateMetadata as metadataEn } from "@/app/en/page";
import { Home } from "@/components/home/Home";
import { Hero } from "@/components/home/Hero";
import { SecaoObservatorios } from "@/components/home/SecaoObservatorios";
import type { DominioId } from "@/lib/dominios";
import type { User } from "@/lib/schema";
import type { Vitrine } from "@/lib/vitrine";
import { en } from "@/i18n/en";

const dependencias = vi.hoisted(() => ({
  sessao: vi.fn<() => Promise<User | null>>(),
  vitrines: vi.fn<() => Record<DominioId, Vitrine>>(),
  redirect: vi.fn<(url: string) => never>(),
}));
vi.mock("@/lib/session", () => ({ getSessionUser: dependencias.sessao }));
vi.mock("@/lib/vitrine", () => ({ vitrines: dependencias.vitrines }));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  redirect: dependencias.redirect,
}));

const REDIRECT = new Error("Interrupção sintética do redirect do Next");
function vitrineSintetica(id: DominioId): Vitrine {
  return {
    id, imagem: `/home/${id}.webp`, focoImagem: "50% 50%",
    contagem: { valor: "1.234,50", unidade: "unidade sintética" },
    paineis: [{ titulo: "Painel sintético", href: `/fixture/${id}`, descricao: "Descrição sintética" }],
    fontes: "Fonte sintética", situacao: "Dados exclusivos do teste",
    metodologia: { href: `/fixture/${id}/metodo`, rotulo: "Método sintético" },
  };
}
// O objeto literal obriga o compilador a conferir cada chave do domínio.
const VITRINES: Record<DominioId, Vitrine> = {
  credito: vitrineSintetica("credito"),
  energia: vitrineSintetica("energia"),
  eficiencia: vitrineSintetica("eficiencia"),
  contas: vitrineSintetica("contas"),
  estados: vitrineSintetica("estados"),
  saneamento: vitrineSintetica("saneamento"),
  gas: vitrineSintetica("gas"),
};

function usuario(onboardingStatus: string): User {
  return {
    id: "usuario-sintetico-home", email: "home@example.invalid", onboardingStatus,
    emailVerifiedAt: null, phoneE164: null, phoneVerifiedAt: null,
    company: null, jobTitle: null, cpf: null, orgType: null, orgArea: null, orgRole: null,
    uf: null, passwordHash: null, termsAcceptedAt: null, privacyVersion: null, marketingOptIn: false,
    createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z"),
  };
}

/** Inspeciona o resultado do servidor sem simular o render dos componentes filhos. */
function elementos(filhos: ReactNode): ReactElement<Record<string, unknown>>[] {
  const encontrados: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(filhos, (filho) => {
    if (!isValidElement<Record<string, unknown>>(filho)) return;
    encontrados.push(filho, ...elementos(filho.props.children as ReactNode));
  });
  return encontrados;
}

beforeEach(() => {
  dependencias.sessao.mockReset().mockResolvedValue(null);
  dependencias.vitrines.mockReset().mockReturnValue(VITRINES);
  dependencias.redirect.mockReset().mockImplementation(() => { throw REDIRECT; });
});

const ENTRADAS = [
  { nome: "página /", idioma: "pt", executar: () => HomePage() },
  { nome: "página /en", idioma: "en", executar: () => HomeEnPage() },
  { nome: "helper PT", idioma: "pt", executar: () => Home({ idioma: "pt" }) },
  { nome: "helper EN", idioma: "en", executar: () => Home({ idioma: "en" }) },
] as const;

describe.each(ENTRADAS)("fluxo real da home: $nome", ({ idioma, executar }) => {
  it.each([null, "EMAIL_PENDING", "PHONE_PENDING", "PROFILE_PENDING", "ACCESS_PENDING", "WAITLIST"])(
    "consulta a sessão e mantém vitrines portuguesas para %s", async (estado) => {
      dependencias.sessao.mockResolvedValue(estado === null ? null : usuario(estado));
      const arvore = elementos(await executar());

      expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
      expect(dependencias.redirect).not.toHaveBeenCalled();
      expect(dependencias.vitrines).toHaveBeenCalledExactlyOnceWith();
      expect(dependencias.sessao.mock.invocationCallOrder[0]).toBeLessThan(dependencias.vitrines.mock.invocationCallOrder[0]);
      const heros = arvore.filter((elemento) => elemento.type === Hero);
      const observatorios = arvore.filter((elemento) => elemento.type === SecaoObservatorios);
      expect(heros).toHaveLength(1);
      expect(observatorios).toHaveLength(1);
      expect(heros[0].props.idioma).toBe(idioma);
      expect(heros[0].props.vitrines).toBe(VITRINES);
      expect(observatorios[0].props.vitrines).toBe(VITRINES);
    },
  );

  it("aguarda a resolução da sessão antes de consultar dados", async () => {
    let resolver!: (user: User | null) => void;
    dependencias.sessao.mockReturnValue(new Promise<User | null>((resolve) => { resolver = resolve; }));
    const pendente = executar();
    expect(dependencias.sessao).toHaveBeenCalledOnce();
    expect(dependencias.vitrines).not.toHaveBeenCalled();
    expect(dependencias.redirect).not.toHaveBeenCalled();
    resolver(null);
    await pendente;
    expect(dependencias.vitrines).toHaveBeenCalledExactlyOnceWith();
  });

  it("COMPLETE interrompe antes das vitrines e conserva o destino existente", async () => {
    dependencias.sessao.mockResolvedValue(usuario("COMPLETE"));
    await expect(executar()).rejects.toBe(REDIRECT);
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.redirect).toHaveBeenCalledExactlyOnceWith("/app/observatorios");
    expect(dependencias.vitrines).not.toHaveBeenCalled();
  });

  it("propaga o erro de sessão sem converter a resposta em vitrine anônima", async () => {
    const erro = new Error("Falha sintética na sessão");
    dependencias.sessao.mockRejectedValue(erro);
    await expect(executar()).rejects.toBe(erro);
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.redirect).not.toHaveBeenCalled();
    expect(dependencias.vitrines).not.toHaveBeenCalled();
  });

  it("propaga uma falha dos dados depois de consultar a sessão", async () => {
    const erro = new Error("Falha sintética das vitrines");
    dependencias.vitrines.mockImplementation(() => { throw erro; });
    await expect(executar()).rejects.toBe(erro);
    expect(dependencias.sessao).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.vitrines).toHaveBeenCalledExactlyOnceWith();
    expect(dependencias.redirect).not.toHaveBeenCalled();
  });
});

describe("metadados das entradas da home", () => {
  it("preserva a descrição PT, o título herdado e a imagem do pai ao acrescentar idiomas", async () => {
    const openGraph: NonNullable<Awaited<ResolvingMetadata>["openGraph"]> = {
      title: {
        absolute: "Scrutiniums: Crédito, Setor Elétrico, Eficiência Estatal, Contas Públicas Federais, Contas Públicas Estaduais, Saneamento e Gás Natural",
        template: null,
      },
      description: "Sete observatórios, a mesma filosofia de evidência: dados oficiais, fonte e data em cada número, metodologia aberta. Gratuito. Painéis com cadastro gratuito.",
      siteName: "Scrutiniums", locale: "pt_BR", type: "website", url: null,
      images: [{
        url: "https://scrutiniums.com/opengraph-image?b5ad3ed804227d3b",
        alt: "Scrutiniums: observatórios com dados oficiais, fonte e data em cada número",
        type: "image/png", width: 1200, height: 630,
      }],
    };
    const antes = structuredClone(openGraph);
    // O helper só consulta openGraph. A composição real da convenção de imagem
    // e do título do layout também é conferida no navegador do build.
    const parent = Promise.resolve({ openGraph } as Awaited<ResolvingMetadata>);
    const resultado = await metadataPt({}, parent);

    expect(resultado).toEqual({
      description: "Da informação dispersa ao conhecimento verificável. Uma plataforma, observatórios de Crédito, Setor Elétrico, Eficiência Estatal, Contas Públicas Federais, Contas Públicas Estaduais, Saneamento e Gás Natural, com bases públicas, registros oficiais e método declarado. Gratuita. Painéis com cadastro gratuito.",
      alternates: { canonical: "/", languages: { "pt-BR": "/", en: "/en", "x-default": "/" } },
      openGraph: { ...antes, title: { absolute: antes.title.absolute }, url: "/", locale: "pt_BR", alternateLocale: "en_US" },
    });
    expect(openGraph).toEqual(antes);
    expect(dependencias.sessao).not.toHaveBeenCalled();
    expect(dependencias.vitrines).not.toHaveBeenCalled();
  });

  it("usa a mesma frase inglesa do H1 e impede herdar a imagem portuguesa", async () => {
    const descricao = en["home.hero.titulo_inicio"].texto + en["home.hero.titulo_destaque"].texto + ".";
    expect(descricao).toBe("From scattered information to verifiable knowledge.");
    const titulo = `Scrutiniums · ${descricao}`;
    const resultado = await metadataEn();
    expect(resultado).toEqual({
      title: { absolute: titulo }, description: descricao,
      alternates: { canonical: "/en", languages: { "pt-BR": "/", en: "/en", "x-default": "/" } },
      openGraph: {
        title: titulo, description: descricao, siteName: "Scrutiniums", type: "website",
        url: "/en", locale: "en_US", alternateLocale: "pt_BR", images: [],
      },
      twitter: { card: "summary", title: titulo, description: descricao, images: [] },
    });
    expect(dependencias.sessao).not.toHaveBeenCalled();
    expect(dependencias.vitrines).not.toHaveBeenCalled();
  });
});
