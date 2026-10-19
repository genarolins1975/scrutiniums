import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

/**
 * Modelo de dados da Scrutiniums (Drizzle ORM, dialeto PostgreSQL).
 * Decisão registrada em ARCHITECTURE.md: um único schema pg-core serve
 * PGlite (Postgres embarcado) em desenvolvimento e node-postgres em produção.
 * Máquina de estados do onboarding:
 * EMAIL_PENDING → PHONE_PENDING → PROFILE_PENDING → COMPLETE
 * (ACCESS_PENDING e WAITLIST são estados LEGADOS do acesso antecipado por
 * código, extinto; a migração de boot promove essas contas a COMPLETE.)
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
  /** CPF normalizado (11 dígitos). Finalidade única: uma conta por pessoa. Nunca exibido integralmente. */
  cpf: text("cpf").unique(),
  /**
   * Perfil de uso (PERFIS_USO em perfilOpcoes.ts), obrigatório no cadastro
   * desde 19/10/2026. Null nas contas anteriores, que continuam válidas.
   */
  perfilUso: text("perfil_uso"),
  /**
   * Perfil estruturado (allowlists em perfilOpcoes.ts; sem texto livre).
   * Tipo de instituição, área e cargo só nos perfis de uso profissionais;
   * null nos demais.
   */
  orgType: text("org_type"),
  orgArea: text("org_area"),
  orgRole: text("org_role"),
  uf: text("uf"),
  /** Hash scrypt da senha ("scrypt:N:r:p:salt:hash"); null em contas antigas sem senha. */
  passwordHash: text("password_hash"),
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

/** Sugestões enviadas pelos usuários; lidas no painel de administração. */
export const suggestions = pgTable("suggestions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  categoria: text("categoria").notNull(),
  texto: text("texto").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

/**
 * Assinaturas do resumo do crédito por e-mail, sem conta. Dupla confirmação:
 * nasce PENDENTE no formulário e só fica ATIVA pelo link enviado ao endereço.
 * O descadastro apaga a linha (nada a reter de quem saiu).
 */
export const assinaturasResumo = pgTable("assinaturas_resumo", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  periodicidade: text("periodicidade").notNull(),
  status: text("status").notNull(),
  consentimentoEm: timestamp("consentimento_em", { withTimezone: true, mode: "date" }).notNull(),
  confirmadaEm: timestamp("confirmada_em", { withTimezone: true, mode: "date" }),
  ultimoEnvioEm: timestamp("ultimo_envio_em", { withTimezone: true, mode: "date" }),
  ultimaEdicao: text("ultima_edicao"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

/**
 * Recortes salvos pela conta (Onda 2, "o que a conta precisa ganhar"): o
 * endereço interno da página com a consulta e a âncora, um título dado pela
 * pessoa e o observatório de origem. O link compartilhável é o próprio caminho;
 * quem não tem conta passa pelo login e volta a ele. Limite por conta em
 * src/lib/conta/recortes.ts.
 */
export const recortesSalvos = pgTable("recortes_salvos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  titulo: text("titulo").notNull(),
  caminho: text("caminho").notNull(),
  observatorio: text("observatorio").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true, mode: "date" }).notNull(),
});

/**
 * Alertas de atualização por domínio de dados (as fontes de src/lib/frescor/limiares.json).
 * `referenciaAvisada` guarda a data de referência que a pessoa já conhece: a do
 * momento da assinatura e, depois, a do último aviso. O envio só sai quando a
 * referência publicada avança (src/lib/conta/alertas.ts).
 */
export const alertasAtualizacao = pgTable("alertas_atualizacao", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  dominio: text("dominio").notNull(),
  referenciaAvisada: text("referencia_avisada"),
  ultimoEnvioEm: timestamp("ultimo_envio_em", { withTimezone: true, mode: "date" }),
  criadoEm: timestamp("criado_em", { withTimezone: true, mode: "date" }).notNull(),
});

export type User = typeof users.$inferSelect;
