/**
 * Tipos da gold do módulo Previsões (public/energia/gold/previsoes_desempenho.json), espelho
 * exato do que pipeline/energia/modulos/previsoes.py publica para os painéis P013 a P016.
 * Valores em R$/MWh nominais, salvo onde indicado; coberturas em fração de 0 a 1; ausência
 * é null e é exibida como ausência (nunca zero). Nenhuma métrica é recalculada na interface.
 *
 * O arquivo de emissões completo não está aqui: cada mês fica em
 * public/energia/series/previsoes_emissoes_AAAA-MM.json (tipo `ParticaoEmissoes`), com o
 * índice em previsoes.json (`emissoes.particoes`), e é carregado sob demanda.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Proveniencia, Submercado } from "./tipos";

export type Horizonte = "W1" | "W2" | "W3" | "W4" | "M1" | "M2" | "M3";
export type Frequencia = "W" | "M";
export type CodigoModelo = "B0" | "S0" | "C1" | "C2-P" | "C2-H";
export type ModeloAvaliado = "B0" | "S0" | "C2-P" | "C2-H";
export type EstadoModelo = "PESQUISA" | "VALIDACAO" | "PRODUCAO" | "APOSENTADO";
export type Periodo = "desenvolvimento" | "teste";
/** Estado da faixa P10 a P90 pela regra da governança (n = entregas distintas). */
export type EstadoCalibracao = "CALIBRADO" | "DESCALIBRADO" | "AMOSTRA_INSUFICIENTE" | "SEM_AVALIACAO";
export type TipoRegistro = "PUBLICACAO" | "RODADA_INTERNA" | "REFERENCIA_EXPERIMENTAL";
export type ResultadoTeste = "aprovado" | "ressalva" | "reprovado";

/* ---------- P016: desempenho e calibração ---------- */

/** Uma linha de métricas. Em `por_horizonte` o submercado é null (os quatro juntos); em
 * `por_frequencia` o campo `horizonte` traz a frequência ("W" ou "M"). `ganho_vs_b0` =
 * MAE do B0 − MAE do modelo nas mesmas células (positivo = melhor que a persistência). */
export type LinhaMetrica = {
  modelo: ModeloAvaliado;
  horizonte: Horizonte | Frequencia;
  submercado: Submercado | null;
  periodo: Periodo;
  linhas: number;
  entregas: number;
  mae: number | null;
  vies: number | null;
  rmse: number | null;
  mae_b0_pareado: number | null;
  ganho_vs_b0: number | null;
  /** Intervalo de 90% por bootstrap de blocos; null com menos de 5 blocos. */
  ganho_ic90: [number | null, number | null] | null;
  skill: number | null;
  perda_quantilica: number | null;
  cobertura_p10_p90: number | null;
  cobertura_p05_p95: number | null;
  largura_p10_p90: number | null;
  abaixo_p10: number | null;
  acima_p90: number | null;
  entregas_com_quantis: number;
  /** Só em `por_celula`. */
  calibracao: EstadoCalibracao | null;
};

export type Desempenho =
  | {
      publicado: true;
      por_horizonte: LinhaMetrica[];
      por_frequencia: LinhaMetrica[];
      /** Só o período de teste; o desenvolvimento por célula está no CSV. */
      por_celula: LinhaMetrica[];
      por_celula_nota: string;
    }
  | { publicado: false; motivo: string };

export type CandidatoSelecao = {
  modelo: "C2-P" | "C2-H";
  ganho_vs_b0: number | null;
  ganho_ic90: [number | null, number | null] | null;
  entregas: number;
  linhas_pareadas: number | null;
  passa: boolean;
};

export type SelecaoFrequencia = {
  candidatos: CandidatoSelecao[];
  selecionado: "C2-P" | "C2-H" | null;
  teste_do_selecionado: {
    mae: number | null;
    mae_b0_pareado: number | null;
    ganho_vs_b0: number | null;
    ganho_ic90: [number | null, number | null] | null;
    entregas: number;
    linhas_pareadas: number | null;
    resultado: string;
  } | null;
  leitura: string;
};

export type Selecao = { regra: string; por_frequencia: Record<Frequencia, SelecaoFrequencia>; contaminacao: string };

export type LimiarRegime = {
  submercado: Submercado;
  frequencia: Frequencia;
  b0_p75: number | null;
  y_p90: number | null;
  ear_p33: number | null;
  ear_p67: number | null;
};

