/**
 * Tipos da gold do módulo Geração (detalhe) (public/energia/gold/geracao_detalhe.json),
 * espelho exato do que pipeline/energia/modulos/geracao_detalhe.py publica para os painéis
 * P021 (matriz efetiva), P022 (despacho térmico), P023 (renováveis restringidas) e P024
 * (capacidade e utilização), e para o achado A11 (MMGD na solar desde 29/04/2023).
 *
 * Quatro grandezas que não se misturam: energia gerada (MWh e MWmed), custo declarado para
 * despacho (CVU, R$/MWh), energia não gerada estimada por restrição (MWh) e potência (MW).
 * A MMGD é energia estimada pelo ONS, categoria própria ("solar_mmgd"). Ausência é null e é
 * exibida como ausência (nunca zero). As séries longas vêm em colunas (arrays paralelos):
 * o índice i de cada array se refere ao mesmo período. Nenhum número é recalculado na
 * interface.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Proveniencia, Submercado } from "./tipos";

/* ---------- Domínios ---------- */

export type CategoriaGeracao =
  | "hidraulica"
  | "eolica"
  | "solar_centralizada"
  | "solar_mmgd"
  | "nuclear"
  | "gas"
  | "carvao"
  | "oleo"
  | "biomassa"
  | "outros"
  | "termica_sem_combustivel"
  | "nao_mapeada";

/** Categorias de combustível das térmicas (inclui nuclear e a categoria explícita de não mapeadas). */
export type CategoriaCombustivel =
  | "gas"
  | "carvao"
  | "oleo"
  | "biomassa"
  | "nuclear"
  | "outros"
  | "termica_sem_combustivel"
  | "nao_mapeada";

/** Categorias com capacidade instalada no conjunto do ONS (usinas despachadas). */
export type CategoriaCapacidade =
  | "hidraulica"
  | "eolica"
  | "solar_centralizada"
  | "nuclear"
  | "gas"
  | "carvao"
  | "oleo"
  | "biomassa"
  | "outros";

export type NaturezaGeracao = "verificada" | "grupo_tipo3" | "grupo_mmgd";
export type MotivoDespacho =
  | "merito"
  | "inflexibilidade"
  | "razao_eletrica"
  | "garantia_energetica"
  | "gfom"
  | "reposicao_perdas"
  | "exportacao"
  | "reserva_potencia"
  | "substituicao"
  | "unit_commitment";
/** Razão oficial da restrição (dicionário do ONS); SEM = limitação sem razão informada. */
export type RazaoRestricao = "REL" | "CNF" | "ENE" | "PAR" | "SEM";
export type FonteBalanco = "hidraulica" | "termica" | "eolica" | "solar";
export type RegiaoGeracao = Submercado | "SIN";

export type PorCategoria<T> = Record<CategoriaGeracao, T>;
export type Quantis = { n: number; min: number; p10: number; p25: number; p50: number; p75: number; p90: number; max: number };

/* ---------- Evidência e controles ---------- */

export type EvidenciaGeracao = Evidencia;
export type ControleGeracao = { nome: string; resultado: "aprovado" | "ressalva" | "reprovado"; detalhe: string; critico: boolean };

/* ---------- A11: MMGD na solar desde 29/04/2023 ---------- */

export type EvidenciaDocumental = {
  orgao: string;
  documento: string;
  url: string | null;
  /** Trecho literal do texto oficial; null quando o texto não foi encontrado na captura. */
  trecho: string | null;
  capturado_em: string | null;
  versao: string | null;
  data_documento: string | null;
  /** Observação da plataforma sobre o documento (não é citação); null quando não há. */
  constatacao: string | null;
};

export type LinhaA11 = {
  d: string;
  /** Solar do Balanço de Energia (média do dia, MWmed); null sem as 24 horas nos 4 subsistemas. */
  balanco_solar_mwmed: number | null;
  usinas_solar_mwmed: number | null;
  /** null antes de 29/04/2023: a modalidade MMGD não existe (ausência, não zero). */
  usinas_mmgd_mwmed: number | null;
  usinas_sem_mmgd_mwmed: number | null;
  diferenca_mwh: number | null;
};

export type ComparacaoMmgdApi = { mes: string; usina_mwmed: number | null; api_mwmed: number | null; razao_usina_api: number | null };

