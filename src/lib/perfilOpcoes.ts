/**
 * Opções estruturadas do perfil (onboarding e conta). Listas fechadas:
 * o preenchimento livre foi eliminado do cadastro — o servidor valida
 * contra estes mesmos valores (allowlist compartilhada, client-safe).
 *
 * Valores já gravados no banco nunca saem das listas: uma revisão pode
 * reescrever o rótulo (sem mudar o sentido) e acrescentar opções, nunca
 * remover ou renomear o `value`.
 */

export type Opcao = { value: string; label: string };

/**
 * Perfil de uso (decisão do dono de 19/10/2026, docs/BANCA_2026-10-19.md):
 * obrigatório no cadastro. Contas anteriores a ele ficam sem valor (null) e
 * continuam válidas.
 */
export const PERFIS_USO: Opcao[] = [
  { value: "cidadao", label: "Cidadão" },
  { value: "estudante", label: "Estudante" },
  { value: "imprensa", label: "Imprensa" },
  { value: "pesquisa_academica", label: "Pesquisa acadêmica" },
  { value: "setor_publico", label: "Setor público" },
  { value: "mercado_financeiro", label: "Mercado financeiro" },
  { value: "empresa", label: "Empresa" },
  { value: "outro", label: "Outro" },
];

/** Perfis de uso que pedem tipo de instituição, área e cargo. */
export const PERFIS_PROFISSIONAIS: ReadonlySet<string> = new Set([
  "pesquisa_academica",
  "setor_publico",
  "mercado_financeiro",
  "empresa",
]);

export function ehPerfilProfissional(perfilUso: unknown): boolean {
  return typeof perfilUso === "string" && PERFIS_PROFISSIONAIS.has(perfilUso);
}

export const TIPOS_INSTITUICAO: Opcao[] = [
  { value: "banco", label: "Banco" },
  { value: "cooperativa", label: "Cooperativa de crédito" },
  { value: "fintech_ip", label: "Fintech ou instituição de pagamento" },
  { value: "gestora", label: "Gestora de investimentos ou fundos" },
  { value: "seguradora", label: "Seguradora ou previdência" },
  { value: "consultoria", label: "Consultoria ou auditoria" },
  { value: "regulador", label: "Órgão público ou agência reguladora" },
  { value: "estatal", label: "Empresa estatal" },
  { value: "academia", label: "Universidade ou centro de pesquisa" },
  { value: "escola", label: "Escola" },
  { value: "imprensa", label: "Imprensa" },
  { value: "energia_saneamento", label: "Empresa de energia, gás ou saneamento" },
  { value: "varejo_industria", label: "Comércio, indústria ou serviços" },
  { value: "terceiro_setor", label: "Organização da sociedade civil (ONG, associação)" },
  { value: "autonomo", label: "Autônomo ou por conta própria" },
  { value: "outra", label: "Outra" },
];

export const AREAS_ATUACAO: Opcao[] = [
  { value: "risco_credito", label: "Risco de crédito" },
  { value: "tesouraria", label: "Tesouraria e investimentos" },
  { value: "regulatorio", label: "Regulação e conformidade (compliance)" },
  { value: "produtos", label: "Produtos e negócios" },
  { value: "financeiro", label: "Finanças e contabilidade" },
  { value: "orcamento_publico", label: "Orçamento e finanças públicas" },
  { value: "politicas_publicas", label: "Políticas públicas e planejamento" },
  { value: "dados", label: "Dados e análise" },
  { value: "pesquisa", label: "Pesquisa e economia" },
  { value: "auditoria", label: "Auditoria e controle interno" },
  { value: "juridico", label: "Jurídico" },
  { value: "comunicacao", label: "Comunicação e jornalismo" },
  { value: "atendimento", label: "Atendimento e operações" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "gestao", label: "Direção e gestão" },
  { value: "ensino", label: "Ensino ou estudo" },
  { value: "outra", label: "Outra" },
];

export const NIVEIS_CARGO: Opcao[] = [
  { value: "estagiario", label: "Estagiário ou trainee" },
  { value: "assistente", label: "Assistente ou auxiliar" },
  { value: "analista", label: "Analista" },
  { value: "especialista", label: "Especialista ou sênior" },
  { value: "coordenador", label: "Coordenador ou supervisor" },
  { value: "gerente", label: "Gerente" },
  { value: "superintendente", label: "Superintendente ou chefe de área" },
  { value: "diretor", label: "Diretor ou presidente" },
  { value: "socio", label: "Sócio ou fundador" },
  { value: "conselheiro", label: "Conselheiro" },
  { value: "professor", label: "Professor ou pesquisador" },
  { value: "estudante", label: "Estudante" },
  { value: "outro", label: "Outro" },
];

