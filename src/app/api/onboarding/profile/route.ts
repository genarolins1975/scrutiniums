import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Etapa 3: empresa e cargo (texto livre, 1..120 caracteres).
 * Conclui o onboarding: status COMPLETE.
 */

const bodySchema = z.object({
  company: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(1).max(120),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.onboardingStatus !== "PROFILE_PENDING") {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
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

  await updateUser(user.id, {
    company: parsed.data.company,
    jobTitle: parsed.data.jobTitle,
    onboardingStatus: "COMPLETE",
  });

  await trackEvent("profile_completed", user.id);
  await trackEvent("onboarding_completed", user.id);

  return NextResponse.json({ ok: true, next: "/app" });
}