export type A11 = {
  estado: "confirmado" | "pendente";
  conclusao: string | null;
  primeiro_dia_mmgd: string | null;
  primeira_hora_mmgd: string | null;
  dias_conferidos: number;
  dias_conciliados: number;
  janela_da_quebra_conciliada: boolean;
  evidencias_documentais: EvidenciaDocumental[];
  tabela: LinhaA11[];
  comparacao_api_transicao: ComparacaoMmgdApi[];
  razao_usina_api: Quantis | null;
  tratamento: string[];
};

/**
 * rotulo_encerrado = o rótulo some do arquivo (sem linhas); rotulo_sem_valor = as linhas continuam,
 * todas vazias; sequencia_zero = rótulo só com zero exato por 3 meses ou mais, depois que as usinas
 * que produziam deixaram o arquivo.
 */
export type TipoQuebra =
  | "rotulo_novo"
  | "rotulo_encerrado"
  | "rotulo_sem_valor"
  | "sequencia_zero"
  | "roraima"
  | "identificadores_sem_valor"
  | "salto_de_universo";
export type Quebra = {
  data: string;
  tipo: TipoQuebra;
  /** FONTE = declarada na documentação do ONS (trecho citado); DADO = detectada por regra publicada. */
  origem: "FONTE" | "DADO";
  trecho_fonte: string | null;
  categorias: string[];
  descricao: string;
};

/* ---------- P021: matriz efetiva ---------- */

/** Ressalva de universo de uma categoria num período: a participação continua publicada, mas não é comparável. */
export type RessalvaUniverso = {
  motivos: ("salto_no_periodo" | "universo_reduzido")[];
  identificadores_com_valor_no_ultimo_mes: number;
  maior_numero_12_meses_antes: number;
  /** Datas (AAAA-MM-01) dos saltos de universo dentro do período. */
  saltos: string[];
};

export type Mix = {
  inicio: string;
  fim: string;
  dias: number;
  horas: number;
  mwmed: PorCategoria<number | null>;
  total_mwmed: number | null;
  total_sem_mmgd_mwmed: number | null;
  /** % da geração no perímetro com MMGD (soma 100). */
  participacao: PorCategoria<number | null>;
  /** % no perímetro sem MMGD; solar_mmgd é sempre null. */
  participacao_sem_mmgd: PorCategoria<number | null>;
  /** true quando o período inteiro é posterior a 29/04/2023. */
  mmgd_no_periodo: boolean;
  dias_no_periodo?: number;
  /** Categorias com linha em só parte dos dias do período (presença parcial): dias com linha. */
  dias_com_linha: Partial<Record<CategoriaGeracao, number>>;
  /** % da energia do período por natureza do dado; natureza sem linha no período é null. */
  natureza_pct: Record<NaturezaGeracao, number | null>;
  ressalvas_universo: Partial<Record<CategoriaGeracao, RessalvaUniverso>>;
};

export type JanelasRegiao = { dia?: Mix | null; "7d"?: Mix | null; "30d": Mix | null; "12m": Mix | null };

export type ComparacaoDozeMeses = {
  atual: { inicio: string; fim: string; dias: number };
  anterior: { inicio: string; fim: string; dias: number };
  mesmo_regime_mmgd: boolean;
  /** null quando a categoria não existia antes ou teve mudança de universo na fonte (ver variacao_suprimida). */
  variacao_pct: PorCategoria<number | null>;
  variacao_suprimida: Partial<Record<CategoriaGeracao, { motivo: string; datas: string[] }>>;
  variacao_total_sem_mmgd_pct: number | null;
  /** Mesmo total, só com as categorias que têm variação publicada (as suprimidas saem das duas janelas). */
  variacao_total_comparavel_pct?: number | null;
  anterior_mwmed: PorCategoria<number | null>;
};

/** Série mensal do SIN; categoria sem linha no mês é null (ausência, nunca zero). */
export type MensalSin = {
  meses: string[];
  dias_completos: number[];
  dias_no_mes: number[];
  parcial: boolean[];
  total_mwmed: (number | null)[];
  total_sem_mmgd_mwmed: (number | null)[];
  /** Só os meses com presença parcial da categoria: {categoria: {mês: dias com linha}}. */
  dias_com_linha: Partial<Record<CategoriaGeracao, Record<string, number>>>;
  /** Meses em que a participação da categoria tem ressalva de universo. */
  ressalvas_universo: Partial<Record<CategoriaGeracao, string[]>>;
} & PorCategoria<(number | null)[]>;

