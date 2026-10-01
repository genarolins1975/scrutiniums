/**
 * Tipos da gold da Visão geral (public/energia/gold/sintese.json), espelho exato do que
 * pipeline/energia/modulos/visao.py publica (painéis P004 a P007), com as frases e regras
 * de pipeline/energia/gold/sintese.py.
 *
 * Compatível com `SinteseGold` de ./tipos (frases com trechos e regra; observar com id,
 * título, condição, ativo, evidência, href e tipo): os campos novos são acréscimos.
 *
 * Datas de referência são do dado (cada painel tem a sua); `data_processamento` é a data
 * civil de Brasília da publicação. Ausência é null, nunca zero. Nenhuma regra é reaplicada
 * na interface: estado, histórico e textos vêm calculados do pipeline.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Natureza, Periodo } from "./tipos";

/* ---------------------------------------------------------------- P004: frases */

export type TrechoVisao = { texto: string; evidencia?: string; href?: string };

/** Valor usado numa frase, com o caminho na gold de origem (ex.: "hidrologia.json#subsistemas[SIN].ear.valor"). */
export type ValorFrase = { valor: number | string; caminho: string; unidade?: string };

export type IdFrase = "reservatorios" | "afluencias" | "carga" | "termica" | "pld" | "rede";

export type SituacaoAtualidade = "EM DIA" | "ATRASADO" | "SEM SLA" | "SEM DADO" | string;

/** Componente da série de origem que não é medição, como a gold de origem o declara (seção 11.3). */
export type ComponenteNatureza = {
  natureza: Natureza | string;
  desde: string;
  descricao: string;
  /** Caminho na proveniência de origem. */
  fonte: string;
  observado_nos_dados_desde?: string;
};

/** Revisão entre capturas no silver principal (valores na unidade da série). */
export type RevisaoSerie = {
  serie: string;
  ref: string;
  de: number;
  para: number;
  relativa_pct: number | null;
  capturado_para: string;
};

export type QualidadeFrase = {
  natureza: Natureza | null;
  /** Componentes PREVISTO ou ESTIMADO do agregado de origem (vazio quando a origem não declara nenhum). */
  componentes_natureza: ComponenteNatureza[];
  frequencia: string | null;
  /** Data de referência do dado da frase. */
  referencia: string;
  /** Janelas de referências usadas (a carga usa também os mesmos dias do ano anterior). */
  janelas: Periodo[];
  /** Data de processamento (Brasília) menos a referência; negativa quando a fonte publica na véspera. */
  defasagem_dias: number | null;
  texto_defasagem: string;
  /** Situação pela frequência declarada da fonte (publicacao.json); null sem linha do conjunto. */
  atualidade: {
    situacao: SituacaoAtualidade | null;
    cadencia: string | null;
    tolerancia_dias: number | null;
    dias_atraso: number | null;
    fonte: string;
  } | null;
  publicado_pela_fonte_em: string | null;
  capturado_em: string | null;
  revisoes: {
    /** Séries do silver que a frase usa; revisões de outras séries do conjunto não contam. */
    series_consideradas: string[];
    /** Referências distintas (dias ou horas) com alguma série usada revisada na janela. */
    referencias_revisadas_na_janela: number;
    pares_serie_referencia: number;
    /** Até 20 referências (dias ou horas) revisadas entre capturas dentro da janela. */
    revisadas: string[];
    /** Maior variação relativa, com a série e a referência que a produziram. */
    maior: RevisaoSerie | null;
    total_no_conjunto: number | null;
    texto: string;
  };
};

export type VersoesFrase = {
  gold: string;
  gerado_em: string | null;
  versao_codigo: string | null;
  versao_pipeline: string | null;
  dataset: string;
  snapshot_id: string | null;
  snapshot_sha256: string | null;
};

