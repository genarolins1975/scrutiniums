/**
 * Tipos da gold do módulo Qualidade do serviço de distribuição
 * (public/energia/gold/qualidade.json e public/energia/series/qualidade_mapa.json), espelho
 * exato do que pipeline/energia/modulos/qualidade.py publica.
 *
 * Histórico: DEC e FEC por conjunto e mês desde 2000 (a série de 2000 a 2009 não tem as
 * parcelas atuais: parcelas_dec e parcelas_fec vêm null nesses anos).
 *
 * Unidades: DEC em horas e centésimos de hora por unidade consumidora (10,50 h são
 * 10 h 30 min, não 10 h 50 min); FEC em interrupções e centésimos por unidade
 * consumidora; compensações em R$ nominais; TMAE em minutos; IASC de 0 a 100.
 * Ausência é null e é exibida como ausência; nenhum número é recalculado na interface.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Natureza, Proveniencia } from "./tipos";

/** Grupos de parcelas publicados (a soma dos grupos é o DEC de todas as origens publicadas). */
export type GrupoParcela = "apurado" | "emergencia" | "dia_critico" | "externa" | "ons";
export type Parcelas = Record<GrupoParcela, number | null>;

export type TipoCompensacao = "mensal" | "trimestral" | "anual" | "dicri" | "dise";

export type ParcialAno = {
  ano: number;
  /** AAAA-MM do último mês nacional completo do ano corrente. */
  ate_mes: string;
  meses: number;
  dec: number | null;
  fec: number | null;
  dec_mesmos_meses_ano_anterior: number | null;
  fec_mesmos_meses_ano_anterior: number | null;
  aviso: string;
};

export type BrasilAnual = {
  ano: number;
  /** 12 meses nacionais completos; ano incompleto tem dec, fec e razões nulos. */
  completo: boolean;
  meses: number;
  dec: number | null;
  fec: number | null;
  dec_limite: number | null;
  fec_limite: number | null;
  /** Fração das UCs em conjuntos com limite publicado para o ano (0 a 1). */
  cobertura_limite: number | null;
  razao_dec: number | null;
  razao_fec: number | null;
  dec_todas_parcelas: number | null;
  fec_todas_parcelas: number | null;
  /** null antes de 2010 (outra desagregação na fonte) e em ano incompleto. */
  parcelas_dec: Parcelas | null;
  parcelas_fec: Parcelas | null;
  ucs_media: number | null;
  conjuntos: number;
};

export type BrasilMensal = {
  m: string;
  dec: number | null;
  fec: number | null;
  ucs: number | null;
  conjuntos: number;
  /** false = mês publicado antes de todas as distribuidoras enviarem (não entra em ano). */
  completo: boolean;
};

export type IdentidadeApurado = {
  ano: number;
  conjunto_meses: number;
  /** % dos conjunto-meses em que DEC = DECIP + DECIND (tolerância de arredondamento 0,01). */
  pct_dec_igual_ip_mais_ind: number | null;
  pct_fec_igual_ip_mais_ind: number | null;
};

export type SerieDistribuidora = {
  anos: number[];
  dec: (number | null)[];
  fec: (number | null)[];
  dec_limite: (number | null)[];
  fec_limite: (number | null)[];
};

export type CompensacaoDistribuidora = {
  ano: number;
  valor: number | null;
  quantidade: number | null;
  /** Valor anual ÷ UCs médias: normalização para comparar, não é o crédito de cada consumidor. */
  valor_por_uc: number | null;
  valor_por_tipo: Partial<Record<TipoCompensacao, number | null>>;
};

export type IascDistribuidora = {
  ano: number;
  valor: number | null;
  /** Entrevistas da distribuidora (soma das contagens por sexo publicadas). */
  amostra: number | null;
  ordem: number | null;
  categoria: string | null;
};

export type ReclamacoesDistribuidora = {
  ano: number;
  n1: number | null;
  n2: number | null;
  interrupcao_n1: number | null;
  /** Taxas por UC só com os 12 meses enviados pela distribuidora (senão null). */
  n1_por_mil_uc: number | null;
  n2_por_mil_uc: number | null;
  interrupcao_n1_por_mil_uc: number | null;
  meses: number;
  ouvidoria_aneel: number | null;
  ouvidoria_aneel_procedentes: number | null;
  /** null quando o arquivo da Ouvidoria não cobre os 12 meses do ano. */
  ouvidoria_aneel_por_100mil_uc: number | null;
  /** Meses com ao menos uma solicitação registrada (mês sem registro = nenhuma solicitação). */
  meses_ouvidoria: number;
};