export type NaturezaMensal = { meses: string[] } & Record<NaturezaGeracao, (number | null)[]>;

export type AnoSin = {
  ano: number;
  dias: number;
  parcial: boolean;
  mwmed: PorCategoria<number | null>;
  total_sem_mmgd_mwmed: number | null;
  participacao_sem_mmgd: PorCategoria<number | null>;
  natureza_pct: Record<NaturezaGeracao, number | null>;
  dias_com_linha: Partial<Record<CategoriaGeracao, number>>;
  ressalvas_universo: Partial<Record<CategoriaGeracao, RessalvaUniverso>>;
  mmgd_dias: number;
};

/** Série recente por categoria; só as categorias com linha no período (lista em `categorias`). */
export type SerieRecente = { categorias: CategoriaGeracao[] } & Partial<Record<CategoriaGeracao, (number | null)[]>>;

export type RotuloFonte = {
  tipo: string;
  combustivel: string;
  modalidade: string | null;
  categoria: CategoriaGeracao;
  natureza: NaturezaGeracao;
  /** null = sem linha nos últimos 12 meses; 0 = linhas com geração zero. */
  mwh_12m: number | null;
  mwh_desde_inicio: number | null;
};

export type ConciliacaoFonte = {
  subsistema_dias: number;
  conciliados: number;
  pct_conciliados: number | null;
  sin_dias: number;
  sin_dias_conciliados: number;
  pct_sin_dias_conciliados: number | null;
  soma_diferencas_mwh: number | null;
  soma_balanco_mwh: number | null;
};

export type ReconciliacaoMensal = {
  mes: string;
  fonte: FonteBalanco;
  balanco_mwh: number | null;
  usinas_mwh: number | null;
  diferenca_mwh: number | null;
  roraima_excluida_mwh: number | null;
  diferenca_sem_roraima_mwh: number | null;
  diferenca_pct: number | null;
  dias: number;
  subsistema_dias: number;
  subsistema_dias_conciliados: number;
};

export type ReconciliacaoBalanco = {
  tolerancia_mwh_por_subsistema_dia: number;
  por_fonte: Record<FonteBalanco, ConciliacaoFonte>;
  roraima: {
    dias_com_termica_rr: number;
    dias_balanco_exclui: number;
    dias_balanco_inclui_integral: number;
    dias_outra_diferenca: number;
    ultimo_dia_excluida: string | null;
    primeiro_dia_sem_exclusao_apos: string | null;
    regra: string;
  };
  maiores_divergencias: { d: string; fonte: FonteBalanco; sm: Submercado; balanco_mwh: number | null; usinas_mwh: number | null; diferenca_mwh: number | null }[];
  mensal_ultimos_6: ReconciliacaoMensal[];
};

export type ContagemMensal = { meses: string[] } & Partial<Record<CategoriaGeracao, number[]>>;

export type SequenciaZeroRotulo = {
  tipo: string;
  combustivel: string;
  modalidade: string | null;
  categoria: CategoriaGeracao;
  inicio: string;
  fim: string;
  meses: number;
  mes_anterior: string;
  mwh_mes_anterior: number | null;
  ultimo_mes_com_valor: string;
  /** Identificadores do rótulo com valor no mês anterior e sem linha no primeiro mês da sequência. */
  identificadores_que_sairam: number;
  mwh_mes_anterior_dos_que_sairam: number | null;
};

export type SequenciaZeroIdentificador = {
  id: string;
  nome: string | null;
  categoria: CategoriaGeracao | null;
  modalidade: string | null;
  inicio: string;
  fim: string;
  meses: number;
  mwh_mes_anterior: number | null;
  continua: boolean;
};

export type LacunaCategoria = {
  sem_valor: number;
  sem_linhas: number;
  com_valor_no_mes: number;
  com_valor_mesmo_mes_ano_anterior: number;
  /** Geração publicada pela fonte para os mesmos identificadores um ano antes: referência observada, não estimativa. */
  mwh_dos_ausentes_mesmo_mes_ano_anterior: number | null;
};

