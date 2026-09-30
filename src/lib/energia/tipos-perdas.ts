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
  /** Último mês (1 a 12) do recorte janeiro..mês do acumulado do ano aberto; null sem acumulado. */
  mes_fim_acumulado: number | null;
  aviso_parcial: string | null;
};

/** Razões de somas sobre um subconjunto de distribuidoras (null = nenhuma distribuidora válida). */
export type SomaNacional = {
  injetada_mwh: number | null;
  perdas_totais_mwh: number | null;
  taxa_total_pct: number | null;
  n_com_tecnica: number;
  injetada_com_tecnica_mwh: number | null;
  /** % da injetada coberta pelas distribuidoras que publicam a separação técnica. */
  cobertura_tecnica_pct: number | null;
  perdas_tecnicas_mwh: number | null;
  /** Razão sobre a injetada das mesmas distribuidoras que publicam a técnica. */
  taxa_tecnica_pct: number | null;
  n_com_pnt_bt: number;
  pnt_mwh: number | null;
  mercado_bt_mwh: number | null;
  pnt_bt_pct: number | null;
};

export type LinhaNacional = {
  ano: number;
  universo: Universo;
  /** Ano posterior ao de referência: sem soma anual (nenhuma distribuidora tem 12 meses). */
  parcial: boolean;
  /** Distribuidoras somadas: 12 meses e sem alerta físico. */
  n_distribuidoras: number;
  /** Distribuidoras com algum dado no ano. */
  n_publicadas: number;
  injetada_mwh: number | null;
  perdas_totais_mwh: number | null;
  taxa_total_pct: number | null;
  n_com_tecnica: number;
  injetada_com_tecnica_mwh: number | null;
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

/** Acumulado janeiro..mes_fim do ano aberto contra o mesmo período do ano anterior. */
export type ParcialDistribuidora = {
  ano: number;
  mes_fim: number;
  meses: number;
  completo: boolean;
  /** Completa e sem alerta nos dois recortes: só então entra no agregado e na comparação. */
  comparavel: boolean;
  origem_injetada: OrigemInjetada;
  injetada_mwh: number | null;
  perdas_totais_mwh: number | null;
  taxa_total_pct: number | null;
  pnt_bt_pct: number | null;
  anterior: {
    perdas_totais_mwh: number | null;
    taxa_total_pct: number | null;
    pnt_bt_pct: number | null;
    origem_injetada: OrigemInjetada;
  };
  alertas: AlertaAnual[];
};

export type AcumuladoAno = {
  ano: number;
  mes_fim: number;
  agregados: { universo: Universo; n_distribuidoras: number; atual: SomaNacional; anterior: SomaNacional }[];
};

export type SegmentoTecnico = {
  /** AAAA-MM */
  inicio: string;
  fim: string;
  /** % da energia injetada, constante no trecho. */
  pct: number;
  meses: number;
  /** Resolução homologatória cuja vigência começa no mês da troca (associação por coincidência de mês). */
  reh: { resolucao: string | null; inicio_vigencia: string } | null;
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
  /** Municípios fora da relação de conjuntos, ligados só pelo cadastro de MMGD (fora do contexto social). */
  so_mmgd: number;
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
  parcial: ParcialDistribuidora | null;
  tecnica_regulatoria: { segmentos: SegmentoTecnico[]; n_segmentos: number } | null;
  tarifa: TarifaPerdas | null;
  territorio: Territorio | null;
  contexto: ContextoSocial | null;
  eventos: EventoDistribuidora[];
};

/** [cnpj, renda_media_pc_confirmados, pnt_bt_pct, taxa_total_pct, cobertura_exclusivos_pct] */
export type PontoAssociacao = [string, number | null, number | null, number | null, number | null];

export type Associacao = {
  variavel_territorial: string;
  /** Ano das perdas usado (o do Censo, 2022, quando completo). */
  ano_perdas: number;
  spearman_pnt_bt: number | null;
  n_pnt_bt: number;
  spearman_taxa_total: number | null;
  n_taxa_total: number;
  universo: string;
  campos_pontos: string[];
  pontos: PontoAssociacao[];
  leitura: string;
};

export type MapaPerdas = {
  ano_relacao: number | null;
  municipios: number;
  municipios_compartilhados: number;
  vinculos: number;
  vinculos_nao_confirmados: number;
  codigos_invalidos: string[];
  /** Códigos IBGE com vínculo só pelo cadastro de MMGD. */
  municipios_so_mmgd: string[];
  /** Códigos IBGE sem nenhuma distribuidora ligada (ficam sem cor no mapa). */
  municipios_sem_vinculo: string[];
  /** Vínculos com distribuidora que não tem balanço no SAMP (sem valor de perdas). */
  vinculos_fora_do_samp: number;
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

/**
 * Objeto "Comprove este número" (seção 11.5), montado e validado por
 * pipeline/energia/evidencia.py (construir); mesma ordem de campos.
 */
export type ArquivoEvidencia = {
  recurso: string | null;
  arquivo: string | null;
  sha256: string | null;
  capturado_em: string | null;
  publicado_em: string | null;
};

export type EvidenciaPerdas = {
  indicador: string;
  /** "sem dado" quando valor_calculo é null. */
  valor_exibido: string;
  valor_calculo: number | null;
  unidade: string;
  periodo: { inicio: string; fim: string };
  entidade: string;
  universo: string;
  filtros: string[];
  fonte: {
    orgao: string;
    conjunto: string;
    recurso: string | null;
    url: string;
    arquivo: string | null;
    sha256: string | null;
    capturado_em: string | null;
    publicado_em: string | null;
    arquivos?: ArquivoEvidencia[];
  };
  extracao_pdf: { documento: string; edicao: string; pagina: string; conferencia: string } | null;
  chaves_origem: string[];
  chaves_total: number | null;
  consulta: string | null;
  manifesto: { rotulo: string; url: string } | null;
  formula: string;
  numerador: { descricao: string; valor: number | null } | null;
  denominador: { descricao: string; valor: number | null } | null;
  pesos: string | null;
  exclusoes: string[];
  cobertura: string;
  tratamento_ausencia: string;
  versao: { pipeline: string; codigo: string | null; publicacao: string };
  /** Texto pronto sobre revisões da fonte entre as capturas. */
  revisoes: string;
  testes: { nome: string; resultado: "aprovado" | "ressalva" | "reprovado"; detalhe: string }[];
  reconciliacao: { descricao: string; resultado: "aprovado" | "ressalva" | "reprovado"; tolerancia: string } | null;
  download: Download[];
  reproducao: string;
  citacao: string;
};

export type PerdasGold = Cabecalho & {
  referencia: ReferenciaTemporal;
  definicoes: Definicoes;
  nacional: LinhaNacional[];
  acumulado: AcumuladoAno | null;
  distribuidoras: Distribuidora[];
  associacao: Associacao;
  mapa: MapaPerdas;
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
  evidencias: {
    taxa_nacional: EvidenciaPerdas;
    perdas_nacional: EvidenciaPerdas;
    pnt_bt_nacional: EvidenciaPerdas;
    injetada_2024: EvidenciaPerdas | null;
    acumulado: EvidenciaPerdas | null;
  };
  downloads: Download[];
  series: { anual: string; municipios: string; evidencias: string };
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
 * Estado do vínculo município × distribuidora: 0 = relação conjunto × município sem
 * empreendimento de MMGD que confirme; 1 = relação confirmada pelo cadastro de MMGD;
 * 2 = só pelo cadastro de MMGD (município fora da relação de conjuntos).
 */
export type EstadoVinculo = 0 | 1 | 2;

/**
 * public/energia/series/perdas_municipios.json: município IBGE (7 dígitos, mesmo id da malha
 * em public/energia/geo/municipios.json) → [índice em `distribuidoras`, estado do vínculo].
 */
export type MunicipiosPerdas = {
  gerado_em: string;
  ano_relacao: number | null;
  distribuidoras: string[];
  campos: string[];
  estados_vinculo: Record<"0" | "1" | "2", string>;
  municipios: Record<string, { uf: string; valido: boolean | null; d: [number, EstadoVinculo][] }>;
};

/**
 * public/energia/series/perdas_evidencias.json: evidência da taxa de perdas totais do ano de
 * referência de cada distribuidora (CNPJ → evidência), lida sob demanda pelo painel de seleção.
 */
export type EvidenciasDistribuidoras = {
  gerado_em: string;
  ano: number;
  evidencias: Record<string, EvidenciaPerdas>;
};
