import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { trackEvent } from "@/lib/events";
import { COOKIE_OBSERVATORIO, dominio, isDominioId } from "@/lib/dominios";

export const runtime = "nodejs";

/**
 * "Entrar" da tela de escolha. Só POST altera estado: guarda o último
 * observatório escolhido (cookie sem PII, só o id do domínio), registra o evento
 * e leva à raiz do observatório. GET não grava nada (o prefetch de links do
 * Next faria GET sem clique) e volta à tela de escolha. A rota está sob /app:
 * o middleware exige sessão. POST de outra origem é recusado.
 */
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/app/observatorios", req.url));
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  // compara com o host que o navegador usou (atrás de proxy, x-forwarded-host)
  const origem = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  let hostOrigem: string | null = null;
  try {
    hostOrigem = origem ? new URL(origem).host : null;
  } catch {
    hostOrigem = "invalida";
  }
  if (hostOrigem && hostOrigem !== host) {
    return new NextResponse("Origem não permitida", { status: 403 });
  }
  let d: FormDataEntryValue | null = null;
  try {
    d = (await req.formData()).get("d");
  } catch {
    d = null;
  }
  if (!isDominioId(d)) {
    return NextResponse.redirect(new URL("/app/observatorios", url), 303);
  }
  const user = await getSessionUser();
  if (user) await trackEvent(`observatorio_escolhido:${d}`, user.id);
  const res = NextResponse.redirect(new URL(dominio(d).rotaRaiz, url), 303);
  res.cookies.set(COOKIE_OBSERVATORIO, d, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
