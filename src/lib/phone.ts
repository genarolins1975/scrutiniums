import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

/**
 * Normaliza país + telefone digitado para E.164.
 * Retorna null quando o número não é válido para o país.
 */
export function toE164(country: string, rawPhone: string): string | null {
  const parsed = parsePhoneNumberFromString(rawPhone, country as CountryCode);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format("E.164");
}

export const COUNTRIES = [
  { code: "BR", ddi: "+55", name: "Brasil" },
  { code: "PT", ddi: "+351", name: "Portugal" },
  { code: "US", ddi: "+1", name: "Estados Unidos" },
  { code: "AR", ddi: "+54", name: "Argentina" },
  { code: "CL", ddi: "+56", name: "Chile" },
  { code: "CO", ddi: "+57", name: "Colômbia" },
  { code: "MX", ddi: "+52", name: "México" },
  { code: "GB", ddi: "+44", name: "Reino Unido" },
  { code: "ES", ddi: "+34", name: "Espanha" },
  { code: "FR", ddi: "+33", name: "França" },
  { code: "DE", ddi: "+49", name: "Alemanha" },
  { code: "IT", ddi: "+39", name: "Itália" },
] as const;
