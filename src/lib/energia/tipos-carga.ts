/**
 * Tipos da gold do módulo Carga (detalhe) (public/energia/gold/carga_detalhe.json),
 * espelho exato do que pipeline/energia/modulos/carga_detalhe.py publica para os painéis
 * P025 (nível e crescimento), P026 (MMGD e perfil horário), P027 (clima e calendário) e o
 * achado A07. Valores em MWmed salvo onde indicado; ausência é null e é exibida como
 * ausência (nunca zero). Nenhum número é recalculado na interface.
 *
 * Duas famílias de carga do ONS convivem aqui sem se misturar: a carga de energia
 * (curva horária e carga diária, o mesmo produto) e a carga verificada da API (carga
 * global, MMGD e carga líquida de MMGD). Campos `global`, `mmgd` e `liquida` vêm sempre
 * da API; campos com a sigla do subsistema (`SE`, `S`, `NE`, `N`, `SIN`) ou `carga`, da curva.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Natureza, Proveniencia, Regiao, Submercado } from "./tipos";

export type ClasseDia = "util" | "sabado" | "domingo_feriado";
export type CategoriaEvento = "feriado_nacional" | "paixao" | "ponto_facultativo";
export type JanelaId = "7d" | "28d" | "mes_corrente" | "ultimo_mes_completo" | "52_semanas";
export type GrupoModelo = "nivel_tendencia" | "calendario" | "sazonalidade" | "temperatura";
export type VarianteModelo =
  | "principal"
  | "sem_temperatura"
  | "temperatura_linear"
  | "temperatura_maxima"
  | "sem_pontos_facultativos"
  | "janela_longa";

/** Contagem de dias por classe; `sem_classe` = antes de 2003 (calendário não classificado). */
export type ClassesDias = Record<ClasseDia | "sem_classe", number>;
/** [data ISO, nome, categoria] de um evento do calendário oficial. */
export type EventoCurto = [string, string, CategoriaEvento];
export type EventoCalendario = { data: string; nome: string; categoria: CategoriaEvento; dia_semana: string };

export type Regime = { inicio: string; fim: string | null; descricao: string };

/* ---------- P025: comparações equivalentes, anual, mensal, revisões, validação ---------- */

/** Composição de calendário de cada janela (nacional: igual para todos os subsistemas). */
export type JanelaComparacao = {
  id: JanelaId;
  rotulo: string;
  inicio: string;
  fim: string;
  dias: number;
  classes: ClassesDias;
  /** null quando a janela contém 29/02 (sem par nas mesmas datas do ano anterior). */
  classes_mesmas_datas: ClassesDias | null;
  classes_equivalente: ClassesDias;
  calendario_equivalente_mesmas_datas: boolean;
  calendario_equivalente_364d: boolean;
  eventos: EventoCurto[];
  eventos_mesmas_datas: EventoCurto[];
  eventos_equivalente: EventoCurto[];
};

/** Números de uma comparação; variacao_pct é null quando os períodos atravessam mudança de regime. */
export type NumerosComparacao = {
  inicio_ant: string;
  fim_ant: string;
  media: number;
  media_ant: number;
  variacao_pct: number | null;
  mesmo_regime: boolean;
} | null;

export type ComparacoesSubsistema = {
  sm: Regiao;
  janelas: Record<JanelaId, { mesmas_datas: NumerosComparacao; equivalente: NumerosComparacao }>;
};

export type CargaAnual = {
  ano: number;
  dias: number;
  completo: boolean;
  /** Regimes do ONS presentes no ano (1, 2 ou 3). */
  regimes: number[];
  /** Variação contra o ano anterior só entre anos completos no mesmo regime. */
  variacao_pct: Partial<Record<Regiao, number>> | null;
} & Record<Regiao, number | null>;

export type AcumuladoAno = {
  inicio: string;
  fim: string;
  inicio_ant: string;
  fim_ant: string;
  sm: Record<Regiao, { media: number; media_ant: number; variacao_pct: number | null; mesmo_regime: boolean } | null>;
};

export type CargaMensal = {
  m: string;
  dias_uteis: number;
  dias_uteis_ant: number | null;
  SE: number | null; var_SE: number | null;
  S: number | null; var_S: number | null;
  NE: number | null; var_NE: number | null;
  N: number | null; var_N: number | null;
  SIN: number | null; var_SIN: number | null;
};