export const UFS: Opcao[] = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
].map((uf) => ({ value: uf, label: uf }));
UFS.push({ value: "EX", label: "Exterior" });

const toSet = (ops: Opcao[]) => new Set(ops.map((o) => o.value));
export const PERFIS_USO_SET = toSet(PERFIS_USO);
export const TIPOS_SET = toSet(TIPOS_INSTITUICAO);
export const AREAS_SET = toSet(AREAS_ATUACAO);
export const NIVEIS_SET = toSet(NIVEIS_CARGO);
export const UFS_SET = toSet(UFS);

export function rotuloDe(ops: Opcao[], value: string | null | undefined): string {
  if (!value) return "—";
  return ops.find((o) => o.value === value)?.label ?? value;
}

// ------------------------------------------------ regra única do perfil

/** Campos do perfil como chegam do formulário ou de um corpo JSON qualquer. */
export type EntradaPerfil = {
  perfilUso?: unknown;
  orgType?: unknown;
  orgArea?: unknown;
  orgRole?: unknown;
  uf?: unknown;
};

export type CampoPerfil = "perfilUso" | "orgType" | "orgArea" | "orgRole" | "uf";

/** Perfil pronto para gravar: campos profissionais nulos fora dos perfis profissionais. */
export type PerfilNormalizado = {
  perfilUso: string;
  orgType: string | null;
  orgArea: string | null;
  orgRole: string | null;
  uf: string;
};

export const MENSAGENS_PERFIL: Record<CampoPerfil, string> = {
  perfilUso: "Escolha como você vai usar a plataforma.",
  orgType: "Selecione o tipo de instituição.",
  orgArea: "Selecione sua área de atuação.",
  orgRole: "Selecione seu nível de cargo.",
  uf: "Selecione sua UF.",
};

const pertence = (set: Set<string>, v: unknown): v is string => typeof v === "string" && set.has(v);

/**
 * Regra única do perfil, usada pelo formulário e pelas rotas de API:
 * perfil de uso e UF sempre obrigatórios; tipo de instituição, área e
 * cargo obrigatórios só nos perfis profissionais. Devolve os campos com
 * erro (objeto vazio quando o perfil é válido).
 */
export function errosPerfil(d: EntradaPerfil): Partial<Record<CampoPerfil, string>> {
  const erros: Partial<Record<CampoPerfil, string>> = {};
  if (!pertence(PERFIS_USO_SET, d.perfilUso)) erros.perfilUso = MENSAGENS_PERFIL.perfilUso;
  if (ehPerfilProfissional(d.perfilUso)) {
    if (!pertence(TIPOS_SET, d.orgType)) erros.orgType = MENSAGENS_PERFIL.orgType;
    if (!pertence(AREAS_SET, d.orgArea)) erros.orgArea = MENSAGENS_PERFIL.orgArea;
    if (!pertence(NIVEIS_SET, d.orgRole)) erros.orgRole = MENSAGENS_PERFIL.orgRole;
  }
  if (!pertence(UFS_SET, d.uf)) erros.uf = MENSAGENS_PERFIL.uf;
  return erros;
}

/**
 * Perfil a gravar, ou null quando inválido. Fora dos perfis profissionais,
 * tipo de instituição, área e cargo viram null mesmo que o corpo os traga:
 * o servidor não grava o que o formulário não pergunta.
 */
export function normalizarPerfil(d: EntradaPerfil): PerfilNormalizado | null {
  if (Object.keys(errosPerfil(d)).length) return null;
  const profissional = ehPerfilProfissional(d.perfilUso);
  return {
    perfilUso: d.perfilUso as string,
    orgType: profissional ? (d.orgType as string) : null,
    orgArea: profissional ? (d.orgArea as string) : null,
    orgRole: profissional ? (d.orgRole as string) : null,
    uf: d.uf as string,
  };
}

/** Corpo que o formulário envia: os campos profissionais só vão quando o perfil de uso os pede. */
export function corpoPerfil(d: { perfilUso: string; orgType: string; orgArea: string; orgRole: string; uf: string }): Record<string, string> {
  return ehPerfilProfissional(d.perfilUso)
    ? { perfilUso: d.perfilUso, orgType: d.orgType, orgArea: d.orgArea, orgRole: d.orgRole, uf: d.uf }
    : { perfilUso: d.perfilUso, uf: d.uf };
}
