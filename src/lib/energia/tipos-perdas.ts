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

/**
 * Alertas físicos que tiram o agente-ano de agregados e comparações. "fornecida_maior_que_injetada":
 * energia fornecida medida no ano acima da injetada (Manaus Energia 2003 a 2008);
 * "balanco_nao_fecha": resíduo acima de 5% da injetada publicada no leiaute antigo, ou fornecida +
 * perdas acima da injetada publicada em mais de 5% no leiaute de 2024.
 */
export type AlertaAnual =
  | "injetada_nao_positiva"
  | "perda_total_negativa"
  | "perda_total_maior_que_injetada"
  | "fornecida_maior_que_injetada"
  | "balanco_nao_fecha"
  | "representacoes_conflitantes";

/**
 * Identidade perdas totais = técnicas + não técnicas (linhas medidas publicadas), conferida mês a
 * mês: "fecha" (até 2 kWh por mês), "diferenca_pequena" (soma dos módulos até 0,1% da perda total),
 * "nao_fecha" (fora dos agregados de técnica e não técnica), "sem_separacao" (técnica ou não
 * técnica ausente em algum mês).
 */
export type EstadoDecomposicao = "fecha" | "diferenca_pequena" | "nao_fecha" | "sem_separacao";

/**
 * Origem do denominador: "publicada" = linha de energia injetada do SAMP (leiaute antigo);
 * "requerida" = fornecida + irregular + perdas (leiaute de 2024, em que a linha publicada deixou de
 * fechar o balanço com a perda calculada pela fonte; a causa não é atribuída);
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
  /** AAAA-MM-DD: data em que a vigência das tarifas foi conferida (situacao de TarifaPerdas). */
  tarifa_consultada_em: string;
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
  /** Razão sobre a injetada de referência das mesmas distribuidoras que publicam a técnica. */
  taxa_tecnica_pct: number | null;
  /** Técnica sobre a injetada publicada: a base em que a fonte aplica o percentual regulatório. */
  taxa_tecnica_injetada_publicada_pct: number | null;
  n_com_pnt_bt: number;
  pnt_mwh: number | null;
  mercado_bt_mwh: number | null;
  /** % do mercado BT das distribuidoras válidas coberto pelas que entram na não técnica. */
  cobertura_bt_pct: number | null;
  pnt_bt_pct: number | null;
};

/** Mesma medida no ano anterior e no ano, só sobre as distribuidoras válidas nos dois anos. */
export type MesmasAnoAnterior = {
  n_total: number;
  /** [ano anterior, ano] */
  taxa_total_pct: [number | null, number | null] | null;
  n_tecnica: number;
  taxa_tecnica_pct: [number | null, number | null] | null;
  n_pnt_bt: number;
  pnt_bt_pct: [number | null, number | null] | null;
  /** Distribuidoras válidas nos dois anos deixadas fora por quebra de escala ou absorção. */
  fora_por_mudanca_de_universo: number;
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
  taxa_tecnica_injetada_publicada_pct: number | null;
  n_com_pnt_bt: number;
  pnt_mwh: number | null;
  mercado_bt_mwh: number | null;
  cobertura_bt_pct: number | null;
  pnt_bt_pct: number | null;
  /** Agentes-ano fora da soma, por motivo (ano_incompleto ou o primeiro alerta físico). */
  excluidos: Record<string, number>;
  /**
   * O conjunto de distribuidoras de cada medida é o mesmo do ano anterior? A diferença entre duas
   * linhas de universos diferentes é composição, não variação; null no primeiro ano ou sem válida.
   */
  universo_igual_ano_anterior: { total: boolean; tecnica: boolean; pnt_bt: boolean } | null;
  /** Onde se lê a variação anual: as mesmas distribuidoras nos dois anos. */
  mesmas_ano_anterior: MesmasAnoAnterior | null;
};

