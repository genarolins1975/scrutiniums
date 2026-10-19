import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/sessionCookie";
import { estadoRotaMobilidade } from "@/lib/eficiencia/mobilidade/roteamento";
import { COOKIE_DESTINO, ehApiDeDados, ehRotaPublica } from "@/lib/rotasPublicas";
import { analisarUrlPagina } from "@/lib/i18n-url";
import { parDeIdioma } from "@/lib/i18n-rotas";
import type { Idioma } from "@/lib/idioma";

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
 * página inicial, apresentação do Crédito, método, glossário, institucionais,
 * o fluxo de entrada e cadastro e, desde 19/10/2026, as consultas pessoais da
 * leva 1 ("aberto e com conta"). Rota nova nasce fechada.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const caminhoPolitica = parDeIdioma(pathname)?.pt ?? pathname;
  // A validação de um slug desconhecido precisa anteceder o streaming:
  // notFound() depois do início do corpo pode manter status HTTP 200.
  if (estadoRotaMobilidade(caminhoPolitica) === "inexistente") {
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
    if (analisarUrlPagina(pathname)?.idioma === "en") {
      const entrada = parDeIdioma("/entrar");
      if (entrada) url.pathname = entrada.en;
    }
    url.searchParams.set("de", destino);
    const res = NextResponse.redirect(url);
    // guarda o destino também para quem ainda vai se cadastrar (só navegação de página)
    if (request.headers.get("accept")?.includes("text/html")) res.cookies.set(COOKIE_DESTINO, destino, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60, secure: process.env.NODE_ENV === "production" });
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }
  // A guarda administrativa vale também antes de existir uma irmã publicada.
  // O pathname original continua sendo a origem do destino de autenticação.
  const pagina = analisarUrlPagina(pathname);
  if (pagina?.idioma === "en") {
    // O Next também procura rotas estáticas pela grafia decodificada. O parser
    // já validou os escapes; decodificar aqui não muda a URL nem abre a rota.
    return protegerAdmin(request, decodeURIComponent(pagina.caminhoPt), "en");
  }
  if (!pagina) {
    try {
      const decodificado = decodeURIComponent(pathname);
      // Um alias rejeitado pelo parser não pode ganhar uma rota inglesa só
      // porque o servidor encontra a versão decodificada depois do middleware.
      if (decodificado === "/en" || decodificado.startsWith("/en/")) {
        return NextResponse.rewrite(new URL("/en/nao-encontrado-404", request.url));
      }
    } catch {
      // Escape inválido não fornece um caminho de política alternativo.
    }
  }
  if (!pathname.startsWith("/app")) return NextResponse.next();
  return protegerAdmin(request, pathname, "pt");
}

async function protegerAdmin(request: NextRequest, caminhoPolitica: string, idioma: Idioma): Promise<NextResponse> {
  // /app/admin só existe para administradores (ADMIN_EMAILS). O middleware
  // roda no edge e não acessa o banco, então consulta a rota interna
  // /api/admin/eu com o cookie da requisição; não-admin recebe rewrite
  // para um caminho inexistente → 404 real (com streaming/loading.tsx, o
  // notFound() da página chegaria com status 200). A página ainda chama
  // notFound() como defesa em profundidade.
  if (caminhoPolitica === "/app/admin" || caminhoPolitica.startsWith("/app/admin/")) {
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
      const destino = idioma === "en" ? "/en/nao-encontrado-404" : "/nao-encontrado-404";
      return NextResponse.rewrite(new URL(destino, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // tudo, exceto os estáticos do próprio Next; a lista aberta decide o resto
  matcher: ["/((?!_next/static|_next/image).*)"],
};
