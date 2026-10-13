import type { MetadataRoute } from "next";

/**
 * Só a vitrine pública é indexável (src/lib/rotasPublicas.ts): página inicial,
 * apresentação do Crédito, método, glossário e institucionais. Painéis e
 * arquivos de dados exigem conta e respondem com redirecionamento ao login
 * (noindex); a área logada (/app) e as APIs ficam fora do rastreamento.
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