export type FraseVisao = {
  id: IdFrase;
  /** Frases são sempre fatos; hipóteses só aparecem nos destaques, rotuladas. */
  tipo: "fato";
  /** Modelo fixo de texto: MODELOS[modelo](valores) refaz `trechos`. */
  modelo: IdFrase;
  ref: string;
  natureza: Natureza;
  regra: string | null;
  trechos: TrechoVisao[];
  texto: string;
  valores: Record<string, ValorFrase>;
  href: string;
  qualidade: QualidadeFrase;
  versoes: VersoesFrase;
  evidencia: Evidencia | null;
  evidencia_problemas?: string[];
};

export type HipoteseVisao = { texto: string; onde_verificar: string; tipo: "hipotese" };

export type DestaqueVisao = {
  regra: string;
  titulo: string;
  texto: string;
  tipo: "fato";
  estado: EstadoRegra;
  /** Primeiro dia com a condição no episódio. */
  desde: string;
  confirmado_em: string;
  dias: number;
  /** Dias entre a confirmação e a referência (a caixa mostra os primeiros `novidade_dias`). */
  dias_desde_confirmacao: number;
  referencia: string;
  normaliza_quando: string;
  frequencia_historica_pct: number;
  /** Primeiro dia em que a regra é avaliável (não o início comum da série). */
  historico_avaliavel_desde: string;
  dias_avaliados: number;
  valor: ValorRegra | null;
  /** Caminho da evidência na gold (sintese.json#observar[regra].evidencia_numero). */
  evidencia_caminho: string;
  evidencia: Evidencia | null;
  hipoteses_a_verificar: HipoteseVisao[];
  nao_implica: string;
  href: string;
};

/** Frequência da caixa de destaques num período (dias com ao menos uma regra na caixa). */
export type FrequenciaPeriodo = {
  inicio: string;
  fim: string;
  dias: number;
  dias_com_destaque: number;
  pct_dias_com_destaque: number | null;
  distribuicao_regras_simultaneas: { regras: number; dias: number }[];
  pct_dias_por_regra: Record<string, number | null>;
};

export type FrequenciaConjunta = {
  criterio: string;
  /** Meta de materialidade: máximo de dias com destaque no período comum (%). */
  meta_pct: number;
  atende_meta: boolean;
  novidade_dias: number;
  regras: IdRegra[];
  /** Período em que todas as regras de sistema são avaliáveis. */
  periodo_comum: FrequenciaPeriodo;
  desde_inicio: FrequenciaPeriodo;
  /** null = sem limite de novidade. */
  sensibilidade_novidade: { novidade_dias: number | null; pct_periodo_comum: number | null; pct_desde_inicio: number | null }[];
  calibracao_anterior: { descricao: string; pct_periodo_comum: number | null; distribuicao_regras_simultaneas: { regras: number; dias: number }[] };
};

export type DestaquesVisao = {
  itens: DestaqueVisao[];
  /** Regras em alerta fora da caixa: além do limite ou confirmadas há mais de `novidade_dias` dias. */
  outras_regras_em_alerta: { regra: IdRegra; motivo: string }[];
  limite: number;
  novidade_dias: number;
  criterio: string;
  /** Texto de ausência quando nenhuma regra está na caixa; null quando há destaques. */
  vazio: string | null;
  frequencia_conjunta: FrequenciaConjunta | null;
};

/* ---------------------------------------------------------------- P005: pequenos múltiplos */

export type IdPainelMultiplo = "preco" | "agua" | "geracao" | "carga" | "rede";

export type ReferenciaPainel =
  | { tipo: "faixa_constante"; rotulo: string; inferior: number; superior: number; caminho: string }
  /** Faixa que muda com a data: nomes das colunas de `dados` com os limites. */
  | { tipo: "faixa_por_data"; rotulo: string; inferior: string; superior: string; caminho: string }
  | { tipo: "serie"; rotulo: string; coluna: string; caminho: string }
  | { tipo: "zero"; rotulo: string; valor: 0 };

