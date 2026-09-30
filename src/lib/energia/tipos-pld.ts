/**
 * Tipos da gold do módulo PLD (detalhe) (public/energia/gold/pld_detalhe.json), espelho
 * exato do que pipeline/energia/modulos/pld_detalhe.py publica para os painéis P008 a
 * P012. Valores em R$/MWh nominais, salvo onde indicado; ausência é null e é exibida
 * como ausência (nunca zero). As séries longas vêm em colunas (arrays paralelos): o
 * índice i de cada array se refere ao mesmo período. Nenhum número é recalculado na
 * interface: comparações entre CMO e PLD já vêm como diferença no mesmo intervalo.
 */
import type { Cabecalho, Download, Proveniencia, Submercado } from "./tipos";

export type SerieSm<T> = Record<Submercado, T>;
export type Fronteira = "N_NE" | "N_SE" | "NE_SE" | "S_SE";
export type Par = "SE_S" | "SE_NE" | "SE_N" | "S_NE" | "S_N" | "NE_N";
/** Situação do PLD da hora: `teto_estrutural_no_dia` = hora entre os limites horários num dia cuja média ficou no teto estrutural. */
export type SituacaoHora =
  | "piso"
  | "teto_horario"
  | "teto_estrutural_no_dia"
  | "entre"
  | "sem_limite"
  | "abaixo_do_piso"
  | "acima_do_teto";

/* ---------- Evidência ("Comprove este número") ---------- */

export type TesteEvidencia = { nome: string; resultado: string; detalhe: string };

export type EvidenciaPld = {
  valor_exibido: number | null;
  valor_calculo: number | null;
  unidade: string;
  periodo: Record<string, string | number>;
  entidade: string;
  universo: string;
  filtros: Record<string, string | number | boolean>;
  fonte: {
    orgao: string;
    conjunto: string;
    recurso: string;
    url: string;
    arquivos: { recurso: string; sha256: string | null; capturado_em?: string; publicado_em?: string | null }[];
  };
  chaves_origem: string;
  formula: string;
  numerador: { descricao: string; valor: number | null } | null;
  denominador: { descricao: string; valor: number | null } | null;
  pesos: string | null;
  exclusoes: string[];
  cobertura: string;
  tratamento_ausencia: string;
  versao: { pipeline: string; codigo: string | null; publicacao: string };
  revisoes: number | null | Record<string, number | null>;
  testes: TesteEvidencia[];
  reconciliacao: {
    descricao: string;
    resultado: string;
    tolerancia: number | null;
    valor_outro_caminho?: number | null;
    valor_outro_produto?: number | null;
  };
  download: Download[];
  reproducao: string;
  citacao: string;
};

/* ---------- P008: conceito e fontes textuais ---------- */

export type FonteTextual = {
  id: string;
  orgao: string;
  texto: string | null;
  origem: string;
  url?: string | null;
  capturado_em?: string | null;
  sha256?: string | null;
  arquivo?: string | null;
};

export type ConceitoPld = {
  fontes_textuais: FonteTextual[];
  bloqueios: { fonte: string; url: string; evidencia: string; consequencia: string }[];
};

/* ---------- P009: CMO e formação de preço ---------- */

export type ProdutoPreco = {
  id: "decomp_semanal" | "dessem_semi_horario" | "pld_horario";
  rotulo: string;
  orgao: string;
  modelo: string;
  resolucao: string;
  grao_geografico: string;
  data_publicada?: string;
  unidade_no_dicionario: string | null;
  unidade_patamares_no_dicionario?: string | null;
  descricao_fonte: string | null;
  url: string;
};

export type ConvencaoSemana = {
  semanas: number;
  corr_semana_que_termina_na_data: number | null;
  corr_semana_seguinte: number | null;
  erro_abs_medio_semana_que_termina_na_data: number | null;
  erro_abs_medio_semana_seguinte: number | null;
};

export type ConvencaoMeiaHora = {
  horas: number;
  erro_abs_medio_inicio: number | null;
  erro_abs_medio_fim: number | null;
  filtro: string;
};

