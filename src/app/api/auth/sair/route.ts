import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export const runtime = "nodejs";

/** Encerra a sessão (revoga o token e limpa o cookie) e volta para a home. */
export async function POST(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