export type ResultadoRegime = {
  modelo: "B0" | "C2-P" | "C2-H";
  frequencia: Frequencia;
  periodo: Periodo;
  tipo: "preco" | "armazenamento" | "extremo";
  regime:
    | "piso"
    | "intermediario"
    | "alto"
    | "armazenamento_baixo"
    | "armazenamento_medio"
    | "armazenamento_alto"
    | "acima_p90_do_desenvolvimento"
    | "ate_p90_do_desenvolvimento";
  linhas: number;
  entregas: number;
  mae: number | null;
  mae_b0_pareado: number | null;
  ganho_vs_b0: number | null;
  ganho_ic90: [number | null, number | null] | null;
  amostra_suficiente: boolean;
};

export type Regimes = { nota: string; limiares: LimiarRegime[]; resultados: ResultadoRegime[] };

export type Sensibilidade = {
  descricao: string;
  resultados: {
    k_dias: 1 | 2 | 3;
    modelo: "B0" | "C2-P" | "C2-H";
    horizonte: Horizonte;
    linhas: number;
    entregas: number;
    mae: number | null;
    vies: number | null;
  }[];
};

export type G23R1 = {
  achado: string;
  coeficiente_d7: {
    ajustes_ok: number;
    acima_de_1: number;
    fracao: number | null;
    por_segmento: {
      modelo: "C2-P" | "C2-H";
      horizonte: Horizonte;
      submercado: Submercado;
      ajustes: number;
      ajustados: number;
      coef_d7_acima_de_1: number;
      fracao_coef_d7_acima_de_1: number | null;
      lambda_zero: number;
      coef_d7_maximo: number | null;
    }[];
  };
  fora_da_faixa_antes_da_restricao: {
    modelo: "C2-P" | "C2-H";
    frequencia: Frequencia;
    previsoes: number;
    abaixo_do_piso: number;
    acima_do_teto: number;
    negativas: number;
  }[];
  origem_2024_11_30_mensal: {
    horizonte: Horizonte;
    submercado: Submercado;
    entrega: string;
    realizado: number | null;
    b0: number | null;
    c2p_bruta: number | null;
    c2h_bruta: number | null;
    c2p_final: number | null;
    c2h_final: number | null;
    piso: number | null;
  }[];
  tratamento: string;
};

/* ---------- P015: arquivo de emissões e prospectivo ---------- */

export type Rodada = {
  run_id: string;
  origem: string;
  cutoff: string;
  prazo: string | null;
  emitido_em: string;
  atraso_min: number | null;
  no_prazo: boolean | null;
  /** "agendada", "manual" ou o texto do registro transcrito de artefato externo. */
  modo: string;
  executor: string | null;
  run_url: string | null;
  tipos: TipoRegistro[];
  modelos: CodigoModelo[];
  versao_codigo: string | null;
  celulas: number;
  com_numero: number;
  falha: boolean;
  motivos: string[];
  alertas: string[];
  registrado_no_portal_em: string | null;
};

export type Apuracao = {
  forecast_id: string;
  modelo: CodigoModelo;
  tipo: TipoRegistro;
  origem: string;
  horizonte: Horizonte;
  submercado: Submercado;
  entrega: string;
  previsao: number;
  realizado: number | null;
  erro: number | null;
  emitida_antes_da_entrega: boolean;
  no_prazo: boolean;
};

export type RevisaoEntrega = {
  modelo: CodigoModelo;
  entrega: string;
  submercado: Submercado;
  rodadas: number;
  sequencia: { run_id: string; origem: string; horizonte: Horizonte; previsao: number; mudanca: number | null }[];
};

export type Reexecucao = {
  conferidas: number;
  divergentes: { forecast_id: string; arquivada: number; refeita: number | null }[];
  tolerancia: string;
};

export type Prospectivo = {
  rodadas: Rodada[];
  total_rodadas: number;
  registros: number;
  registros_por_tipo: Record<TipoRegistro, number>;
  apuracoes: Apuracao[];
  apuracoes_total: number;
  metricas: { entregas_apuradas: number; celulas: number; mae: number | null; vies: number | null } | null;
  leitura: string;
  revisoes_entre_rodadas: RevisaoEntrega[];
  reexecucao: Reexecucao;
};

export type Rotina = {
  workflow: string;
  cron_utc: string[];
  horarios: string;
  fuso: string;
  inicio_operacao_agendada: string | null;
  execucoes_agendadas: number;
  no_prazo: number;
  atrasadas: number;
  falhas: number;
  dias_sem_rodada: string[];
  dias_sem_rodada_total: number;
  comprovada: boolean;
  leitura: string;
  criterio_comprovacao: string;
};