export type UniversoMatriz = {
  identificadores_por_categoria: ContagemMensal;
  identificadores_sem_valor_por_categoria: ContagemMensal;
  /** Identificadores com valor em algum dos 12 meses anteriores e sem nenhuma linha no mês. */
  identificadores_sem_linhas_por_categoria: ContagemMensal;
  lacuna_ultimo_mes: {
    mes: string;
    mes_ano_anterior: string;
    identificadores_sem_valor: number;
    identificadores_sem_linhas: number;
    por_categoria: Partial<Record<CategoriaGeracao, number>>;
    detalhe_por_categoria: Partial<Record<CategoriaGeracao, LacunaCategoria>>;
    exemplos: string[];
    exemplos_sem_linhas: string[];
    nota: string;
  } | null;
  linhas_sem_id_ons_por_arquivo: Record<string, number>;
  mudancas_de_rotulo: {
    tipo: string;
    combustivel: string;
    modalidade: string | null;
    categoria: CategoriaGeracao;
    natureza: NaturezaGeracao;
    aparece_em: string | null;
    /** Último mês com linhas no arquivo, quando o rótulo some antes do último mês. */
    ultimo_mes_com_linhas: string | null;
    /** Último mês com valor, quando as linhas continuam depois dele, todas vazias. */
    ultimo_mes_com_valor: string | null;
  }[];
  saltos_de_universo: { mes: string; categoria: CategoriaGeracao; identificadores_antes: number; identificadores_depois: number }[];
  sequencias_zero_rotulo: SequenciaZeroRotulo[];
  sequencias_zero_identificadores: {
    n: number;
    continuam_no_ultimo_mes: number;
    por_categoria: Partial<Record<CategoriaGeracao, number>>;
    /** As sequências mais longas (a contagem completa está em n). */
    lista: SequenciaZeroIdentificador[];
  };
  regra: string;
  regra_ressalvas: string;
  regra_sequencias_zero: string;
};

/** Decomposição da categoria "outros" pelo código de combustível do CEG (CM, FL, PE...). */
export type OutrosPorCeg = {
  inicio: string;
  fim: string;
  itens: {
    codigo_ceg: string | null;
    fonte_aneel: string;
    mwh: number | null;
    mwmed: number | null;
    pct_da_categoria: number | null;
    identificadores: number;
    maiores: string[];
  }[];
  regra: string;
} | null;

export type Matriz = {
  dia_referencia: string;
  primeiro_dia: string;
  dias_completos: number;
  janelas: Record<RegiaoGeracao, JanelasRegiao>;
  comparacao_12m: ComparacaoDozeMeses | null;
  mensal_sin: MensalSin;
  natureza_mensal_sin: NaturezaMensal;
  anual_sin: AnoSin[];
  diario_sin_recente: { dias: string[] } & SerieRecente;
  horario_sin_recente: { horas: string[] } & SerieRecente;
  rotulos: RotuloFonte[];
  nao_mapeadas: RotuloFonte[];
  outros_por_ceg: OutrosPorCeg;
  reconciliacao_balanco: ReconciliacaoBalanco;
  universo: UniversoMatriz;
};

/* ---------- P022: despacho térmico ---------- */

export type MotivoInfo = { id: MotivoDespacho; rotulo: string; campo: string };

export type TermicaMensal = {
  meses: string[];
  horas: number[];
  parcial: boolean[];
  total_mwmed: (number | null)[];
  nao_classificado_mwmed: (number | null)[];
  constrained_off_mwmed: (number | null)[];
} & Record<MotivoDespacho, (number | null)[]>;

export type TermicaCombustivel12m = {
  categoria: CategoriaCombustivel;
  rotulo: string;
  mwh: number | null;
  mwmed: number | null;
  pct_total: number | null;
  motivos_mwh: Record<MotivoDespacho, number | null>;
  motivos_pct: Record<MotivoDespacho, number | null>;
  nao_classificado_mwh: number | null;
};

export type OrigemCombustivel =
  | "termica_por_motivo"
  | "geracao_por_usina"
  | "capacidade_instalada"
  | "geracao_por_usina_ceg_base"
  | "capacidade_instalada_ceg_base"
  | "mesma_usina"
  | "nao_identificado";

/** Parcela da usina (código do ONS nos modelos), com a geração no período e o CVU da semana vigente. */
export type ParcelaTermica = { cod: number; nome: string | null; mwh: number | null; cvu_semana_vigente: number | null };

