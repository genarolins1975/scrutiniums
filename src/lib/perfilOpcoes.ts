/**
 * Opções estruturadas do perfil (onboarding e conta). Listas fechadas:
 * o preenchimento livre foi eliminado do cadastro — o servidor valida
 * contra estes mesmos valores (allowlist compartilhada, client-safe).
 */

export type Opcao = { value: string; label: string };

export const TIPOS_INSTITUICAO: Opcao[] = [
  { value: "banco", label: "Banco" },
  { value: "cooperativa", label: "Cooperativa de crédito" },
  { value: "fintech_ip", label: "Fintech / Instituição de pagamento" },
  { value: "gestora", label: "Gestora de recursos / Fundos" },
  { value: "seguradora", label: "Seguradora / Previdência" },
  { value: "consultoria", label: "Consultoria / Auditoria" },
  { value: "regulador", label: "Órgão público / Regulador" },
  { value: "academia", label: "Academia / Pesquisa" },
  { value: "imprensa", label: "Imprensa" },
  { value: "varejo_industria", label: "Varejo / Indústria / Serviços" },
  { value: "autonomo", label: "Autônomo / Pessoa física" },
  { value: "outra", label: "Outra" },
];

export const AREAS_ATUACAO: Opcao[] = [
  { value: "risco_credito", label: "Risco de crédito" },
  { value: "tesouraria", label: "Tesouraria / Mercado" },
  { value: "regulatorio", label: "Regulatório / Compliance" },
  { value: "produtos", label: "Produtos / Negócios" },
  { value: "dados", label: "Dados / Analytics" },
  { value: "pesquisa", label: "Pesquisa / Economia" },
  { value: "auditoria", label: "Auditoria / Controles internos" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "gestao", label: "Gestão executiva" },
  { value: "ensino", label: "Ensino / Estudo" },
  { value: "outra", label: "Outra" },
];

export const NIVEIS_CARGO: Opcao[] = [
  { value: "analista", label: "Analista" },
  { value: "especialista", label: "Especialista / Sênior" },
  { value: "coordenador", label: "Coordenador / Supervisor" },
  { value: "gerente", label: "Gerente" },
  { value: "superintendente", label: "Superintendente / Head" },
  { value: "diretor", label: "Diretor / C-level" },
  { value: "socio", label: "Sócio / Fundador" },
  { value: "conselheiro", label: "Conselheiro" },
  { value: "professor", label: "Professor / Pesquisador" },
  { value: "estudante", label: "Estudante" },
  { value: "outro", label: "Outro" },
];

export const UFS: Opcao[] = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
].map((uf) => ({ value: uf, label: uf }));
UFS.push({ value: "EX", label: "Exterior" });

const toSet = (ops: Opcao[]) => new Set(ops.map((o) => o.value));
export const TIPOS_SET = toSet(TIPOS_INSTITUICAO);
export const AREAS_SET = toSet(AREAS_ATUACAO);
export const NIVEIS_SET = toSet(NIVEIS_CARGO);
export const UFS_SET = toSet(UFS);

export function rotuloDe(ops: Opcao[], value: string | null | undefined): string {
  if (!value) return "—";
  return ops.find((o) => o.value === value)?.label ?? value;
}