export type RevisaoLinha = {
  sm: Submercado;
  dia: string;
  capturado_em: string;
  capturado_em_ant: string;
  valor: number;
  valor_ant: number;
  diferenca: number;
  /** null quando o valor anterior não era positivo (correção de valor fora do domínio). */
  diferenca_pct: number | null;
  situacao: "revisao" | "correcao_de_valor_fora_do_dominio";
};

export type Revisoes = {
  capturas_diaria: string[];
  total: number;
  dias_revisados: number;
  mediana_abs_pct: number | null;
  max_abs_pct: number | null;
  linhas: RevisaoLinha[];
  curva_contra_diaria: {
    dias_comparados: number;
    dias_diferentes: number;
    tolerancia: string;
    exemplos: { sm: Submercado; dia: string; curva: number; diaria: number; diferenca: number }[];
    leitura: string;
  };
};

export type RegraValidacao = { id: "F1" | "F2" | "F3" | "C1"; tipo: string; critica: boolean; descricao: string };
export type OcorrenciaValidacao = {
  sm: Submercado;
  dia: string;
  valor: number | null;
  regras: ("F1" | "F2" | "F3")[];
  situacao: "quarentena" | "atipico_conferido";
  curva_horaria_media: number | null;
  conferencia: string;
};
export type ForaDoDominio = {
  sm: Submercado;
  dia: string;
  valor: number;
  capturado_em: string;
  vintage: string;
  recurso: string;
  revisado_para: number | null;
  revisado_em: string | null;
  situacao: "revisado_pela_fonte" | "vigente_em_quarentena";
};
export type ValidacaoFisica = {
  regras: RegraValidacao[];
  quarentena: OcorrenciaValidacao[];
  atipicos_conferidos: OcorrenciaValidacao[];
  historico_fora_do_dominio: ForaDoDominio[];
  valores_verificados: number;
};

export type P025 = {
  comparacoes: { janelas: JanelaComparacao[]; subsistemas: ComparacoesSubsistema[] };
  anual: CargaAnual[];
  acumulado_ano: AcumuladoAno;
  mensal: CargaMensal[];
  revisoes: Revisoes;
  validacao: ValidacaoFisica;
  serie_diaria: { arquivo: string; gold: string };
};

/* ---------- A07: +10,5% em sete dias ---------- */

export type ComparacaoCompleta = {
  tipo: "mesmas_datas" | "equivalente";
  inicio: string;
  fim: string;
  inicio_ant: string;
  fim_ant: string;
  dias: number;
  media: number;
  media_ant: number;
  variacao_pct: number | null;
  mesmo_regime: boolean;
  calendario_equivalente: boolean;
  classes: ClassesDias;
  classes_ant: ClassesDias;
  eventos: EventoCalendario[];
  eventos_ant: EventoCalendario[];
};

export type ComposicaoCalendario = { dias_semana: number[]; classes: ClassesDias; eventos: EventoCalendario[] };
export type ApiJanela = { global: number | null; mmgd: number | null; liquida: number | null };
export type ApiVariacao = {
  global_pct: number;
  liquida_pct: number;
  mmgd_pct: number | null;
  delta_global: number;
  delta_mmgd: number;
  delta_liquida: number;
  /** Aumento da MMGD em pontos percentuais da carga global da janela de comparação. */
  mmgd_na_variacao_pct_pontos: number;
} | null;

export type DecomposicaoA07 = {
  sm: Regiao;
  variante: VarianteModelo;
  comparacao: "mesmas_datas" | "equivalente";
  origem_modelo: string;
  ultimo_dia_treino: string;
  inicio: string;
  fim: string;
  inicio_ant: string;
  fim_ant: string;
  dias: number;
  real_log100: number;
  previsto_log100: number;
  residuo_log100: number;
  contribuicoes_log100: Record<GrupoModelo, number>;
  variacao_real_pct: number;
};

export type ResiduoJanela = {
  sm: Regiao;
  janela: "2026" | "2025_mesmas_datas" | "2025_equivalente";
  dias: number;
  dias_janela: number;
  inicio: string;
  fim: string;
  real: number;
  previsto: number;
  residuo_pct: number;
  dias_acima_p90: number;
  dias_abaixo_p10: number;
  origens: string[];
};

