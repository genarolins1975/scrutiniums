/**
 * Tipos da gold do módulo Perdas (public/energia/gold/perdas.json), espelho exato do que
 * pipeline/energia/modulos/perdas.py publica, e dos dois arquivos lidos sob demanda
 * (public/energia/series/perdas_anual.json e perdas_municipios.json).
 *
 * Energia em MWh, taxas em %, tarifa em R$/MWh nominais sem tributos. Ausência é null e é
 * exibida como ausência: zero só aparece quando a fonte publicou zero. Nenhuma taxa é
 * recalculada na interface; agregados já vêm como razão de somas do pipeline.
 */
import type { Cabecalho, Download, Proveniencia } from "./tipos";

/** Classe do fechamento do balanço anual (injetada = fornecida + irregular + perdas). */
export type EstadoReconciliacao = "fecha" | "residuo_pequeno" | "residuo_relevante" | "sem_componentes";

/** Alertas físicos que tiram o agente-ano de agregados e comparações. */
export type AlertaAnual =
  | "injetada_nao_positiva"
  | "perda_total_negativa"
  | "perda_total_maior_que_injetada"
  | "representacoes_conflitantes";

/**
 * Origem do denominador: "publicada" = linha de energia injetada do SAMP (leiaute antigo);
 * "requerida" = fornecida + irregular + perdas (leiaute de 2024, em que a linha publicada é bruta);
 * "mista" = ano com meses dos dois leiautes.
 */
export type OrigemInjetada = "publicada" | "requerida" | "mista";

export type Universo = "concessionarias" | "permissionarias" | "todas";

export type Definicoes = {
  perdas_totais: string;
  perdas_tecnicas: string;
  perdas_nao_tecnicas: string;
  energia_injetada: string;
  mercado_bt: string;
  residuo: string;
  tecnica_regulatoria: string;
  custo_tarifa: string;
};

export type ReferenciaTemporal = {
  /** Último ano civil encerrado com ao menos 90% das distribuidoras completas. */
  ano: number;
  ano_parcial: number | null;
  /** AAAA-MM da última competência publicada em qualquer distribuidora. */
  ultima_competencia: string;
  ultima_competencia_parcial: string | null;
  aviso_parcial: string | null;
};

export type LinhaNacional = {
  ano: number;
  universo: Universo;
  /** Distribuidoras somadas: 12 meses e sem alerta físico. */
  n_distribuidoras: number;
  /** Distribuidoras com algum dado no ano. */
  n_publicadas: number;
  injetada_mwh: number;
  perdas_totais_mwh: number;
  taxa_total_pct: number | null;
  n_com_tecnica: number;
  injetada_com_tecnica_mwh: number;
  /** % da injetada coberta pelas distribuidoras que publicam a separação técnica. */
  cobertura_tecnica_pct: number | null;
  perdas_tecnicas_mwh: number | null;
  /** Razão sobre a injetada das mesmas distribuidoras que publicam a técnica. */
  taxa_tecnica_pct: number | null;
  n_com_pnt_bt: number;
  pnt_mwh: number | null;
  mercado_bt_mwh: number | null;
  pnt_bt_pct: number | null;
  /** Agentes-ano fora da soma, por motivo (ano_incompleto ou o primeiro alerta físico). */
  excluidos: Record<string, number>;
};

export type ReferenciaDistribuidora = {
  ano: number;
  meses: number;
  completo: boolean;
  injetada_mwh: number | null;
  origem_injetada: OrigemInjetada;
  perdas_totais_mwh: number | null;
  taxa_total_pct: number | null;
  perdas_tecnicas_mwh: number | null;
  taxa_tecnica_pct: number | null;
  pnt_mwh: number | null;
  pnt_injetada_pct: number | null;
  mercado_bt_mwh: number | null;
  pnt_bt_pct: number | null;
  residuo_pct_injetada: number | null;
  reconciliacao: EstadoReconciliacao;
  alertas: AlertaAnual[];
};

