import type { ResolvingMetadata } from "next";
import { describe, expect, it } from "vitest";
import { generateMetadata as glossarioPt } from "@/app/glossario/page";
import { generateMetadata as termosPt } from "@/app/termos/page";
import { generateMetadata as privacidadePt } from "@/app/privacidade/page";
import { metadata as glossarioEn } from "@/app/en/glossario/page";
import { metadata as termosEn } from "@/app/en/termos/page";
import { metadata as privacidadeEn } from "@/app/en/privacidade/page";

const PAGINAS = [
  {
    pt: "/glossario", en: "/en/glossario", gerarPt: glossarioPt, metadataEn: glossarioEn,
    titulo: "Glossário",
    descricao: "Definições, fórmulas, fontes e limitações de todos os indicadores da Scrutiniums. Fonte única de nomes e definições da plataforma.",
  },
  {
    pt: "/termos", en: "/en/termos", gerarPt: termosPt, metadataEn: termosEn,
    titulo: "Termos de uso",
    descricao: "Condições de uso da plataforma Scrutiniums: acesso gratuito mediante cadastro, caráter estritamente informativo, isenção de garantias e limitação de responsabilidade.",
  },
  {
    pt: "/privacidade", en: "/en/privacidade", gerarPt: privacidadePt, metadataEn: privacidadeEn,
    titulo: "Política de privacidade",
    descricao: "Quais dados a Scrutiniums coleta, por que coleta, por quanto tempo guarda e como você exerce seus direitos.",
  },
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

describe.each(PAGINAS)("metadados das irmãs públicas dinâmicas: $pt", (pagina) => {
  it("preserva os textos PT e a imagem herdada, acrescentando canonical próprio e idiomas", async () => {
    const openGraph = ogDoPai();
    const antes = structuredClone(openGraph);
    // O gerador consulta apenas OG. A resolução do título do layout e da
    // convenção opengraph-image também é comprovada no navegador do build.
    const parent = Promise.resolve({ openGraph } as Awaited<ResolvingMetadata>);
    const resultado = await pagina.gerarPt({}, parent);

    expect(resultado).toEqual({
      title: pagina.titulo,
      description: pagina.descricao,
      alternates: {
        canonical: pagina.pt,
        languages: { "pt-BR": pagina.pt, en: pagina.en, "x-default": pagina.pt },
      },
      openGraph: {
        ...antes,
        title: { absolute: antes.title.absolute },
        url: pagina.pt,
        locale: "pt_BR",
        alternateLocale: "en_US",
      },
    });
    expect(openGraph).toEqual(antes);
    expect(resultado).not.toHaveProperty("twitter");
  });

  it("identifica o conteúdo inglês como português marcado e não herda a imagem PT", () => {
    expect(pagina.metadataEn).toEqual({
      title: { absolute: "Scrutiniums · Portuguese only" },
      description: "Portuguese only",
      alternates: {
        canonical: pagina.en,
        languages: { "pt-BR": pagina.pt, en: pagina.en, "x-default": pagina.pt },
      },
      openGraph: {
        title: "Scrutiniums · Portuguese only",
        description: "Portuguese only",
        siteName: "Scrutiniums",
        type: "website",
        url: pagina.en,
        locale: "en_US",
        alternateLocale: "pt_BR",
        images: [],
      },
      twitter: {
        card: "summary", title: "Scrutiniums · Portuguese only", description: "Portuguese only", images: [],
      },
    });
  });
});
