/**
 * Tipos da gold do módulo Expansão da oferta e da rede (public/energia/gold/expansao.json),
 * espelho exato do que pipeline/energia/modulos/expansao.py publica, e do arquivo de pontos
 * lido sob demanda (public/energia/series/expansao_usinas_pontos.json).
 *
 * Três camadas que a interface nunca mistura: realizado (SIGA, liberações comerciais, obras
 * energizadas do SIGET), carteira com previsões (RALIE, sempre com a data da fotografia em que a
 * previsão foi registrada) e cenário (PDE 2035, selo CENÁRIO). Potência em MW (não é energia),
 * linhas em km de circuito, transformação em MVA, dinheiro em reais nominais: campos separados,
 * nunca somados entre si. Ausência é null; zero só aparece quando a contagem ou a soma é
 * realmente zero. Nenhuma conta é refeita na interface.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Proveniencia } from "./tipos";

/** Tipo de geração do SIGA (SigTipoGeracao). */
export type TipoGeracao = "UHE" | "PCH" | "CGH" | "EOL" | "UFV" | "UTE" | "UTN" | "CGU";

/** Estágio publicado a partir da fase do SIGA; "outro" preserva fase não prevista. */
export type Estagio = "operacao" | "construcao" | "construcao_nao_iniciada" | "outro";

export type Desfecho = "em_implantacao" | "operacao" | "outorga_encerrada" | "sem_desfecho";

/** Classificação de viabilidade da fiscalização no RALIE. */
export type Viabilidade = "Alta" | "Média" | "Baixa";

export type Referencias = {
  /** Data de geração do arquivo diário do SIGA. */
  siga: string;
  /** Fotografia (DatRalie) do RALIE atual: data-base das previsões publicadas. */
  ralie: string;
  /** Primeira fotografia do histórico publicado pela ANEEL. */
  ralie_historico_desde: string;
  /** Data de modificação do arquivo de liberações informada pela ANEEL (corte das janelas). */
  liberacoes_arquivo: string;
  liberacoes_ultima_data: string | null;
  atos: string | null;
  /** Data do último lote do arquivo de leilões (período do dado, não publicação). */
  leiloes_transmissao: string | null;
  /** Data de modificação do arquivo de leilões informada pela ANEEL. */
  leiloes_transmissao_publicado_em: string | null;
  siget: string;
  /** Captura das camadas do WebMap da EPE (o serviço não informa data do dado). */
  rede_epe_capturada_em: string | null;
  pde: string;
};

export type Regras = {
  estagio: string;
  encerramentos: string;
  outorga: string;
  potencia: string;
  previsao: string;
  confiabilidade: string;
  deslizamento: string;
  data_em_bloco: string;
  desvio_prazo_vigente: string;
  transmissao: string;
  cenario: string;
};

// ------------------------------------------------------------------ capacidade (SIGA)

export type CapacidadeTipo = {
  tipo: string;
  nome: string;
  usinas: number;
  mw_fiscalizado: number;
  mw_outorgado: number;
  participacao_pct: number | null;
};

export type CapacidadeOrigem = { origem: string | null; usinas: number; mw_fiscalizado: number; participacao_pct: number | null };

export type CapacidadeFonte = { origem: string | null; fonte: string | null; usinas: number; mw_fiscalizado: number };

export type CapacidadeUf = {
  uf: string | null;
  usinas: number;
  mw_fiscalizado: number;
  participacao_pct: number | null;
  /** MW fiscalizado por origem (Hídrica, Fóssil, Eólica, Solar, Biomassa, Nuclear) presente na UF. */
  por_origem: Record<string, number>;
};

export type ReconciliacaoTipo = {
  tipo: string;
  siga_mw: number;
  agregado_mw: number;
  liberado_no_intervalo_mw: number;
  diferenca_mw: number;
  residuo_mw: number;
  residuo_pct: number | null;
};

export type ReconciliacaoUf = {
  uf: string;
  siga_mw: number;
  agregado_mw: number;
  liberado_no_intervalo_mw: number;
  diferenca_mw: number;
  diferenca_pct: number | null;
  residuo_mw: number;
  residuo_pct: number | null;
};

