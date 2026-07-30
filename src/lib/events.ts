import { db, newId, schema } from "./db";

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
  | "onboarding_completed"
  | "verification_failed"
  | "onboarding_abandoned";

export async function trackEvent(name: ProductEventName, userId?: string): Promise<void> {
  try {
    db.insert(schema.productEvents)
      .values({ id: newId(), name, userId: userId ?? null, createdAt: new Date() })
      .run();
  } catch {
    // Telemetria nunca derruba o fluxo principal.
  }
}
