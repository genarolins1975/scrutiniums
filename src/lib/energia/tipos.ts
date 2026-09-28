/**
 * Tipos do domínio Energia: espelho do contrato da gold publicada por
 * pipeline/energia (ver docs/observatorios/MODELO_AUDITABILIDADE.md).
 * A leitura acontece no build (Server Components); nenhum dado é inventado
 * na interface: campo ausente é null e é exibido como ausência.
 */

export type Natureza = "OBSERVADO" | "CALCULADO" | "ESTIMADO" | "PREVISTO" | "CENARIO";
export type Submercado = "SE" | "S" | "NE" | "N";
export type Regiao = Submercado | "SIN";

export type Fonte = {
  orgao: string;
  dataset: string;
  recurso: string;
  url_dataset: string;
  url_primaria: string;
  licenca: string;
};

export type Periodo = { inicio: string; fim: string };

export type Proveniencia = {
  indicador: string;
  natureza: Natureza;
  fonte: Fonte;
  unidade: string;
  frequencia: string;
  periodo_referencia: Periodo;
  publicado_pela_fonte_em: string | null;
  capturado_em: string | null;
  validado_em: string;
  cobertura_historica: Periodo;
  transformacoes: string[];
  formula: string | null;
  snapshot: { id: string | null; sha256: string | null };
  versao_pipeline: string;
  versao_codigo: string | null;
  /** Revisões detectadas entre as vintages integradas; null quando a detecção não se aplica. */
  revisoes_conhecidas: {
    detectado_em: string;
    total: number;
    vintages_comparadas?: number;
    arquivos?: number;
    /** Downloads bem-sucedidos que vieram idênticos a uma captura já integrada (não viram vintage). */
    recapturas_sem_mudanca?: number;
    ultimo_download_ok?: string | null;
    exemplos: { serie: string; ref: string; valores: number }[];
  } | null;
  limitacoes: string[];
  download: string | null;
  notas_fonte: string | null;
};

export type Cabecalho = {
  dominio: "energia";
  gold: string;
  gerado_em: string;
  versao_pipeline: string;
  versao_codigo: string | null;
  disponivel: boolean;
  motivo?: string;
};

export type Download = { rotulo: string; url: string };

/* ---------- PLD ---------- */

export type PldCartao = {
  sm: Submercado;
  nome: string;
  media_dia: number;
  min_hora: number;
  quando_min: string;
  max_hora: number;
  quando_max: string;
  variacao_dia_anterior: { abs: number; pct: number | null } | null;
  media_7d_anteriores: number | null;
  variacao_vs_7d: { abs: number; pct: number | null } | null;
  posicao: {
    percentil: number | null;
    faixa: "baixa" | "central" | "alta" | null;
    n_dias: number;
    quartis: { p25: number | null; p50: number | null; p75: number | null };
  };
  menor_valor_ano: number;
  horas_no_menor_valor_ano: number;
};

export type PldPeriodoSm = {
  media: number;
  min: number;
  quando_min: string;
  max: number;
  quando_max: string;
  desvio_padrao: number | null;
  permanencia: { baixa: number; central: number; alta: number };
  frac_menor_valor_ano: number;
};

export type PldPeriodo = {
  rotulo: string;
  inicio: string;
  fim: string;
  n_horas: number;
  por_submercado: Record<Submercado, PldPeriodoSm>;
  diferenca: { horas_acima_limiar: number; frac_horas_acima_limiar: number; maior: number; quando_maior: string };
};

export type PontoSm = { [K in Submercado]: number | null };

export type PldGold = Cabecalho & {
  unidade: string;
  fuso: string;
  dia_referencia: string;
  primeira_hora: string;
  ultima_hora: string;
  coleta_direta: { tentado_em: string; ok: boolean; detalhe: string } | null;
  regras: Record<string, string>;
  limiar_diferenca: number;
  cartoes: PldCartao[];
  periodos: Record<"hoje" | "7d" | "30d" | "12m" | "historico", PldPeriodo>;
  curva_horaria: { dia: string; horas: ({ h: string } & PontoSm)[] };
  horario_30d: ({ t: string } & PontoSm)[];
  diario: ({ d: string } & PontoSm)[];
  mensal: ({ m: string; dias: number; parcial: boolean } & PontoSm)[];
  menor_valor_ano: ({ ano: string; ate: string } & PontoSm)[];
  quartis_horarios: Record<Submercado, { p25: number | null; p75: number | null }>;
  snapshot: { id: string | null; sha256: string | null; capturas: unknown[] };
  proveniencia: { horario: Proveniencia; diario: Proveniencia; posicao: Proveniencia; estatisticas?: Proveniencia; mensal?: Proveniencia };
  downloads: Download[];
};

