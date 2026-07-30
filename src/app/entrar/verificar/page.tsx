import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Rota antiga do login por SMS. Mantida apenas por compatibilidade com
 * links/abas antigos: o fluxo vive agora em /entrar/sms/verificar.
 */
export default function EntrarVerificarLegacyPage() {
  redirect("/entrar/sms/verificar");
}
