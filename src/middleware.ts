import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/sessionCookie";

/**
 * Proteção de rotas internas com validação forte na borda: o cookie de
 * sessão é assinado (HMAC + expiração) e verificado aqui sem acesso a
 * banco. Cookies ausentes, forjados, malformados ou vencidos são
 * redirecionados para /entrar. A revogação (logout, encerrar sessões)
 * continua sendo conferida no servidor via banco (getSessionUser) nas
 * rotas de aplicação; o conteúdo estático do Observatório (/obs) fica
 * protegido pela assinatura e expiração.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/app") ||
    pathname === "/observatorio" ||
    pathname.startsWith("/observatorio/") ||
    pathname.startsWith("/obs/");
  if (!isProtected) return NextResponse.next();

  const verified = await verifySessionCookie(
    request.cookies.get("scrutiniums_session")?.value,
  );
  if (!verified) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    // Ativos em /obs não são destinos navegáveis; após o login, volta à SPA.
    url.searchParams.set("de", pathname.startsWith("/obs/") ? "/observatorio" : pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/observatorio", "/observatorio/:path*", "/obs/:path*"],
};