export type SemanaSm = {
  sm: Submercado;
  nome: string;
  decomp: number | null;
  dessem: number | null;
  pld: number | null;
  pld_menos_decomp: number | null;
  pld_menos_dessem: number | null;
  dessem_menos_decomp: number | null;
};

export type SemanaReferencia = { inicio: string; fim: string; por_sm: SemanaSm[]; texto: string };

export type RelacaoAnual = {
  ano: number;
  sm: Submercado;
  parcial: boolean;
  horas_pld: number;
  horas_com_cmo: number;
  horas_sem_cmo: number;
  por_situacao: Record<SituacaoHora, number>;
  todas: { media_dif: number | null; media_abs_dif: number | null };
  entre: {
    n: number;
    media_dif: number | null;
    media_abs_dif: number | null;
    mediana_abs_dif: number | null;
    frac_abs_ate_1: number | null;
    frac_abs_ate_0_01: number | null;
  } | null;
  piso: { n: number; frac_cmo_no_piso_ou_abaixo: number | null; frac_cmo_acima_do_piso_mais_1: number | null } | null;
};

export type BlocoCmoPld = {
  produtos: ProdutoPreco[];
  nao_equivalencia: string[];
  alinhamento: {
    hora: string;
    semana: string;
    convencao_semana: SerieSm<ConvencaoSemana>;
    convencao_meia_hora: SerieSm<ConvencaoMeiaHora>;
  };
  /** Semanas operativas: `fim` é a sexta-feira publicada pelo ONS; `inicio`, o sábado. */
  semanal: { fim: string[]; inicio: string[] } & SerieSm<{ decomp: (number | null)[]; dessem: (number | null)[]; pld: (number | null)[] }>;
  semanas_completas: number;
  semana_referencia: SemanaReferencia | null;
  relacao_anual: RelacaoAnual[];
};

/* ---------- P010: limites, piso e tetos ---------- */

export type AtoLimite = {
  ano: number | null;
  ato: string;
  data_publicacao: string | null;
  dispositivo: string | null;
  url: string;
  trecho: string | null;
  altera_ou_revoga: string | null;
  unidade: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  pld_min: number | null;
  pld_max_horario: number | null;
  pld_max_estrutural: number | null;
};

export type RegimeLimites = {
  inicio: string;
  fim: string;
  pld_min: number | null;
  pld_max_horario: number | null;
  pld_max_estrutural: number | null;
  ato_pld_min: string | null;
  ato_pld_max_horario: string | null;
  ato_pld_max_estrutural: string | null;
};

export type PermanenciaAnual = {
  ano: number;
  sm: Submercado;
  parcial: boolean;
  horas: number;
  horas_com_limite: number;
  horas_piso: number;
  frac_piso: number | null;
  horas_teto_horario: number;
  frac_teto_horario: number | null;
  horas_entre: number;
  horas_sem_limite: number;
  controle_abaixo_do_piso: number;
  controle_acima_do_teto: number;
  sensibilidade_meio_centavo: { horas_piso: number; horas_teto_horario: number };
  dias: number;
  dias_teto_estrutural: number;
  dias_teto_estrutural_com_hora_acima: number;
  controle_dias_acima_estrutural: number;
  dias_sem_teto_estrutural: number;
};

export type EmpatePiso = {
  ano: number;
  horas: number;
  por_quantidade_no_piso: Record<"0" | "1" | "2" | "3" | "4", number>;
  horas_quatro_no_piso: number;
  frac_quatro_no_piso: number | null;
};

export type ConferenciaAto = {
  ano: number;
  sm: Submercado;
  menor_observado: number | null;
  maior_observado: number | null;
  pld_min_atos: number[];
  pld_max_horario_atos: number[];
  menor_igual_ao_piso: boolean | null;
  maior_igual_ao_teto_horario: boolean | null;
};