/** Usina = identidade que liga as chaves (CEG) da mesma usina na fonte; `id` é a chave mais recente. */
export type TermicaUsina = {
  id: string;
  nome: string | null;
  origem_nome: "termica_por_motivo" | "geracao_por_usina" | "capacidade_instalada";
  sm: Submercado | string | null;
  ceg: string | null;
  chaves_na_fonte: string[];
  combustivel: string | null;
  categoria: CategoriaCombustivel;
  origem_combustivel: OrigemCombustivel;
  mwh: number | null;
  mwmed: number | null;
  /** Só motivos com geração no período (motivo ausente = zero na usina). */
  motivos_pct: Partial<Record<MotivoDespacho, number>>;
  constrained_off_mwh: number | null;
  /** Parcelas com geração no período ou CVU na semana; as demais são contadas em parcelas_omitidas. */
  parcelas: ParcelaTermica[];
  parcelas_omitidas: number;
  /** CVU quando a usina tem uma só parcela com CVU; com várias, null (o CVU de cada uma está em parcelas). */
  cvu_semana_vigente: number | null;
};

export type CvuUsina = {
  cod: number;
  nome: string | null;
  sm: string | null;
  cvu: number | null;
  categoria: CategoriaCombustivel;
  /** Identidade da usina na térmica por motivo; null = sem par ou código ambíguo. */
  id_termica: string | null;
  usina: string | null;
};

export type Cvu = {
  semana: { inicio: string; fim: string | null; estudo: string | null; pmo: string | null; revisao: number | null };
  usinas: CvuUsina[];
  por_combustivel: ({ categoria: CategoriaCombustivel; rotulo: string } & Quantis)[];
  mediana_mensal: { meses: string[] } & Partial<Record<CategoriaCombustivel, (number | null)[]>>;
  cobertura: { usinas_com_cvu: number; pareadas_com_termica: number; sem_par: string[]; codigos_ambiguos: { cod: number; usinas: string[] }[] };
  controles: { conflitos_mesma_semana_usina: number; linhas_repetidas_identicas: number };
};

export type Termica = {
  motivos: MotivoInfo[];
  ultimo_mes_completo: string;
  primeiro_mes: string;
  primeiro_mes_na_gold: string;
  mensal_sin: TermicaMensal;
  ultimos_12m: {
    inicio: string;
    fim: string;
    horas: number;
    total_mwh: number | null;
    total_mwmed: number | null;
    por_motivo: { motivo: MotivoDespacho; rotulo: string; mwh: number | null; pct: number | null }[];
    nao_classificado_mwh: number | null;
    nao_classificado_pct: number | null;
    por_combustivel: TermicaCombustivel12m[];
  };
  mensal_combustivel: { meses: string[] } & Record<CategoriaCombustivel, (number | null)[]>;
  usinas_12m: TermicaUsina[];
  usinas_12m_resumo: { usinas_com_geracao: number; publicadas: number; cobertura_da_energia_pct: number | null; lista_completa: string };
  mapa_combustivel: {
    usinas: number;
    por_origem: Record<string, number>;
    nao_identificadas: { id: string; nome: string | null; mwh_12m: number | null }[];
    nao_identificadas_mwh_12m: number | null;
    nao_identificadas_pct_12m: number | null;
  };
  identidade: { usinas_com_mais_de_uma_chave: { usina: string; nome: string | null; chaves: string[] }[]; regra: string };
  universo: {
    mensal: {
      mes: string;
      termica_por_motivo_mwh: number | null;
      usinas_pareadas: number;
      usinas_sem_par: number;
      pareadas_termica_mwh: number | null;
      pareadas_geracao_usina_mwh: number | null;
      diferenca_pareadas_pct: number | null;
      geracao_usina_tipo_i_iia_mwh: number | null;
      cobertura_tipo_i_iia_pct: number | null;
    }[];
    regra: string;
  };
  cvu: Cvu | null;
  controles: { valores_negativos_na_fonte: number };
};

/* ---------- P023: renováveis restringidas ---------- */

export type RestricaoMensal = {
  meses: string[];
  parcial: boolean[];
  energia_nao_gerada_mwh: Record<RazaoRestricao, (number | null)[]>;
  energia_nao_gerada_total_mwh: (number | null)[];
  geracao_verificada_mwh: (number | null)[];
  /** % = não gerada ÷ (verificada + não gerada). */
  taxa_pct: (number | null)[];
  /** MW: maior corte simultâneo numa meia hora do mês (potência, não energia). */
  potencia_max_cortada_mw: (number | null)[];
  usinas: number[];
  meias_horas_limitadas: number[];
};

