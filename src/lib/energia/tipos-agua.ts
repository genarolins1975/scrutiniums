/**
 * Tipos da gold do módulo Água e clima (detalhe) (public/energia/gold/agua_detalhe.json),
 * espelho exato do que pipeline/energia/modulos/agua_detalhe.py publica para os painéis
 * P017 a P020. Complementa hidrologia.json (EAR e ENA por subsistema), sem substituí-la.
 *
 * Unidades: EAR em MWmês (1 MWmês = 720 MWh); ENA e MLT em MWmed (média do dia); volumes
 * em hm³; vazões em m³/s; chuva em mm; temperatura em °C. Ausência é null e é exibida como
 * ausência (nunca zero). Séries longas vêm em colunas (arrays paralelos): o índice i de
 * cada array se refere ao mesmo ponto. Nos pequenos múltiplos (`semanal`), a data do
 * ponto i é `d0` + `passo_dias` × i. Nenhum número é recalculado na interface.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Natureza, Proveniencia, Regiao, Submercado } from "./tipos";

/** Posição frente à faixa do 10º ao 90º percentil. */
export type FaixaUsual = "abaixo" | "dentro" | "acima";

/* ---------- P017 armazenamento ---------- */

export type AguaEarSubsistema = {
  sm: Regiao;
  nome: string;
  dia: string;
  natureza: Natureza;
  ear_pct: number | null;
  ear_mwmes: number | null;
  ear_max_mwmes: number | null;
  participacao_capacidade_sin_pct: number | null;
  participacao_armazenado_sin_pct: number | null;
  variacao_7d_mwmes: number | null;
  variacao_30d_mwmes: number | null;
  variacao_12m_mwmes: number | null;
  variacao_30d_pp: number | null;
  /** Faixa do mesmo dia do calendário nos anos completos da base (% da EAR máxima). */
  p10: number | null;
  p50: number | null;
  p90: number | null;
  anos_na_base: number;
  periodo_base: string;
  p10_mwmes: number | null;
  p50_mwmes: number | null;
  p90_mwmes: number | null;
  faixa: FaixaUsual | null;
  percentil_na_data: number | null;
};

/** Pequeno múltiplo: um ponto a cada `passo_dias` dias desde `d0` (inclusive) até o dia de referência. */
export type AguaSemanal = {
  d0: string;
  passo_dias: number;
  v: (number | null)[];
  p10: (number | null)[];
  p50: (number | null)[];
  p90: (number | null)[];
};

/** REE ou bacia (conjuntos EAR por REE e EAR por bacia do ONS). */
export type AguaEarRecorte = {
  nome: string;
  dia: string | null;
  ear_pct: number | null;
  ear_mwmes: number | null;
  ear_max_mwmes: number | null;
  /** EAR máxima zero no dia (só usinas a fio d'água): percentual sem significado. */
  sem_armazenamento: boolean;
  variacao_7d_pp: number | null;
  variacao_30d_pp: number | null;
  variacao_30d_mwmes: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  anos_na_base: number;
  periodo_base: string | null;
  p10_mwmes: number | null;
  p50_mwmes: number | null;
  p90_mwmes: number | null;
  faixa: FaixaUsual | null;
  percentil_na_data: number | null;
  ear_max_base_min_mwmes: number | null;
  ear_max_base_max_mwmes: number | null;
  /** A EAR máxima mudou mais de 5% dentro da base: a faixa mistura capacidades diferentes. */
  capacidade_mudou_na_base: boolean;
  semanal: AguaSemanal;
};

export type AguaReservatorioEvento = {
  cod: string;
  nome: string;
  parte: "proprio" | "jusante";
  tipo: "entrada" | "saida" | "alteracao";
  variacao_mwmes: number | null;
};

export type AguaEventoCapacidade = {
  data: string;
  sm: Submercado;
  antes_mwmes: number | null;
  depois_mwmes: number | null;
  variacao_mwmes: number | null;
  atribuido_mwmes: number | null;
  residuo_mwmes: number | null;
  /** 10 MWmês até 2017 (valores inteiros) e 0,05 MWmês desde 2018. */
  tolerancia_mwmes: number;
  fechado: boolean;
  /** Até três maiores; a lista completa está em agua_capacidade_eventos.csv. */
  reservatorios: AguaReservatorioEvento[];
  n_reservatorios: number;
};

export type AguaColunasMwmes<K extends string> = Record<K, string[]> & Record<Regiao, (number | null)[]>;

