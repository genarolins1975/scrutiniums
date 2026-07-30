import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Modelo de dados da Scrutiniums (Drizzle ORM).
 * Decisão registrada em ARCHITECTURE.md: Drizzle + better-sqlite3 em
 * desenvolvimento, portável para PostgreSQL trocando o driver.
 * Máquina de estados do onboarding:
 * EMAIL_PENDING → PHONE_PENDING → PROFILE_PENDING → COMPLETE
 */

export const ONBOARDING_STATUSES = [
  "EMAIL_PENDING",
  "PHONE_PENDING",
  "PROFILE_PENDING",
  "COMPLETE",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
  phoneE164: text("phone_e164").unique(),
  phoneVerifiedAt: integer("phone_verified_at", { mode: "timestamp_ms" }),
  company: text("company"),
  jobTitle: text("job_title"),
  onboardingStatus: text("onboarding_status").notNull().default("EMAIL_PENDING"),
  termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
  privacyVersion: text("privacy_version"),
  marketingOptIn: integer("marketing_opt_in", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/** Códigos de verificação: somente hash. Nunca OTPs em claro. */
export const verificationTokens = sqliteTable("verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  purpose: text("purpose").notNull(), // EMAIL_VERIFY | LOGIN | RECOVERY
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** Auditoria de mudanças sensíveis. Apenas dados mascarados em detail. */
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** Eventos de produto não sensíveis. Nunca PII. */
export const productEvents = sqliteTable("product_events", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type User = typeof users.$inferSelect;
