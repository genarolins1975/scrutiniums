import type { MetadataRoute } from "next";

/**
 * A área logada (/app) nunca deve ser indexada (dados atrás de cadastro).
 * O Observatório (/observatorio) e seus ativos (/obs, inclusive JS/CSS,
 * necessários para o Google renderizar a SPA) são públicos e indexáveis —
 * são a principal superfície de aquisição, junto com as páginas públicas
 * (home, dados, glossário, fontes, metodologia, imprensa).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/api/", "/entrar/sms", "/cadastro/telefone", "/cadastro/perfil", "/cadastro/acesso"],
      },
    ],
    sitemap: "https://scrutiniums.com/sitemap.xml",
  };
}