export type VariacaoAnual = {
  ano_base: number;
  taxa_total_pp: number | null;
  /** Variação relativa do volume de perdas totais (%). */
  perdas_totais_pct: number | null;
  pnt_bt_pp: number | null;
  /** Injetada mudou mais de 30%: provável mudança de universo (incorporação, cisão). */
  quebra_escala: boolean;
  /** Um ano no leiaute antigo e outro no de 2024. */
  atravessa_leiaute: boolean;
};

export type SegmentoTecnico = {
  /** AAAA-MM */
  inicio: string;
  fim: string;
  /** % da energia injetada, constante no trecho. */
  pct: number;
  meses: number;
  /** Resolução homologatória cuja vigência começa no mês de transição, quando existe. */
  reh: { resolucao: string | null; inicio_vigencia: string } | null;
  /** Dia de início reconstituído da média pró-rata do mês de transição. */
  dia_inicio_prorata: number | null;
  transicao: string | null;
};

export type TarifaPerdas = {
  resolucao: string | null;
  /** AAAA-MM-DD */
  inicio: string;
  fim: string | null;
  pt: number;
  pnt: number;
  rede_basica: number;
  perdas: number;
  tusd: number;
  te: number;
  total: number;
  participacao_perdas_pct: number | null;
  participacao_pnt_pct: number | null;
  n_processos: number;
};

export type Territorio = {
  municipios: number;
  confirmados: number;
  exclusivos: number;
  compartilhados: number;
  nao_confirmados: number;
  ufs: string[];
  /** UFs que só aparecem em vínculos sem confirmação (em geral erro de código na fonte). */
  ufs_so_nao_confirmadas: string[];
};

export type ContextoSocial = {
  populacao_confirmados: number;
  populacao_exclusivos: number;
  cobertura_exclusivos_pct: number | null;
  /** R$ de 2022 por mês, média ponderada por moradores. */
  renda_media_pc_confirmados: number | null;
  renda_media_pc_exclusivos: number | null;
  municipios_com_renda: number;
  area_km2_confirmados: number;
};

export type EventoDistribuidora =
  | { tipo: "mudanca_nome"; competencia: string; de: string; para: string }
  | { tipo: "inicio_serie"; competencia: string }
  | { tipo: "fim_serie"; competencia: string };

export type EvidenciaDistribuidora = {
  formula: string;
  numerador: { descricao: string; valor: number | null };
  denominador: { descricao: string; valor: number | null };
  chaves_origem: string[];
  reconciliacao: { descricao: string; resultado: EstadoReconciliacao; tolerancia: string };
};

export type Distribuidora = {
  cnpj: string;
  cnpj_formatado: string;
  sigla: string | null;
  nome: string;
  classificacao: string;
  grupo: "concessionaria" | "permissionaria";
  primeira_competencia: string;
  ultima_competencia: string;
  ativa: boolean;
  referencia: ReferenciaDistribuidora | null;
  variacao: VariacaoAnual | null;
  tecnica_regulatoria: { segmentos: SegmentoTecnico[]; n_segmentos: number } | null;
  tarifa: TarifaPerdas | null;
  territorio: Territorio | null;
  contexto: ContextoSocial | null;
  eventos: EventoDistribuidora[];
  evidencia?: EvidenciaDistribuidora;
};

export type EventoPerdas = EventoDistribuidora & { cnpj: string; sigla: string | null };

export type Associacao = {
  variavel_territorial: string;
  spearman_pnt_bt: number | null;
  n_pnt_bt: number;
  spearman_taxa_total: number | null;
  n_taxa_total: number;
  universo: string;
  leitura: string;
};

export type MapaPerdas = {
  ano_relacao: number | null;
  municipios: number;
  municipios_compartilhados: number;
  vinculos: number;
  vinculos_nao_confirmados: number;
  codigos_invalidos: string[];
  conjuntos_sem_municipio: string[];
  geometria: string;
  arquivo: string;
  regra: string;
};

export type ComparacaoRelatorio = {
  documento: string;
  acesso: string;
  valores_relatorio: {
    taxa_total_pct: number;
    perdas_tecnicas_twh: number;
    taxa_tecnica_pct: number;
    pnt_twh: number;
    pnt_injetada_pct: number;
    mercado_bt_faturado_sobre_injetada_pct: number;
    base: string;
  };
  valores_observatorio: { taxa_total_pct: number | null; injetada_twh: number | null; base: string };
  leitura: string;
};

