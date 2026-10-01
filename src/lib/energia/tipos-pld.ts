/**
 * Tipos da gold do módulo PLD (detalhe) (public/energia/gold/pld_detalhe.json), espelho
 * exato do que pipeline/energia/modulos/pld_detalhe.py publica para os painéis P008 a
 * P012. Valores em R$/MWh nominais, salvo onde indicado; ausência é null e é exibida
 * como ausência (nunca zero). As séries longas vêm em colunas (arrays paralelos): o
 * índice i de cada array se refere ao mesmo período. Nenhum número é recalculado na
 * interface: comparações entre CMO e PLD já vêm como diferença no mesmo intervalo.
 */
import type { ArquivoEvidencia, Evidencia, FonteEvidencia } from "./evidencia";
import type { Cabecalho, Download, Fonte, Proveniencia, Submercado } from "./tipos";

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

/* ---------- Fonte e proveniência compostas ---------- */

/**
 * Endereço de cada fonte de um número que combina conjuntos de órgãos diferentes (PLD da CCEE
 * e atos da ANEEL, por exemplo): `Fonte` guarda só o da primeira, `urls` lista todas. Nos atos
 * da ANEEL vêm o nível de conferência e a cópia pública efetivamente lida.
 */
export type UrlFonte = {
  orgao: string;
  dataset: string;
  url_dataset: string;
  url_primaria: string;
  nivel_conferencia?: NivelConferencia | null;
  /** Cópia pública lida quando o endereço oficial não responde (Internet Archive). */
  url_copia?: string | null;
};

export type FonteComposta = Fonte & { urls?: UrlFonte[] };

type RevisoesBase = NonNullable<Proveniencia["revisoes_conhecidas"]>;
/** Revisões de um número com mais de uma fonte: `total` soma as revisões das séries usadas de cada fonte. */
export type RevisoesPld = RevisoesBase & { componentes?: { fonte: string; total: number | null }[] };

/** Proveniência do módulo: o contrato compartilhado com a fonte composta e as revisões por fonte. */
export type ProvenienciaPld = Omit<Proveniencia, "fonte" | "revisoes_conhecidas"> & {
  fonte: FonteComposta;
  revisoes_conhecidas: RevisoesPld | null;
};

/* ---------- Evidência ("Comprove este número") ---------- */

/** Arquivo da ficha; o ato da ANEEL traz endereço oficial, cópia lida e nível de conferência, e a resposta da API do ONS, a URL consultada. */
export type ArquivoEvidenciaPld = ArquivoEvidencia & {
  url?: string | null;
  url_copia?: string | null;
  nivel_conferencia?: NivelConferencia | null;
};

/** Fichas no contrato compartilhado (pipeline/energia/evidencia.py e src/lib/energia/evidencia.ts), com os campos extras dos arquivos. */
export type EvidenciaPld = Omit<Evidencia, "fonte"> & {
  fonte: Omit<FonteEvidencia, "arquivos"> & { arquivos?: ArquivoEvidenciaPld[] | null };
};

/**
 * public/energia/series/pld_evidencias.json: as fichas completas, lidas sob demanda pela
 * interface; a gold traz só o índice (`PldDetalheGold.evidencias`).
 */
export type PldEvidenciasArquivo = { gerado_em: string; gold: "pld_detalhe.json"; evidencias: Record<string, EvidenciaPld> };

/**
 * public/energia/series/pld_hora_dia.json: mapa hora × dia dos últimos 90 dias corridos.
 * `SE[i][h]` = PLD do dia `dias[i]` na hora h (0 a 23); null = hora sem PLD publicado.
 */
export type PldHoraDiaArquivo = { gerado_em: string; unidade: string; fuso: string; dias: string[] } & SerieSm<(number | null)[][]>;

/* ---------- P008: conceito e fontes textuais ---------- */

/**
 * Texto citado no P008. Passagens normativas (`documento` e `dispositivo` presentes) só
 * entram quando conferidas literalmente no documento baixado; o arquivo, o sha256 e a
 * captura ficam em `documentos_normativos[documento]`.
 */
