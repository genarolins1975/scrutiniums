import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { COOKIE_OBSERVATORIO, VALIDADE_ULTIMO_ACESSO, ultimoAcessoDoCaminho } from "@/lib/observatorios/ultimoAcesso";

export const runtime = "nodejs";

/** Navegação já exibida no cliente; prefetch e GET nunca alteram a continuidade. */
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return new NextResponse(null, { status: 403 });
  }
  if (!(await getSessionUser())) return new NextResponse(null, { status: 401 });
  let caminho: unknown;
  try { caminho = (await req.json()).caminho; } catch { /* corpo inválido */ }
  const valor = typeof caminho === "string" && caminho.length <= 512 && !/[?#]/.test(caminho)
    ? ultimoAcessoDoCaminho(caminho) : null;
  if (!valor) return new NextResponse(null, { status: 400 });
  const res = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (req.cookies.get(COOKIE_OBSERVATORIO)?.value !== valor) {
    res.cookies.set(COOKIE_OBSERVATORIO, valor, {
      path: "/", maxAge: VALIDADE_ULTIMO_ACESSO, sameSite: "lax", httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
