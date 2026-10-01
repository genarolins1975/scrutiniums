/**
 * Tipos da gold do módulo Rede (detalhe) (public/energia/gold/rede_detalhe.json), espelho
 * exato do que pipeline/energia/modulos/rede_detalhe.py publica para os painéis P028 a
 * P031 e os achados A05 e A06. Complementa a gold de operação rede.json (tipos em
 * tipos.ts), que continua existindo.
 *
 * Convenções:
 * - fronteiras na orientação canônica (N→NE, N→SE/CO, NE→SE/CO, S→SE/CO): positivo =
 *   energia da primeira para a segunda região; exterior: positivo = exportação do Brasil;
 * - energia em MWh (cada valor horário em MWmed vale a mesma quantidade em MWh);
 * - séries longas em colunas (arrays paralelos): o índice i de cada array se refere ao
 *   mesmo dia, mês ou hora do array de datas do mesmo bloco;
 * - ausência é null e é exibida como ausência (nunca zero); nenhum número é recalculado
 *   na interface.
 * Chaves de dicionários indexados por sigla (subsistema, fronteira, país, fluxo do ATLS)
 * seguem os tipos abaixo.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Proveniencia, Submercado } from "./tipos";

export type FronteiraRede = "N_NE" | "N_SE" | "NE_SE" | "S_SE";
export type PaisRede = "ARGENTINA" | "URUGUAI" | "PARAGUAI";
/** Países com programado e com conversoras no Sul (Argentina e Uruguai). */
export type PaisSul = "ARGENTINA" | "URUGUAI";
/** Pares com programado × verificado: as quatro fronteiras e os dois países do Sul. */
export type ParProgramado = FronteiraRede | PaisSul;
export type SubsistemaOuSin = Submercado | "SIN";
export type Faixa = "1" | "10" | "100";
export type LimiarSensibilidade = "500" | "1000" | "2000";

type Colunas<K extends string> = Record<K, (number | null)[]>;

/* ---------- cabeçalho, regras, esquema da fonte e cobertura ---------- */

export type ReferenciaRede = {
  /** Último dia com as 24 horas das quatro fronteiras. */
  dia: string;
  ultima_hora_fluxo: string;
  ultima_hora_pld: string | null;
  ano_inicial: number;
};

export type RegrasRede = {
  orientacao: string;
  energia: string;
  bruto_liquido: string;
  nulo: string;
  pld: string;
  balanco: string;
  tolerancia_balanco: string;
  limites: string;
  materialidade: string;
};

export type FronteiraDef = { par: FronteiraRede; de: Submercado; para: Submercado; nome: string };
export type PaisDef = { pais: PaisRede; nome: string };

/** Como cada arquivo anual do ONS publicou as linhas (orientação, sinal, programado). */
export type EsquemaIntercambioNacional = {
  recurso: string;
  linhas: number;
  tem_programado: boolean;
  /** Contagem de linhas por orientação publicada ("N->NE", "SE->S", "NE->N"...). */
  orientacoes: Record<string, number>;
  verificado_negativo: number;
  verificado_zero: number;
  /** true = quatro orientações fixas com valor com sinal; false = linha orientada pelo sentido da hora. */
  orientacao_fixa: boolean;
  primeira: string | null;
  ultima: string | null;
  conflitos: number;
};

export type EsquemaIntercambioInternacional = {
  recurso: string;
  linhas: number;
  tem_programado: boolean;
  paises: Record<string, number>;
  primeira: string | null;
  ultima: string | null;
};

export type EsquemaBalanco = {
  recurso: string;
  linhas: number;
  nulos: Record<string, number>;
  subsistemas: Record<string, number>;
  primeira: string | null;
  ultima: string | null;
};

export type EsquemaFonteRede = {
  intercambio_nacional: EsquemaIntercambioNacional[];
  intercambio_internacional: EsquemaIntercambioInternacional[];
  balanco: EsquemaBalanco[];
};

export type DiaIncompleto = { dia: string; horas: number };
export type CoberturaFonte = { dias_incompletos: number; lista: DiaIncompleto[] };
export type CoberturaRede = {
  inicio: string;
  fim: string;
  dias: number;
  fronteiras: CoberturaFonte;
  exterior: CoberturaFonte;
  balanco: CoberturaFonte;
};

/* ---------- P028: circulação ---------- */

