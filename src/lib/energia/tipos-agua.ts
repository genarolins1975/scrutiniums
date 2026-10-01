/**
 * Tipos da gold do módulo Água e clima (detalhe) (public/energia/gold/agua_detalhe.json),
 * espelho exato do que pipeline/energia/modulos/agua_detalhe.py publica para os painéis
 * P017 a P020. Complementa hidrologia.json (EAR e ENA por subsistema), sem substituí-la.
 *
 * Unidades: EAR em MWmês (1 MWmês = 720 MWh); ENA e MLT em MWmed (média do dia); volumes
 * em hm³; vazões em m³/s; chuva em mm; temperatura em °C. Ausência é null e é exibida como
 * ausência (nunca zero). Séries longas vêm em colunas (arrays paralelos): o índice i de
 * cada array se refere ao mesmo ponto. Séries com `d0` e `passo_dias` têm dias regulares: a
 * data do ponto i é `d0` + `passo_dias` × i (dia sem dado = null, nunca preenchido).
 * EAR máxima zero (recorte sem armazenamento) = percentual, faixa e percentil "não se
 * aplica" (null). Nenhum número é recalculado na interface.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Natureza, Proveniencia, Regiao, Submercado } from "./tipos";

/** Posição frente à faixa do 10º ao 90º percentil. */
export type FaixaUsual = "abaixo" | "dentro" | "acima";

/* ---------- P017 armazenamento ---------- */

/** Campos da faixa sazonal comuns a subsistemas, SIN, REE e bacias. */
export type AguaFaixaSazonal = {
  /** Faixa do mesmo dia do calendário nos anos completos da base (% da EAR máxima); null com menos de 5 anos ou sem armazenamento. */
  p10: number | null;
  p50: number | null;
  p90: number | null;
  anos_na_base: number;
  /** Primeiro e último ano realmente usados ("2018-2025"). */
  periodo_base: string | null;
  p10_mwmes: number | null;
  p50_mwmes: number | null;
  p90_mwmes: number | null;
  faixa: FaixaUsual | null;
  percentil_na_data: number | null;
  ear_max_base_min_mwmes: number | null;
  ear_max_base_max_mwmes: number | null;
  /** A EAR máxima mudou mais de 5% dentro da base: a faixa em % mistura capacidades diferentes. */
  capacidade_mudou_na_base: boolean;
};

export type AguaCaptura = "silver principal" | "recaptura do módulo";

export type AguaEarSubsistema = AguaFaixaSazonal & {
  sm: Regiao;
  nome: string;
  dia: string;
  natureza: Natureza;
  /** Captura do arquivo anual usada (a mais recente entre o silver principal e a recaptura do módulo). */
  captura: AguaCaptura | null;
  capturado_em: string | null;
  ear_pct: number | null;
  ear_mwmes: number | null;
  ear_max_mwmes: number | null;
  participacao_capacidade_sin_pct: number | null;
  participacao_armazenado_sin_pct: number | null;
  variacao_7d_mwmes: number | null;
  variacao_30d_mwmes: number | null;
  variacao_12m_mwmes: number | null;
  variacao_30d_pp: number | null;
  /** Último ano a cada 14 dias com a faixa da data (mesmas regras dos REE e das bacias). */
  semanal: AguaSemanal;
};

/** Pequeno múltiplo: um ponto a cada `passo_dias` dias desde `d0` (inclusive) até o dia de referência. */
export type AguaSemanal = {
  d0: string;
  passo_dias: number;
  v: (number | null)[];
  p10: (number | null)[];
  p90: (number | null)[];
};

/** REE ou bacia (conjuntos EAR por REE e EAR por bacia do ONS). */
export type AguaEarRecorte = AguaFaixaSazonal & {
  nome: string;
  /** Só REE: primeiro ano da base (2018 para os REE com perímetro mudado no fim de 2017). */
  base_desde?: number;
  /** Só REE: data da quebra de perímetro que afetou o REE, ou null. */
  perimetro_mudou_em?: string | null;
  dia: string | null;
  /** null quando a EAR máxima é zero (não se aplica). */
  ear_pct: number | null;
  ear_mwmes: number | null;
  ear_max_mwmes: number | null;
  /** EAR máxima zero no dia (só usinas a fio d'água): percentual não se aplica. */
  sem_armazenamento: boolean;
  variacao_7d_pp: number | null;
  variacao_30d_pp: number | null;
  variacao_30d_mwmes: number | null;
  /** null quando o recorte não tem armazenamento. */
  semanal: AguaSemanal | null;
};