export type AguaArmazenamento = {
  dia: string;
  subsistemas: AguaEarSubsistema[];
  /** EAR no último dia de cada mês, desde 2000. */
  serie_mensal_mwmes: AguaColunasMwmes<"m"> & { SIN_max: (number | null)[] };
  /** EAR diária dos últimos 180 dias. */
  serie_diaria_mwmes: AguaColunasMwmes<"d">;
  capacidade: {
    eventos: AguaEventoCapacidade[];
    n_eventos: number;
    eventos_fechados: number;
    maior_residuo_mwmes: number | null;
    fim_de_ano: ({ ano: number; d: string } & Record<Regiao, number | null>)[];
    variacao_desde_inicio_mwmes: Record<Regiao, number | null>;
    inicio: string;
  };
  ree: AguaEarRecorte[];
  bacias: AguaEarRecorte[];
};

export type AguaReconciliacaoEar = {
  dia: string;
  pct_publicado_vs_recalculado_max_pp: number | null;
  pares_conferidos: number;
  soma_ree_mwmes: number | null;
  n_ree: number;
  soma_bacias_mwmes: number | null;
  n_bacias: number;
  /** SIN pelo silver principal (a base dos números exibidos). */
  sin_mwmes: number | null;
  /** SIN pelo arquivo por subsistema recapturado junto com os de REE, bacia e reservatório. */
  sin_mesma_captura_mwmes: number | null;
  reservatorios_por_subsistema: {
    sm: Submercado;
    dia: string;
    soma_reservatorios_mwmes: number | null;
    subsistema_mwmes: number | null;
    diferenca_mwmes: number | null;
    soma_max_reservatorios_mwmes: number | null;
    max_subsistema_mwmes: number | null;
    fonte_subsistema: "recaptura" | "silver principal";
  }[];
  /** Anos e subsistemas com dias fora da tolerância (só os que divergem). */
  reservatorios_por_ano: {
    ano: number;
    sm: Submercado;
    dias: number;
    tolerancia_mwmes: number;
    precisao: "inteiro" | "3 casas";
    fonte_subsistema: "recaptura" | "silver principal";
    dias_fora_ear: number;
    max_dif_ear_mwmes: number | null;
    dias_fora_ear_max: number;
    max_dif_ear_max_mwmes: number | null;
  }[];
  anos_sem_divergencia: number[];
  dias_reservatorios_comparados: number;
  dias_reservatorios_fora_tolerancia: number;
  /** Só para contraste (o que não se publica como SIN). */
  media_simples_dos_percentuais: number | null;
  diferenca_media_simples_pp: number | null;
};

/* ---------- P018 afluência ---------- */

export type AguaEnaResumo = {
  nome: string;
  dia: string;
  pct_mlt_dia: number | null;
  ena_mwmed_dia: number | null;
  mlt_mwmed_dia: number | null;
  /** Razão de somas: Σ ENA ÷ Σ MLT dos 30 dias. */
  pct_mlt_30d: number | null;
  ena_30d_soma_mwmed_dia: number | null;
  mlt_30d_soma_mwmed_dia: number | null;
  /** Só nos subsistemas (a ENA armazenável por REE e bacia não é guardada). */
  pct_mlt_arm_30d?: number | null;
  p10_30d: number | null;
  p50_30d: number | null;
  p90_30d: number | null;
  anos_na_base_30d: number;
  periodo_base: string | null;
  percentil_30d: number | null;
  faixa_30d: FaixaUsual | null;
};

export type AguaEnaSubsistema = AguaEnaResumo & { sm: Regiao; natureza: Natureza };

export type AguaMltComparacaoPmo = {
  mes: string;
  sm: Submercado;
  pmo_mwmed: number;
  relatorio: string;
  dias_no_conjunto: number;
  aberto_inicio_mwmed: number | null;
  aberto_fim_mwmed: number | null;
  dif_inicio_pct: number | null;
  dif_fim_pct: number | null;
};