export type CapacidadeInstalada = {
  data_referencia: string;
  total: { usinas: number; mw_fiscalizado: number; mw_outorgado: number };
  por_tipo: CapacidadeTipo[];
  por_origem: CapacidadeOrigem[];
  por_fonte: CapacidadeFonte[];
  por_uf: CapacidadeUf[];
  /** Usinas cuja lista de municípios cita mais de uma UF (atribuídas à UF principal). */
  multiestaduais: { usinas: number; mw_fiscalizado: number };
  reconciliacao: {
    /** Mês (AAAA-MM) do agregado oficial "empreendimentos em operação". */
    referencia_tipo: string | null;
    por_tipo: ReconciliacaoTipo[];
    /** Mês (AAAA-MM) do agregado oficial "capacidade instalada por UF". */
    referencia_uf: string | null;
    por_uf: ReconciliacaoUf[];
    tolerancia_residuo_pct: number;
    justificativa_tolerancia: string;
    fora_da_tolerancia: { tipos: string[]; ufs: string[] };
  };
};

// ------------------------------------------------------------------ estágios e carteira (P040)

export type EstagioResumo = {
  estagio: Estagio;
  rotulo: string;
  usinas: number;
  mw_outorgado: number;
  mw_fiscalizado: number;
};

/** Linha por tipo ou por UF com usinas e MW outorgado de cada estágio ativo. */
export type EstagiosLinha = {
  operacao_usinas: number;
  operacao_mw_outorgado: number;
  construcao_usinas: number;
  construcao_mw_outorgado: number;
  construcao_nao_iniciada_usinas: number;
  construcao_nao_iniciada_mw_outorgado: number;
};

/** Encerramentos de um ano: potência uma vez por usina (núcleo do CEG); atos contados à parte. */
export type EncerramentosAno = {
  ano: string;
  atos: number;
  revogacoes: number;
  extincoes: number;
  usinas: number;
  mw_usinas: number;
  usinas_sem_potencia: number;
  /** Usinas do ano que já tinham ato de encerramento em ano anterior (aparecem nos dois anos). */
  usinas_com_ato_em_ano_anterior: number;
  mw_usinas_com_ato_em_ano_anterior: number;
  /** Usinas do ano que seguem na fase Operação do SIGA: outorga encerrada, usina não retirada. */
  usinas_em_operacao_no_siga: number;
  mw_usinas_em_operacao_no_siga: number;
  atos_sem_chave_de_usina: number;
  mw_atos_sem_chave_de_usina: number;
  atos_sem_potencia: number;
  atos_potencia_corrigida: number;
  atos_potencia_fora_da_soma: number;
  ano_parcial: boolean;
};

/** Ato cuja potência foi corrigida (kW no campo de MW) ou ficou fora da soma. */
export type AtoPotenciaConferida = {
  chave: string;
  publicacao: string | null;
  nome: string | null;
  nucleo: number | null;
  tipo: string | null;
  mw_no_ato: number | null;
  /** Potência somada; null = fora da soma. */
  mw_usado: number | null;
  kw_cadastro: number | null;
  cadastro: string | null;
  motivo: string | null;
};

export type Encerramentos = {
  regra: string;
  desde: string | null;
  por_ano: EncerramentosAno[];
  por_tipo: { tipo: string | null; usinas: number; mw_usinas: number }[];
  /** Atos sem data de publicação na fonte: fora da série anual, contados à parte (e no total). */
  sem_data_publicacao: { atos: number; usinas: number; mw_usinas: number };
  total: { atos: number; usinas: number; mw_usinas: number; usinas_sem_potencia: number };
  repeticoes: { usinas_com_mais_de_um_ato: number; atos_alem_do_primeiro: number; mw_que_a_soma_por_ato_repetiria: number };
  potencia_conferida: {
    regra: string;
    atos_com_cadastro: number;
    atos_sem_cadastro: number;
    atos_sem_potencia: number;
    corrigidas_kw: AtoPotenciaConferida[];
    fora_da_soma: AtoPotenciaConferida[];
    mw_no_ato_dos_atos_corrigidos_ou_fora: number;
  };
  usinas_em_operacao_no_siga: {
    nota: string;
    atos: number;
    usinas: number;
    mw_usinas_nos_atos: number;
    por_outorga_no_siga: { outorga: string; usinas: number; mw_fiscalizado_siga: number }[];
  };
  sem_chave_de_usina: { nota: string; atos: number; mw_usado: number; por_ano: { ano: string | null; atos: number; mw_usado: number }[] };
};

