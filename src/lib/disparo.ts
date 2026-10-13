import { timingSafeEqual } from "node:crypto";

/**
 * Autorização dos disparos agendados (boletim mensal e resumo por e-mail):
 * `Authorization: Bearer ${BOLETIM_SECRET}`, com no mínimo 16 caracteres.
 * Sem o segredo configurado, nenhum Bearer é aceito.
 */
export function bearerDisparoValido(req: Request): boolean {
  const segredo = process.env.BOLETIM_SECRET;
  if (!segredo || segredo.length < 16) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const a = Buffer.from(auth.slice("Bearer ".length), "utf-8");
  const b = Buffer.from(segredo, "utf-8");
  return a.length === b.length && timingSafeEqual(a, b);
}