export type RestricaoUsina = {
  id: string;
  nome: string | null;
  sm: string | null;
  uf: string | null;
  lat: number | null;
  lon: number | null;
  /** Coordenada da subestação coletora; sem ela, a do ponto de conexão (origem registrada). */
  origem_coordenada: "subestacao_coletora" | "ponto_de_conexao" | null;
  energia_nao_gerada_mwh: number;
  geracao_verificada_mwh: number | null;
  taxa_pct: number | null;
  razao_principal: RazaoRestricao;
};

export type RestricaoDetalheMes = {
  mes: string;
  usinas: number;
  conjuntos: number;
  geracao_verificada_mwh: number | null;
  geracao_estimada_mwh: number | null;
  meias_horas_restritas: number;
  conferencia: { conjuntos_e_usinas_comparados: number; soma_detalhe_mwh: number | null; soma_arquivo_principal_mwh: number | null; diferenca_pct: number | null };
};

export type Restricao = {
  fonte: "eolica" | "solar";
  primeiro_mes: string;
  ultimo_mes_completo: string | null;
  mensal_sin: RestricaoMensal;
  ultimos_12m: {
    inicio: string;
    fim: string;
    energia_nao_gerada_mwh: number | null;
    geracao_verificada_mwh: number | null;
    taxa_pct: number | null;
    por_razao: { razao: RazaoRestricao; rotulo: string; mwh: number | null; pct: number | null; origens_mwh: Record<string, number | null> }[];
    por_subsistema: { sm: Submercado; energia_nao_gerada_mwh: number | null; geracao_verificada_mwh: number | null; taxa_pct: number | null }[];
    potencia_max_cortada_mw: number | null;
    quando_potencia_max: string | null;
    usinas_no_universo: number;
    usinas_com_restricao: number;
  } | null;
  usinas_12m: RestricaoUsina[];
  usinas_12m_resumo: {
    usinas_com_restricao: number;
    publicadas: number;
    cobertura_da_energia_pct: number | null;
    com_coordenadas: number;
    coordenadas_por_origem: Record<string, number>;
    lista_completa: string;
  };
  descricoes_ultimo_mes: { mes: string; n_descricoes: number; itens: { descricao: string; mwh: number | null }[] } | null;
  diario_recente: {
    dias: string[];
    energia_nao_gerada_mwh: Record<RazaoRestricao, (number | null)[]>;
    geracao_verificada_mwh: (number | null)[];
    potencia_max_cortada_mw: (number | null)[];
  };
  gnra: { meses_com_campo: number; primeiro_mes_com_campo: string | null; maior_diferenca_mensal_mwh: number | null };
  detalhe: RestricaoDetalheMes[] | null;
  controles: {
    linhas: number;
    valores_negativos_na_fonte: number;
    limitadas_sem_referencia: number;
    razao_fora_do_dominio: number;
    gnra_divergente_da_regra: number;
    meias_horas_com_gnra: number;
    /** Corte simultâneo × soma das referências das mesmas linhas na meia hora. */
    meias_horas_com_corte: number;
    meias_horas_corte_acima_da_referencia: number;
    arquivos_sem_controle_de_referencia: number;
    dias_maior_corte_acima_da_referencia: number;
    dias_maior_corte_sem_referencia: number;
  };
};

/* ---------- P024: capacidade e utilização ---------- */

export type FcUsina = { id: string; nome: string | null; fc_pct: number | null; potencia_media_mw: number | null };

export type Capacidade12m = {
  categoria: CategoriaCapacidade;
  rotulo: string;
  potencia_atual_mw: number | null;
  /** Potência média em operação nos 12 meses (todas as unidades da categoria). */
  potencia_media_12m_mw: number | null;
  /** Capacidade-hora do denominador ÷ horas dos 12 meses; nunca passa de potencia_media_12m_mw. */
  capacidade_hora_media_mw: number | null;
  geracao_pareada_mwh: number | null;
  capacidade_hora_mwh: number | null;
  fator_capacidade_pct: number | null;
  cobertura_pct: number | null;
  /** Fator de capacidade publicado pelo ONS (eólica e solar), para conferência. */
  fc_ons_pct: number | null;
  distribuicao_usinas: Quantis | null;
  /** Contagem de grupos de usinas por faixa de 10 pontos (0-10, ..., 90-100, 100 ou mais). */
  histograma_10pp: number[];
  menores: FcUsina[];
  maiores: FcUsina[];
};

