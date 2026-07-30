import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * "Não tenho código": usuário sem código de acesso entra na lista de
 * espera (WAITLIST). Cadastro fica completo e guardado; ele será
 * contatado quando o produto entrar em produção e pode voltar a
 * /cadastro/acesso com um código a qualquer momento.
 */

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.onboardingStatus !== "ACCESS_PENDING") {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  await updateUser(user.id, { onboardingStatus: "WAITLIST" });
  await trackEvent("waitlist_joined", user.id);

  return NextResponse.json({ ok: true });
}
