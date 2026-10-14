import type { SituacaoAgua, SituacaoEsgoto } from "./tipos";

export const SITUACAO_AGUA: Record<SituacaoAgua, string> = {
  participou: "Participou do módulo de água",
  nao_participou: "Não participou do módulo de água",
};

export const SITUACAO_ESGOTO: Record<SituacaoEsgoto, string> = {
  participou: "Participou, com indicadores de esgoto",
  delegacao_sem_atendimento: "Delegação sem atendimento: serviço delegado, sem rede em operação declarada",
  informacoes_sem_indicadores: "Informou dados sem indicadores calculados",
  nao_participou: "Não participou do módulo de esgoto",
};

/** Motivo publicado pelo SINISA para indicador sem valor. */
export const MOTIVO_TEXTO: Record<string, string> = {
  nao_calculado_divisao_zero: "Não calculado: divisão por zero",
  nao_calculado_condicoes: "Não calculado: condições da regra oficial não atendidas",
  nao_calculado_campos_vazios: "Não calculado: campos obrigatórios vazios",
  ver_prestador: "Consultar o dado por prestador",
  nao_informado: "Não informado",
};

export const NATUREZA_CURTA: Record<string, string> = {
  "Sociedade de economia mista": "Sociedade de economia mista (estatal com ações)",
  "Empresa privada": "Empresa privada",
  "Empresa pública": "Empresa pública",
  Autarquia: "Autarquia",
  Município: "Administração direta municipal",
  "Associação privada": "Associação privada (inclui modelos comunitários)",
};
