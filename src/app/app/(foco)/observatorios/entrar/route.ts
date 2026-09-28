import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { trackEvent } from "@/lib/events";
import { COOKIE_OBSERVATORIO, dominio, isDominioId } from "@/lib/dominios";

export const runtime = "nodejs";

/**
 * "Entrar" da tela de escolha: guarda o último observatório escolhido (cookie
 * sem PII, só o id do domínio) e leva à raiz do observatório. Domínio
 * desconhecido volta à tela de escolha. A rota está sob /app: o middleware
 * exige sessão.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const d = url.searchParams.get("d");
  if (!isDominioId(d)) {
    return NextResponse.redirect(new URL("/app/observatorios", url));
  }
  const user = await getSessionUser();
  if (user) await trackEvent(`observatorio_escolhido:${d}`, user.id);
  const res = NextResponse.redirect(new URL(dominio(d).rotaRaiz, url));
  res.cookies.set(COOKIE_OBSERVATORIO, d, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
