/**
 * Tipos do domínio OBEE (Observatório Brasileiro de Eficiência Estatal).
 * Espelham public/eficiencia/gold/educacao_capitais.json, escrita por
 * pipeline/eficiencia/gold.py.
 */

export type StatusDado =
  | "OBSERVADO"
  | "NAO_APLICAVEL"
  | "NAO_DIVULGADO"
  | "AUSENTE_NA_COLETA"
  | "DESATUALIZADO"
  | "INCONSISTENTE"
  | "NAO_COMPARAVEL"
  | "INCOMPLETO"
  | "INDISPONIVEL_TEMPORARIAMENTE";

export type EstadoPublicacao = "PUBLICAVEL" | "PUBLICAVEL_COM_RESSALVAS" | "NAO_PUBLICAVEL";

export type IndicadorId =
  | "ctx.populacao.residente"
  | "edu.despesa.funcao_educacao"
  | "edu.despesa.subfuncao"
  | "edu.despesa.por_habitante"
  | "edu.despesa.por_matricula_rede_propria"
  | "edu.despesa.ponte_matricula"
  | "edu.matriculas.rede_municipal"
  | "edu.matriculas.conveniadas_municipais"
  | "edu.atu.rede_municipal"
  | "edu.aprovacao.rede_municipal"
  | "edu.ideb.rede_municipal"
  | "edu.saeb.rede_municipal"
  | "edu.despesa_por_matricula";

export type EtapaId =
  | "total"
  | "creche"
  | "pre_escola"
  | "anos_iniciais"
  | "anos_finais"
  | "ensino_medio"
  | "eja"
  | "profissional";

export type FichaIndicador = {
  id: IndicadorId;
  nome: string;
  nome_curto: string;
  familia: "recursos" | "atendimento" | "resultado" | "contexto";
  pergunta: string;
  o_que_mede: string;
  o_que_nao_mede: string[];
  formula: string;
  numerador: string | null;
  denominador: string | null;
  unidade: string;
  escala: string;
  fontes: string[];
  localizacao_registro: string;
  periodo: string;
  perimetro: { territorial: string; institucional: string; servico: string };
  ausencias: string;
  transformacoes: string[];
  correcao_monetaria: string;
  comparacao: string;
  natureza: "OBSERVADO" | "CALCULADO";
  universo_curto: string;
  universo_rotulo: string;
  versao_metodologica: string;
  estado: EstadoPublicacao;
  ressalvas: string[];
  motivo_nao_publicacao?: string[];
  granularidade: { etapa: boolean; anos: "exercicios" | "censo" | "edicoes_ideb" };
  download: string | null;
};

export type SituacaoConferencia = "CONFERE" | "DIFERENCA_MENOR" | "RECONCILIADA_MSC" | "PERIMETRO_INTRA_MSC" | "PENDENTE" | "NAO_CONFERIDO";

export type Conferencia = {
  versao_politica: string;
  situacao: SituacaoConferencia;
  rotulo: string;
  elegivel_comparacao: boolean;
  quebra_serie: boolean;
  motivo_inelegibilidade: string | null;
  explicacao: string;
  rreo: { exceto_intra: number; intra: number | null } | null;
  msc: { liquidado_total: number; intra_mod91: number; sem_intra: number } | null;
  diferenca: number | null;
  diferenca_pct_dca: number | null;
  evidencias: string[];
  fontes_sha256: { dca: string | null; rreo: string | null; msc: string | null };
};

export type Observacao = {
  indicador: IndicadorId;
  ente: number;
  ano: number;
  etapa: EtapaId | null;
  componente: string | null;
  valor: number | null;
  status: StatusDado;
  nota: string | null;
  nota_material: boolean;
  elegivel_comparacao: boolean;
  fonte: string;
  registro: string;
  participacao?: number | null;
  escolas?: number;
  escolas_sem_contagem?: number;
  fator_ipca?: number;
  conferencia?: Conferencia;
  quebra_serie?: boolean;
  tipo_populacao?: string | null;
  data_referencia?: string | null;
  publicacao_original?: number | null;
  calculo?: { numerador: number; denominador: number; numerador_ref: string; denominador_ref: string; numerador_componente?: string; dca_total?: number };
};

/** Estatísticas do grupo de capitais (pipeline/eficiencia/referencias.py): uma única regra para cartões, gráficos, tabela e downloads. */
export type ReferenciaGrupo = {
  indicador: IndicadorId;
  componente: string | null;
  etapa: EtapaId | null;
  ano: number;
  grupo: "todas" | "N" | "NE" | "SE" | "S" | "CO";
  capitais_no_grupo: number;
  capitais_com_valor: number;
  n: number;
  media: number | null;
  mediana: number | null;
  minimo: number | null;
  maximo: number | null;
  q1: number | null;
  q3: number | null;
  capitais_minimo: number[];
  capitais_maximo: number[];
  quartis_exibicao: boolean;
  soma_numerador: number | null;
  soma_denominador: number | null;
  razao_agregada: number | null;
  pares: number[];
};