/* ---------- Hidrologia ---------- */

export type Faixa = "abaixo" | "dentro" | "acima" | null;

export type HidroSubsistema = {
  sm: Regiao;
  nome: string;
  ear: {
    valor: number | null;
    dia: string;
    natureza: Natureza;
    variacao_7d_pp: number | null;
    variacao_30d_pp: number | null;
    mediana_historica: number | null;
    p10: number | null;
    p90: number | null;
    anos_na_base: number;
    desvio_mediana_pp: number | null;
    percentil_na_data: number | null;
    faixa: Faixa;
  };
  ena: {
    dia: string;
    pct_mlt_dia: number | null;
    natureza_dia: Natureza;
    pct_mlt_30d: number | null;
    percentil_30d_mesma_janela: number | null;
    p10_30d: number | null;
    p90_30d: number | null;
    anos_na_base_30d: number;
    faixa_30d: Faixa;
  };
};

export type SerieRegiao = { [K in Regiao]?: number | null };

export type HidrologiaGold = Cabecalho & {
  dia_referencia_ear: string;
  dia_referencia_ena: string;
  regras: Record<string, string>;
  subsistemas: HidroSubsistema[];
  desvio_principal: { sm: Regiao; nome: string; desvio_pp: number } | null;
  serie_ear: ({ d: string } & SerieRegiao)[];
  serie_ena: ({ d: string } & SerieRegiao)[];
  bandas_ear: ({ md: string } & Record<string, number | null | string>)[];
  mensal_ear: ({ m: string } & SerieRegiao)[];
  proveniencia: { ear: Proveniencia; ear_sin: Proveniencia; padrao: Proveniencia; ear_mensal?: Proveniencia; ena: Proveniencia; ena30: Proveniencia };
  fonte_notas: { ear: string | null; ena: string | null };
  downloads: Download[];
};

/* ---------- Carga ---------- */

export type CargaComparacao = {
  media: number;
  media_ano_anterior: number;
  variacao_pct: number | null;
  mesmo_regime: boolean;
  inicio: string;
  fim: string;
  inicio_anterior: string;
  fim_anterior: string;
} | null;

export type CargaGold = Cabecalho & {
  dia_referencia: string;
  unidade: string;
  regras: Record<string, string>;
  regimes: { inicio: string; fim: string | null; descricao: string }[];
  subsistemas: { sm: Regiao; nome: string; natureza: Natureza; dia: number; ult7: CargaComparacao; ult30: CargaComparacao; max_12m: { valor: number; dia: string } }[];
  serie: ({ d: string } & SerieRegiao)[];
  mensal: ({ m: string; dias: number } & SerieRegiao)[];
  proveniencia: { carga: Proveniencia; sin: Proveniencia; mensal?: Proveniencia };
  fonte_notas: string | null;
  downloads: Download[];
};

/* ---------- Geração ---------- */

export type FonteGeracao = "hidraulica" | "termica" | "eolica" | "solar";

export type Mix = {
  inicio: string;
  fim: string;
  mwmed: Record<FonteGeracao, number>;
  total_mwmed: number;
  participacao: Record<FonteGeracao, number>;
  hes: number;
} | null;

export type GeracaoGold = Cabecalho & {
  dia_referencia: string;
  fontes: { id: FonteGeracao; nome: string }[];
  regras: Record<string, string>;
  regioes: { rg: Regiao; nome: string; dia: Mix; "7d": Mix; "30d": Mix; "12m": Mix }[];
  comparacao_anual: { ano: number; "7d": Mix; "30d": Mix }[];
  termica_contexto: {
    participacao_7d: number | null;
    mediana_365d: number | null;
    p10_365d: number | null;
    p90_365d: number | null;
    percentil: number | null;
    n_janelas: number;
  };
  perfil_horario_sin: ({ h: string } & Record<FonteGeracao, number | null>)[];
  serie_sin: ({ d: string } & Record<FonteGeracao, number | null>)[];
  serie_termica_7d?: { d: string; termica_7d: number | null }[];
  inicio_regime_atual?: string;
  anos_fora_do_regime?: number[];
  /** Solar do SIN e do Sul na véspera e no dia da quebra de 29/04/2023 (MWmed). */
  degrau_solar?: { antes: string; depois: string; solar_sin_antes: number; solar_sin_depois: number; solar_s_antes: number; solar_s_depois: number } | null;
  /** Mix do SIN nos 12 meses anteriores aos últimos 12, quando a janela inteira está no regime atual. */
  mix_12m_anterior_sin?: Mix;
  proveniencia: { geracao: Proveniencia; termica_7d?: Proveniencia };
  fonte_notas: string | null;
  downloads: Download[];
};