export type CamposFronteiraDia =
  | "liquido_mwh"
  | "canonico_mwh"
  | "inverso_mwh"
  | "contra_saldo_mwh"
  | "horas"
  | "horas_inverso"
  | "reversoes"
  | "horas_precos_separados"
  | "horas_separados_fluxo_para_mais_caro"
  | "horas_separados_fluxo_para_mais_barato";

export type ResumoFronteira30d = {
  par: FronteiraRede;
  de: Submercado;
  para: Submercado;
  inicio: string;
  fim: string;
  dias: number;
  dias_completos: number;
  horas: number;
  liquido_mwh: number;
  canonico_mwh: number;
  inverso_mwh: number;
  /** min(canônico, inverso) na janela inteira: energia que o saldo de 30 dias esconde. */
  contra_saldo_mwh: number;
  /** Soma, dia a dia, do que o saldo diário esconde. */
  contra_saldo_dias_mwh: number;
  dias_com_reversao: number;
  dias_com_os_dois_sentidos: number;
  horas_canonico: number;
  horas_inverso: number;
  horas_pld: number;
  horas_precos_separados: number;
  horas_separados_fluxo_para_mais_caro: number;
  horas_separados_fluxo_para_mais_barato: number;
};

export type CamposFronteiraMes =
  | "liquido_mwh"
  | "canonico_mwh"
  | "inverso_mwh"
  | "contra_saldo_dias_mwh"
  | "horas"
  | "horas_inverso"
  | "horas_precos_separados";

export type CirculacaoRede = {
  diario: { dias: string[]; por_par: Record<FronteiraRede, Colunas<CamposFronteiraDia>> };
  resumo_30d: ResumoFronteira30d[];
  mensal: { meses: string[]; horas_calendario: number[]; por_par: Record<FronteiraRede, Colunas<CamposFronteiraMes>> };
  subsistemas_diario: {
    dias: string[];
    por_sm: Record<Submercado, Colunas<"exportacao_bruta_mwh" | "importacao_bruta_mwh" | "liquido_mwh" | "horas_transito">>;
  };
  subsistemas_mensal: {
    meses: string[];
    por_sm: Record<Submercado, Colunas<"exportacao_bruta_mwh" | "importacao_bruta_mwh" | "horas" | "horas_transito">>;
  };
  /** Últimos 7 dias completos, hora a hora: fluxo, programado, exterior e PLD na mesma hora. */
  janela_horaria: {
    horas: string[];
    fluxo: Record<FronteiraRede, (number | null)[]>;
    programado: Record<FronteiraRede, (number | null)[]>;
    exterior: Record<PaisSul, (number | null)[]>;
    pld: Record<Submercado, (number | null)[]>;
  };
};

/* ---------- P029: balanço e exterior ---------- */

export type PeriodoResiduo = { inicio: string; fim: string; horas: number };

export type IdentidadeBalanco = {
  /** "balanco.SE", "perimetro.S", "soma_sin"... */
  id: string;
  identidade: "balanco" | "perimetro" | "soma_sin";
  sm: SubsistemaOuSin;
  descricao: string;
  horas: number;
  horas_fecham: number;
  /** Horas que fecham, mas com diferença entre 0,01 MWmed e a tolerância (sensibilidade da tolerância). */
  horas_entre_0_01_e_tolerancia: number;
  horas_residuo: number;
  horas_acima: Record<Faixa, number>;
  maior_residuo_mwmed: number | null;
  maior_residuo_em: string | null;
  /** Até 12 sequências contíguas mais longas de horas com resíduo. */
  periodos: PeriodoResiduo[];
  n_periodos: number;
  primeira_hora_residuo: string | null;
  ultima_hora_residuo: string | null;
};

export type CamposBalancoMes =
  | "geracao_mwh"
  | "carga_mwh"
  | "intercambio_mwh"
  | "fronteiras_exterior_mwh"
  | "residuo_balanco_mwh"
  | "residuo_perimetro_mwh"
  | "horas_completas"
  | "horas_residuo_balanco"
  | "horas_residuo_perimetro";

export type BalancoRede = {
  tolerancia_mwmed: number;
  faixas_mwmed: number[];
  identidades: IdentidadeBalanco[];
  mensal: { meses: string[]; por_sm: Record<SubsistemaOuSin, Colunas<CamposBalancoMes>> };
};

export type ExteriorPais = Colunas<
  "exportacao_mwh" | "importacao_mwh" | "horas" | "horas_com_fluxo" | "programado_liquido_mwh"
> & { ultima_hora: string | null; ultima_hora_com_fluxo: string | null };