/** Quebra de perímetro dos REE detectada nos arquivos (REE novo recortado de REE existentes). */
export type AguaQuebraPerimetroRee = {
  data: string;
  /** Último dia da configuração anterior com a mesma soma de EAR máximas. */
  dia_soma_conservada: string | null;
  /** Dias com perímetro já mudado e REE novos ainda ausentes. */
  transicao: string[];
  novos: string[];
  afetados: string[];
  soma_ear_max_antes_mwmes: number | null;
  soma_ear_max_depois_mwmes: number | null;
  comparacao: {
    nome: string;
    ear_max_antes_mwmes: number | null;
    ear_max_depois_mwmes: number | null;
    perimetro_mudou: boolean;
    novo: boolean;
  }[];
};

export type AguaReservatorioEvento = {
  nome: string;
  parte: "proprio" | "jusante";
  tipo: "entrada" | "saida" | "alteracao";
  variacao_mwmes: number | null;
};

/** Antes, depois, atribuído e tolerância estão em agua_capacidade_eventos.csv. */
export type AguaEventoCapacidade = {
  data: string;
  sm: Submercado;
  variacao_mwmes: number | null;
  residuo_mwmes: number | null;
  /** Resíduo dentro da tolerância (10 MWmês até 2017, valores inteiros; 0,05 MWmês desde 2018). */
  fechado: boolean;
  /** Até três maiores; a lista completa está em agua_capacidade_eventos.csv. */
  reservatorios: AguaReservatorioEvento[];
  n_reservatorios: number;
};

export type AguaColunasMwmes<K extends string> = Record<K, string[]> & Record<Regiao, (number | null)[]>;

/** Colunas por região com dias regulares desde d0. */
export type AguaColunasRegiao = { d0: string; passo_dias: number } & Record<Regiao, (number | null)[]>;

export type AguaArmazenamento = {
  dia: string;
  subsistemas: AguaEarSubsistema[];
  /** EAR no último dia com dado de cada mês, desde 2000. */
  serie_mensal_mwmes: AguaColunasMwmes<"m"> & {
    SIN_max: (number | null)[];
    /** Meses cujo ponto não é o último dia do calendário (o mês corrente, incompleto, inclusive). */
    meses_sem_ultimo_dia: { m: string; d: string }[];
    /** Mês corrente incompleto, com o dia usado, ou null. */
    mes_parcial: { m: string; d: string } | null;
  };
  /** EAR diária dos últimos 120 dias. */
  serie_diaria_mwmes: AguaColunasRegiao;
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
  quebras_perimetro_ree: AguaQuebraPerimetroRee[];
};

export type AguaCapturaAno = {
  ano: number;
  fonte: AguaCaptura;
  capturado_em: string | null;
  recurso: string | null;
  vintage_id: string | null;
};

/** Revisão do ONS entre a captura do silver principal e a recaptura (últimos 30 dias). */
export type AguaRevisaoCaptura = {
  sm: Submercado;
  serie: string;
  dias_revisados: number;
  dia_maior: string;
  silver_principal: number | null;
  recaptura: number | null;
  diferenca: number | null;
};

export type AguaReconciliacaoEar = {
  dia: string;
  pct_publicado_vs_recalculado_max_pp: number | null;
  pares_conferidos: number;
  soma_ree_mwmes: number | null;
  n_ree: number;
  soma_bacias_mwmes: number | null;
  n_bacias: number;
  /** SIN da captura mais recente (a base dos números exibidos). */
  sin_mwmes: number | null;
  /** Igual a sin_mwmes quando a captura usada é a recaptura feita junto com REE, bacia e reservatório. */
  sin_mesma_captura_mwmes: number | null;
  /** SIN no silver principal no mesmo dia (null se a captura dele não tem o dia). */
  sin_silver_principal_mwmes: number | null;
  captura_por_ano: AguaCapturaAno[];
  revisoes_entre_capturas_30d: AguaRevisaoCaptura[];
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
  /** Relatório citado: o do próprio mês quando coletado. */
  relatorio: string;
  relatorio_do_proprio_mes: boolean;
  dias_no_conjunto: number;
  aberto_inicio_mwmed: number | null;
  aberto_fim_mwmed: number | null;
  dif_inicio_pct: number | null;
  dif_fim_pct: number | null;
};

