import { parsePhoneNumberFromString } from "libphonenumber-js";

/** null impede concluir o perfil sem prova de posse de um telefone canônico. */
export function cpfObrigatorioParaTelefone(user: {
  phoneE164: string | null;
  phoneVerifiedAt: Date | null;
}): boolean | null {
  if (!user.phoneE164 || !user.phoneVerifiedAt || !Number.isFinite(user.phoneVerifiedAt.getTime())) return null;
  const telefone = parsePhoneNumberFromString(user.phoneE164);
  if (!telefone?.isValid() || telefone.number !== user.phoneE164 || !telefone.country) return null;
  return telefone.countryCallingCode === "55";
}