export type ResumoExterior12m = {
  meses: [string, string] | null;
  exportacao_mwh: number;
  importacao_mwh: number;
  horas_com_fluxo: number;
  horas: number;
};

export type ExteriorRede = {
  meses: string[];
  por_pais: Record<PaisRede, ExteriorPais>;
  /** Itaipu é geração, não intercâmbio: contexto do exterior. */
  itaipu: Colunas<"total_mwh" | "brasil_mwh" | "nao_brasil_mwh" | "horas">;
  resumo_12m: Record<PaisRede, ResumoExterior12m>;
  itaipu_identidades: {
    linhas: number | null;
    total_diferente_de_60_mais_50: number | null;
    brasil_diferente_de_60_mais_50_brasil: number | null;
  };
};

/* ---------- P030: restrições publicadas ---------- */

export type BuscaLimite = { onde: string; url: string; resultado: string };

export type TrechoConferido = { id: string; texto: string; confere: boolean | null };

export type DocumentoOns = {
  titulo: string;
  url: string;
  licenca: string;
  capturado_em: string | null;
  sha256: string | null;
  arquivo: string | null;
  extracao: string | null;
  trechos: TrechoConferido[];
};

export type FluxoAtls = {
  /** Sigla do ONS (FNS, FNESE, RSE, RSUL...). */
  fluxo: string;
  /** Definição só quando conferida literalmente em documento público do ONS. */
  definicao: string | null;
  documento_definicao: string | null;
  inicio: string | null;
  fim: string | null;
  meses: number;
  meses_com_violacao: number;
  horas_violacao_total: number;
  ultimos_12_meses: { inicio: string; fim: string; horas_violacao: number; meses_com_violacao: number } | null;
  /** Publicado no último mês do arquivo. */
  ativo: boolean;
  /** Série mensal desde o ano inicial do módulo (histórico completo em rede_atls.csv). */
  serie: { meses: string[]; horas_violacao: (number | null)[] };
  conferencias: {
    acumulado_anual_confere: number;
    acumulado_anual_meses: number;
    meses_denominador_diferente_do_calendario: string[];
    meses_atls_1_com_horas: string[];
  };
};

export type Perturbacao = {
  cod_perturbacao: string;
  inicio: string;
  registros: number;
  ens_mwh: number;
  carga_interrompida_mw_soma: number;
  ufs: string[];
  subsistemas: string[];
  rede_basica: boolean;
};

export type CamposInterrupcaoAno =
  | "registros"
  | "perturbacoes"
  | "ens_mwh"
  | "registros_rede_basica"
  | "ens_rede_basica_mwh"
  | "registros_100mw";

export type RestricoesRede = {
  limites: { integrados: false; busca: BuscaLimite[]; conclusao: string };
  documentos: Record<"ons_submodulo_9_1" | "ons_pel_2019_2020" | "ons_rt_dpl_0131_2023", DocumentoOns>;
  atls: {
    fluxos: FluxoAtls[];
    ultimo_mes: string | null;
    unidade_publicada: string;
    maior_valor_lido: number | null;
    menor_valor_lido: number | null;
  };
  interrupcoes: {
    registros: number;
    perturbacoes: number;
    inicio: string | null;
    fim: string | null;
    registros_abaixo_de_100mw: number;
    linhas_repetidas: number | null;
    anual: { anos: string[]; parcial: boolean[]; por_sm: Record<SubsistemaOuSin, Record<CamposInterrupcaoAno, number[]>> };
    maiores_perturbacoes: Perturbacao[];
    perturbacoes_recentes: Perturbacao[];
    ultimos_12_meses: {
      inicio: string | null;
      fim: string | null;
      registros: number;
      perturbacoes: number;
      ens_mwh: number;
      registros_rede_basica: number;
    };
  };
};

/* ---------- P031: programado versus verificado ---------- */

export type DistribuicaoDesvio = {
  horas: number;
  inicio: string;
  fim: string;
  vies_mwmed: number;
  desvio_abs_medio_mwmed: number;
  p50_abs_mwmed: number;
  p90_abs_mwmed: number;
  p99_abs_mwmed: number;
  max_abs_mwmed: number;
  horas_materiais: Record<LimiarSensibilidade, number>;
  horas_inversao: number;
  programado_abs_mediano_mwmed: number;
};

export type MaiorDesvio = {
  hora: string;
  par: ParProgramado;
  programado_mwmed: number;
  verificado_mwmed: number;
  desvio_mwmed: number;
  inversao: boolean;
};

