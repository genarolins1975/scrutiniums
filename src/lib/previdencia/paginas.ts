/**
 * Painel "Previdência e INSS" (Observatório das Contas Públicas, coleção Contas Federais; aprovado pelo dono em
 * 20/10/2026): fonte única de rota, títulos, pergunta, seção de telemetria e nomes de exibição. Registro, navegação,
 * vitrine, camada aberta, "Para você", sitemap e páginas leem daqui.
 *
 * Princípio do aperitivo: o endereço público /contas-publicas/previdencia serve, sem sessão, a versão aperitivo
 * (src/app/aperitivo/previdencia, por rewrite do middleware) e, com sessão, o painel completo
 * (src/app/contas-publicas/previdencia). APERITIVOS em src/lib/rotasPublicas.ts declara as duas.
 *
 * O painel mantém pipeline e gold próprios (pipeline/previdencia, public/previdencia/gold) e a fonte de frescor
 * "previdencia" (src/lib/frescor/limiares.json). Nomes de exibição sem hífen: a plataforma não usa hífen como pontuação.
 */
import type { CampoQ, CampoV, IdEspecieAeps, IdTipo } from "./tipos";

export const ROTA_PREVIDENCIA = "/contas-publicas/previdencia";
export const VERSAO_ABERTA = "/aperitivo/previdencia";
export const TITULO_PAINEL = "Previdência e INSS";
export const ROTULO_NAVEGACAO = "Previdência e INSS";
export const PERGUNTA_PAINEL = "Quanto o INSS paga, a quem e onde?";
export const PERGUNTA_APERITIVO = "Quanto o INSS paga na minha cidade?";
export const SECAO_PAINEL = "contas:previdencia";
export const SECAO_APERITIVO = "contas:previdencia-aperitivo";

/** Endereço público com o município escolhido (a busca e a volta do login usam o mesmo). */
export const hrefMunicipio = (ibge: string) => `${ROTA_PREVIDENCIA}?ibge=${ibge}`;

/** Arquivos para baixar, servidos por rotas com conta ao lado do painel. */
export const DOWNLOADS = [
  { arquivo: "beneficios-por-municipio.csv", rotulo: "Benefícios por município, dezembro de cada ano", descricao: "Quantidade e valor líquido por grupo de espécie, município a município" },
  { arquivo: "beneficios-por-estado.csv", rotulo: "Benefícios por estado", descricao: "Os dezembros do arquivo municipal somados por UF e o mês mais recente do BEPS (Regime Geral)" },
  { arquivo: "beneficios-brasil-mensal.csv", rotulo: "Benefícios no Brasil, mês a mês", descricao: "Quantidade e valor por grande grupo, da série do BEPS" },
  { arquivo: "resultado-rgps.csv", rotulo: "Resultado do Regime Geral, ano a ano", descricao: "Arrecadação, benefícios, necessidade de financiamento, BPC e PIB, do Resultado do Tesouro Nacional" },
  { arquivo: "anuario-inss.csv", rotulo: "Concessões, valor do ano e atendimento, do Anuário", descricao: "As sete tabelas do Anuário Estatístico da Previdência Social usadas no painel, valor a valor, com a linha e a coluna da fonte, e o atendimento e a rede das edições anteriores" },
] as const;

/** O estado com a preposição certa ("do Maranhão", "de São Paulo", "da Bahia"), pela sigla. */
export const DO_ESTADO: Record<string, string> = {
  AC: "do Acre", AL: "de Alagoas", AP: "do Amapá", AM: "do Amazonas", BA: "da Bahia", CE: "do Ceará", DF: "do Distrito Federal",
  ES: "do Espírito Santo", GO: "de Goiás", MA: "do Maranhão", MT: "de Mato Grosso", MS: "de Mato Grosso do Sul", MG: "de Minas Gerais",
  PA: "do Pará", PB: "da Paraíba", PR: "do Paraná", PE: "de Pernambuco", PI: "do Piauí", RJ: "do Rio de Janeiro", RN: "do Rio Grande do Norte",
  RS: "do Rio Grande do Sul", RO: "de Rondônia", RR: "de Roraima", SC: "de Santa Catarina", SP: "de São Paulo", SE: "de Sergipe", TO: "do Tocantins",
};

