import { parsePhoneNumberFromString, isSupportedCountry, getCountries, getCountryCallingCode, CountryCode } from "libphonenumber-js";

/**
 * Normaliza país + telefone digitado para E.164.
 * Retorna null quando o número não é válido para o país.
 */
export function toE164(country: string, rawPhone: string): string | null {
  if (!isSupportedCountry(country.toUpperCase())) return null;
  const parsed = parsePhoneNumberFromString(rawPhone, { defaultCountry: country.toUpperCase() as CountryCode, extract: false });
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format("E.164");
}

export type PaisTelefone = Readonly<{ code: string; ddi: string; name: string }>;

function listarPaises(locale: "pt-BR" | "en"): readonly PaisTelefone[] {
  const nomes = new Intl.DisplayNames([locale], { type: "region" });
  return Object.freeze(getCountries()
    .map((code) => ({ code, ddi: "+" + getCountryCallingCode(code), name: nomes.of(code) ?? code }))
    .sort((a, b) => a.code === "BR" ? -1 : b.code === "BR" ? 1 : a.name.localeCompare(b.name, locale)));
}
/** Todos os países reconhecidos; a oferta de SMS é filtrada no servidor. */
export const COUNTRIES: readonly PaisTelefone[] = listarPaises("pt-BR");
/** Mesma lista com os nomes em inglês, para as páginas /en. */
export const COUNTRIES_EN: readonly PaisTelefone[] = listarPaises("en");
