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
  | "INDISPONIVEL_TEMPORARIAMENTE";

export type EstadoPublicacao = "PUBLICAVEL" | "PUBLICAVEL_COM_RESSALVAS" | "NAO_PUBLICAVEL";

export type IndicadorId =
  | "edu.despesa.funcao_educacao"
  | "edu.despesa.subfuncao"
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
  familia: "recursos" | "atendimento" | "resultado";
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
  versao_metodologica: string;
  estado: EstadoPublicacao;
  ressalvas: string[];
  motivo_nao_publicacao?: string[];
  granularidade: { etapa: boolean; anos: "exercicios" | "censo" | "edicoes_ideb" };
  download: string | null;
};

export type ConferenciaRreo = {
  situacao: "confere" | "diferenca_menor" | "diverge" | "inclui_intra" | "sem_rreo";
  comparavel: boolean;
  rreo?: number;
  rreo_intra?: number;
  diferenca?: number;
  diferenca_pct?: number;
  explicacao?: string;
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
  fonte: string;
  registro: string;
  participacao?: number | null;
  escolas?: number;
  fator_ipca?: number;
  conferencia_rreo?: ConferenciaRreo;
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
  resultado: "aprovada" | "aprovada_com_divergencias_documentadas" | "reprovada" | "medicao";
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
  sem_valor: { ente: number; nome: string; status: StatusDado }[];
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
  trilhas: Trilha[];
  fontes: Fonte[];
  status: Record<StatusDado, string>;
  observacoes: Observacao[];
};
