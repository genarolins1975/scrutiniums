/**
 * Administração da plataforma (server-only: lê process.env e nunca deve
 * ser importado por componente de cliente).
 *
 * ADMIN_EMAILS: lista de e-mails separada por vírgulas (ex.:
 * "dono@scrutiniums.com,socio@scrutiniums.com"). Comparação
 * case-insensitive com trim. Lista vazia ou ausente → ninguém é admin
 * (administração fechada por padrão).
 */

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

export function isAdmin(user: { email: string } | null | undefined): boolean {
  if (!user?.email) return false;
  return adminEmails().has(user.email.trim().toLowerCase());
}
