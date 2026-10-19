import { isValidCpf } from "@/lib/cpf";
import { errosPerfil } from "@/lib/perfilOpcoes";

/**
 * Regras do formulário da etapa 3, puras para teste: senha (8 a 72
 * caracteres, digitada uma vez), CPF quando exigido e a regra única do
 * perfil (errosPerfil), a mesma que o servidor aplica.
 */
export function errosPerfilForm(d: {
  password: string;
  cpf: string;
  exigeCpf: boolean;
  perfilUso: string;
  orgType: string;
  orgArea: string;
  orgRole: string;
  uf: string;
}): Record<string, string | undefined> {
  const senhaOk = d.password.length >= 8 && d.password.length <= 72;
  return {
    password: senhaOk ? undefined : "A senha deve ter entre 8 e 72 caracteres.",
    cpf: !d.exigeCpf || isValidCpf(d.cpf) ? undefined : "CPF inválido. Confira os dígitos.",
    ...errosPerfil(d),
  };
}