export type PainelDeterminante = {
  id: IdPainelMultiplo;
  titulo: string;
  pergunta: string;
  /** Id no catálogo de métricas (metricas.json). */
  metrica: string;
  unidade: string;
  casas: number;
  colunas: { id: string; rotulo: string }[];
  referencia: ReferenciaPainel;
  /** Último dia de dado da gold de origem: cada painel tem o seu. */
  data_referencia: string;
  gold: string;
  caminho: string;
  /** Caminho da proveniência na gold de origem (ex.: "pld.json#proveniencia.diario"). */
  proveniencia: string;
  natureza: Natureza;
  frequencia: string;
  href: string;
  valor_atual: { rotulo: string | null; valor: number | null; caminho: string | null };
  nota: string;
  download: Download[];
  defasagem_dias: number | null;
  texto_defasagem: string;
  ultimo_dia_com_dado: string | null;
  dias_com_dado: number;
};

/** Linha do recorte alinhado: `d` e as colunas dos painéis; null = sem dado naquela data. */
export type LinhaMultiplos = { d: string } & Record<string, number | null | string>;

export type MultiplosVisao = {
  janela: { inicio: string; fim: string; dias: number };
  chave_x: "d";
  datas_referencia: Partial<Record<IdPainelMultiplo, string>>;
  /** Frase pronta que explica as datas diferentes (sem sugerir simultaneidade). */
  aviso_datas: string;
  paineis: PainelDeterminante[];
  dados: LinhaMultiplos[];
  regra: string;
  download: Download[];
};

/* ---------------------------------------------------------------- P006: energia e sociedade */

export type IdSociedade = "tarifa" | "continuidade" | "perdas" | "beneficios";

export type ComplementoSociedade = {
  rotulo: string;
  /** Número único ou par [atual, comparação]; null é ausência. */
  valor: number | (number | null)[] | null;
  unidade: string | null;
  valor_exibido?: string;
  mes?: string | null;
  aviso?: string | null;
};

export type AtualidadeConjunto = {
  conjunto: string;
  situacao: SituacaoAtualidade | null;
  cadencia: string | null;
  dias_atraso: number | null;
  ultimo_periodo: string | null;
} | null;

export type ItemSociedade = {
  id: IdSociedade;
  titulo: string;
  pergunta: string;
  valor: number;
  unidade: string;
  /** Texto do valor como o módulo de origem exibe (evidência). */
  valor_exibido: string;
  /** Só na continuidade: DEC em horas e minutos (9,33 h = 9 h 20 min). */
  equivalente?: string | null;
  complementos: ComplementoSociedade[];
  periodo: { tipo: "vigencia" | "anual" | "mensal"; inicio: string; fim: string; rotulo: string };
  defasagem: { dias?: number | null; meses?: number; texto: string };
  cobertura: string;
  natureza: Natureza | string;
  frequencia: string;
  /** Sempre true: indicador anual, mensal ou de vigência, nunca a situação do dia. */
  nao_e_situacao_do_dia: true;
  aviso: string;
  metrica: string;
  gold: string;
  caminho: string;
  evidencia_caminho: string;
  evidencia: Evidencia;
  evidencias_complementares?: { caminho: string; evidencia: Evidencia }[];
  atualidade: AtualidadeConjunto;
  href: string;
};

export type SociedadeVisao = {
  itens: ItemSociedade[];
  ausentes: { id: IdSociedade; motivo: string }[];
  regra: string;
};

/* ---------------------------------------------------------------- P007: o que observar */

export type IdRegra =
  | "ear_faixa"
  | "ena_faixa"
  | "termica"
  | "carga_extrema"
  | "descolamento"
  | "pld_piso"
  | "pld_teto"
  | "restricao_eolica"
  | "restricao_solar"
  | "revisao_material"
  | "pld_defasagem"
  | "atualidade_fontes"
  | "cmo_semana";

/**
 * ativo: duração mínima atingida e condição presente; em_retorno: em alerta, condição
 * ausente há menos dias que o retorno exige; em_observacao: condição presente sem a
 * duração mínima; normal; sem_dado; evento (calendário, não alerta).
 */