/** Agregado do RALIE atual: potência outorgada das usinas e das unidades listadas. */
export type GrupoRalie = { usinas: number; mw_outorgado: number; mw_ugs_em_implantacao: number };

export type RalieAtual = {
  data_ralie: string;
  usinas: number;
  ugs: number;
  mw_outorgado: number;
  mw_ugs_em_implantacao: number;
  por_obra: (GrupoRalie & { situacao_obra: string })[];
  por_viabilidade: (GrupoRalie & { viabilidade: string })[];
  por_cronograma: (GrupoRalie & { situacao_cronograma: string })[];
  por_justificativa: (GrupoRalie & { justificativa: string })[];
  obra_x_viabilidade: (GrupoRalie & { situacao_obra: string; viabilidade: string })[];
  por_tipo: (GrupoRalie & { tipo: string })[];
  por_uf: (GrupoRalie & { uf: string })[];
  leilao: { usinas_com_compromisso: number; mw_outorgado_com_compromisso: number; usinas_sem_compromisso: number };
  /** Fase no SIGA das usinas do RALIE ("ausente do SIGA" quando o núcleo não consta). */
  fase_no_siga: { fase: string; usinas: number }[];
};

export type DesfechoCoorte = { usinas: number; mw_outorgado: number; pct_mw: number | null };

export type Coorte = {
  /** "estoque_inicial" (primeira fotografia) ou o ano de entrada no RALIE. */
  coorte: string;
  rotulo: string;
  usinas: number;
  mw_outorgado: number;
  desfechos: Record<Desfecho, DesfechoCoorte>;
};

/** Última fotografia de cada mês do Parquet histórico do RALIE. */
export type HistoricoMensalRalie = {
  ralie: string;
  usinas: number;
  mw_outorgado: number;
  ugs: number;
  mw_ugs: number;
  mw_ugs_sem_previsao: number;
  mw_obra_nao_iniciada: number;
  mw_obra_em_andamento: number;
  mw_obra_paralisada: number;
  mw_viabilidade_alta: number;
  mw_viabilidade_media: number;
  mw_viabilidade_baixa: number;
  mw_cronograma_normal: number;
  mw_cronograma_atrasado: number;
  mw_cronograma_adiantado: number;
  mw_ugs_por_tipo: Record<string, number>;
};

export type Estagios = {
  data_referencia: string;
  resumo: EstagioResumo[];
  por_tipo: (EstagiosLinha & { tipo: string; nome: string })[];
  por_uf: (EstagiosLinha & { uf: string })[];
  encerramentos: Encerramentos;
  ralie: RalieAtual;
  coortes: Coorte[];
  desfechos_definicao: Record<Desfecho, string>;
  /** Onde estão no SIGA as usinas sem desfecho ("ausente do SIGA" = fora do arquivo aberto, sem ato vinculado). */
  sem_desfecho_no_siga: { situacao_siga: string; usinas: number; mw_outorgado: number }[];
  historico_mensal: HistoricoMensalRalie[];
};

// ------------------------------------------------------------------ cronograma e atrasos (P041)

export type PorViabilidade = Record<Viabilidade, number>;

