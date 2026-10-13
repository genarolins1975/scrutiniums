import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/sessionCookie";
import { estadoRotaMobilidade } from "@/lib/eficiencia/mobilidade/roteamento";
import { COOKIE_DESTINO, ehApiDeDados, ehRotaPublica } from "@/lib/rotasPublicas";

/**
 * Proteção de rotas com validação forte na borda: o cookie de sessão é
 * assinado (HMAC + expiração) e verificado aqui sem acesso a banco. Cookies
 * ausentes, forjados, malformados ou vencidos são redirecionados para
 * /entrar com o destino preservado. A revogação (logout, encerrar sessões)
 * continua sendo conferida no servidor via banco (getSessionUser) nas rotas
 * de aplicação.
 *
 * Os painéis dos observatórios exigem conta (decisão de produto de
 * 13/10/2026). Ficam abertas só as rotas listadas em src/lib/rotasPublicas.ts:
 * página inicial, apresentação do Crédito, método, glossário, institucionais
 * e o fluxo de entrada e cadastro. Rota nova nasce fechada.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // A validação de um slug desconhecido precisa anteceder o streaming:
  // notFound() depois do início do corpo pode manter status HTTP 200.
  if (estadoRotaMobilidade(pathname) === "inexistente") {
    return new NextResponse("Página de Mobilidade não encontrada.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  if (ehRotaPublica(pathname)) return NextResponse.next();

  const verified = await verifySessionCookie(
    request.cookies.get("scrutiniums_session")?.value,
  );
  if (!verified) {
    // API de dados responde 401; navegação vai ao login com o destino.
    if (ehApiDeDados(pathname)) {
      return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
    }
    const destino = pathname + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = "/entrar";
    url.searchParams.set("de", destino);
    const res = NextResponse.redirect(url);
    // guarda o destino também para quem ainda vai se cadastrar (só navegação de página)
    if (request.headers.get("accept")?.includes("text/html")) res.cookies.set(COOKIE_DESTINO, destino, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60, secure: process.env.NODE_ENV === "production" });
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }
  if (!pathname.startsWith("/app")) return NextResponse.next();

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
  // tudo, exceto os estáticos do próprio Next; a lista aberta decide o resto
  matcher: ["/((?!_next/static|_next/image).*)"],
};
