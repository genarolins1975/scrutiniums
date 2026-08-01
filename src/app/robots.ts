import type { MetadataRoute } from "next";

/**
 * A área logada nunca deve ser indexada (dados atrás de cadastro); as
 * páginas públicas (home, glossário, fontes, metodologia, jurídico e
 * cadastro) são a superfície de aquisição e ficam abertas aos robôs.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/observatorio", "/obs/", "/api/", "/entrar/sms", "/cadastro/telefone", "/cadastro/perfil", "/cadastro/acesso"],
      },
    ],
    sitemap: "https://scrutiniums.com/sitemap.xml",
  };
}