export type PrevisoesAtuais = {
  /** Data-base das previsões (fotografia do RALIE). */
  data_ralie: string;
  por_ano: { ano: string; ugs: number; mw: number; por_viabilidade: PorViabilidade }[];
  sem_previsao: { justificativa: string; ugs: number; mw: number }[];
  /** em_bloco: data atribuída a 100 usinas ou mais na fotografia (convencional). */
  datas_mais_frequentes: { data: string; ugs: number; usinas: number; mw: number; em_bloco: boolean }[];
  datas_em_bloco: { regra: string; datas: string[]; ugs: number; mw: number };
  proximos_24_meses: { mes: string; mw: number; por_viabilidade: PorViabilidade }[];
  atraso_previsto: {
    mw_com_previsao: number;
    mw_previsao_apos_outorgado: number;
    mw_previsao_ate_outorgado: number;
    pct_mw_apos_outorgado: number | null;
    mediana_dias_ponderada: number | null;
    /** O mesmo cálculo sem as unidades em data em bloco. */
    sem_datas_em_bloco: {
      mw_com_previsao: number;
      mw_previsao_apos_outorgado: number;
      pct_mw_apos_outorgado: number | null;
      mediana_dias_ponderada: number | null;
    };
  };
};

export type UsinaAtrasada = {
  nucleo: number;
  ceg: string | null;
  nome: string | null;
  tipo: string | null;
  uf: string | null;
  mw_outorgado: number | null;
  mw_em_implantacao: number | null;
  situacao_obra: string | null;
  viabilidade: string | null;
  justificativa: string | null;
  outorgado_max: string | null;
  previsao_max: string | null;
  /** Maior previsão menos maior data outorgada entre as unidades; null sem uma das datas. */
  atraso_previsto_dias: number | null;
};

export type ConfiabilidadeFotografia = {
  /** Fotografia mensal S (data-base das previsões). */
  ralie: string;
  /** S + 365 dias. */
  fim_janela: string;
  ugs: number;
  mw_prometido: number;
  mw_no_prazo: number;
  mw_depois: number;
  mw_nao_liberado: number;
  pct_no_prazo: number | null;
  pct_depois: number | null;
  pct_nao_liberado: number | null;
  ugs_excluidas_ja_liberadas: number;
};

export type Deslizamento = {
  ralie: string;
  ralie_seguinte: string;
  ugs: number;
  mw: number;
  pct_adiada: number | null;
  pct_mantida: number | null;
  pct_antecipada: number | null;
  mediana_dias_ponderada: number | null;
  /** Potência com previsão em data em bloco em S ou em S + 12 meses. */
  pct_mw_em_data_em_bloco: number | null;
  pct_mw_bloco_nas_duas: number | null;
  sem_datas_em_bloco: {
    ugs: number;
    mw: number;
    pct_adiada: number | null;
    pct_mantida: number | null;
    pct_antecipada: number | null;
    mediana_dias_ponderada: number | null;
  };
};

export type DatasEmBlocoFotografia = {
  ralie: string;
  datas: number;
  ugs: number;
  mw: number;
  maior: { data: string; usinas: number; dias_depois_da_fotografia: number } | null;
};

/** Liberação comercial menos a data outorgada vigente (sem data-base): desvio, não atraso. */
export type DesvioPrazoAno = {
  ano: string;
  unidades_ou_grupos: number;
  mw_liberado: number;
  pct_mw_depois_do_prazo: number | null;
  pct_mw_antes_do_prazo: number | null;
  mediana_desvio_dias_ponderada: number | null;
  ano_parcial: boolean;
};

export type Cronograma = {
  data_ralie: string;
  historico_fonte: {
    primeira_fotografia: string;
    fotografias: number;
    fotografias_mensais: number;
    ultima_fotografia: string;
  };
  /** Capturas do RALIE atual pelo observatório (histórico próprio, começa na primeira captura). */
  historico_proprio: { primeira_captura: string | null; capturas: number; ugs_com_previsao_revisada: number };
  previsoes_atuais: PrevisoesAtuais;
  por_situacao_cronograma: { situacao: string; usinas: number; mw_outorgado: number }[];
  maiores_atrasadas: UsinaAtrasada[];
  confiabilidade: ConfiabilidadeFotografia[];
  confiabilidade_ultima_por_tipo: { tipo: string; mw_prometido: number; mw_no_prazo: number; pct_no_prazo: number | null }[];
  deslizamento: Deslizamento[];
  datas_em_bloco_por_fotografia: DatasEmBlocoFotografia[];
  desvio_prazo_vigente: { definicao: string; por_ano: DesvioPrazoAno[] };
  data_liberacoes: string;
};

