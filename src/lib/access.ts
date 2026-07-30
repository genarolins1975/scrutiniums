/**
 * Códigos de acesso do acesso antecipado (server-only: lê process.env e
 * nunca deve ser importado por componente de cliente — os códigos jamais
 * chegam ao navegador).
 *
 * ACCESS_CODES: lista separada por vírgulas (ex.: "SCRUT-2026,CONVIDADO-01").
 * Comparação case-insensitive com trim. Lista vazia ou ausente → nenhum
 * código é válido (acesso fechado por padrão).
 */

function validCodes(): Set<string> {
  const raw = process.env.ACCESS_CODES ?? "";
  return new Set(
    raw
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length > 0),
  );
}

export function isValidAccessCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  return validCodes().has(normalized);
}
