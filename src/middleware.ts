import { NextRequest, NextResponse } from "next/server";

/**
 * Proteção de rotas internas: sem cookie de sessão, redireciona para /entrar.
 * A validação forte da sessão acontece no servidor (layout de /app).
 * Também protege o Observatório embutido: as rotas /observatorio (SPA) e
 * /obs (ativos estáticos e JSONs analíticos) exigem a mesma sessão.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("scrutiniums_session");
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/app") ||
    pathname === "/observatorio" ||
    pathname.startsWith("/observatorio/") ||
    pathname.startsWith("/obs/");
  if (!hasSession && isProtected) {
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
