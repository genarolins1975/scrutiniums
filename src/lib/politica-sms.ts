import { parsePhoneNumberFromString, isSupportedCountry, type CountryCode } from "libphonenumber-js";
import { COUNTRIES } from "./phone";

/** Configuração exclusivamente do servidor. Vazio mantém somente o Brasil. */
export function paisesSmsPermitidos(configuracao = process.env.SMS_PAISES_PERMITIDOS): CountryCode[] {
  if (!configuracao?.trim()) return ["BR"];
  const codigos = configuracao.split(",").map((codigo) => codigo.trim().toUpperCase());
  // Erro de configuração fecha o envio; não amplia a lista silenciosamente.
  if (codigos.some((codigo) => !isSupportedCountry(codigo))) return [];
  return [...new Set(codigos)] as CountryCode[];
}

export function paisDoTelefone(e164: string): CountryCode | null {
  const numero = parsePhoneNumberFromString(e164);
  if (!numero?.isValid() || numero.number !== e164 || !numero.country) return null;
  return numero.country;
}

export function smsPermitido(e164: string): boolean {
  const pais = paisDoTelefone(e164);
  return pais !== null && paisesSmsPermitidos().includes(pais);
}

export function opcoesPaisSms() {
  const permitidos = new Set<string>(paisesSmsPermitidos());
  return COUNTRIES.filter((pais) => permitidos.has(pais.code));
}