export type TipoReferencia = "nacional_mesmo_universo" | "nacional_outro_universo" | "internacional_contexto" | "incompativel";

export type ReferenciaExterna = {
  id: string;
  indicador: IndicadorId;
  componente: string | null;
  etapa: EtapaId | null;
  ano: number;
  tipo: "nacional_mesmo_universo" | "nacional_outro_universo";
  rotulo: string;
  valor: number;
  unidade: string;
  unidade_diferenca: string | null;
  escopo: string;
  fonte: string;
  registro: string;
};

export type InternacionalGrupo = {
  conjunto: "ocde_tamanho_turma" | "ocde_despesa_por_estudante";
  nome: string;
  nivel: string;
  etapa: EtapaId | null;
  instituicoes: "publicas" | "todas";
  ano: number;
  unidade: string;
  brasil: number | null;
  media_ocde_publicada: number | null;
  paises: { codigo: string; nome: string; valor: number }[];
  paises_com_dado: number;
  agregados_na_fonte: string[];
  fonte: string;
};

export type LinhaMatriz = {
  id: string;
  indicador: IndicadorId;
  candidata: string;
  fonte: string;
  universo: string;
  unidade: string;
  periodo: string;
  metodo: string;
  compatibilidade: string;
  tipo: TipoReferencia;
  uso: string;
  decisao: string;
};

export type Capital = {
  id: string;
  cod_ibge: number;
  nome: string;
  uf: string;
  regiao: "N" | "NE" | "SE" | "S" | "CO";
  tipo_ente: string;
  rede: string;
};

export type Validacao = {
  id: string;
  titulo: string;
  tipo: "automatica" | "medicao";
  resultado: "aprovada" | "aprovada_com_divergencias_documentadas" | "regra_aplicada_com_pendencias" | "reprovada" | "medicao";
  detalhe: string;
  casos: Record<string, unknown>[];
};

export type Captura = {
  chave: string;
  instituicao: string;
  conjunto: string;
  pagina: string;
  url: string;
  capturado_em: string;
  publicado_em?: string;
  sha256_original?: string;
  sha256_recorte?: string;
  md5_publicado_inep?: string | null;
  md5_conferido?: string;
  recorte?: string;
  parametros?: string;
  linhas_recorte?: number;
  arquivos_capturados?: number;
  arquivos_com_erro?: number;
  notas_da_fonte?: string[];
};

export type Fonte = { id: string; papel: string; capturas: Captura[] };

export type LinhaCobertura = {
  ano: number;
  etapa: EtapaId | null;
  elegiveis: number;
  com_valor: number;
  comparaveis: number;
  sem_valor: { ente: number; nome: string; status: StatusDado }[];
  fora_da_comparacao: { ente: number; nome: string }[];
};

export type Trilha = { indicador: IndicadorId; ente: number; nome: string; ano: number; passos: string[]; valor: number };

export type GoldEducacao = {
  meta: {
    dominio: string;
    painel: string;
    versao_pipeline: string;
    versao_catalogo: string;
    versao_codigo: string | null;
    gerado_em: string;
    dados_capturados_ate: string;
    hash_dados: string;
    observacoes: number;
  };
  politica_conferencia: {
    versao: string;
    tolerancia_arredondamento_reais: number;
    tolerancia_relativa: number;
    elegiveis: SituacaoConferencia[];
    rotulos: Record<SituacaoConferencia, string>;
  };
  painel: { id: string; titulo: string; frase: string; rede: string };
  universo: {
    capitais: Capital[];
    excluidos: { cod_ibge: number; nome: string; uf: string; tipo_ente: string; motivo: string }[];
    regioes: Record<string, string>;
  };
  periodos: { financeiros: number[]; censo: number[]; ideb: number[] };
  etapas: { id: EtapaId; nome: string }[];
  subfuncoes: Record<string, string>;
  ipca: { fatores_para_2025: Record<string, number>; media_anual_numero_indice: Record<string, number> };
  indicadores: FichaIndicador[];
  cobertura: Partial<Record<IndicadorId, LinhaCobertura[]>>;
  validacoes: Validacao[];
  referencias: ReferenciaGrupo[];
  politica_referencias: { versao: string; media: string; razao_agregada: string; mediana: string; quartis: string; limiar_quartis: number; limiar_quartis_nota: string; empates: string; elegibilidade: string; precisao: string; nacional: string };
  referencias_externas: ReferenciaExterna[];
  referencias_internacionais: InternacionalGrupo[];
  matriz_referencias: LinhaMatriz[];
  trilhas: Trilha[];
  fontes: Fonte[];
  status: Record<StatusDado, string>;
  observacoes: Observacao[];
};