/* ---------- Rede ---------- */

export type RedeGold = Cabecalho & {
  dia_referencia: string;
  dia_referencia_liquido: string | null;
  ultimo_dia_pld: string | null;
  regras: Record<string, string>;
  /** R$/MWh: diferença de PLD médio diário acima da qual o dia conta como "com diferença". */
  limiar_diferenca_dia?: number;
  fronteiras: {
    par: string;
    de: Submercado;
    para: Submercado;
    nome: string;
    fluxo_dia: number | null;
    programado_dia: number | null;
    fluxo_media_30d: number | null;
    fluxo_media_30d_anterior?: number | null;
    dias_sentido_canonico_30d: number;
    diferenca_preco_ultimo_dia_comum: { dia: string; valor: number } | null;
    dias_com_diferenca_30d: number;
    n_dias_pld_30d: number;
  }[];
  liquido_subsistemas: { sm: Submercado; nome: string; dia: number | null; media_30d: number | null }[];
  serie_fluxos: ({ d: string } & Record<string, number | null | string>)[];
  serie_amplitude_pld: { d: string; amplitude: number }[];
  resumo_amplitude?: {
    dia: string;
    valor: number;
    media_30d: number | null;
    media_30d_anterior: number | null;
    maior_30d: { dia: string; valor: number };
  } | null;
  limites_integrados: boolean;
  balanco_sin?: {
    dia: string;
    soma_saldos: number | null;
    intercambio_sin: number | null;
    dias_365: number;
    dias_sin_nao_nulo_365: number;
    horas_sin_nulo_total: number;
    horas_total: number;
    dias_divergentes: string[];
  } | null;
  proveniencia: { fluxo: Proveniencia; diferenca: Proveniencia; amplitude: Proveniencia; saldos?: Proveniencia };
  fonte_notas: string | null;
  downloads: Download[];
};

/* ---------- CMO ---------- */

export type CmoGold = Cabecalho & {
  semana_referencia: string;
  unidade: string;
  ultima_semana: { sm: Submercado; nome: string; semanal: number; leve: number | null; media: number | null; pesada: number | null; semana_anterior: number | null }[];
  serie: ({ s: string } & PontoSm)[];
  proveniencia: { cmo: Proveniencia };
  fonte_notas: string | null;
  downloads: Download[];
};

/* ---------- Síntese ---------- */

export type Trecho = { texto: string; evidencia?: string; href?: string };

export type SinteseGold = Cabecalho & {
  frases: { id: string; ref: string; natureza: Natureza; regra: string; trechos: Trecho[] }[];
  observar: { id: string; titulo: string; condicao: string; ativo: boolean; evidencia: string; href: string; tipo: "regra" | "dados" | "evento" }[];
  nota: string;
};

/* ---------- Modelos e previsões ---------- */

export type EstadoModelo = "PESQUISA" | "VALIDACAO" | "PRODUCAO" | "APOSENTADO";

export type Modelo = {
  id: string;
  codigo: string;
  nome: string;
  /** O que o modelo faz, em uma frase sem jargão. */
  resumo?: string;
  /** A limitação mais importante, em linguagem direta. */
  limitacao_principal?: string;
  versao: string;
  estado: EstadoModelo;
  papel: string;
  objetivo: string;
  metodologia: string;
  formula: string | null;
  features: string[];
  usa_hidrologia: boolean;
  dados_treinamento: string;
  janela: string;
  benchmarks: string[];
  limitacoes: string[];
  falhas_conhecidas: string[];
  promovido_em: string | null;
  versao_codigo: string | null;
  snapshot: string | null;
  evidencias: { descricao: string; arquivo: string; sha256: string }[];
  auditoria: string;
};