export type AguaMlt = {
  pmo: {
    comparacao: AguaMltComparacaoPmo[];
    /** Todos os relatórios que publicam o mês (o do mês e o do mês anterior, como projeção). */
    relatorios_por_mes: { mes: string; relatorios: string[]; valores_iguais: boolean }[];
    tolerancia_pct: number;
    meses_coincidentes: string[];
    dias_coincidentes: { inicio: string; fim: string }[];
    meses_divergentes: string[];
    maior_diferenca_pct: number | null;
    relatorios: string[];
  };
  /** Mudanças da MLT de usinas existentes fora do dia 1º, comparadas por igualdade com versões anteriores. */
  revisoes_no_mes: {
    data: string;
    usinas: number;
    exemplos: { nome: string; sm: string; antes: number | null; depois: number | null; variacao_pct: number | null }[];
    variacao_mediana_pct: number | null;
    abrangencia: "ampla" | "pontual";
    iguais_a_1_ano_antes: number;
    comparaveis_1_ano_antes: number;
    iguais_a_2_anos_antes: number;
    comparaveis_2_anos_antes: number;
    vespera_igual_ao_ano_anterior: number;
    vespera_comparaveis: number;
    classificacao: "retorno_a_versao_anterior" | "nova_versao";
    /** Data (1 ou 2 anos antes) cujos valores a revisão restaurou. */
    igual_a_vigente_em: string | null;
  }[];
  /** Nova versão desfeita depois por um retorno à versão que vigorava antes dela. */
  periodos_provisorios: {
    inicio: string;
    fim: string;
    retorno_em: string;
    versao_restaurada_igual_a_de: string;
    usinas_na_nova_versao: number;
    usinas_no_retorno: number;
  }[];
  /** Ano corrente: MLT do último dia de cada mês encerrado igual à do mesmo mês do ano anterior. */
  ano_corrente_igual_ao_anterior: { mes: string; usinas_comparadas: number; usinas_iguais: number }[];
  /** MLT vigente no último dia de janeiro e de julho comparada com a do mesmo mês do ano anterior. */
  anos: { ano: number[]; mes: number[]; usinas_comparadas: number[]; usinas_com_mlt_diferente: number[] };
  anos_regra: string;
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
  captura_por_ano: AguaCapturaAno[];
  revisoes_entre_capturas_30d: AguaRevisaoCaptura[];
  /** REE que aparecem no arquivo de ENA depois do início do conjunto (reconfiguração). */
  ree_novos_por_data: { data: string; novos: string[] }[];
  /** ENA de 30 dias (% MLT) a cada 7 dias nos últimos 18 meses; o ponto i termina em d0 + 7 × i. */
  serie_30d_semanal: AguaColunasRegiao;
  conferencia_bacias_sin: {
    dia: string;
    soma_bacias_mwmed: number | null;
    sin_mwmed: number | null;
    diferenca_mwmed: number | null;
    captura_sin: AguaCaptura | null;
  } | null;
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
    /** Meses com dias IMERG Late (preliminares), deste mês em diante; null se nenhum. */
    preliminar_desde: string | null;
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
  /** Últimos 45 dias (consecutivos desde d0) com a faixa do mesmo dia do calendário (2001 a 2025). */
  diaria: {
    d0: string;
    passo_dias: number;
    t: (number | null)[];
    tmax: (number | null)[];
    p10: (number | null)[];
    p90: (number | null)[];
  };
};

/** PREVISÃO (não observação): rodada de 00Z do ECMWF IFS 0,25°, substituída a cada rodada. */
export type AguaPrevisao = {
  natureza: "PREVISTO";
  modelo: string;
  /** Inicialização da rodada (emissão), UTC. */
  emitida_em: string;
  capturada_em: string;
  idade_horas: number | null;
  /** Primeiro dia previsto (dia UTC); o dia i é d0 + i. */
  d0: string;
  n_dias: number;
  dia_utc: true;
  bacias: {
    bacia: string;
    mm: (number | null)[];
    mm_7d: number | null;
    mm_total: number | null;
    /** Média 2001 a 2025 dos mesmos dias pelo IMERG (outro produto: ordem de grandeza). */
    imerg_media_7d_mm: number | null;
    imerg_media_total_mm: number | null;
    anos_climatologia: number;
  }[];
  temperatura: {
    recorte: Regiao;
    t: (number | null)[];
    tmax: (number | null)[];
    t_media_7d_c: number | null;
    merra2_media_7d_c: number | null;
    anos_climatologia: number;
  }[];
  comparabilidade: string;
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
    /** Primeiro e último mês realmente comparados (AAAA-MM); null sem par bacia e mês. */
    periodo: { inicio: string; fim: string } | null;
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
  /** null quando não há rodada válida (motivo em `pendencias`). */
  previsao: AguaPrevisao | null;
};