/** Nomes dos tipos da tabela 15 do BEPS para leitura leiga; o rótulo da fonte fica na gold (rotulo_fonte). */
export const NOME_TIPO: Record<IdTipo, string> = {
  total: "Todos os benefícios do INSS",
  rgps: "Regime Geral (RGPS)",
  previdenciarios: "Previdenciários",
  aposentadorias: "Aposentadorias",
  apo_idade: "Aposentadoria por idade",
  apo_invalidez: "Aposentadoria por invalidez",
  apo_tempo: "Aposentadoria por tempo de contribuição",
  pensoes: "Pensão por morte",
  auxilios: "Auxílios",
  aux_doenca: "Auxílio doença",
  aux_acidente: "Auxílio acidente",
  aux_reclusao: "Auxílio reclusão",
  salario_maternidade: "Salário maternidade",
  prev_outros: "Outros previdenciários",
  acidentarios: "Por acidente de trabalho",
  acid_apo_invalidez: "Aposentadoria por invalidez",
  acid_pensao: "Pensão por morte",
  acid_aux_doenca: "Auxílio doença",
  acid_aux_acidente: "Auxílio acidente",
  acid_aux_suplementar: "Auxílio suplementar",
  assistenciais: "Assistenciais",
  loas: "Benefício de Prestação Continuada (BPC)",
  loas_idoso: "BPC da pessoa idosa",
  loas_deficiencia: "BPC da pessoa com deficiência",
  loas_outros: "Outros assistenciais",
  rmv: "Renda mensal vitalícia",
  rmv_idade: "Renda mensal vitalícia por idade",
  rmv_invalidez: "Renda mensal vitalícia por invalidez",
  ble: "Legislação específica",
};

/** Os grupos do arquivo municipal, na ordem da gold. */
export const NOME_GRUPO_Q: Record<CampoQ, string> = {
  total: "Todos os benefícios",
  previdenciarios: "Previdenciários (Regime Geral)",
  aposentadorias: "Aposentadorias",
  apo_idade: "Por idade",
  apo_invalidez: "Por invalidez",
  apo_tempo: "Por tempo de contribuição",
  pensoes: "Pensões por morte",
  auxilios: "Auxílios",
  outros_prev: "Outros previdenciários",
  assistenciais: "Assistenciais e de legislação específica",
};

export const NOME_GRUPO_V: Record<CampoV, string> = {
  total: "Todos os benefícios",
  aposentadorias: "Aposentadorias",
  pensoes: "Pensões por morte",
  auxilios: "Auxílios",
  outros_prev: "Outros previdenciários",
  assistenciais: "Assistenciais e de legislação específica",
};

/** Grupos de espécie do Anuário (AEPS) para leitura leiga; o rótulo da fonte fica na gold (rotulo_fonte). */
export const NOME_ESPECIE_AEPS: Record<IdEspecieAeps, string> = {
  total: "Todos os benefícios",
  rgps: "Regime Geral (RGPS)",
  previdenciarios: "Previdenciários",
  aposentadorias: "Aposentadorias",
  apo_tempo: "Aposentadoria por tempo de contribuição",
  apo_idade: "Aposentadoria por idade",
  apo_invalidez: "Aposentadoria por invalidez",
  pensoes: "Pensão por morte",
  auxilios: "Auxílios",
  aux_doenca: "Auxílio doença",
  aux_reclusao: "Auxílio reclusão",
  aux_acidente: "Auxílio acidente",
  salario_maternidade: "Salário maternidade",
  prev_outros: "Outros previdenciários",
  salario_familia: "Salário família",
  abono_permanencia: "Abono de permanência",
  vantagem_servidor: "Vantagem de servidor",
  acidentarios: "Por acidente de trabalho",
  acid_apo_invalidez: "Aposentadoria por invalidez (acidente de trabalho)",
  acid_pensao: "Pensão por morte (acidente de trabalho)",
  acid_auxilios: "Auxílios (acidente de trabalho)",
  acid_aux_doenca: "Auxílio doença (acidente de trabalho)",
  acid_aux_acidente: "Auxílio acidente (acidente de trabalho)",
  acid_aux_suplementar: "Auxílio suplementar (acidente de trabalho)",
  assistenciais: "Assistenciais",
  bpc: "Benefício de Prestação Continuada (BPC)",
  bpc_deficiencia: "BPC da pessoa com deficiência",
  bpc_idoso: "BPC da pessoa idosa",
  pmv: "Pensão mensal vitalícia",
  rmv: "Renda mensal vitalícia",
  rmv_invalidez: "Renda mensal vitalícia por invalidez",
  rmv_idade: "Renda mensal vitalícia por idade",
  epu: "Encargos previdenciários da União (EPU)",
};

/** Os três grandes grupos do Anuário: o que o BEPS chama de legislação específica aparece aqui separado. */
export const GRANDES_GRUPOS_AEPS = ["rgps", "assistenciais", "epu"] as const satisfies readonly IdEspecieAeps[];