export type QualidadePerdas = {
  agentes_no_arquivo: number;
  agentes_com_balanco_de_distribuicao: number;
  agentes_ano_completos: number;
  reconciliacao: Partial<Record<EstadoReconciliacao, number>>;
  alertas: Partial<Record<AlertaAnual, number>>;
  linhas_duplicadas_ignoradas: number;
  ressalvas: string[];
  comparacao_relatorio_aneel: ComparacaoRelatorio;
};

export type Bloqueio = { item: string; tentativas: string[]; evidencia: string; dependencia: string };

/** Objeto "Comprove este número" (seção 11.5), montado no pipeline. */
export type EvidenciaPerdas = {
  valor_exibido: string;
  valor_calculo: number | null;
  unidade: string;
  periodo: string;
  entidade: string;
  universo: string;
  filtros: string[];
  fonte: {
    orgao: string;
    dataset: string;
    recurso: string;
    url_dataset: string;
    url_primaria: string;
    licenca: string;
    arquivo: string | null;
    sha256: string | null;
    capturado_em: string | null;
    publicado_em: string | null;
  };
  chaves_origem: string[];
  formula: string;
  numerador: { descricao: string; valor: number | null };
  denominador: { descricao: string; valor: number | null };
  pesos: string | null;
  exclusoes: string[];
  cobertura: string;
  tratamento_ausencia: string;
  versao: { pipeline: string; codigo: string | null; publicacao: string };
  revisoes: Proveniencia["revisoes_conhecidas"];
  testes: { nome: string; resultado: string; detalhe: string }[];
  reconciliacao: { descricao: string; resultado: string; tolerancia: string } | null;
  download: Download[];
  reproducao: string;
  citacao: string;
};

export type PerdasGold = Cabecalho & {
  referencia: ReferenciaTemporal;
  definicoes: Definicoes;
  nacional: LinhaNacional[];
  nacional_parcial: LinhaNacional | null;
  distribuidoras: Distribuidora[];
  associacao: Associacao;
  mapa: MapaPerdas;
  eventos: EventoPerdas[];
  qualidade: QualidadePerdas;
  bloqueios: Bloqueio[];
  decisoes: string[];
  proveniencia: {
    volumes: Proveniencia;
    taxas: Proveniencia;
    reconciliacao: Proveniencia;
    tecnica_regulatoria: Proveniencia;
    tarifa: Proveniencia;
    territorio: Proveniencia;
    contexto: Proveniencia;
  };
  evidencias: { taxa_nacional: EvidenciaPerdas; pnt_bt_nacional: EvidenciaPerdas };
  downloads: Download[];
  series: { anual: string; municipios: string };
};

/* ---------- arquivos sob demanda (public/energia/series) ---------- */

/**
 * Linha anual de public/energia/series/perdas_anual.json, na ordem de `campos`:
 * [ano, meses, completo (0/1), injetada_mwh, perdas_totais_mwh, taxa_total_pct, perdas_tecnicas_mwh,
 *  taxa_tecnica_pct, pnt_mwh, pnt_bt_pct, mercado_bt_mwh, residuo_pct_injetada, reconciliacao,
 *  alertas, origem_injetada]
 */
export type LinhaAnualPerdas = [
  number,
  number,
  0 | 1,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  EstadoReconciliacao,
  AlertaAnual[],
  OrigemInjetada,
];

export type SerieAnualPerdas = {
  gerado_em: string;
  unidades: string;
  campos: string[];
  distribuidoras: Record<string, LinhaAnualPerdas[]>;
};

/**
 * public/energia/series/perdas_municipios.json: município IBGE (7 dígitos, mesmo id da malha
 * em public/energia/geo/municipios.json) → [índice em `distribuidoras`, confirmado pelo
 * cadastro de MMGD (0/1)].
 */
export type MunicipiosPerdas = {
  gerado_em: string;
  ano_relacao: number | null;
  distribuidoras: string[];
  campos: string[];
  municipios: Record<string, { uf: string; valido: boolean | null; d: [number, 0 | 1][] }>;
};