export type BlocoLimitesDisponivel = {
  disponivel: true;
  origem: string;
  conferido_em: string | null;
  tolerancia: { valor: number; unidade: string; regra: string; justificativa: string };
  atos: AtoLimite[];
  rejeitados: { ato: string | null; motivo: string }[];
  regimes: RegimeLimites[];
  permanencia_anual: PermanenciaAnual[];
  empates_piso: EmpatePiso[];
  conferencias: ConferenciaAto[];
  /** Últimos 366 dias completos; o histórico inteiro está em pld_limites_diario.csv. */
  calendario: { dias: string[] } & SerieSm<{
    horas_piso: number[];
    horas_teto_horario: number[];
    /** Datas (dentro de `dias`) com a média diária no teto estrutural. */
    dias_teto_estrutural: string[];
    /** Datas sem teto estrutural vigente conhecido (sem ato). */
    dias_sem_teto_estrutural_vigente: string[];
  }>;
  regra_menor_observado: string;
  nota_teto_estrutural: string;
};

export type BlocoLimitesIndisponivel = {
  disponivel: false;
  motivo: string;
  origem: null;
  dependencia: string;
  rejeitados: { ato: string | null; motivo: string }[];
};

export type BlocoLimites = BlocoLimitesDisponivel | BlocoLimitesIndisponivel;

/* ---------- P011: histórico e distribuição ---------- */

export type MensalSm = {
  horas: number[];
  temporal: (number | null)[];
  horas_com_carga: number[];
  ponderada_carga: (number | null)[];
  /** true quando a ponderada usa exatamente as mesmas horas da temporal. */
  mesmas_horas: boolean[];
  /** Média temporal em reais do mês-base do deflator. */
  real: (number | null)[];
};

export type Quantis = {
  n: number;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
};

export type SazonalMes = Quantis & { sm: Submercado; mes: number; anos: number[] };

export type PosicaoReferencia = {
  sm: Submercado;
  dia: string;
  media_dia: number | null;
  mesmo_mes: {
    mes: number;
    percentil: number | null;
    n_dias: number;
    empates: number;
    p10: number | null;
    p25: number | null;
    p50: number | null;
    p75: number | null;
    p90: number | null;
  };
  mesma_semana_iso: { semana: number; percentil: number | null; n_dias: number; anos: number[] };
};

export type MesCorrente = {
  sm: Submercado;
  mes: string;
  dias: number;
  parcial: boolean;
  media_dias_completos: number | null;
  mesmo_mes_anos_anteriores: { ano: number; media: number | null; dias: number }[];
};

export type RegimeDistribuicao = Quantis & {
  ano: number;
  sm: Submercado;
  parcial: boolean;
  limites: { pld_min: number | null; pld_max_horario: number | null; pld_max_estrutural: number | null }[];
  media: number | null;
  horas_com_limite: number;
  frac_piso: number | null;
  frac_teto_horario: number | null;
};

export type BlocoHistorico = {
  mensal: { meses: string[]; dias_completos: number[]; parcial: boolean[] } & SerieSm<MensalSm>;
  deflator: { indice: string; mes_base: string | null; indice_base: number | null; ultimo_mes_do_indice: string | null; regra: string };
  ponderacao: { peso: string; ressalva: string; ultima_hora_com_carga: string | null };
  sazonal_mes: SazonalMes[];
  posicao_referencia: PosicaoReferencia[];
  mes_corrente: MesCorrente[];
  regimes: RegimeDistribuicao[];
  /** Média por hora do dia (24 colunas) em cada um dos últimos 12 meses. */
  perfil_hora_mes: { meses: string[]; parcial: boolean[] } & SerieSm<(number | null)[][]>;
};

/* ---------- P012: diferenças regionais ---------- */

export type PeriodoRegional = { id: string; rotulo: string; inicio: string | null; fim: string | null; horas: number };

export type AmplitudePeriodo = {
  periodo: string;
  rotulo: string;
  inicio: string;
  fim: string;
  horas: number;
  horas_com_separacao: number;
  frac_com_separacao: number | null;
  media: number | null;
  p50: number | null;
  p95: number | null;
  max: number | null;
  quando_max: string;
};

export type SeparacaoPar = {
  periodo: string;
  par: Par;
  horas: number;
  horas_separadas: number;
  frac_separadas: number | null;
  dif_media: number | null;
  dif_abs_media: number | null;
  dif_abs_p95: number | null;
  dif_max: number | null;
  quando_max: string;
  horas_diferenca_de_um_centavo: number;
  horas_acima_1: number;
  horas_acima_10: number;
};

