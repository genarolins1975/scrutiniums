import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

/**
 * Modelo de dados da Scrutiniums (Drizzle ORM, dialeto PostgreSQL).
 * Decisão registrada em ARCHITECTURE.md: um único schema pg-core serve
 * PGlite (Postgres embarcado) em desenvolvimento e node-postgres em produção.
 * Máquina de estados do onboarding:
 * EMAIL_PENDING → PHONE_PENDING → PROFILE_PENDING → ACCESS_PENDING → COMPLETE
 * (ACCESS_PENDING → WAITLIST quando não há código de acesso; WAITLIST →
 * COMPLETE ao informar um código válido depois.)
 */

export const ONBOARDING_STATUSES = [
  "EMAIL_PENDING",
  "PHONE_PENDING",
  "PROFILE_PENDING",
  "ACCESS_PENDING",
  "WAITLIST",
  "COMPLETE",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
  phoneE164: text("phone_e164").unique(),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true, mode: "date" }),
  company: text("company"),
  jobTitle: text("job_title"),
  onboardingStatus: text("onboarding_status").notNull().default("EMAIL_PENDING"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true, mode: "date" }),
  privacyVersion: text("privacy_version"),
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

/** Códigos de verificação: somente hash. Nunca OTPs em claro. */
export const verificationTokens = pgTable("verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  purpose: text("purpose").notNull(), // EMAIL_VERIFY | LOGIN | RECOVERY
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

/** Auditoria de mudanças sensíveis. Apenas dados mascarados em detail. */
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

/** Eventos de produto não sensíveis. Nunca PII. */
export const productEvents = pgTable("product_events", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export type User = typeof users.$inferSelect;
