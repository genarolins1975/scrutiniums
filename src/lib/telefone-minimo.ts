/**
 * Conferência mínima no navegador antes de pedir o SMS. Só barra o que
 * certamente não é telefone: a validade por país fica com o servidor
 * (toE164, libphonenumber), que conhece numerações nacionais de sete dígitos
 * ou menos, como a da Islândia. O Brasil mantém o mínimo de oito dígitos.
 */
export function digitosMinimosTelefone(pais: string): number {
  return pais.toUpperCase() === "BR" ? 8 : 4;
}