/** Documentos normativos e técnicos citados (fontes/normas_pld.py). */
export type DocumentoNormativoId =
  | "decreto_5163_2004"
  | "ren_aneel_957_2021"
  | "ons_pr_submodulo_2_4"
  | "ons_pr_submodulo_4_3"
  | "ons_pr_submodulo_4_5"
  | "cepel_dessem_manual_metodologia";

export type FonteTextual = {
  id: string;
  orgao: string;
  texto: string | null;
  origem: string;
  url?: string | null;
  documento?: DocumentoNormativoId;
  dispositivo?: string;
  capturado_em?: string | null;
  sha256?: string | null;
  arquivo?: string | null;
};

export type DocumentoNormativo = {
  orgao: string;
  titulo: string;
  /** Endereço oficial do ato. */
  url: string;
  /** Cópia pública efetivamente lida quando o endereço oficial não responde (Internet Archive). */
  url_copia: string | null;
  licenca: string;
  nota: string;
  capturado_em: string | null;
  sha256: string | null;
  arquivo: string | null;
};

export type AgenteExemplo = {
  id: "consumidor" | "gerador";
  rotulo: string;
  compras_contratadas_mwh: number;
  vendas_contratadas_mwh: number;
  geracao_verificada_mwh: number;
  consumo_verificado_mwh: number;
  diferenca_mwh: number;
  valor_rs: number | null;
  resultado: "crédito" | "débito" | "sem diferença";
};

/** Exemplo SINTÉTICO de liquidação: quantidades hipotéticas; só o PLD da hora é real. */
export type ExemploLiquidacao = {
  natureza: "EXEMPLO_SINTETICO";
  aviso: string;
  pld: { valor: number | null; sm: Submercado; nome: string; hora: string; unidade: string; fonte: string; regra_escolha: string };
  formula: string;
  agentes: AgenteExemplo[];
  leitura: string;
  simplificacoes: string[];
  /** Ids de `fontes_textuais` (só passagens conferidas). */
  base_normativa: string[];
};

export type ConceitoPld = {
  fontes_textuais: FonteTextual[];
  documentos_normativos: Record<DocumentoNormativoId, DocumentoNormativo>;
  normas_nao_conferidas: { id: string; documento: string; dispositivo: string; motivo: string }[];
  /** Os atos anuais de limites, com trecho literal, ficam em `limites.atos`. */
  atos_de_limites: "limites.atos";
  exemplo_liquidacao: ExemploLiquidacao;
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
  /** Intervalo a que cada valor se refere. */
  entrega: string;
  /** Quando o valor é calculado, montado só com passagens conferidas dos Procedimentos de Rede do ONS e do manual do DESSEM (null: não conferido). */
  momento_do_calculo: string | null;
  /** Motivo publicado quando `momento_do_calculo` é null. */
  momento_do_calculo_motivo: string | null;
  /** Ids de `conceito.fontes_textuais` que sustentam a descrição do produto. */
  fontes_normativas: string[];
  deck_versao: string;
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
  /**
   * Semanas operativas: `fim` é a sexta-feira publicada pelo ONS; `inicio`, o sábado.
   * Recorte das últimas `semanal_recorte.semanas_na_gold` semanas; o histórico desde 2021
   * está no CSV `semanal_recorte.historico_completo`.
   */
  semanal: { fim: string[]; inicio: string[] } & SerieSm<{ decomp: (number | null)[]; dessem: (number | null)[]; pld: (number | null)[] }>;
  semanal_recorte: { semanas_na_gold: number; semanas_no_csv: number; historico_completo: string };
  /** Conferência gold contra o CSV publicado, relido depois de escrito. */
  equivalencia_csv: {
    celulas: number;
    divergentes: number;
    exemplos: { semana_fim: string; sm: Submercado; campo: "decomp" | "dessem" | "pld"; gold: number | null; csv: number | null }[];
    tolerancia: string;
  };
  semanas_completas: number;
  semana_referencia: SemanaReferencia | null;
  relacao_anual: RelacaoAnual[];
};

/* ---------- P010: limites, piso e tetos ---------- */

