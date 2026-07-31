import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { trackView } from "@/lib/telemetry";
import { checkRateLimit, POLICIES } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Registro de visita a uma seção da área logada (telemetria SEM PII).
 * Exige sessão válida; a seção precisa estar na allowlist (ver telemetry.ts).
 * As respostas são sempre mínimas: o cliente (sendBeacon) não lê o corpo.
 */

const bodySchema = z.object({ secao: z.string().min(1).max(40) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const limit = checkRateLimit(`views:user:${user.id}`, POLICIES.viewsPerUser);
  if (!limit.allowed) return new NextResponse(null, { status: 429 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  // Seção fora da allowlist: 204 do mesmo jeito (nada a revelar), sem gravar.
  await trackView(parsed.data.secao, user.id);
  return new NextResponse(null, { status: 204 });
}