export type ProgramadoRede = {
  inicio: string | null;
  fim: string;
  limiar_material_mwmed: number;
  justificativa_limiar: string | null;
  limiares_sensibilidade_mwmed: number[];
  distribuicao: Partial<Record<ParProgramado, DistribuicaoDesvio>>;
  diario: {
    dias: string[];
    por_par: Record<ParProgramado, Colunas<"programado_mwh" | "verificado_mwh" | "desvio_abs_mwh" | "horas_materiais" | "horas_inversao">>;
  };
  mensal: {
    meses: string[];
    por_par: Record<
      ParProgramado,
      Colunas<"horas" | "programado_mwh" | "verificado_mwh" | "desvio_abs_mwh" | "horas_materiais" | "horas_inversao">
    >;
  };
  maiores_desvios: MaiorDesvio[];
  versao_programa: {
    identificada_pela_fonte: boolean;
    texto: string;
    conferencia_pdo: {
      dias: number;
      primeiro_dia: string | null;
      ultimo_dia: string | null;
      horas: number;
      horas_conferem: number;
      horas_com_programa_ou_pdo: number;
      horas_com_programa_ou_pdo_conferem: number;
      tolerancia_mwmed: number;
      amostra: string;
    };
    revisoes_do_programado_entre_capturas: number;
    capturas_comparadas: number | null;
  };
};

/* ---------- conferências, achados e proveniência ---------- */

export type ConferenciaSilver = {
  arquivos_identicos: string[];
  horas_comparadas: number;
  iguais: number;
  diferentes_no_mesmo_arquivo: number;
  diferentes_por_revisao: number;
  /** [hora, valor no silver principal, valor aqui] da primeira divergência, se houver. */
  exemplo_divergencia: [string, number, number] | null;
  captura_principal: string | null;
  captura_modulo: string | null;
};

export type DicionarioOns = {
  conjunto: string;
  url: string | null;
  capturado_em: string | null;
  sha256: string | null;
  data_documento: string | null;
  /** O dicionário diz o que significa o sinal do valor? */
  menciona_sinal: boolean | null;
  versoes: { versao: string; data: string; descricao: string }[];
  permissoes: Record<string, { nulo: boolean; zerado: boolean; negativo: boolean }>;
  trechos: TrechoConferido[];
};

export type AchadosRede = {
  A05: {
    status: string;
    perimetro: string;
    sinais: string;
    exterior: string;
    perdas: string;
    diagnostico_perimetro_sul: {
      horas: number;
      balanco_coerente: number;
      exterior_zero_no_balanco: number;
      exterior_menor_no_balanco: number;
      exterior_outro_no_balanco: number;
      meses: string[];
    };
    paraguai: { horas: number; horas_com_fluxo: number; inicio: string | null; fim: string | null };
    frases: string[];
    dicionario_balanco_define_sinal: boolean | null;
    dicionario_internacional_define_sinal: boolean | null;
  };
  A06: {
    status: string;
    conclusao: string;
    busca: BuscaLimite[];
    trecho_dicionario: TrechoConferido | null;
    correcao_metodologia: string;
  };
  dicionarios: Record<string, DicionarioOns>;
};

export type ProvenienciaRede = Record<
  "fluxo" | "subsistemas" | "pld_na_hora" | "balanco" | "exterior" | "atls" | "interrupcoes" | "programado",
  Proveniencia
>;

/**
 * Evidências por chave: `contra_saldo_30d.<fronteira>`, `a05_perimetro_sul`,
 * `a05_balanco_sin`, `exterior_12m`, `atls_12m.<fluxo>`, `ens_12m`,
 * `desvio_medio.<par>`.
 */
export type EvidenciasRede = Record<string, Evidencia>;

export type GoldRedeDetalhe = Cabecalho & {
  referencia: ReferenciaRede;
  regras: RegrasRede;
  fronteiras: FronteiraDef[];
  paises: PaisDef[];
  esquema_fonte: EsquemaFonteRede;
  cobertura: CoberturaRede;
  circulacao: CirculacaoRede;
  balanco: BalancoRede;
  exterior: ExteriorRede;
  restricoes: RestricoesRede;
  programado: ProgramadoRede;
  conferencia_silver_principal: Record<"ons_rede_intercambio_nacional" | "ons_rede_balanco", ConferenciaSilver> | null;
  achados: AchadosRede;
  ressalvas: string[];
  downloads: Download[];
  proveniencia: ProvenienciaRede;
  evidencias: EvidenciasRede;
};
