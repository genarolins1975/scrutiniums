import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { getDb, newId, schema } from "@/lib/db";
import { checkRateLimit, POLICIES } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Sugestões dos usuários (aba do Observatório → painel de administração).
 * Sessão COMPLETE obrigatória; categoria em allowlist; texto 10..2000
 * caracteres. O conteúdo é livre por natureza, então nunca entra em log —
 * só na tabela, lida exclusivamente pelo painel restrito a ADMIN_EMAILS.
 */

const CATEGORIAS = ["analise", "dado", "usabilidade", "outra"] as const;

const bodySchema = z.object({
  categoria: z.enum(CATEGORIAS),
  texto: z.string().trim().min(10, "curto").max(2000, "longo"),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.onboardingStatus !== "COMPLETE") {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const limite = checkRateLimit(`sugestoes:user:${user.id}`, POLICIES.sugestoesPerUser);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "Muitas sugestões em sequência. Aguarde um pouco e tente novamente." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(limite.retryAfterMs / 1000))) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const curto = parsed.error.issues.some((i) => i.message === "curto");
    return NextResponse.json(
      {
        error: curto
          ? "Escreva um pouco mais (mínimo de 10 caracteres) para a sugestão ser útil."
          : "Dados inválidos. O texto deve ter até 2.000 caracteres.",
      },
      { status: 400 },
    );
  }

  const db = await getDb();
  await db.insert(schema.suggestions).values({
    id: newId(),
    userId: user.id,
    categoria: parsed.data.categoria,
    texto: parsed.data.texto,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