export type A07 = {
  /** Publicação do diagnóstico (commit e instante da gold) que é reproduzida. */
  referencia: {
    commit: string;
    arquivo: string;
    gerado_em: string;
    sm: "SIN";
    inicio: string;
    fim: string;
    inicio_anterior: string;
    fim_anterior: string;
    variacao_publicada_pct: number;
  };
  reproducao: Partial<ComparacaoCompleta> & {
    vintages: { recurso: string; capturado_em: string; sha256: string }[];
    confere_publicado: boolean;
  };
  por_captura_2026: {
    capturado_em: string;
    sha256: string;
    dias: ({ d: string; SIN: number | null; fora_do_dominio: Submercado[] } & Record<Submercado, number | null>)[];
    variacao_pct: number | null;
    janela_completa: boolean;
  }[];
  comparacoes: { sm: Regiao; mesmas_datas: ComparacaoCompleta | null; equivalente: ComparacaoCompleta | null; curva_horaria_mesmas_datas: number | null }[];
  calendario: { a: ComposicaoCalendario; b: ComposicaoCalendario; e: ComposicaoCalendario; dias_equivalentes: string[] };
  mmgd: { sm: Regiao; a: ApiJanela; b: ApiJanela; e: ApiJanela; var_b: ApiVariacao; var_e: ApiVariacao }[];
  temperatura: { sm: Regiao; dias: number; a: number | null; b: number | null; e: number | null; a_max: number | null; b_max: number | null; e_max: number | null }[];
  fonte_temperatura: Record<string, string[]>;
  janela_modelo: { inicio: string; fim: string | null; dias: number; dias_janela: number; motivo: string | null };
  residuos_fora_da_amostra: ResiduoJanela[];
  decomposicao: DecomposicaoA07[];
  /** Frases geradas por regra a partir dos números acima. */
  textos: string[];
};

/* ---------- P026: curva horária, pico, MMGD e carga líquida ---------- */

export type HoraRecente = { h: string; global: number | null; mmgd: number | null; liquida: number | null } & Record<Regiao, number | null>;

/** Perfil típico: arrays de 24 posições (índice = hora local de início). */
export type PerfilTipico = {
  mes: string;
  sm: Regiao;
  classe: ClasseDia;
  dias_curva: number;
  dias_api: number;
  carga: (number | null)[];
  global: (number | null)[];
  mmgd: (number | null)[];
  liquida: (number | null)[];
};

export type PicoDia = { d: string; pico: number | null; hora: number | null; pico_liquida: number | null; hora_liquida: number | null };
/** `contagem[h]` = dias do ano com o pico na hora h. */
export type HoraPicoAno = { ano: number; dias: number; contagem: number[]; regimes: number[] };

export type P026 = {
  ultimo_dia: string;
  ultimo_dia_curva: string;
  ultimo_dia_api: string;
  recente: HoraRecente[];
  perfil_sin_12m: PerfilTipico[];
  perfil_subsistemas: PerfilTipico[];
  perfil_evolucao: PerfilTipico[];
  meses_perfil: string[];
  picos_90d: PicoDia[];
  hora_pico_por_ano: Record<Regiao, HoraPicoAno[]>;
  hora_pico_api_sin_por_ano: { ano: number; dias: number; contagem_liquida: number[]; contagem_global: number[] }[];
  recordes_anuais: { sm: Regiao; ano: number; dia: string; hora: number; pico: number }[];
  mmgd_mensal: { m: string; sm: Regiao; dias: number; dias_no_mes: number; global: number; mmgd: number; mmgd_pct: number }[];
  compatibilidade: {
    por_ano: { sm: Regiao; ano: number; horas: number; global_mwmed: number; curva_mwmed: number; diferenca_pct: number }[];
    por_hora_sin_365d: { hora: number; horas: number; diferenca_mwmed: number | null; diferenca_pct: number | null }[];
    conclusao: string;
  };
  conceitos: Record<"carga_curva" | "carga_global" | "mmgd" | "carga_liquida" | "dupla_contagem", string>;
};

/* ---------- P027: decomposição estatística ---------- */

