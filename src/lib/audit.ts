import { getDb, newId, schema } from "./db";

export type AuditAction =
  | "EMAIL_CHANGE_REQUESTED"
  | "EMAIL_CHANGED"
  | "PHONE_CHANGE_REQUESTED"
  | "PHONE_CHANGED"
  | "SESSION_REVOKED"
  | "PASSWORD_CHANGED"
  | "ACCOUNT_DELETED";

/** Auditoria de mudanças sensíveis. detail deve conter apenas dados mascarados. */
export async function audit(userId: string, action: AuditAction, detail?: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.auditLogs)
    .values({ id: newId(), userId, action, detail: detail ?? null, createdAt: new Date() });
}
