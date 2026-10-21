import type { ResolvingMetadata } from "next";
import { describe, expect, it } from "vitest";
import { generateMetadata as entrarPt, dynamic as modoEntrarPt } from "@/app/entrar/page";
import { generateMetadata as cadastroPt, dynamic as modoCadastroPt } from "@/app/cadastro/page";
import { metadata as entrarEn, dynamic as modoEntrarEn } from "@/app/en/entrar/page";
import { metadata as cadastroEn, dynamic as modoCadastroEn } from "@/app/en/cadastro/page";
import { generateMetadata as smsPt, dynamic as modoSmsPt } from "@/app/entrar/sms/page";
import { generateMetadata as smsVerificarPt, dynamic as modoSmsVerificarPt } from "@/app/entrar/sms/verificar/page";
import { metadata as smsEn, dynamic as modoSmsEn } from "@/app/en/entrar/sms/page";
import { metadata as smsVerificarEn, dynamic as modoSmsVerificarEn } from "@/app/en/entrar/sms/verificar/page";

// Entrada e SMS têm tradução publicada; o cadastro continua só em português.
const PAGINAS = [
  { pt: "/entrar", en: "/en/entrar", titulo: "Entrar", gerarPt: entrarPt, metadataEn: entrarEn, modos: [modoEntrarPt, modoEntrarEn],
    traducao: { titulo: "Sign in", descricao: "Sign in to Scrutiniums with your email and password to open the observatory dashboards." } },
  { pt: "/cadastro", en: "/en/cadastro", titulo: "Crie seu acesso", gerarPt: cadastroPt, metadataEn: cadastroEn, modos: [modoCadastroPt, modoCadastroEn], traducao: null },
  { pt: "/entrar/sms", en: "/en/entrar/sms", titulo: "Entrar com código por SMS", gerarPt: smsPt, metadataEn: smsEn, modos: [modoSmsPt, modoSmsEn],
    traducao: { titulo: "Sign in with an SMS code", descricao: "Sign in to Scrutiniums with a code sent by SMS to the phone number on your account." } },
  { pt: "/entrar/sms/verificar", en: "/en/entrar/sms/verificar", titulo: "Código de acesso", gerarPt: smsVerificarPt, metadataEn: smsVerificarEn, modos: [modoSmsVerificarPt, modoSmsVerificarEn],
    traducao: { titulo: "Access code", descricao: "Enter the access code sent by SMS to sign in to Scrutiniums." } },
] as const;

function ogDoPai(): NonNullable<Awaited<ResolvingMetadata>["openGraph"]> {
  return {
    title: {
      absolute: "Scrutiniums: Crédito, Setor Elétrico, Eficiência Estatal, Contas Públicas Federais, Contas Públicas Estaduais, Saneamento e Gás Natural",
      template: "%s · Scrutiniums",
    },
    description: "Sete observatórios, a mesma filosofia de evidência: dados oficiais, fonte e data em cada número, metodologia aberta. Gratuito. Painéis com cadastro gratuito.",
    siteName: "Scrutiniums", locale: "pt_BR", type: "website", url: null,
    images: [{
      url: "https://scrutiniums.com/opengraph-image?b5ad3ed804227d3b",
      alt: "Scrutiniums: observatórios com dados oficiais, fonte e data em cada número",
      type: "image/png", width: 1200, height: 630,
    }],
  };
}

describe.each(PAGINAS)("metadados da entrada de autenticação $pt", (pagina) => {
  it("conserva título, descrição herdada e cartão PT sem tornar a página estática", async () => {
    const openGraph = ogDoPai();
    const antes = structuredClone(openGraph);
    const parent = Promise.resolve({ openGraph } as Awaited<ResolvingMetadata>);
    const resultado = await pagina.gerarPt({}, parent);
    expect(pagina.modos).toEqual(["force-dynamic", "force-dynamic"]);
    expect(resultado).toEqual({
      title: pagina.titulo,
      alternates: {
        canonical: pagina.pt,
        ...(pagina.traducao ? { languages: { "pt-BR": pagina.pt, en: pagina.en, "x-default": pagina.pt } } : {}),
      },
      openGraph: {
        ...antes, title: { absolute: antes.title.absolute }, url: pagina.pt,
        locale: "pt_BR", alternateLocale: "en_US",
      },
    });
    // As folhas originais só tinham title. Não copiar a descrição OG para
    // description, pois os dois textos do RootLayout são distintos.
    expect(resultado).not.toHaveProperty("description");
    expect(resultado).not.toHaveProperty("twitter");
    expect(resultado).not.toHaveProperty("robots");
    expect(openGraph).toEqual(antes);
  });

  it.runIf(pagina.traducao !== null)("publica o head inglês próprio, indexável e com alternativas recíprocas", () => {
    const { titulo, descricao } = pagina.traducao!;
    expect(pagina.metadataEn).toEqual({
      title: titulo,
      description: descricao,
      alternates: {
        canonical: pagina.en,
        languages: { "pt-BR": pagina.pt, en: pagina.en, "x-default": pagina.pt },
      },
      openGraph: {
        title: `${titulo} · Scrutiniums`, description: descricao,
        siteName: "Scrutiniums", type: "website", url: pagina.en,
        locale: "en_US", alternateLocale: "pt_BR", images: [],
      },
      twitter: { card: "summary", title: `${titulo} · Scrutiniums`, description: descricao, images: [] },
    });
    expect(pagina.metadataEn).not.toHaveProperty("robots");
  });

  it.runIf(pagina.traducao === null)("anuncia fallback integral em EN com alternativas recíprocas e sem cartão PT", () => {
    expect(pagina.metadataEn).toEqual({
      title: { absolute: "Scrutiniums · Portuguese only" },
      description: "Portuguese only",
      robots: { index: false, follow: true },
      alternates: {
        canonical: pagina.en,
      },
      openGraph: {
        title: "Scrutiniums · Portuguese only", description: "Portuguese only",
        siteName: "Scrutiniums", type: "website", url: pagina.en,
        locale: "en_US", alternateLocale: "pt_BR", images: [],
      },
      twitter: {
        card: "summary", title: "Scrutiniums · Portuguese only", description: "Portuguese only", images: [],
      },
    });
    expect(pagina.metadataEn.robots).toEqual({ index: false, follow: true });
  });
});