export type EstadoRegra = "ativo" | "em_retorno" | "em_observacao" | "normal" | "sem_dado" | "evento";

export type EpisodioRegra = {
  inicio: string;
  confirmado_em: string;
  dias_condicao: number;
  fim: string;
  normalizado_em: string | null;
  em_curso: boolean;
  duracao_dias: number;
  /** Só no episódio em curso: dias entre a confirmação e a referência. */
  dias_desde_confirmacao?: number;
};

/** Número avaliado no dia e limiares, na unidade da regra; null é ausência. */
export type ValorRegra = { valor: number | null; limiar_inferior: number | null; limiar_superior: number | null };

export type HistoricoRegra = {
  /** Início comum da série reavaliada (01/01/2021). */
  inicio: string;
  fim: string;
  /** Primeiro e último dia em que a regra tem base para ser avaliada. */
  primeiro_dia_avaliado: string;
  ultimo_dia_avaliado: string;
  dias_avaliados: number;
  dias_sem_avaliacao: number;
  dias_com_condicao: number;
  pct_dias_com_condicao: number;
  acionamentos_brutos: number;
  /** Sequências da condição mais curtas que a duração mínima (ruído filtrado). */
  acionamentos_curtos_descartados: number;
  pct_acionamentos_descartados: number | null;
  episodios: number;
  /** null quando menos de 365 dias avaliados (extrapolação enganaria). */
  episodios_por_ano: number | null;
  historico_curto: boolean;
  duracao_mediana_dias: number | null;
  duracao_maxima_dias: number | null;
  dias_exibidos: number;
  pct_dias_exibidos: number;
  sensibilidade_duracao: {
    duracao_minima_dias: number;
    episodios: number;
    dias_exibidos: number;
    pct_dias_exibidos: number;
    por_ano: number | null;
  }[];
  ultimos_episodios: EpisodioRegra[];
};

export type RegistroEmissoes = {
  inicio: string | null;
  /** Publicações aceitas (gold em public/energia/gold) registradas no silver. */
  publicacoes_registradas: number;
  mudancas_de_estado: number;
  emitidos: number;
  referencias_em_alerta: number;
  /** null para regras sem histórico diário (dados, evento). */
  nao_confirmados_apos_revisao: number | null;
  exemplos_nao_confirmados: { capturado_em: string; referencia: string }[];
  nota: string;
};

export type RegraObservar = {
  id: IdRegra;
  tipo: "regra" | "dados" | "evento";
  /** Destaques só usam regras sobre o sistema. */
  assunto: "sistema" | "dados";
  titulo: string;
  condicao: string;
  limiar: string | null;
  duracao_minima_dias: number | null;
  retorno_dias: number | null;
  regra_retorno: string;
  materialidade: string;
  nao_implica: string;
  hipoteses: { texto: string; onde_verificar: string }[];
  href: string;
  gold: string;
  metrica: string | null;
  unidade: string;
  /** Identificador da definição (condição, limiar e durações). */
  versao_regra: string;
  alerta_nao_implica_causa: string;
  ativo: boolean;
  estado: EstadoRegra;
  /** Data de referência do dado avaliado. */
  referencia: string;
  defasagem_dias: number | null;
  condicao_no_dia: boolean;
  /** Texto do dia com os números da gold de origem. */
  evidencia: string;
  episodio_atual?: EpisodioRegra | null;
  sequencia_atual?: { inicio: string; fim: string; dias: number } | null;
  dias_sem_condicao_no_retorno?: number;
  historico: HistoricoRegra | null;
  historico_nao_se_aplica?: string;
  /** Cadeia de um caractere por dia (A, o, ., -), últimos 365 dias avaliados. */
  linha_estado?: { inicio: string | null; estados: string; legenda: Record<string, string> };
  valor?: ValorRegra;
  evidencia_numero?: Evidencia | null;
  evidencia_problemas?: string[];
  alternativas_avaliadas?: {
    id: string;
    condicao: string;
    adotada: boolean;
    pct_dias_exibidos: number | null;
    episodios: number | null;
    pct_dias_com_condicao: number | null;
    primeiro_dia_avaliado: string | null;
    motivo: string;
  }[];
  /** Só em pld_defasagem: última tentativa de coleta direta e bloqueios registrados pelo módulo PLD. */
  coleta_direta?: { tentado_em: string | null; ok: boolean | null; fonte: string } | null;
  bloqueios_registrados?: { fonte: string; evidencia: string; origem: string }[];
  limites_vigentes?: {
    data: string;
    pld_min: number;
    ato_pld_min: string;
    pld_max_horario: number;
    ato_pld_max_horario: string;
    pld_max_estrutural: number;
    ato_pld_max_estrutural: string;
    fonte: string;
  };
  conferencia_limites?: { resultado: "aprovado" | "ressalva"; detalhe: string };
  conjuntos_avaliados?: string[];
  registro_emissoes: RegistroEmissoes;
};