export type ModelosGold = Cabecalho & {
  fonte: Record<string, string> & { codigos_internos?: Record<string, string> };
  publicacao_resultados: { liberada: boolean; motivo: string; condicoes: string[] };
  definicoes: Record<string, string>;
  modelos: Modelo[];
  em_producao: string[];
};

export type RegistroPrevisao = {
  forecast_id: string;
  tipo: "PUBLICACAO" | "RODADA_INTERNA";
  run_id: string;
  origem: string;
  cutoff: string;
  prazo?: string;
  emitido_em: string;
  /** Data (AAAA-MM-DD, Brasília) em que o registro entrou no arquivo da plataforma. */
  registrado_no_portal_em: string;
  natureza?: "PREVISTO";
  features_usadas?: { serie: string; capturado_em: string }[];
  frequencia: "W" | "M";
  horizonte: string;
  entrega: { id: string; inicio: string; fim: string };
  submercado: Submercado;
  modelo: string;
  versao_modelo: string;
  estado_modelo: EstadoModelo;
  versao_codigo: string | null;
  snapshot: string | null;
  previsao: number | null;
  quantis: Record<string, number | string> | null;
  calibracao: { status: string; cobertura?: number; n?: number };
  status: "DISPONIVEL" | "INDISPONIVEL";
  motivo: string | null;
  alertas: string[];
  sha256: string;
  substitui: string | null;
  motivo_correcao: string | null;
};

export type PrevisoesGold = Cabecalho & {
  atual: {
    disponivel: boolean;
    motivo_codigo?: string | null;
    motivo?: string | null;
    ultima_execucao?: {
      run_id: string;
      tipo: string;
      origem: string;
      cutoff: string;
      emitido_em: string;
      modelo: string;
      versao_modelo: string;
      estado_modelo: EstadoModelo;
      celulas: number;
      com_numero: number;
      motivos: string[];
      alertas: string[];
    } | null;
    informacao_faltante?: string[];
    estado_pipeline?: string;
    modelo?: string;
  };
  publicacoes: number;
  rodadas: NonNullable<PrevisoesGold["atual"]["ultima_execucao"]>[];
  arquivo: RegistroPrevisao[];
  apuracoes: unknown[];
  regras: Record<string, string>;
};

/* ---------- Catálogo e meta ---------- */

export type EstadoCatalogo =
  | "CATALOGADO"
  | "EM INTEGRAÇÃO"
  | "INTEGRADO"
  | "VALIDADO"
  | "UTILIZADO EM INDICADOR"
  | "UTILIZADO EM MODELO";

export type EntradaCatalogo = {
  id: string;
  slug: string | null;
  orgao: string;
  nome: string | null;
  titulo: string;
  url: string;
  licenca: string | null;
  modificado_na_fonte: string | null;
  descricao: string;
  n_recursos: number | null;
  formatos: string[];
  tema: string;
  estado: EstadoCatalogo;
  usado_em: string[];
  modelos: string[];
  /** origem: FONTE = declarada na descrição do conjunto; PLATAFORMA = identificada pela Scrutiniums no dado. */
  quebras: { data: string; descricao: string; origem?: "FONTE" | "PLATAFORMA" }[];
  metadados_verificados: boolean;
  descontinuado: boolean;
};

export type CatalogoGold = {
  dominio: "energia";
  gerado_em: string;
  disponivel: boolean;
  estados: EstadoCatalogo[];
  definicoes_estado: Record<string, string>;
  portais: Record<string, { colhido_em: string | null; conjuntos: number; erro: string | null }>;
  contagem: Record<string, number>;
  total: number;
  entradas: EntradaCatalogo[];
};

export type MetaGold = Cabecalho & {
  golds: Record<string, { disponivel: boolean; gerado_em: string | null }>;
  fontes: Record<string, {
    ultima_captura: string | null;
    snapshot: string | null;
    snapshot_sha256: string | null;
    ultima_tentativa: { tentado_em: string; ok: boolean; detalhe: string } | null;
    capturas: { recurso: string; sha256: string; capturado_em: string; publicado_em: string | null; origem: string }[];
    recapturas_sem_mudanca?: number | null;
    historico?: { recurso: string; sha256: string; capturado_em: string; publicado_em: string | null; origem: string; vigente: boolean }[];
  }>;
  regressoes: { gold: string; motivo: string }[];
  builders_falhos: { gold: string; motivo: string }[];
  coleta_executada: boolean;
};