// ------------------------------------------------------------------ geração e transmissão (P042)

/** km, MVA, investimento e RAP só dos lotes contratados; lotes sem vencedor à parte. */
export type LeilaoAno = {
  ano: string;
  lotes_ofertados: number;
  lotes_contratados: number;
  lotes_sem_vencedor: number;
  km: number;
  mva: number;
  investimento_previsto_rs_mi: number;
  rap_edital_rs_mi: number;
  rap_vencedor_rs_mi: number;
  desagio_agregado_pct: number | null;
  lotes_sem_investimento: number;
  investimento_ofertado_sem_vencedor_rs_mi: number;
  rap_edital_sem_vencedor_rs_mi: number;
};

export type Leiloes = {
  /** Data de modificação do arquivo informada pela ANEEL (publicação, não período do dado). */
  publicado_em: string | null;
  /** Período do dado: primeiro e último lote do arquivo. */
  periodo: { inicio: string | null; fim: string | null };
  por_ano: LeilaoAno[];
  lotes: number;
  lotes_contratados: number;
  lotes_sem_vencedor: number;
  sem_vencedor_por_rotulo: Record<string, number>;
  regra_sem_vencedor: string;
  /** Último leilão presente no arquivo aberto: anos posteriores são ausência, não zero. */
  ultimo_leilao: { leilao: string | null; data: string | null };
  desagio_inconsistente: { lote: string; desagio_fonte_pct: number | null; desagio_calculado_pct: number | null }[];
  desagio_inconsistente_total: number;
};

export type ObrasTransmissao = {
  data_referencia: string;
  /** Definição da extensão: km de circuito (circuito duplo e bipolo contam cada circuito). */
  definicao_km: string;
  modulos_lt_fora_do_limite: number;
  /** Módulos listados em mais de um empreendimento: contados uma vez. */
  modulos_em_mais_de_um_empreendimento: { regra: string; modulos_lt: number; modulos_tr: number; km_lt: number; mva_tr: number };
  por_situacao: { situacao: string; empreendimentos: number; obras: number; km_lt_novas: number; mva_tr_novos: number }[];
  em_andamento: {
    empreendimentos: number;
    km_lt_novas: number;
    mva_tr_novos: number;
    com_prazo_legal_vencido: number;
    km_prazo_vencido: number;
    mva_prazo_vencido: number;
    mediana_dias_desde_prazo_legal: number | null;
  };
  /** Linha interestadual aparece nas duas UFs: a soma das UFs supera o total nacional. */
  em_andamento_por_uf: { uf: string; empreendimentos: number; km_lt_toca_uf: number; mva_tr: number }[];
  maiores_prazos_vencidos: {
    id: string;
    ons: string | null;
    nome: string | null;
    oper_ato_legal: string | null;
    dias_desde_prazo_legal: number | null;
    km_lt: number;
    mva_tr: number;
    ufs: string[];
  }[];
  atraso_realizado_por_ano: {
    ano: string;
    empreendimentos: number;
    pct_com_atraso: number | null;
    mediana_dias: number | null;
    p75_dias: number | null;
  }[];
  entrada_por_ano: { ano: string; km_lt_novas: number; mva_tr_novos: number; modulos_lt: number; modulos_tr: number }[];
};

/** Geração e rede por UF lado a lado: grandezas diferentes, nunca somadas nem divididas. */
export type GeracaoERedeUf = {
  uf: string;
  mw_ugs_em_implantacao: number;
  mw_previsto_24_meses: number;
  km_lt_em_andamento_toca_uf: number;
  mva_tr_em_andamento: number;
  empreendimentos_transmissao_em_andamento: number;
  /** km de traçado das linhas da EPE dentro da UF; null sem a camada. */
  km_rede_existente_epe: number | null;
  km_rede_planejada_epe: number | null;
};