export type NivelConferencia = "texto_do_ato" | "documento_oficial_do_processo";

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
  /** Nível de conferência registrado pelo módulo Regulação; null = sem registro. */
  nivel_conferencia: NivelConferencia | null;
  nivel_descricao: string | null;
  /** Documento em que os valores foram lidos (id de pipeline/energia/regulatorio/documentos.json). */
  documento_valores: string | null;
  documento_titulo: string | null;
  documento_url: string | null;
  documento_copia: string | null;
  documento_sha256: string | null;
  dou: string | null;
};

export type ConferenciaAtos = {
  por_nivel: Partial<Record<NivelConferencia | "sem_registro", number>>;
  atos_lidos_em_documento_do_processo: string[];
  atos_sem_registro_de_conferencia: string[];
  pendencias: { ano: number | null; item: string | null; situacao: string | null }[];
  leitura: string;
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
  /** Horas com o PLD exatamente um centavo acima do piso: preço diferente do piso, classe à parte. */
  horas_um_centavo_acima_do_piso: number;
  horas_um_centavo_abaixo_do_teto_horario: number;
  /** Contagem com R$ 0,01/MWh na hora (juntaria o centavo vizinho ao limite). */
  sensibilidade_um_centavo: { horas_piso: number; horas_teto_horario: number };
  dias: number;
  dias_teto_estrutural: number;
  dias_teto_estrutural_com_hora_acima: number;
  controle_dias_acima_estrutural: number;
  dias_sem_teto_estrutural: number;
};

