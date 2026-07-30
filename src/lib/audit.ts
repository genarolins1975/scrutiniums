import { db, newId, schema } from "./db";

export type AuditAction =
  | "EMAIL_CHANGE_REQUESTED"
  | "EMAIL_CHANGED"
  | "PHONE_CHANGE_REQUESTED"
  | "PHONE_CHANGED"
  | "SESSION_REVOKED"
  | "ACCOUNT_DELETED";

/** Auditoria de mudanças sensíveis. detail deve conter apenas dados mascarados. */
export function audit(userId: string, action: AuditAction, detail?: string): void {
  db.insert(schema.auditLogs)
    .values({ id: newId(), userId, action, detail: detail ?? null, createdAt: new Date() })
    .run();
}