export type SerieAnualExpansao = {
  ano: string;
  /** Resumo anual oficial de liberações (MW até 2013, kW desde 2014, convertido). */
  mw_geracao_liberada: number | null;
  fonte_mw_geracao_liberada: string | null;
  /** Soma do arquivo detalhado ÷ resumo oficial: cobertura do detalhado (100 desde 2014). */
  cobertura_detalhado_pct: number | null;
  km_lt_energizados: number | null;
  mva_tr_energizados: number | null;
  km_contratados_leilao: number | null;
  mva_contratados_leilao: number | null;
  /** Contratos de concessão assinados no ano (SIGET); 0 = nenhum contrato no ano. */
  km_contratos_assinados_siget: number | null;
  mva_contratos_assinados_siget: number | null;
  ano_parcial: boolean;
};

export type ContratoAssinado = {
  contrato: string;
  numero: string | null;
  assinatura: string | null;
  agente: string | null;
  empreendimentos: number | null;
  km_lt_novas: number | null;
  mva_tr_novos: number | null;
};

export type ContratosAssinados = {
  data_referencia: string;
  regra: string;
  nota_zero: string;
  por_ano: {
    ano: string;
    contratos: number;
    contratos_sem_empreendimento: number;
    empreendimentos: number;
    km_lt_novas: number;
    mva_tr_novos: number;
    ano_parcial: boolean;
  }[];
  depois_do_ultimo_leilao_do_arquivo: { ultimo_leilao: string | null; contratos: ContratoAssinado[] };
};

export type CamadaRedeEpe = {
  camada: string;
  id_camada: number;
  capturado_em: string;
  sha256: string;
  linhas: number;
  contagem_informada: number;
  km_geometria: number;
  km_campo_fonte_plausivel: number;
  campo_extensao_fora_de_escala: { linhas: number; exemplos: { nome: string | null; extensao_fonte: number; km_geometria: number }[] };
  diferenca_relativa_mediana_geometria_x_campo_pct: number | null;
  ano_min: number | null;
  ano_max: number | null;
  por_tensao: { tensao_kv: number | null; linhas: number; km: number }[];
  por_ano: { ano: number | null; linhas: number; km: number }[];
  por_uf: { uf: string; km: number }[];
  km_fora_de_uf: number;
};

/** Linhas de transmissão do WebMap da EPE (geometria; sem data do dado informada pela EPE). */
export type RedeEpe = {
  fonte: string;
  servico: string;
  webmap: string;
  data_do_dado: null;
  nota_data: string;
  definicao_km: string;
  generalizacao_grau: number;
  existente: CamadaRedeEpe;
  planejada: CamadaRedeEpe;
};

export type Transmissao = {
  leiloes: Leiloes;
  obras: ObrasTransmissao;
  contratos_assinados: ContratosAssinados | null;
  rede_epe: RedeEpe | null;
  geracao_e_rede_por_uf: GeracaoERedeUf[];
  serie_anual: SerieAnualExpansao[];
};

// ------------------------------------------------------------------ cenários (P043)

export type LinhaFigura = { ref: string; [coluna: string]: string | number | null };

export type FiguraPde = {
  titulo: string;
  aba: string;
  unidade: string;
  pagina: number | null;
  nota: string;
  colunas: string[];
  linhas: LinhaFigura[];
};

export type CamadaPde = {
  categoria: string;
  rotulo: string;
  pde_dez2025_gw: number | null;
  pde_dez2035_gw: number | null;
  correspondencia: string;
  nota: string | null;
  /** Realizado do SIGA na categoria correspondente; null quando não há correspondência verificada. */
  realizado_siga_gw: number | null;
  carteira_ralie_gw: number | null;
};

export type Cenarios = {
  selo: "CENÁRIO";
  edicao: string;
  orgao: string;
  aprovacao: { texto: string; verificado_em: string; fonte: string } | null;
  data_base_premissas: string;
  horizonte: string;
  cenario: string;
  universo: string;
  hipoteses: { texto: string; pagina: number | null }[];
  relatorio: string;
  caderno_de_dados: string;
  figuras: Record<string, FiguraPde>;
  camadas: CamadaPde[];
  conferencia_relatorio: {
    descricao: string;
    calculado_gw: number | null;
    relatorio_gw: number;
    diferenca_gw: number | null;
    tolerancia_gw: number;
    resultado: "aprovada" | "divergente";
    /** "valor e universo" ou "valor (não de universo)". */
    conferencia_de: string;
    ressalva: string | null;
  }[];
  atualizacao_planilhas: Record<string, string | null> | null;
  vintage: { arquivo: string | null; sha256: string | null; capturado_em: string | null };
};