export type FluxoSeparacao = {
  periodo: string;
  fronteira: Fronteira;
  horas_com_fluxo: number;
  horas_separadas: number;
  do_menor_para_o_maior: number;
  do_maior_para_o_menor: number;
  fluxo_nulo: number;
  frac_do_menor_para_o_maior: number | null;
  fluxo_medio_separadas: number | null;
  fluxo_medio_nao_separadas: number | null;
  ultima_hora_fluxo: string | null;
};

export type BlocoRegional = {
  pares: Par[];
  fronteiras: Fronteira[];
  regra_separacao: string;
  regra_fluxo: string;
  periodos: PeriodoRegional[];
  amplitude: AmplitudePeriodo[];
  separacao: SeparacaoPar[];
  /** Linhas e colunas na ordem `ordem`; dif_media[i][j] = média de PLD_i − PLD_j; diagonal null. */
  matriz: { periodo: string; ordem: Submercado[]; dif_media: (number | null)[][]; frac_separadas: (number | null)[][] };
  perfil_horario_separacao_12m: Record<Par, (number | null)[]>;
  fluxos: FluxoSeparacao[];
};

export type HorarioRecente = {
  t: string[];
  pld: SerieSm<(number | null)[]>;
  cmo_dessem: SerieSm<(number | null)[]>;
  fluxo: Record<Fronteira, (number | null)[]>;
  amplitude: (number | null)[];
};

/* ---------- Achados históricos ---------- */

export type SequenciaZero = { inicio: string; fim: string; semanas: number };

export type ArquivoA02 = {
  recurso: string;
  url: string;
  sha256: string | null;
  linhas: number | null;
  linhas_todas_zero: number | null;
  formas_do_zero: string[];
  semanas_no_trecho: number;
  linhas_zeradas_no_trecho: number;
  linhas_esperadas_no_trecho: number;
  parquet: { recurso: string; sha256: string | null; celulas_iguais: number | null; celulas: number | null; erro: string | null };
};

export type AchadoA02 = {
  status: string;
  sequencias_por_sm: SerieSm<SequenciaZero[]>;
  sequencia_comum_mais_longa: SequenciaZero | null;
  reconciliacao_silver_principal: {
    iguais: number;
    diferentes: number;
    so_no_silver_principal: number;
    so_na_releitura: number;
    exemplos_diferenca: { sm: Submercado; semana: string; silver_principal: number; original_relido: number }[];
    nota: string;
  };
  periodo?: { primeira_semana_inicio: string; ultima_semana_fim: string; semanas: number };
  arquivos: ArquivoA02[];
  dessem_mesmo_periodo?: { sm: Submercado; meias_horas: number; meias_horas_zero: number; frac_zero: number | null; media: number | null; max: number | null }[];
  pld_mesmo_periodo?: { sm: Submercado; horas: number; media: number | null; horas_com_limite: number; frac_piso: number | null }[];
  observacao_formato?: string;
  texto?: string;
};

export type CampoDicionario = { descricao: string; unidade?: string };
export type PdfDicionario = {
  sha256: string | null;
  data_documento: string | null;
  versoes: { versao: string; data: string; descricao: string }[] | null;
};

export type AchadoA03 = {
  status: string;
  dicionario_semanal: Record<string, CampoDicionario>;
  dicionario_semi_horario: Record<string, CampoDicionario>;
  pdf: { cmo_semanal: PdfDicionario | null; cmo_semi_horario: PdfDicionario | null };
  unidade_media_semanal_no_dicionario: string | null;
  unidade_patamares_no_dicionario: string | null;
  unidade_semi_horario_no_dicionario: string | null;
  verificacao: {
    semanas_subsistema: number;
    media_entre_min_e_max_dos_patamares: number;
    fora: { sm: Submercado; semana: string; media_semanal: number; leve: number; media: number; pesada: number }[];
    tolerancia: number;
    leitura: string;
  };
  decisao: string;
};