export type AguaMlt = {
  pmo: {
    comparacao: AguaMltComparacaoPmo[];
    tolerancia_pct: number;
    meses_coincidentes: string[];
    dias_coincidentes: { inicio: string; fim: string }[];
    meses_divergentes: string[];
    maior_diferenca_pct: number | null;
    relatorios: string[];
  };
  /** Mudanças da MLT de usinas existentes fora do dia 1º (revisão da referência). */
  revisoes_no_mes: {
    data: string;
    usinas: number;
    exemplos: { nome: string; sm: string; antes: number | null; depois: number | null; variacao_pct: number | null }[];
    variacao_mediana_pct: number | null;
  }[];
  /** MLT do dia 15 do mês comparada com a do mesmo mês do ano anterior, por usina. */
  anos: { ano: number[]; mes: number[]; usinas_comparadas: number[]; usinas_com_mlt_diferente: number[] };
  /** MLT implícita dos subsistemas no dia 15 de janeiro e de julho de cada ano (MWmed). */
  implicita_subsistemas: { ano: number[]; mes: number[] } & Record<Submercado, (number | null)[]>;
  n_mudancas_virada_de_mes: number;
  n_mudancas_no_mes: number;
  usinas_com_mlt: number;
  /** Soma das usinas (MWmed, dicionário por reservatório) × subsistema (dicionário diz MWmês). */
  unidade: {
    sm: Submercado;
    dias: number;
    dias_dentro_0_1pct: number;
    mediana_dif_mwmed: number | null;
    max_dif_rel_pct: number | null;
    mlt_dias: number;
    mlt_dias_dentro_0_1pct: number;
    exemplo: {
      dia: string;
      soma_reservatorios_mwmed: number | null;
      subsistema_mwmed: number | null;
      soma_mlt_reservatorios_mwmed: number | null;
      mlt_implicita_subsistema_mwmed: number | null;
    };
  }[];
};

export type AguaAfluencia = {
  dia: string;
  subsistemas: AguaEnaSubsistema[];
  ree: AguaEnaResumo[];
  bacias: AguaEnaResumo[];
  dia_ree: string | null;
  dia_bacias: string | null;
  /** ENA de 30 dias (% MLT) a cada 7 dias nos últimos 18 meses. */
  serie_30d_semanal: { d: string[] } & Record<Regiao, (number | null)[]>;
  conferencia_bacias_sin: { dia: string; soma_bacias_mwmed: number | null; sin_mwmed: number | null; diferenca_mwmed: number | null } | null;
  mlt: AguaMlt;
};

/* ---------- P019 clima ---------- */

export type AguaPrecipitacaoBacia = {
  bacia: string;
  dia: string;
  ultimo_mes_completo: string | null;
  mm_30d: number | null;
  media_30d_base: number | null;
  p10_30d: number | null;
  p90_30d: number | null;
  anos_base_30d: number;
  anomalia_30d_pct: number | null;
  percentil_30d: number | null;
  /** Janela com dias IMERG Late (sem calibração por pluviômetros). */
  preliminar_30d: boolean;
  cobertura_media_pct: number | null;
  /** Últimos 12 meses completos. */
  mensal: {
    m: string[];
    mm: (number | null)[];
    media: (number | null)[];
    p10: (number | null)[];
    p90: (number | null)[];
    anomalia_pct: (number | null)[];
    preliminar: boolean[];
  };
  /** Correlação de Pearson (associação, não causa) entre anomalia de chuva e ENA % MLT da bacia. */
  associacao_ena: {
    r_mesmo_mes: number | null;
    n_mesmo_mes: number;
    r_mes_seguinte: number | null;
    n_mes_seguinte: number;
    periodo: string;
  } | null;
};

export type AguaTemperatura = {
  recorte: Regiao;
  nome: string;
  dia: string;
  media_30d_c: number | null;
  media_30d_base_c: number | null;
  anomalia_30d_c: number | null;
  p10_30d_c: number | null;
  p90_30d_c: number | null;
  anos_base: number;
  percentil_30d: number | null;
  /** Janela com dias GEOS-IT (ainda não substituídos pelo MERRA-2). */
  preliminar_30d: boolean;
  /** Últimos 24 meses completos. */
  mensal: { m: string[]; t: (number | null)[]; media: (number | null)[]; anomalia_c: (number | null)[] };
  /** Últimos 60 dias com a faixa do mesmo dia do calendário (2001 a 2025). */
  diaria: { d: string[]; t: (number | null)[]; tmax: (number | null)[]; p10: (number | null)[]; p90: (number | null)[] };
};

export type AguaClima = {
  precipitacao_bacias: AguaPrecipitacaoBacia[];
  temperatura: AguaTemperatura[];
  validacao_estacoes: {
    bacias: {
      bacia: string;
      meses: number;
      estacoes_mediana: number | null;
      imerg_mm: number | null;
      estacoes_mm: number | null;
      vies_pct: number | null;
      correlacao: number | null;
    }[];
    correlacao_geral: number | null;
    pares: number;
    vies_geral_pct: number | null;
  };
  cobertura_precipitacao: { bacia: string; pontos: number; passos_grau: number[]; poligonos: string[] }[];
  cobertura_temperatura: {
    uf: string;
    subsistema: Submercado | null;
    celulas: number;
    populacao_uf: number | null;
    populacao_nas_celulas: number;
    cobertura_pct: number | null;
  }[];
  totais: { pontos_precipitacao: number; celulas_temperatura: number };
  corte_imerg_final: string;
  corte_merra2: string;
  base_climatologica: string;
  separacao: { observacao: string; estimativa: string; previsao: string; cenario: string };
};