export type MetricasModelo = {
  dias: number;
  origens: number;
  mape_pct: number;
  vies_pct: number;
  mae_mwmed: number;
  rmse_mwmed: number;
  cobertura_80_pct: number;
  cobertura_95_pct: number;
  mape_referencia_364d_pct: number | null;
  dias_referencia_364d: number;
};

export type DiaDecomposicao = {
  d: string;
  real: number;
  previsto: number;
  p10: number;
  p90: number;
  p025: number;
  p975: number;
  residuo_pct: number;
  origem: string;
} & Record<GrupoModelo, number>;

export type P027 = {
  natureza: Natureza;
  nome: string;
  especificacao: {
    alvo: string;
    estimador: string;
    variaveis: { nome: string; grupo: GrupoModelo }[];
    nos_temperatura: Record<Regiao, number[]>;
    inicio_treino: string;
    primeira_origem: string;
    origens: string;
    intervalo: string;
    contribuicoes: string;
    temperatura: string;
  };
  metricas: Record<Regiao, MetricasModelo>;
  sensibilidade: ({ sm: Regiao; variante: VarianteModelo; rotulo: string } & MetricasModelo)[];
  por_origem_sin: { origem: string; dias_treino: number; dias: number; mape_pct: number; vies_pct: number; fonte_intervalo: string }[];
  erros_sin_pct: { p05: number; p25: number; mediana: number; p75: number; p95: number };
  recente_sin: DiaDecomposicao[];
  /** Efeito da temperatura em log × 100, relativo à média do treino: pares [°C, efeito]. */
  resposta_temperatura: Record<Regiao, { faixa_observada: [number, number]; nos: number[]; pontos: [number, number][] }>;
  coeficientes_sin: { variavel: string; grupo: GrupoModelo; coeficiente: number; ativa: boolean }[];
  ultimo_ajuste_sin: { origem: string; dias_treino: number; ultimo_dia_treino: string; dp_residuo_treino_log100: number };
  leitura: string;
} | null;

/* ---------- Calendário, temperatura e fontes ---------- */

export type LeiFeriado = {
  id: string;
  norma: string;
  estabelece: string;
  ementa_senado: string | null;
  id_senado: string | null;
  conferida: boolean;
  url: string;
  capturado_em: string | null;
  sha256: string | null;
};

export type FonteCarga = {
  id: "diaria" | "curva" | "api" | "temperatura" | "populacao" | "centroides" | "leis";
  orgao: string;
  conjunto: string;
  recurso: string;
  url: string;
  licenca: string;
  grao: string;
  unidade?: string;
  periodo?: { inicio: string | null; fim: string | null };
  capturas?: number;
  arquivos?: number;
  ultima_captura?: string | null;
  dicionario?: string;
  frequencia_declarada?: string;
  modificado_na_fonte?: string | null;
  identidade_conferida_meias_horas?: number;
  identidade_falhas?: number;
  atualizacao_na_fonte?: { mais_antiga: string | null; mais_recente: string | null };
  capitais_com_dado?: string[];
  leis?: LeiFeriado[];
};

export type CargaDetalheGold = Cabecalho & {
  dia_referencia: string;
  unidade: "MWmed";
  regimes: Regime[];
  p025: P025;
  a07: A07;
  p026: P026;
  p027: P027;
  calendario: {
    leis: LeiFeriado[];
    categorias: Record<CategoriaEvento, string>;
    eventos_12m: { data: string; nome: string; categoria: CategoriaEvento; base: string }[];
  };
  temperatura: {
    pesos: Record<Regiao, Record<string, number>>;
    ano_populacao: string | null;
    /** Produto da NASA em cada mês: MERRA2 ou GEOSIT. */
    fontes_por_mes: Record<string, string>;
    capitais: Record<string, { codigo_ibge: string; nome: string }>;
    ufs_por_subsistema: Record<Submercado, string[]>;
  };
  fontes: FonteCarga[];
  proveniencia: Record<"comparacoes" | "curva" | "api" | "temperatura" | "modelo", Proveniencia>;
  evidencias: Partial<Record<"a07_reproducao" | "p025_7d_equivalente" | "p026_mmgd_mes" | "p026_pico_sin" | "p027_mape_sin", Evidencia>>;
  downloads: Download[];
};
