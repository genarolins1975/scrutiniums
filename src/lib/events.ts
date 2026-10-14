import { getDb, newId, schema } from "./db";

/**
 * Eventos de produto não sensíveis.
 * Nunca enviar e-mail, telefone, código, empresa ou cargo.
 */
export type ProductEventName =
  | "onboarding_started"
  | "email_verified"
  | "phone_verification_requested"
  | "phone_verified"
  | "profile_completed"
  | "waitlist_joined"
  | "waitlist_invited"
  | "boletim_enviado"
  | "boletim_optin"
  | "boletim_optout"
  // assinatura do resumo sem conta: só o fato, nunca o endereço
  | "resumo_assinatura_pedida"
  | "resumo_assinatura_confirmada"
  | "resumo_assinatura_cancelada"
  | "resumo_enviado"
  | "onboarding_completed"
  | "verification_failed"
  | "onboarding_abandoned"
  // escolha de observatório na tela pós login (domínio, nunca PII)
  | "observatorio_escolhido:credito"
  | "observatorio_escolhido:energia"
  | "observatorio_escolhido:eficiencia"
  | "observatorio_escolhido:contas"
  | "observatorio_escolhido:estados"
  | "observatorio_escolhido:gas";

export async function trackEvent(name: ProductEventName, userId?: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .insert(schema.productEvents)
      .values({ id: newId(), name, userId: userId ?? null, createdAt: new Date() });
  } catch {
    // Telemetria nunca derruba o fluxo principal.
  }
}
