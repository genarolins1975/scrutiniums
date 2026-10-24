import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { COOKIE_OBSERVATORIO, VALIDADE_ULTIMO_ACESSO, ultimoAcessoDoCaminho } from "@/lib/observatorios/ultimoAcesso";

export const runtime = "nodejs";

/** Mesmos hosts permitidos da rota legada /app/observatorios/entrar, inclusive atrás de proxy. */
function origemPermitida(req: NextRequest): boolean {
  const permitidos = new Set(["scrutiniums.com", "www.scrutiniums.com"]);
  const host = req.headers.get("host");
  if (host) permitidos.add(host);
  if (process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1") {
    const encaminhado = req.headers.get("x-forwarded-host");
    if (encaminhado) permitidos.add(encaminhado);
  }
  const bruto = req.headers.get("origin");
  try {
    const origem = new URL(bruto ?? "");
    return ["http:", "https:"].includes(origem.protocol) && bruto === origem.origin && permitidos.has(origem.host);
  } catch { return false; }
}

/** Navegação já exibida no cliente; prefetch e GET nunca alteram a continuidade. */
export async function POST(req: NextRequest) {
  if (!origemPermitida(req)) {
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
