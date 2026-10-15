import type { MetadataRoute } from "next";

/**
 * A abertura em src/lib/rotasPublicas.ts não elimina os bloqueios de
 * rastreamento: as etapas SMS são públicas e constam no sitemap nos dois
 * idiomas, mas conservam o bloqueio abaixo. Painéis e arquivos de dados
 * exigem conta e redirecionam ao login (noindex); /app e APIs são bloqueados.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/api/", "/entrar/sms", "/en/entrar/sms", "/cadastro/telefone", "/cadastro/perfil", "/cadastro/acesso"],
      },
    ],
    sitemap: "https://scrutiniums.com/sitemap.xml",
  };
}