/** Registro do arquivo imutável (uma célula de uma rodada), como gravado em
 * pipeline/energia/previsoes/emissoes/AAAA-MM.jsonl. Os registros anteriores ao
 * particionamento (rodada de 27/09/2026) não têm os campos marcados como opcionais. */
export type RegistroEmissao = {
  forecast_id: string;
  run_id: string;
  tipo: TipoRegistro;
  natureza?: "PREVISTO";
  rotulo?: string;
  origem: string;
  cutoff: string;
  prazo: string | null;
  emitido_em: string;
  atraso_min?: number;
  registrado_no_portal_em: string;
  horizonte: Horizonte;
  frequencia: Frequencia;
  entrega: { id: string; inicio: string; fim: string };
  submercado: Submercado;
  modelo: CodigoModelo;
  versao_modelo: string;
  estado_modelo: EstadoModelo;
  versao_codigo: string | null;
  configuracao_sha256?: string;
  snapshot: string | null;
  snapshot_sha256?: string | null;
  elegibilidade?: "LAT1D";
  execucao?: { modo: "agendada" | "manual"; executor: string; run_url: string | null; iniciado_em: string };
  status: "DISPONIVEL" | "INDISPONIVEL";
  previsao: number | null;
  previsao_bruta?: number;
  ajustada_ao_limite?: boolean;
  previsao_parte_desconhecida?: number;
  media_conhecida_no_corte?: number;
  quantis: { p10: number; p90: number; rotulo_faixa: string } | null;
  calibracao: { status: string; cobertura_p10_p90?: number | null; entregas?: number | null; fonte?: string };
  limites?: { piso_medio: number | null; teto_estrutural_medio: number | null; provisoria: boolean };
  features_usadas?: {
    nome: string;
    serie: string;
    dataset: string;
    inicio?: string;
    fim?: string;
    valor?: number;
    horas?: number;
    capturado_em: string | null;
    vintages?: number;
  }[];
  fracao_conhecida?: number;
  horas_capturadas_ate_corte?: number;
  motivo: string | null;
  detalhe_falha?: string;
  alertas: string[];
  evidencia?: { classe: string; fonte: string; sha256_fonte?: string };
  substitui: string | null;
  motivo_correcao: string | null;
  anterior?: string | null;
  sha256: string;
};

/** public/energia/series/previsoes_emissoes_AAAA-MM.json */
export type ParticaoEmissoes = { mes: string; registros: RegistroEmissao[] };

/* ---------- P013: previsão atual ---------- */

export type CelulaAtual = {
  horizonte: Horizonte;
  submercado: Submercado;
  entrega: { id: string; inicio: string; fim: string };
  previsao: number | null;
  status: "DISPONIVEL" | "INDISPONIVEL";
  motivo: string | null;
  quantis: { p10: number; p90: number; rotulo_faixa: string } | null;
  calibracao: EstadoCalibracao | string | null;
  limites: { piso_medio: number | null; teto_estrutural_medio: number | null; provisoria: boolean } | null;
  ajustada_ao_limite: boolean | null;
  fracao_conhecida: number | null;
  periodo_usado: { inicio: string; fim: string; capturado_em: string | null } | null;
  forecast_id: string;
};

export type PublicadoNoCorte = {
  cutoff: string;
  origem: string;
  natureza: "OBSERVADO";
  nota: string;
  submercados: Record<
    Submercado,
    {
      horas: number;
      primeira: string | null;
      ultima: string | null;
      media: number | null;
      minimo: number | null;
      maximo: number | null;
      /** [hora local 'AAAA-MM-DDTHH:00', PLD em R$/MWh] */
      valores: [string, number | null][];
      capturado_em: string | null;
    }
  >;
};

export type PrevisaoAtual =
  | {
      disponivel: boolean;
      rotulo: string;
      run_id: string;
      origem: string;
      cutoff: string;
      prazo: string | null;
      emitido_em: string;
      atraso_min: number | null;
      modo: string;
      alertas: string[];
      versao_codigo: string | null;
      celulas: CelulaAtual[];
      bandas: string;
      candidatos: { emitidos: boolean; motivo: string | null };
      ja_publicado_no_corte: PublicadoNoCorte | null;
    }
  | { disponivel: false; motivo: string; ja_publicado_no_corte: PublicadoNoCorte | null };

/* ---------- P014: fichas dos modelos ---------- */