export type Capacidade = {
  retrato: {
    data: string;
    total_mw: number | null;
    por_categoria: { categoria: CategoriaCapacidade; rotulo: string; mw: number | null; unidades: number; usinas: number; pct: number | null }[];
    nao_mapeadas_mw: number | null;
    unidades_desativadas_no_retrato: number;
  };
  mensal: {
    meses: string[];
    potencia_operacional_mw: Record<CategoriaCapacidade, (number | null)[]>;
    fator_capacidade_pct: Record<CategoriaCapacidade, (number | null)[]>;
    fc_ons_pct: Record<"eolica" | "solar_centralizada", (number | null)[]>;
  };
  ultimos_12m: { inicio: string; fim: string; por_categoria: Capacidade12m[] } | null;
  pareamento: {
    usina_meses_por_casamento: Record<string, number>;
    unidades_repetidas_evitadas: number;
    fc_acima_de_100: {
      n: number;
      ultimos_12m: number;
      por_categoria: Partial<Record<CategoriaCapacidade, number>>;
      exemplos: { id: string; nome: string | null; mes: string; fc_pct: number; potencia_mw: number | null; categoria: CategoriaCapacidade }[];
    };
    regra: string;
  };
  contexto: {
    /** Capacidade fiscalizada do SIGA (ANEEL), outro universo: contexto, nunca somada nem pareada. */
    siga: {
      data_referencia: string | null;
      total_mw: number | null;
      por_categoria_mw: Partial<Record<CategoriaCapacidade, number>>;
      fontes_em_outros: { origem: string | null; fonte: string | null; mw: number | null }[];
      fonte: string;
      serie_temporal: string;
      nota_temporal: string;
    } | null;
    /** Série histórica da ANEEL por tipo de geração ao lado da potência do ONS no último dia do mesmo mês. */
    siga_historico: {
      datas: string[];
      grupos: Record<
        "hidraulica" | "eolica" | "solar_centralizada" | "nuclear" | "termica",
        { aneel_mw: (number | null)[]; ons_mw: (number | null)[]; ons_pct_da_aneel: (number | null)[] }
      >;
      data_geracao_arquivo: string | null;
      capturado_em: string | null;
      tipos_fora_dos_grupos: Record<string, number>;
      fonte: string;
      regra: string;
    } | null;
    /** Capacidade de MMGD cadastrada na ANEEL (módulo Transição): fora do fator de capacidade. */
    mmgd: {
      potencia_mw: number;
      data_cadastro: string | null;
      fonte: string;
      /** Potência cadastrada ao fim de cada mês ao lado da MMGD estimada pelo ONS; nunca somadas nem divididas. */
      mensal: {
        meses: string[];
        potencia_cadastrada_mw: (number | null)[];
        cadastro_provisorio: boolean[];
        geracao_estimada_ons_mwmed: (number | null)[];
        mes_completo_na_geracao: boolean[];
        regra: string;
      } | null;
    } | null;
  };
};

/* ---------- Gold ---------- */

export type FontePublicada = {
  id: string;
  orgao: string;
  conjunto: string;
  url: string;
  licenca: string;
  arquivos: number;
  primeiro_periodo: string | null;
  ultimo_periodo: string | null;
  ultima_captura: string | null;
  publicacao_mais_recente: string | null;
};

export type GoldGeracaoDetalhe = Cabecalho & {
  paineis: string[];
  dia_referencia: string;
  categorias: { id: CategoriaGeracao; rotulo: string; termica: boolean }[];
  naturezas: { id: NaturezaGeracao; rotulo: string }[];
  razoes: { id: RazaoRestricao; rotulo: string }[];
  regras: Record<"matriz" | "participacao" | "comparacao" | "termica" | "restricao" | "capacidade" | "janelas", string>;
  a11: A11;
  quebras: Quebra[];
  matriz: Matriz;
  termica: Termica | null;
  restricoes: { eolica: Restricao | null; solar: Restricao | null };
  capacidade: Capacidade | null;
  controles: ControleGeracao[];
  proveniencia: Partial<Record<"matriz" | "a11" | "termica" | "cvu" | "restricao_eolica" | "restricao_solar" | "capacidade", Proveniencia>>;
  evidencias: Record<string, EvidenciaGeracao>;
  fontes: FontePublicada[];
  downloads: Download[];
};
