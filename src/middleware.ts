import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/sessionCookie";

/**
 * Proteção de rotas internas com validação forte na borda: o cookie de
 * sessão é assinado (HMAC + expiração) e verificado aqui sem acesso a
 * banco. Cookies ausentes, forjados, malformados ou vencidos são
 * redirecionados para /entrar. A revogação (logout, encerrar sessões)
 * continua sendo conferida no servidor via banco (getSessionUser) nas
 * rotas de aplicação.
 *
 * O Observatório (/observatorio e os ativos em /obs) é PÚBLICO por
 * decisão de produto: leitura aberta e indexável, sem cadastro. Atrás de
 * login ficam apenas as rotas de conta e aplicação (/app) — onde há dado
 * por usuário e funções de valor agregado.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/app")) return NextResponse.next();

  const verified = await verifySessionCookie(
    request.cookies.get("scrutiniums_session")?.value,
  );
  if (!verified) {
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = "/entrar";
    url.searchParams.set("de", pathname);
    return NextResponse.redirect(url);
  }

  // /app/admin só existe para administradores (ADMIN_EMAILS). O middleware
  // roda no edge e não acessa o banco, então consulta a rota interna
  // /api/admin/eu com o cookie da requisição; não-admin recebe rewrite
  // para um caminho inexistente → 404 real (com streaming/loading.tsx, o
  // notFound() da página chegaria com status 200). A página ainda chama
  // notFound() como defesa em profundidade.
  if (pathname === "/app/admin" || pathname.startsWith("/app/admin/")) {
    let admin = false;
    try {
      const res = await fetch(new URL("/api/admin/eu", request.url), {
        headers: { cookie: request.headers.get("cookie") ?? "" },
      });
      admin = res.ok;
    } catch {
      admin = false;
    }
    if (!admin) {
      return NextResponse.rewrite(new URL("/nao-encontrado-404", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