export type EmpatePiso = {
  ano: number;
  /** Ano de referência ainda em curso. */
  parcial: boolean;
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
  /** `hora`: igualdade ao centavo na hora; `media_diaria`: teto estrutural sobre a média das 24 horas. */
  tolerancia: { hora: number; media_diaria: number; sensibilidade_hora: number; unidade: string; regra: string; justificativa: string };
  atos: AtoLimite[];
  conferencia_atos: ConferenciaAtos;
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
  /** Peso: carga do balanço do ONS, cujo perímetro muda dentro da série (`BlocoHistorico.mensal.perimetro_carga`). */
  ponderada_carga: (number | null)[];
  /** true quando a ponderada usa exatamente as mesmas horas da temporal. */
  mesmas_horas: boolean[];
  horas_com_carga_sem_mmgd: number[];
  /** Peso: carga global líquida de MMGD da API de carga verificada do ONS (perímetro homogêneo). */
  ponderada_carga_sem_mmgd: (number | null)[];
  mesmas_horas_sem_mmgd: boolean[];
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

/** Magnitude e alcance das revisões da carga do ONS num mês, com o efeito na média ponderada publicada. */
export type RevisaoCarga = {
  sm: Submercado;
  mes: string;
  horas_revisadas: number;
  max_abs_mwmed: number | null;
  quando_max: string;
  media_abs_mwmed: number | null;
  max_rel: number | null;
  horas_com_troca_de_sinal: number;
  capturas: string[];
  ponderada_primeira_captura: number | null;
  ponderada_vigente: number | null;
  efeito_na_ponderada: number | null;
};

/** Perímetro da carga do balanço declarado pelo ONS; "P2_P3" = mês em que a mudança declarada acontece. */
export type PerimetroCarga = "P1" | "P2" | "P3" | "P2_P3" | "P1_P2";

export type ConferenciaPerimetroSm = {
  erro_abs_medio_com_mmgd: number | null;
  erro_abs_medio_sem_mmgd: number | null;
  coef_mmgd_min: number | null;
  coef_mmgd_max: number | null;
  meses_seguem_com_mmgd: number;
  meses_seguem_sem_mmgd: number;
};

export type PerimetroPeso = {
  id: "P1" | "P2" | "P3";
  inicio: string | null;
  fim: string | null;
  /** Trecho literal da descrição do conjunto Carga de Energia do ONS. */
  trecho: string;
  /** Trecho conferido na descrição capturada; null sem captura. */
  trecho_conferido: boolean | null;
  componente_estimado: string | null;
  inclui_mmgd: boolean;
  natureza_do_peso: "OBSERVADO" | "ESTIMADO";
  primeiro_mes: string | null;
  ultimo_mes: string | null;
  n_meses: number;
  /** Conferência contra a API de carga verificada; null sem a API. */
  conferencia: SerieSm<ConferenciaPerimetroSm> | null;
};

export type QuebraPerimetro = {
  data: string;
  mes: string;
  de: "P1" | "P2";
  para: "P2" | "P3";
  origem: "FONTE";
  descricao: string;
  conferida_no_dado: boolean;
  /** Primeiro dia em que a carga horária do balanço acompanha a carga com MMGD (só na quebra de 2023). */
  inicio_observado_no_balanco?: string | null;
  nota: string;
};

export type SensibilidadePeso = {
  mes: string;
  perimetro_carga: PerimetroCarga;
  por_sm: {
    sm: Submercado;
    temporal: number;
    ponderada_carga: number;
    ponderada_carga_sem_mmgd: number;
    ponderada_menos_temporal: number;
    sem_mmgd_menos_temporal: number;
    ponderada_menos_sem_mmgd: number;
  }[];
  texto: string;
};

export type HorasRetiradas = { sm: Submercado; mes: string; horas: number; exemplos: { hora: string; carga_mwmed: number | null }[] }[];

export type BlocoHistorico = {
  mensal: { meses: string[]; dias_completos: number[]; parcial: boolean[]; perimetro_carga: PerimetroCarga[] } & SerieSm<MensalSm>;
  /** Mapa hora × dia dos últimos 90 dias em arquivo próprio (PldHoraDiaArquivo), lido sob demanda. */
  hora_dia: { url: string; inicio: string; fim: string; dias: number; dias_completos_no_recorte: number; nota: string };
  deflator: { indice: string; mes_base: string | null; indice_base: number | null; ultimo_mes_do_indice: string | null; regra: string };
  ponderacao: {
    peso: string;
    ressalva: string;
    ultima_hora_com_carga: string | null;
    controle_fisico: string;
    /** Horas com carga ≤ 0 retiradas do peso (ressalva visível); vazio quando não houve. */
    horas_retiradas: HorasRetiradas;
    revisoes_carga: RevisaoCarga[];
    perimetros: PerimetroPeso[];
    fonte_perimetro: { conjunto: string; url: string | null; capturado_em: string | null; modificado_na_fonte: string | null; nota: string };
    quebras: QuebraPerimetro[];
    conferencia_perimetro: {
      disponivel: boolean;
      motivo: string | null;
      limiar_coef_mmgd: number;
      meses_divergentes: { sm: Submercado; mes: string; perimetro: PerimetroCarga; segue: "com_mmgd" | "sem_mmgd"; coef_mmgd: number | null }[];
      metodo: string;
    };
    peso_sem_mmgd: {
      disponivel: boolean;
      motivo: string | null;
      peso: string;
      natureza: "OBSERVADO";
      perimetro: string;
      ultima_hora: string | null;
      horas_retiradas: HorasRetiradas;
    };
    comparabilidade: string;
    /** Último mês completo com as três médias nos quatro submercados; null quando não há. */
    sensibilidade_peso: SensibilidadePeso | null;
  };
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
  /** Sensibilidade ao limiar: acima de R$ 1,00/MWh (o limiar de pld.json) e de R$ 10,00/MWh. */
  horas_acima_1: number;
  horas_acima_10: number;
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
  limiar_sensibilidade: string;
  regra_fluxo: string;
  periodos: PeriodoRegional[];
  amplitude: AmplitudePeriodo[];
  separacao: SeparacaoPar[];
  /** Linhas e colunas na ordem `ordem`; dif_media[i][j] = média de PLD_i − PLD_j; diagonal null. */
  matriz: { periodo: string; ordem: Submercado[]; dif_media: (number | null)[][]; frac_separadas: (number | null)[][] };
  perfil_horario_separacao_12m: Record<Par, (number | null)[]>;
  fluxos: FluxoSeparacao[];
};

/**
 * public/energia/series/pld_horario_recente.json: últimas 168 horas até o fim do dia de
 * referência, lido sob demanda (a gold traz `HorarioRecente`, o ponteiro).
 */
export type PldHorarioRecenteArquivo = {
  gerado_em: string;
  unidade: string;
  fuso: string;
  t: string[];
  pld: SerieSm<(number | null)[]>;
  cmo_dessem: SerieSm<(number | null)[]>;
  fluxo: Record<Fronteira, (number | null)[]>;
  amplitude: (number | null)[];
};

export type HorarioRecente = {
  url: string;
  inicio: string;
  fim: string;
  horas: number;
  horas_com_pld_nos_quatro: number;
  horas_com_cmo_nos_quatro: number;
  horas_com_fluxo: Record<Fronteira, number>;
  nota: string;
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
  dessem_mesmo_periodo?: {
    sm: Submercado;
    /** Meias horas publicadas; `meias_horas_esperadas` = dias do período × 48. */
    meias_horas: number;
    meias_horas_esperadas: number;
    dias_sem_publicacao: number;
    meias_horas_zero: number;
    frac_zero: number | null;
    media: number | null;
    max: number | null;
  }[];
  pld_mesmo_periodo?: { sm: Submercado; horas: number; media: number | null; horas_com_limite: number; frac_piso: number | null }[];
  observacao_formato?: string;
  /** Permissões declaradas no dicionário em PDF do CMO semanal (zero admitido ou não). */
  dicionario_permite?: Record<string, PermissoesCampo> | null;
  texto?: string;
};

export type CampoDicionario = { descricao: string; unidade?: string };
/** Colunas "Permite valor nulo / zerado / negativo" do dicionário em PDF do ONS. */
export type PermissoesCampo = { nulo: boolean; zerado: boolean; negativo: boolean };

export type PdfDicionario = {
  sha256: string | null;
  data_documento: string | null;
  versoes: { versao: string; data: string; descricao: string }[] | null;
  permissoes: Record<string, PermissoesCampo> | null;
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
  tolerancias: {
    hora_no_limite: number;
    media_diaria_teto_estrutural: number;
    separacao: number;
    sensibilidade_hora: number;
    fluxo_nulo_mwmed: number;
    unidade: string;
  };
  conceito: ConceitoPld;
  cmo_pld: BlocoCmoPld;
  limites: BlocoLimites;
  historico: BlocoHistorico;
  regional: BlocoRegional;
  horario_recente: HorarioRecente;
  achados: Achados;
  cobertura: { cmo_semi_horario: CoberturaDessemAno[]; importacao_cmo_semi_horario: Record<string, RelatorioImportacao | null> };
  metricas: Record<"cmo_pld" | "limites" | "historico" | "regional" | "achados", string[]>;
  /** Proveniência de cada métrica: `calculo` (natureza da transformação) e `fonte` (natureza do dado de origem, quando publicada). */
  metricas_proveniencia: Record<string, { calculo: string; fonte: string | null }>;
  controles: Controle[];
  proveniencia: {
    /** Natureza ESTIMADO: resultado do modelo DESSEM, não medição. */
    cmo_semi_horario: ProvenienciaPld;
    cmo_horario: ProvenienciaPld;
    comparacao_semanal: ProvenienciaPld;
    relacao_pld_cmo: ProvenienciaPld;
    historico_mensal: ProvenienciaPld;
    /** Peso da ponderada pelo balanço: natureza ESTIMADO (previsão de usinas não despachadas desde 03/2021 e MMGD estimada desde 29/04/2023). */
    peso_carga_balanco: ProvenienciaPld;
    /** Peso da ponderada sem MMGD (API de carga verificada); ausente quando o silver do módulo Carga não está disponível. */
    peso_carga_sem_mmgd?: ProvenienciaPld;
    sazonal: ProvenienciaPld;
    distribuicao: ProvenienciaPld;
    regional: ProvenienciaPld;
    fluxos: ProvenienciaPld;
    a02: ProvenienciaPld;
    a09: ProvenienciaPld;
    /** Presente só quando os atos de limites estão disponíveis. */
    limites?: ProvenienciaPld;
  };
  /** Índice das fichas; as fichas completas ficam em `arquivo` (PldEvidenciasArquivo), lidas sob demanda. */
  evidencias: { arquivo: string; indice: Record<string, { indicador: string; valor_exibido: string; entidade: string }> };
  snapshots: Record<
    "cmo_semi_horario" | "cmo_semanal_original" | "dicionarios" | "ipca" | "normas" | "pld" | "cmo_semanal" | "balanco" | "intercambio",
    SnapshotResumo
  > & { carga_api?: SnapshotResumo };
  downloads: Download[];
};