/** Série de universo fixo: as mesmas distribuidoras em todos os anos (tendência da separação). */
export type UniversoFixo = {
  universo: Universo;
  anos: number[];
  n_distribuidoras: number;
  cnpjs: string[];
  criterio: string;
  linhas: {
    ano: number;
    taxa_total_pct: number | null;
    taxa_tecnica_pct: number | null;
    pnt_bt_pct: number | null;
    pnt_mwh: number | null;
    mercado_bt_mwh: number | null;
    /** % do mercado BT de todas as distribuidoras válidas do universo no ano. */
    cobertura_bt_pct: number | null;
  }[];
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
  taxa_tecnica_injetada_publicada_pct: number | null;
  pnt_mwh: number | null;
  pnt_injetada_pct: number | null;
  mercado_bt_mwh: number | null;
  pnt_bt_pct: number | null;
  residuo_pct_injetada: number | null;
  reconciliacao: EstadoReconciliacao;
  decomposicao: EstadoDecomposicao;
  /** Perdas totais − técnicas − não técnicas (MWh). */
  residuo_decomposicao_mwh: number | null;
  alertas: AlertaAnual[];
};

export type VariacaoAnual = {
  ano_base: number;
  /** Falso com quebra de escala ou absorção entre os dois anos: as variações ficam null. */
  comparavel: boolean;
  taxa_total_pp: number | null;
  /** Variação relativa do volume de perdas totais (%). */
  perdas_totais_pct: number | null;
  /** Só com a decomposição fechando nos dois anos. */
  pnt_bt_pp: number | null;
  variacao_injetada_pct: number | null;
  /** Injetada mudou mais de 30%: provável mudança de universo (incorporação, cisão). */
  quebra_escala: boolean;
  /** Absorção provável observada no SAMP entre os dois anos. */
  absorcao: boolean;
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
  /** 6 ou mais: só trechos de referência entram na gold (os curtos ficam no CSV). */
  meses: number;
  /** Variação contra o trecho anterior (p.p.); null sem trecho ou mês anterior. */
  troca_pp: number | null;
  /**
   * Resolução homologatória cuja vigência começa no mês da troca, só com troca de ao menos
   * 0,02 p.p. (associação por coincidência de datas; a fonte não liga o percentual ao ato).
   */
  reh: { resolucao: string | null; inicio_vigencia: string } | null;
  transicao: string | null;
};

