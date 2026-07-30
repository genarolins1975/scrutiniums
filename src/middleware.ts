import { NextRequest, NextResponse } from "next/server";

/**
 * Proteção de rotas internas: sem cookie de sessão, redireciona para /entrar.
 * A validação forte da sessão acontece no servidor (layout de /app).
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("scrutiniums_session");
  if (!hasSession && request.nextUrl.pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("de", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