export type Distribuidora = {
  /** CNPJ de 14 dígitos: chave canônica. */
  cnpj: string;
  /** SigAgente atual publicado pela ANEEL nos indicadores de continuidade. */
  sigla: string | null;
  /** Nome usado pela ANEEL no IASC, quando a distribuidora está na pesquisa. */
  nome_comercial: string | null;
  /** Concessionária ou Permissionária (conjunto de manifestações). */
  classificacao: string | null;
  ano: number;
  meses: number;
  ucs: number | null;
  conjuntos: number;
  dec: number | null;
  fec: number | null;
  dec_limite: number | null;
  fec_limite: number | null;
  cobertura_limite: number | null;
  razao_dec: number | null;
  razao_fec: number | null;
  dgc_calculado: number | null;
  dgc_publicado: number | null;
  posicao_ranking: number | null;
  porte_ranking: "grande" | "pequeno" | null;
  dec_todas_parcelas: number | null;
  fec_todas_parcelas: number | null;
  /** % do DEC de todas as origens que foi expurgado do apurado. */
  pct_dec_expurgado: number | null;
  parcelas_dec: Parcelas;
  parcelas_fec: Parcelas;
  /** Menor cobertura mensal (UCs com DEC ÷ UCs com número de UCs) no ano. */
  cobertura_min: number | null;
  compensacao: CompensacaoDistribuidora | null;
  iasc: IascDistribuidora | null;
  reclamacoes: ReclamacoesDistribuidora | null;
  tmae_min: number | null;
  /** null quando a base de eventos não foi integrada; 0 = nenhum evento publicado. */
  eventos_emergencia_2026: number | null;
  serie: SerieDistribuidora;
};

export type Quantis = {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p99: number | null;
  min: number | null;
  max: number | null;
};

export type FaixaHistograma = { de: number; ate: number | null; conjuntos: number };

export type ConjuntoPublico = {
  conjunto: number;
  nome: string | null;
  cnpj: string | null;
  sigla: string | null;
  dec: number | null;
  fec: number | null;
  dec_limite: number | null;
  fec_limite: number | null;
  razao_dec: number | null;
  razao_fec: number | null;
  ucs: number | null;
};

export type ConjuntosHistorico = {
  ano: number;
  conjuntos: number;
  com_limite: number;
  acima_limite_dec: number;
  pct_acima_limite_dec: number | null;
  pct_ucs_acima_limite_dec: number | null;
  dec_p50: number | null;
  dec_p90: number | null;
  razao_p50: number | null;
  razao_p90: number | null;
};

/** Contagem de conjuntos por faixa de limite (linhas) e faixa da razão DEC ÷ limite (colunas). */
export type MatrizLimiteRazao = {
  limite_de: number;
  limite_ate: number | null;
  "razao_0_0.5": number;
  "razao_0.5_1.0": number;
  "razao_1.0_1.5": number;
  "razao_1.5_mais": number;
};

export type Conjuntos = {
  ano: number;
  total: number;
  com_limite: number;
  acima_limite_dec: number;
  acima_limite_fec: number;
  acima_algum_limite: number;
  pct_acima_limite_dec: number | null;
  ucs_com_limite: number | null;
  ucs_acima_limite_dec: number | null;
  pct_ucs_acima_limite_dec: number | null;
  quantis_dec: Quantis;
  quantis_fec: Quantis;
  quantis_razao_dec: Quantis;
  quantis_razao_fec: Quantis;
  histograma_razao_dec: FaixaHistograma[];
  histograma_razao_fec: FaixaHistograma[];
  matriz_limite_razao_dec: MatrizLimiteRazao[];
  cauda_razao_dec: ConjuntoPublico[];
  cauda_dec: ConjuntoPublico[];
  historico: ConjuntosHistorico[];
};

export type CompensacaoAnual = {
  ano: number;
  /** Todos os 12 meses com as distribuidoras que costumam informar. */
  completo: boolean;
  valor: number | null;
  quantidade: number | null;
  /** null nos anos sem nenhuma linha de unidade geradora na fonte (antes de 2018). */
  valor_ug: number | null;
  valor_por_uc: number | null;
  por_tipo: Partial<Record<TipoCompensacao, { valor: number | null; quantidade: number | null }>>;
};