/* ---------- P020 reservatórios e balanço ---------- */

export type AguaConvencaoDefluencia = "inclui_outras" | "exclui_outras" | "sem_outras_estruturas" | "indeterminada";

export type AguaReservatorio = {
  id: string;
  /** cod_usina do ONS: liga o reservatório às parcelas da decomposição da EAR (por usina). */
  cod: string | null;
  nome: string;
  subsistema: string | null;
  bacia: string | null;
  vol_util_total_hm3: number | null;
  vol_util_pct_fim: number | null;
  dv_obs_hm3: number | null;
  afluencia_hm3: number | null;
  defluencia_hm3: number | null;
  turbinado_hm3: number | null;
  vertido_hm3: number | null;
  outras_estruturas_hm3: number | null;
  /** Defluência − turbinada − vertida (− outras, se a defluência as inclui); null com convenção indeterminada. */
  defluencia_nao_discriminada_hm3: number | null;
  transferido_hm3: number | null;
  natural_hm3: number | null;
  /** ΔV observado − (afluência − defluência). */
  residuo_hm3: number | null;
  residuo_com_transferencia_hm3: number | null;
  /** Na janela de 30 dias publicada. */
  dias_residuo_dentro_tolerancia_pct: number | null;
  dias_residuo_avaliados: number;
  /** Em toda a série diária disponível (período em periodo_fecham_por_construcao). */
  serie_dias_residuo_dentro_tolerancia_pct: number | null;
  convencao_defluencia: AguaConvencaoDefluencia;
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
  sem_balanco_por_motivo: Record<string, number>;
  /** Na série diária disponível (critério e período nos campos seguintes). */
  n_fecham_por_construcao: number;
  criterio_fecham_por_construcao: string;
  periodo_fecham_por_construcao: { inicio: string; fim: string } | null;
  n_fecham_na_janela: number;
  convencao_defluencia: Partial<Record<AguaConvencaoDefluencia, number>>;
  sem_cadastro: string[];
  decomposicao_ear: AguaDecomposicaoEar[];
  /** Séries diárias de 45 dias de cada reservatório da lista, no JSON lido sob demanda. */
  series_45d: { arquivo: string; d0: string; fim: string; dias: number };
};

/** Série diária de um reservatório (dias consecutivos desde d0; null = sem dado no dia). */
export type AguaSerieReservatorio = {
  id: string;
  nome: string;
  d0: string;
  passo_dias: number;
  /** Volume útil, % do volume útil total. */
  vol: (number | null)[];
  /** Vazões afluente, defluente, turbinada e vertida, m³/s. */
  afl: (number | null)[];
  defl: (number | null)[];
  turb: (number | null)[];
  vert: (number | null)[];
};

/** public/energia/series/agua_reservatorios_45d.json (um item por reservatório da lista da gold, na mesma ordem). */
export type AguaReservatorios45d = {
  fim: string;
  d0: string;
  passo_dias: number;
  criterio: string;
  reservatorios: AguaSerieReservatorio[];
};

/* ---------- gold ---------- */

export type AguaProvenienciaChave =
  | "ear_sin"
  | "capacidade"
  | "ear_ree"
  | "ear_bacia"
  | "ena_30d"
  | "ena_30d_ree"
  | "ena_30d_bacia"
  | "mlt"
  | "balanco"
  | "precipitacao"
  | "temperatura"
  | "previsao";

export type AguaEvidenciaChave =
  | "ear_sin"
  | "ear_sin_mwmes"
  | "capacidade"
  | "ena_30d_sin"
  | "ena_arm_30d_sin"
  | "mlt_pmo_vs_aberto"
  | "temperatura_sin_30d"
  | "precipitacao_maior_bacia_30d"
  | "balanco_maior_reservatorio"
  | "fecham_por_construcao";

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
