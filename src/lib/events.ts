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
  | "onboarding_completed"
  | "verification_failed"
  | "onboarding_abandoned";

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