export type TarifaPerdas = {
  resolucao: string | null;
  /** AAAA-MM-DD */
  inicio: string;
  fim: string | null;
  /**
   * "vigente": início ≤ data da consulta ≤ fim; "vigencia_encerrada": nenhum processo vigente no
   * arquivo da fonte, e este é o último já iniciado (nunca apresentar como a tarifa em vigor).
   */
  situacao: "vigente" | "vigencia_encerrada";
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

/**
 * Eventos observados no próprio SAMP. A continuidade entre séries é inferida pela energia (salto
 * ou sucessão no mês seguinte ao fim de outra série), nunca pelo nome, e vem marcada como provável.
 */
export type EventoDistribuidora =
  | { tipo: "mudanca_nome"; competencia: string; de: string; para: string }
  | {
      tipo: "inicio_serie";
      competencia: string;
      sucessao_provavel_de?: { cnpj: string; razao_energia: number; mesma_raiz_cnpj: boolean };
    }
  | {
      tipo: "fim_serie";
      competencia: string;
      continuidade_provavel?: { cnpj: string; tipo: "sucessao" | "absorcao" }[];
    }
  | {
      tipo: "absorcao_provavel";
      competencia: string;
      encerradas: string[];
      salto_pct: number;
      salto_sobre_encerradas: number;
    };

/** Correspondência explícita entre CNPJs da mesma raiz, com a origem da ligação. */
export type Correspondencia = { cnpj: string; sigla: string | null; regra: "mesma_raiz_cnpj"; origem: string };

export type Distribuidora = {
  cnpj: string;
  cnpj_formatado: string;
  /** Falso quando o CNPJ publicado pela fonte tem dígito verificador inválido (mantido como veio). */
  cnpj_dv_valido: boolean;
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
  /** Trechos de referência (últimos 3); n_curtos = trechos de 2 a 5 meses, só no CSV. */
  tecnica_regulatoria: { segmentos: SegmentoTecnico[]; n_segmentos: number; n_curtos: number } | null;
  tarifa: TarifaPerdas | null;
  territorio: Territorio | null;
  contexto: ContextoSocial | null;
  eventos: EventoDistribuidora[];
  correspondencias: Correspondencia[];
};

/** [cnpj, renda_media_pc_confirmados, pnt_bt_pct, taxa_total_pct, cobertura_exclusivos_pct] */
export type PontoAssociacao = [string, number | null, number | null, number | null, number | null];

export type Associacao = {
  variavel_territorial: string;
  /** Ano das perdas usado (o do Censo, 2022, quando completo). */
  ano_perdas: number;
  /** Ano da relação conjunto × distribuidora usada para o território (o mesmo das perdas). */
  ano_relacao: number | null;
  /** Concessionárias por modo de confirmação dos vínculos: "mmgd" ou "uf_principal". */
  confirmacao: Record<string, number>;
  excluidas: { cnpj: string; sigla: string | null; motivo: string }[];
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
  valores_observatorio: {
    taxa_total_pct: number | null;
    injetada_twh: number | null;
    injetada_publicada_twh: number | null;
    base: string;
  };
  leitura: string;
};

export type QualidadePerdas = {
  agentes_no_arquivo: number;
  agentes_com_balanco_de_distribuicao: number;
  agentes_ano_completos: number;
  reconciliacao: Partial<Record<EstadoReconciliacao, number>>;
  alertas: Partial<Record<AlertaAnual, number>>;
  decomposicao: Partial<Record<EstadoDecomposicao, number>>;
  limite_residuo_balanco_pct: number;
  mudancas_de_universo: {
    absorcoes: number;
    sucessoes: number;
    pares_com_quebra_de_escala: number;
    cnpj_com_digito_invalido: string[];
  };
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
  /** Só as concessionárias; os três universos estão em series.nacional (perdas_nacional.json). */
  nacional: LinhaNacional[];
  acumulado: AcumuladoAno | null;
  universo_fixo: UniversoFixo;
  distribuidoras: Distribuidora[];
  associacao: Associacao;
  mapa: MapaPerdas;
  qualidade: QualidadePerdas;
  bloqueios: Bloqueio[];
  decisoes: string[];
  proveniencia: {
    /** Perdas totais: valor medido publicado pela fonte (OBSERVADO). */
    volumes: Proveniencia;
    /** Técnicas e não técnicas: estimadas pela fonte (ESTIMADO). */
    separacao: Proveniencia;
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
  series: { anual: string; municipios: string; evidencias: string; nacional: string };
};

/* ---------- arquivos sob demanda (public/energia/series) ---------- */

/**
 * Linha anual de public/energia/series/perdas_anual.json, na ordem de `campos`:
 * [ano, meses, completo (0/1), injetada_mwh, perdas_totais_mwh, taxa_total_pct, perdas_tecnicas_mwh,
 *  taxa_tecnica_pct, pnt_mwh, pnt_bt_pct, mercado_bt_mwh, residuo_pct_injetada, reconciliacao,
 *  alertas, origem_injetada, decomposicao, taxa_tecnica_injetada_publicada_pct,
 *  universo_muda_ano_anterior (1 = quebra de escala ou absorção contra o ano anterior; null no
 *  primeiro ano da série)]
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
  EstadoDecomposicao,
  number | null,
  0 | 1 | null,
];

/** public/energia/series/perdas_nacional.json: os três universos, lidos sob demanda. */
export type SerieNacionalPerdas = {
  gerado_em: string;
  unidades: string;
  linhas: LinhaNacional[];
};

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