export type Ficha = {
  codigo: CodigoModelo;
  nome: string;
  versao: string;
  estado: EstadoModelo;
  papel: string | null;
  implementado_no_repositorio: boolean;
  motivo_sem_implementacao: string | null;
  entradas: string[] | null;
  formula: string | null;
  transformacoes: string[] | null;
  configuracao: ({ sha256: string } & Record<string, unknown>) | null;
  coeficientes_ultimo_ajuste: {
    variaveis: { id: string; rotulo: string }[];
    segmentos: {
      horizonte: Horizonte;
      submercado: Submercado;
      origem_ajuste: string;
      ok: boolean;
      motivo: string | null;
      lambda: string | number | null;
      entregas_treino: number | null;
      coeficientes: Record<string, number | null> | null;
    }[];
    leitura: string;
  } | null;
  corte: string;
  hipoteses: string[];
  aprovacao: { estado: EstadoModelo; promovido_em: string | null; referencia_experimental: boolean; leitura: string };
  limitacoes: string[] | null;
  falhas_conhecidas: string[] | null;
  implementacao: Record<string, unknown> | null;
  reproducao: { comando: string; teste: string; tolerancia: string; reexecucao_do_arquivo: Reexecucao | null } | null;
  /** Só no C1: pesos não publicáveis (configuração fora do repositório). */
  pesos_c1?: null;
  pesos_c1_motivo?: string | null;
};

/* ---------- governança ---------- */

export type Governanca = {
  estados: string;
  referencia_experimental: {
    autorizada: boolean;
    fundamento: string;
    rotulo: string;
    verificada_em: string;
    condicoes: { id: string; descricao: string; verificada: boolean; evidencia: string }[];
    faixas: string;
    nao_equivale_a: string;
  };
  pendencias: { id: string; titulo: string; estado: string; descricao: string; encaminhamento: string; responsavel: string }[];
  decisao_revisavel: { item: string; estado: string | null; evidencia: string | null; responsavel: string | null }[];
  achados: {
    A08: { estado: string; diagnostico: string; correcao: string; confirmacao: string };
    A09: { estado: string; leitura: string; detalhe: string };
  };
};

export type RevisoesHidrologia = {
  observacoes_revisadas: number;
  maior_revisao: number | null;
  exemplos: { serie: string; ref: string; de: number | null; para: number | null }[];
};

export type PrevisoesDesempenhoGold = Cabecalho & {
  paineis: string[];
  proveniencia: Proveniencia;
  definicoes: {
    alvo: string;
    realizado: string;
    entregas: string;
    conhecido_no_corte: string;
    corte_operacional: string;
    cenario_de_elegibilidade: string;
    quantis: string;
    erro: string;
    ganho: string;
    perda_quantilica: string;
    cobertura: string;
    calibracao: string;
    periodos: { desenvolvimento: string; teste: string; fronteira: string };
  };
  dados: {
    instante_informacao: string;
    ultimo_dia_pld: string;
    origens: { inicio: string; fim: string; n: number };
    snapshots: Record<string, { id: string | null; sha256: string | null; ultima_captura: string | null; revisoes: number | null }>;
    revisoes_hidrologia: Record<string, RevisoesHidrologia>;
    /** Dicionários de dados do ONS (PDF) guardados pela coleta do módulo, com a conferência dos campos usados pelo C2-H. */
    dicionarios_ons: Record<
      "ear" | "ena",
      {
        url: string;
        sha256: string | null;
        capturado_em: string | null;
        arquivo: string | null;
        campos: Record<string, "presente" | "ausente"> | null;
        leitura: string;
      }
    >;
    ultima_entrega_apurada_teste: string | null;
    linhas_csv: { semanal: number; mensal: number };
    configuracao_sha256: string;
    configuracao_registrada_sha256: string | null;
  };
  modelos: {
    codigo: CodigoModelo;
    versao: string;
    estado: EstadoModelo;
    papel: string | null;
    avaliado: boolean;
    motivo_sem_avaliacao: string | null;
  }[];
  desempenho: Desempenho;
  selecao: Selecao | null;
  regimes: Regimes | null;
  sensibilidade_latencia: Sensibilidade | null;
  g23_r1: G23R1 | null;
  prospectivo: Prospectivo;
  rotina: Rotina;
  previsao_atual: PrevisaoAtual;
  fichas: Ficha[];
  governanca: Governanca;
  evidencias: Record<string, Evidencia>;
  validacoes: { nome: string; resultado: ResultadoTeste; detalhe: string }[];
  downloads: Download[];
};
