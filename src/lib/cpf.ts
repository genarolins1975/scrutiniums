/**
 * CPF: normalização, validação (dígitos verificadores) e mascaramento.
 * O CPF existe na plataforma com uma única finalidade: garantir uma conta
 * por pessoa. NUNCA é exibido integralmente, NUNCA é logado e NUNCA é
 * enviado a analytics. Exibição sempre via maskCpf.
 */

/** Remove tudo que não é dígito. */
export function normalizeCpf(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Formata para exibição durante a digitação: 000.000.000-00. */
export function formatCpf(value: string): string {
  const d = normalizeCpf(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Validação completa: 11 dígitos, não repetidos, DVs corretos. */
export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 000..., 111..., etc.
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i], 10) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return dv(9) === parseInt(cpf[9], 10) && dv(10) === parseInt(cpf[10], 10);
}

/** Exibição mascarada: •••.456.789-•• (mantém o miolo para reconhecimento). */
export function maskCpf(value: string | null | undefined): string {
  const cpf = normalizeCpf(value ?? "");
  if (cpf.length !== 11) return "—";
  return `•••.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-••`;
}