export type CompensacaoMensal = { m: string; valor: number | null; quantidade: number | null; completo: boolean };

export type Compensacoes = {
  ano_referencia: number;
  ultimo_mes_completo: string | null;
  anual: CompensacaoAnual[];
  mensal: CompensacaoMensal[];
  concentracao_5_maiores_pct: number | null;
  rotulos_tipo: Record<TipoCompensacao, string>;
};

/** Distribuidora pesquisada no IASC sem indicadores de continuidade no ano de referência. */
export type IascLinha = {
  cnpj: string;
  sigla: string | null;
  nome_iasc: string | null;
  iasc: number | null;
  amostra: number | null;
  ordem: number | null;
  categoria: string | null;
  classificacao: string | null;
};

export type TaxaNacional = {
  ano: number;
  /** Ano fechado com a fonte cobrindo os 12 meses; ano corrente é parcial (taxas null). */
  completo: boolean;
  /** Distribuidoras no numerador e no denominador (mesmo universo). */
  distribuidoras: number;
  total: number | null;
  ucs: number | null;
  /** UCs do universo ÷ UCs de todas as distribuidoras com continuidade no ano (0 a 1). */
  cobertura_ucs: number | null;
  /** Por mil UCs (reclamações na distribuidora) ou por 100 mil UCs (Ouvidoria ANEEL). */
  por_ucs: number | null;
  meses_min: number | null;
  meses_max: number | null;
  /** Manifestações: distribuidoras fora por não terem os 12 meses enviados (0 na Ouvidoria). */
  distribuidoras_sem_12_meses: number;
  /** Lista das distribuidoras fora (vazia em ano parcial). */
  fora_meses_incompletos: { cnpj: string; sigla: string | null; meses: number }[];
};

export type ReclamacoesNacional = TaxaNacional & {
  interrupcao: number | null;
  interrupcao_por_mil_uc: number | null;
  n2: number | null;
  n2_por_mil_uc: number | null;
};

export type OuvidoriaNacional = TaxaNacional & {
  procedentes: number | null;
  procedentes_por_100mil_uc: number | null;
};

export type EventoEmergencia = {
  codigo: string;
  cnpj: string | null;
  sigla: string | null;
  inicio: string | null;
  fim: string | null;
  duracao_h: number | null;
  chi_evento: number | null;
  chi_limite: number | null;
  razao_chi: number | null;
  origem: string | null;
};

export type Atendimento = {
  /** IASC de cada distribuidora em Distribuidora.iasc; aqui o resumo do último ano. */
  iasc: {
    ano: number | null;
    distribuidoras: number;
    /** Soma das amostras (a ANEEL declara cerca de 30 mil entrevistas por ano). */
    entrevistas: number | null;
    quantis: Quantis;
    sem_continuidade_no_ano: IascLinha[];
    anos_disponiveis: number[];
  };
  reclamacoes_distribuidora: ReclamacoesNacional[];
  ouvidoria_aneel: OuvidoriaNacional[];
  tmae: { ano: number; distribuidoras: number; ocorrencias: number | null; tmae_min: number | null }[];
  eventos_emergencia: {
    total: number;
    distribuidoras: number;
    inicio_min: string | null;
    inicio_max: string | null;
    /** Sobre os eventos com datas válidas (duração ausente quando a data publicada é implausível). */
    duracao_mediana_h: number | null;
    duracao_max_h: number | null;
    /** Eventos com início ou fim implausível como publicados (ex.: fim no ano 3036): mantidos, sem duração. */
    datas_invalidas: { codigo: string; sigla: string | null; inicio: string | null; fim: string | null; motivo: string }[];
    maiores_chi: EventoEmergencia[];
  };
  resiliencia_parcelas: {
    ano: number;
    dec_emergencia: number | null;
    dec_dia_critico: number | null;
    dec_todas_parcelas: number | null;
    dec_apurado: number | null;
  }[];
};

/** Relação do município com os conjuntos ATIVOS no ano de referência (com DEC publicado). */
export type RelacaoMunicipio = "conjunto_exclusivo" | "conjunto_compartilhado" | "varios_conjuntos" | "sem_conjunto_ativo";

export type MapaResumo = {
  ano: number;
  municipios_com_relacao: number;
  municipios_com_valor: number;
  por_relacao: Partial<Record<RelacaoMunicipio, number>>;
  /** URL do JSON com as linhas por município (/energia/series/qualidade_mapa.json), lido sob demanda. */
  arquivo: string;
  regra: string;
};