export type AchadoA09 = {
  status: string;
  publicado_pela_fonte_em: null;
  motivo_sem_publicacao: string;
  last_modified_sem_mudanca: { recurso: string; last_modified: string; conteudos_distintos: number }[];
  leitura_last_modified: string;
  descricao_fonte: string;
  captura_versionada: { capturado_em: string | null; ultimo_dia: string | null; nota: string };
  dias_com_captura_direta: {
    dia: string;
    primeira_captura_completa: string;
    horas: number;
    antecedencia_ao_inicio_do_dia_h: number | null;
    elegivel_sob_lat1d_em: string;
    folga_lat1d_h: number | null;
  }[];
  dias_capturados_antes_de_comecar: number;
  vintages_comparadas: number;
  valores_revisados: number;
  hipotese_lat1d: string;
  folga_minima_lat1d_h: number | null;
  impacto: string;
};

export type Achados = {
  A01: { status: string; regra: string; semana_referencia: SemanaReferencia | null };
  A02: AchadoA02;
  A03: AchadoA03;
  A04: { status: string; origem: string | null; motivo: string | null; atos: number; rejeitados: { ato: string | null; motivo: string }[]; regra: string };
  A09: AchadoA09;
};

/* ---------- Cobertura, controles e metadados ---------- */

export type CoberturaDessemAno = {
  ano: number;
  meias_horas_esperadas: number;
  meias_horas_presentes: number;
  dias_ausentes: string[];
  dias_incompletos: string[];
  presentes_por_sm: SerieSm<number>;
};

export type RelatorioImportacao = {
  linhas: number;
  observacoes: number;
  zeros: number;
  negativos: number;
  vazios: number;
  invalidos: number;
  duplicados: number;
  subsistema_desconhecido: number;
  nome_divergente: number;
  fora_da_grade: number;
  primeira: string | null;
  ultima: string | null;
  novas: number;
  revisoes: number;
};

export type Controle = { nome: string; resultado: "aprovado" | "ressalva" | "reprovado"; detalhe: string };

export type SnapshotResumo = {
  id: string | null;
  sha256: string | null;
  arquivos: number;
  ultima_captura: string | null;
  /** null quando a fonte não informa publicação de modo confiável (PLD da CCEE). */
  publicacao_mais_recente: string | null;
  publicacao_confiavel: boolean;
  revisoes_detectadas: number | null;
};

export type PldDetalheGold = Cabecalho & {
  unidade: string;
  fuso: string;
  referencia: {
    dia: string;
    ultima_hora_pld: string;
    ultima_meia_hora_cmo: string;
    ultima_semana_decomp: string;
    ultima_hora_carga: string | null;
    ultima_hora_fluxo: string | null;
    ultimo_mes_ipca: string | null;
  };
  tolerancias: { monetaria: number; sensibilidade: number; fluxo_nulo_mwmed: number; unidade: string };
  conceito: ConceitoPld;
  cmo_pld: BlocoCmoPld;
  limites: BlocoLimites;
  historico: BlocoHistorico;
  regional: BlocoRegional;
  horario_recente: HorarioRecente;
  achados: Achados;
  cobertura: { cmo_semi_horario: CoberturaDessemAno[]; importacao_cmo_semi_horario: Record<string, RelatorioImportacao | null> };
  metricas: Record<"cmo_pld" | "limites" | "historico" | "regional" | "achados", string[]>;
  controles: Controle[];
  proveniencia: {
    cmo_semi_horario: Proveniencia;
    cmo_horario: Proveniencia;
    comparacao_semanal: Proveniencia;
    historico_mensal: Proveniencia;
    sazonal: Proveniencia;
    regional: Proveniencia;
    fluxos: Proveniencia;
    a02: Proveniencia;
    /** Presente só quando os atos de limites estão disponíveis. */
    limites?: Proveniencia;
  };
  evidencias: Record<string, EvidenciaPld>;
  snapshots: Record<
    "cmo_semi_horario" | "cmo_semanal_original" | "dicionarios" | "ipca" | "pld" | "cmo_semanal" | "balanco" | "intercambio",
    SnapshotResumo
  >;
  downloads: Download[];
};
