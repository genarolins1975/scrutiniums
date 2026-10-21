import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { trackEvent } from "@/lib/events";
import { COOKIE_OBSERVATORIO } from "@/lib/dominios";
import { opcaoObservatorio } from "@/lib/opcoesObservatorios";
import { escolhaObservatorio } from "@/lib/observatorios/lista";

export const runtime = "nodejs";

/**
 * "Entrar" da tela de escolha. Só POST altera estado: guarda o último
 * observatório ou módulo escolhido (cookie sem PII, só o id da opção), registra o evento
 * e leva à raiz do observatório. Os blocos dos seis observatórios enviam
 * observatório (o) e coleção (c), resolvidos pela allowlist do registro.
 * GET não grava nada (o prefetch de links do Next faria GET sem clique) e
 * volta à tela de escolha. A rota está sob /app:
 * o middleware exige sessão. POST de outra origem é recusado.
 */
const HOSTS_CANONICOS = ["scrutiniums.com", "www.scrutiniums.com"];

export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/app/observatorios", req.url));
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  // Origem da requisição (Origin; na falta, Referer) precisa ser um host permitido:
  // o domínio canônico, o Host da própria requisição e, só com proxy declarado
  // confiável (Vercel ou TRUST_PROXY=1), o x-forwarded-host. Sem origem: recusa.
  const permitidos = new Set<string>(HOSTS_CANONICOS);
  const hostDireto = req.headers.get("host");
  if (hostDireto) permitidos.add(hostDireto);
  if (process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1") {
    const fwd = req.headers.get("x-forwarded-host");
    if (fwd) permitidos.add(fwd);
  }
  const bruto = req.headers.get("origin") ?? req.headers.get("referer");
  let hostOrigem: string | null = null;
  try {
    hostOrigem = bruto && bruto !== "null" ? new URL(bruto).host : null;
  } catch {
    hostOrigem = null;
  }
  if (!hostOrigem || !permitidos.has(hostOrigem)) {
    return new NextResponse("Origem não permitida", { status: 403 });
  }
  let form: FormData | null = null;
  try {
    form = await req.formData();
  } catch {
    form = null;
  }
  const opcao = opcaoObservatorio(form?.get("d"));
  const escolha = opcao ? undefined : escolhaObservatorio(form?.get("o"), form?.get("c"));
  if (!opcao && !escolha) {
    return NextResponse.redirect(new URL("/app/observatorios", url), 303);
  }
  const user = await getSessionUser();
  if (user) {
    await trackEvent(opcao ? `observatorio_escolhido:${opcao.dominioId}` : `observatorio_aberto:${escolha!.observatorio.id}`, user.id);
  }
  const res = NextResponse.redirect(new URL(opcao ? opcao.rotaRaiz : escolha!.href, url), 303);
  res.cookies.set(COOKIE_OBSERVATORIO, opcao ? opcao.id : escolha!.observatorio.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