export type ReconciliacaoDgcAno = {
  ano: number;
  publicados: number;
  com_dgc: number;
  sem_cnpj: string[];
  comparados: number;
  ate_1_centesimo: number;
  exatos_2_casas: number;
  maior_diferenca: number | null;
  divergentes: {
    empresa: string;
    sigla_ranking: string | null;
    cnpj: string | null;
    dgc_publicado: number | null;
    dgc_calculado: number | null;
    diferenca: number | null;
  }[];
};

export type ControleImportacao = {
  dataset: string;
  recurso: string;
  sha256: string;
  capturado_em: string;
  publicado_em: string | null;
  importado_em: string | null;
  versao_importacao: string | null;
  /** Contagens da importação (linhas lidas, conflitos de chave, observações novas, revisões). */
  detalhe: Record<string, unknown> | null;
};

export type QualidadeGold = Cabecalho & {
  ano_referencia: number;
  ultimo_mes_completo: string;
  parcial: ParcialAno | null;
  unidades: { dec: string; fec: string; tmae: string; compensacao: string; iasc: string };
  regras: Record<"agregacao" | "limite" | "apurado" | "centesimos" | "compensacao" | "parcial", string>;
  parcelas: {
    rotulos: Record<GrupoParcela, string>;
    definicao: Record<string, string>;
    grupos: Record<GrupoParcela, string[]>;
  };
  brasil: { anual: BrasilAnual[]; mensal: BrasilMensal[]; identidade_apurado: IdentidadeApurado[] };
  distribuidoras: Distribuidora[];
  conjuntos: Conjuntos;
  compensacoes: Compensacoes;
  atendimento: Atendimento;
  mapa: MapaResumo;
  reconciliacao: { dgc: ReconciliacaoDgcAno[] };
  /** Resultado da importação de cada arquivo vigente (modo Auditar). */
  controles: ControleImportacao[];
  /** "Comprove este número" (pipeline/energia/evidencia.py). Uma chave some quando o número não
   * existe no ano de referência (ex.: taxa nacional de ano incompleto). */
  evidencias: Partial<
    Record<
      | "dec_brasil"
      | "fec_brasil"
      | "conjuntos_acima_limite"
      | "compensacoes_ano"
      | "reclamacoes_distribuidora"
      | "ouvidoria_aneel",
      Evidencia
    >
  >;
  proveniencia: Record<
    | "conjuntos"
    | "distribuidoras"
    | "limites"
    | "compensacoes"
    | "iasc"
    | "reclamacoes"
    | "ouvidoria_aneel"
    | "atendimento_emergencial"
    | "eventos"
    | "mapa"
    | "ranking",
    Proveniencia
  >;
  downloads: Download[];
};

/**
 * Mapa municipal (public/energia/series/qualidade_mapa.json), gravado sem indentação e lido no
 * cliente sob demanda. Cada linha: [cod_ibge, índice em `relacoes`, n_conjuntos ativos, dec_min,
 * dec_max, fec_min, fec_max]. Os valores são dos conjuntos inteiros que atendem o município
 * (IndQual Município, conjuntos com DEC no ano): nunca um DEC medido no município.
 */
export type LinhaMapaQualidade = [string, 0 | 1 | 2 | 3, number, number | null, number | null, number | null, number | null];

export type QualidadeMapaGold = Cabecalho & {
  ano: number;
  colunas: ["cod_ibge", "relacao", "n_conjuntos", "dec_min", "dec_max", "fec_min", "fec_max"];
  relacoes: [RelacaoMunicipio, RelacaoMunicipio, RelacaoMunicipio, RelacaoMunicipio];
  linhas: LinhaMapaQualidade[];
};

/** Natureza declarada de cada bloco (conferida com a proveniência na gold). */
export const NATUREZA_BLOCO: Record<keyof QualidadeGold["proveniencia"], Natureza> = {
  conjuntos: "OBSERVADO",
  distribuidoras: "CALCULADO",
  limites: "CALCULADO",
  compensacoes: "CALCULADO",
  iasc: "ESTIMADO",
  reclamacoes: "CALCULADO",
  ouvidoria_aneel: "CALCULADO",
  atendimento_emergencial: "CALCULADO",
  eventos: "OBSERVADO",
  mapa: "CALCULADO",
  ranking: "OBSERVADO",
};
