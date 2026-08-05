import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/** Preferência do boletim mensal na conta (liga/desliga o consentimento). */
const bodySchema = z.object({ optIn: z.boolean() });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await updateUser(user.id, { marketingOptIn: parsed.data.optIn });
  await trackEvent(parsed.data.optIn ? "boletim_optin" : "boletim_optout", user.id);
  return NextResponse.json({ optIn: parsed.data.optIn });
}
