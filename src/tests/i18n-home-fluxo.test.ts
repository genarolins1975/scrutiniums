import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import type { ResolvingMetadata } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage, { generateMetadata as metadataPt } from "@/app/page";
import HomeEnPage, { generateMetadata as metadataEn } from "@/app/en/page";
import { Home } from "@/components/home/Home";
import { Hero } from "@/components/home/Hero";
import { SecaoObservatorios } from "@/components/home/SecaoObservatorios";
import { vitrinesPublicadas as VITRINES } from "@/lib/publicacao/entradas";
import { RedirecionarHome } from "@/components/home/RedirecionarHome";
import { en } from "@/i18n/en";

const dependencias = vi.hoisted(() => ({ sessao: vi.fn(), vitrines: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: dependencias.sessao }));
vi.mock("@/lib/vitrine", () => ({ vitrines: dependencias.vitrines }));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  redirect: dependencias.redirect,
}));

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
  for (const chamada of Object.values(dependencias)) chamada.mockReset().mockImplementation(() => {
    throw new Error("A home publicada não pode consultar sessão nem bases em runtime");
  });
});

const ENTRADAS = [
  { nome: "página /", idioma: "pt", executar: () => HomePage() },
  { nome: "página /en", idioma: "en", executar: () => HomeEnPage() },
  { nome: "helper PT", idioma: "pt", executar: () => Home({ idioma: "pt" }) },
  { nome: "helper EN", idioma: "en", executar: () => Home({ idioma: "en" }) },
] as const;

describe.each(ENTRADAS)("fluxo real da home: $nome", ({ idioma, executar }) => {
  // A decisão de sessão foi para o middleware: home-estatica e home-estatica-browser
  // verificam redirecionamento, pendência, revogação, expiração e falha do serviço.
  it("entrega a composição publicada no idioma correto sem depender de sessão ou leitura de bases", async () => {
    const arvore = elementos(await executar());
    expect(dependencias.sessao).not.toHaveBeenCalled();
    expect(dependencias.vitrines).not.toHaveBeenCalled();
    expect(dependencias.redirect).not.toHaveBeenCalled();
    const heros = arvore.filter(elemento => elemento.type === Hero);
    const observatorios = arvore.filter(elemento => elemento.type === SecaoObservatorios);
    expect(heros).toHaveLength(1);
    expect(observatorios).toHaveLength(1);
    expect(heros[0].props.idioma).toBe(idioma);
    expect(heros[0].props.vitrines).toBe(VITRINES);
    expect(observatorios[0].props.vitrines).toBe(VITRINES);
    expect(arvore.filter(elemento => elemento.type === RedirecionarHome)).toHaveLength(1);
  });
});

describe("metadados das entradas da home", () => {
  it("preserva a descrição PT, o título herdado e a imagem do pai ao acrescentar idiomas", async () => {
    const openGraph: NonNullable<Awaited<ResolvingMetadata>["openGraph"]> = {
      title: {
        absolute: "Scrutiniums: Crédito, Setor Elétrico, Eficiência Estatal, Contas Públicas Federais, Contas Públicas Estaduais, Saneamento, Gás Natural e Agronegócio",
        template: null,
      },
      description: "Seis observatórios, a mesma filosofia de evidência: dados oficiais, fonte e data em cada número, metodologia aberta. Gratuito. Painéis com cadastro gratuito.",
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
      description: "Da informação dispersa ao conhecimento verificável. Uma plataforma, observatórios de Famílias, Serviços Públicos, Contas Públicas, Energia e Infraestrutura, Economia e Território e Clima, com bases públicas, registros oficiais e método declarado. Gratuita. Painéis com cadastro gratuito.",
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