/* ---------- P020 reservatórios e balanço ---------- */

export type AguaReservatorio = {
  id: string;
  nome: string;
  subsistema: string | null;
  bacia: string | null;
  tipo: string | null;
  vol_util_total_hm3: number | null;
  vol_util_pct_fim: number | null;
  dv_obs_hm3: number | null;
  afluencia_hm3: number | null;
  defluencia_hm3: number | null;
  turbinado_hm3: number | null;
  vertido_hm3: number | null;
  outras_estruturas_hm3: number | null;
  /** Defluência − (turbinada + vertida + outras estruturas informadas). */
  defluencia_nao_discriminada_hm3: number | null;
  transferido_hm3: number | null;
  natural_hm3: number | null;
  /** ΔV observado − (afluência − defluência). */
  residuo_hm3: number | null;
  residuo_com_transferencia_hm3: number | null;
  dias_residuo_dentro_tolerancia_pct: number | null;
  balanco_calculado: boolean;
  ear_max_mwmes: number | null;
};

export type AguaParcelaEar = { cod: string; nome: string | null; parte: "proprio" | "jusante"; delta_mwmes: number | null };

export type AguaDecomposicaoEar = {
  sm: Submercado;
  inicio: string;
  fim: string;
  delta_ear_mwmes: number | null;
  soma_reservatorios_mwmes: number | null;
  residuo_mwmes: number | null;
  n_reservatorios: number;
  maiores_quedas: AguaParcelaEar[];
  maiores_altas: AguaParcelaEar[];
  /** Contexto da mesma janela: não fecha balanço com a variação da EAR. */
  contexto: {
    ena_bruta_media_mwmed: number | null;
    ena_armazenavel_media_mwmed: number | null;
    geracao_hidraulica_media_mwmed: number | null;
    horas_geracao: number;
    comparavel_com_delta_ear: false;
  };
};

export type AguaReservatorios = {
  inicio: string;
  fim: string;
  volume_inicial_em: string;
  lista: AguaReservatorio[];
  criterio_lista: string;
  n_sem_volume_util: number;
  n_reservatorios: number;
  n_com_balanco: number;
  n_fecham_por_construcao: number;
  sem_cadastro: string[];
  decomposicao_ear: AguaDecomposicaoEar[];
  /** Últimos 60 dias dos 8 reservatórios de maior volume útil. */
  series_principais: {
    id: string;
    nome: string;
    d: string[];
    vol: (number | null)[];
    afl: (number | null)[];
    defl: (number | null)[];
    turb: (number | null)[];
    vert: (number | null)[];
  }[];
};

/* ---------- gold ---------- */

export type AguaProvenienciaChave =
  | "ear_sin"
  | "capacidade"
  | "ear_ree"
  | "ear_bacia"
  | "ena_30d"
  | "ena_recortes"
  | "mlt"
  | "balanco"
  | "precipitacao"
  | "temperatura";

export type AguaEvidenciaChave =
  | "ear_sin"
  | "ear_sin_mwmes"
  | "capacidade"
  | "ena_30d_sin"
  | "mlt_pmo_vs_aberto"
  | "temperatura_sin_30d"
  | "precipitacao_maior_bacia_30d"
  | "balanco_maior_reservatorio";

export type AguaDetalheGold = Cabecalho & {
  dias_referencia: {
    ear: string;
    ena: string;
    ree: string | null;
    bacias: string | null;
    reservatorios: string | null;
    precipitacao: string | null;
    temperatura: string | null;
  };
  regras: Record<string, string>;
  armazenamento: AguaArmazenamento;
  reconciliacao_ear: AguaReconciliacaoEar;
  afluencia: AguaAfluencia;
  clima: AguaClima | null;
  reservatorios: AguaReservatorios | null;
  /** Partes que não puderam ser construídas nesta execução, com o motivo. */
  pendencias: string[];
  /** Controles não críticos que falharam (visíveis na página). */
  ressalvas: string[];
  proveniencia: Partial<Record<AguaProvenienciaChave, Proveniencia>>;
  evidencias: Partial<Record<AguaEvidenciaChave, Evidencia>>;
  downloads: Download[];
};