/* ---------------------------------------------------------------- revisões e controles */

export type RevisaoMaior = {
  serie: string;
  ref: string;
  de: number;
  para: number;
  relativa_pct: number | null;
  /** Unidade da série: %, % da MLT, MWmês, MWmed ou R$/MWh. */
  unidade: string;
  capturado_para: string;
};

export type RevisoesVisao = {
  operacao: {
    dataset: string;
    revisoes: number;
    materiais: number;
    /** Revisões materiais em séries que a página usa (as que contam na regra revisao_material). */
    materiais_em_series_usadas: number;
    referencias_de: string | null;
    referencias_ate: string | null;
    dias_de_captura: string[];
    maior_material: RevisaoMaior | null;
    dias_comparaveis: string[];
  }[];
  modulos: {
    dataset: string;
    eventos: number | null;
    referencias_de: string | null;
    referencias_ate: string | null;
    maior_relativa_pct: number | null;
    por_captura: Record<string, number> | null;
    fonte: string;
  }[];
  /** Séries do silver principal que entram em algum número da página. */
  series_da_pagina: string[];
  regra_material: string;
  download: Download[];
};

export type ControleVisao = { nome: string; resultado: "aprovado" | "ressalva" | "reprovado"; detalhe: string };

/* ---------------------------------------------------------------- gold */

export type SinteseVisaoGold = Cabecalho & {
  modulo: "visao";
  paineis: ["P004", "P005", "P006", "P007"];
  /** Data civil de Brasília do processamento (comum.hoje_brasilia). */
  data_processamento: string;
  fuso_processamento: string;
  processado_em: string;
  frases: FraseVisao[];
  frases_ausentes: IdFrase[];
  destaques: DestaquesVisao;
  fatos_e_hipoteses: string;
  multiplos: MultiplosVisao | null;
  sociedade: SociedadeVisao;
  observar: RegraObservar[];
  observar_resumo: { ativas: IdRegra[]; em_observacao: IdRegra[]; total_regras: number };
  observar_sem_dado: { id: IdRegra; motivo: string }[];
  alertas_nao_confirmados: { regra: IdRegra; capturado_em: string; referencia: string }[];
  revisoes: RevisoesVisao;
  origens: {
    gold: string;
    disponivel: boolean;
    gerado_em: string | null;
    versao_codigo: string | null;
    /** Contexto da execução (igual ou diferente do arquivo publicado) ou arquivo publicado lido pela Visão geral. */
    origem: string;
    igual_ao_publicado: boolean;
    arquivo_publicado_gerado_em: string | null;
    lida_em: string;
    idade_horas: number | null;
  }[];
  historico_regras: {
    inicio: string;
    regra: string;
    registro_publicacoes: { publicacao_anterior_registrada_nesta_execucao: boolean };
    falso_alarme: string;
  };
  validacao: ControleVisao[];
  nota: string;
  downloads: Download[];
  limitacoes: string[];
};