// ------------------------------------------------------------------ conferências entre recursos oficiais

export type Conferencias = {
  /** RALIE atual (CSV) contra a mesma fotografia no Parquet histórico, unidade por unidade. */
  ralie_csv_x_parquet: {
    fotografia: string;
    ugs_csv: number;
    ugs_parquet: number;
    ugs_iguais: number;
    mw_csv: number;
    mw_parquet: number;
    resultado: "aprovada" | "divergente";
  };
  /** Liberações do arquivo detalhado somadas por ano e tipo contra o resumo anual oficial (kW, desde 2014). */
  liberacoes_detalhado_x_resumo: {
    desde: string;
    grupos_ano_tipo: number;
    iguais: number;
    tolerancia_kw: number;
    divergentes: { ano: string; tipo: string; detalhado_kw: number | null; resumo_kw: number | null }[];
    resultado: "aprovada" | "divergente";
  };
};

// ------------------------------------------------------------------ evidência (seção 11.5)

/** Ficha "Comprove este número" montada e validada por pipeline/energia/evidencia.py (contrato comum). */
export type EvidenciaExpansao = Evidencia;

export type ChaveEvidenciaExpansao =
  | "capacidade_total"
  | "outorgado_sem_obra"
  | "ralie_em_implantacao"
  | "coorte_inicial_operacao"
  | "confiabilidade_ultima"
  | "transmissao_em_andamento"
  | "leiloes_ultimo_ano"
  | "pde_capacidade_2035";

export type ChaveProvenienciaExpansao =
  | "capacidade"
  | "estagios"
  | "encerramentos"
  | "ralie"
  | "coortes"
  | "confiabilidade"
  | "desvio_prazo_vigente"
  | "leiloes"
  | "obras"
  | "previsoes"
  | "contratos_transmissao"
  | "rede_epe"
  | "cenarios";

// ------------------------------------------------------------------ gold

export type ExpansaoGold = Cabecalho & {
  referencias: Referencias;
  regras: Regras;
  /** Violações não críticas da validação física e de esquema, visíveis na página. */
  ressalvas: string[];
  capacidade_instalada: CapacidadeInstalada;
  estagios: Estagios;
  cronograma: Cronograma;
  transmissao: Transmissao;
  cenarios: Cenarios;
  conferencias: Conferencias;
  /** rede_epe só existe quando as camadas da EPE estão no bronze. */
  proveniencia: Record<Exclude<ChaveProvenienciaExpansao, "rede_epe">, Proveniencia> & { rede_epe?: Proveniencia };
  /** Fichas dos números de destaque; uma ficha some quando a série de origem não existe. */
  evidencias: Partial<Record<ChaveEvidenciaExpansao, EvidenciaExpansao>>;
  downloads: Download[];
};

/** public/energia/series/expansao_usinas_pontos.json (carregado sob demanda pelo mapa). */
export type PontosUsinas = {
  colunas: ["nucleo", "nome", "tipo", "estagio", "uf", "mw_outorgado", "mw_fiscalizado", "lat", "lon"];
  linhas: [number, string | null, string | null, Estagio, string | null, number | null, number | null, number, number][];
  fonte: string;
  nota: string;
};

/** public/energia/series/expansao_rede_epe.json (carregado sob demanda pelo mapa da rede). */
export type LinhasRedeEpe = {
  colunas: ["camada", "nome", "tensao_kv", "ano", "km_geometria", "d"];
  linhas: ["existente" | "planejada", string | null, number | null, number | null, number | null, string][];
  viewBox: string;
  projecao: Record<string, unknown>;
  fonte: string;
  nota: string;
};
