/**
 * Tipos da gold do módulo Mercado (public/energia/gold/mercado.json), espelho exato do que
 * pipeline/energia/modulos/mercado.py publica (painéis P032 a P035).
 *
 * Unidades no nome do campo: _mwh (energia, MWh), _mwmed (MW médios do mês; MWh = MWmed × horas),
 * _uc (unidades consumidoras), _pct (%), _rs (R$ nominais), _mil_rs (mil R$), _gwh (GWh),
 * _milhoes_rs e _bilhoes_rs nas conferências com o InfoMercado. Séries de gráfico vêm com MWh e R$
 * inteiros; o valor completo está na evidência e nos CSV. Ausência é null e é exibida como
 * ausência: zero só aparece quando a fonte publicou zero. Nenhuma razão é recalculada na
 * interface; participações e fatores já vêm como razão de somas do pipeline.
 *
 * Três universos de consumo convivem e nenhum é a carga do ONS: EPE (consumo na rede), CCEE
 * (consumo contabilizado no centro de gravidade) e SAMP (mercado faturado por distribuidora).
 * Agente (CNPJ), perfil, parcela de carga e unidade consumidora são contagens diferentes.
 */
import type { Cabecalho, Periodo, Proveniencia } from "./tipos";
import type { Evidencia, ResultadoTeste } from "./evidencia";

/* ---------------------------------------------------------------- comuns */

/** Endereço do JSON com as tabelas longas lidas sob demanda (public/energia/series/mercado_detalhe.json). */
export type DetalheSobDemanda = { url: string; tabelas: string[] };

export type Mes = string; // "AAAA-MM"
export type Ano = string; // "AAAA"
export type SubmercadoMercado = "SE" | "S" | "NE" | "N";
/** Subsistema da EPE: os quatro submercados e os sistemas isolados. */
export type SubsistemaEpe = SubmercadoMercado | "ISOL";
export type ClasseEpe = "Residencial" | "Industrial" | "Comercial" | "Rural" | "Outros";

/** Conferência pontual (por exemplo, com o InfoMercado em PDF). */
export type ConferenciaInfoMercado = {
  numero: string;
  mes: Mes;
  medida: string;
  publicado: number;
  calculado: number | null;
  diferenca: number | null;
  /** Texto com unidade ("0,006 p.p. (...)"). */
  tolerancia: string;
  nota: string | null;
  recurso: string | null;
  url: string | null;
  /** Página do PDF em que o número aparece (1 = primeira). */
  pagina: string | null;
  resultado: ResultadoTeste;
};

export type Referencias = {
  hoje: string;
  epe_ultimo_mes: Mes;
  ccee_ultimo_mes_consumo: Mes | null;
  ccee_ultimo_mes_gsf: Mes | null;
  samp_ano_referencia: Ano | null;
};

export type DefinicoesMercado = {
  acl: string;
  acr: string;
  agente: string;
  perfil: string;
  parcela_de_carga: string;
  unidade_consumidora: string;
  migracao: string;
  entrada_saida_agente: string;
  desligamento: string;
  variacao_liquida: string;
  mre: string;
  gsf: string;
  risco_hidrologico_acr: string;
  ess: string;
  eer: string;
  competencia_pagamento_reprocessamento: string;
  pld: string;
};

/* ---------------------------------------------------------------- P032: livre e regulado */

export type UniversoConsumo = {
  id: "epe" | "ccee" | "samp";
  titulo: string;
  descricao: string;
  unidade: string;
  desde: Mes | null;
  ate: Mes | null;
};

export type KpiParticipacaoLivre = {
  valor_pct: number;
  /** Mesma razão nos 12 meses anteriores; null quando a janela anterior não está completa. */
  anterior_pct: number | null;
  periodo: Periodo;
  evidencia: Evidencia;
};

export type KpisLivreRegulado = {
  participacao_livre_12m?: KpiParticipacaoLivre;
  consumo_livre_12m?: { valor_mwh: number; total_mwh: number; periodo: Periodo };
  participacao_acl_ccee_12m?: { valor_pct: number; periodo: Periodo; evidencia: Evidencia };
};

export type EpeMensal = {
  mes: Mes;
  cativo_mwh: number | null;
  livre_mwh: number | null;
  total_mwh: number | null;
  livre_pct: number | null;
  cativo_uc: number | null;
  livre_uc: number | null;
  /** Ano marcado como preliminar pela EPE. */
  preliminar: boolean;
  /** Estoque de unidades livres menos o do mês anterior. */
  variacao_livre_uc: number | null;
};

export type EpeAnual = {
  ano: Ano;
  cativo_mwh: number;
  livre_mwh: number;
  total_mwh: number;
  livre_pct: number | null;
  meses: number;
  completo: boolean;
  preliminar: boolean;
};

export type EpeAberturaAnual = {
  ano: Ano;
  /** Classe de consumo da EPE. */
  chave: string;
  cativo_mwh: number;
  livre_mwh: number;
  livre_pct: number | null;
  meses: number;
  completo: boolean;
};

export type EpeAbertura12m = {
  /** Subsistema, região ou UF. */
  chave: string;
  cativo_mwh: number | null;
  livre_mwh: number | null;
  livre_pct: number | null;
  livre_uc: number | null;
};

export type EpeUfAnual = { uf: string; ano: Ano; livre_pct: number | null; total_mwh: number | null };

export type CceeMensal = {
  mes: Mes;
  /** ACR = classe Distribuidor; ACL = demais classes (CONSUMO_CLASSE_AGENTE). */
  acr_mwmed: number;
  acl_mwmed: number;
  total_mwmed: number;
  acl_pct: number | null;
  /** "classes" (conta pelas classes de agente) ou "ambiente" (mês sem classes, conjunto de ambiente). */
  origem: "classes" | "ambiente";
  /** Valores como publicados em CONSUMO_MENSAL_AMBIENTE_COMERCIALIZACAO (sem a Varejista desde fev/2026). */
  acr_publicado_mwmed: number | null;
  acl_publicado_mwmed: number | null;
  varejista_mwmed: number | null;
  horas: number;
  acr_mwh: number;
  acl_mwh: number;
};

export type CceeClasse = {
  classe: string;
  consumo_cg_mwmed: number | null;
  ponto_conexao_acr_mwmed: number | null;
  ponto_conexao_acl_mwmed: number | null;
};

export type IdentidadeClasses = {
  mes: Mes;
  /** Σ classes − (ACR + ACL publicado). */
  diferenca_mwmed: number;
  varejista_mwmed: number | null;
  /** Diferença menos a classe Varejista; acima de 5 MWmed, ressalva. */
  residuo_mwmed: number;
  ok: boolean;
};

export type ComparacaoUniversos = {
  mes: Mes;
  ccee_acl_mwh: number;
  ccee_acl_pct: number | null;
  epe_livre_mwh: number | null;
  epe_livre_pct: number | null;
  samp_livre_mwh: number | null;
  epe_sobre_ccee_pct: number | null;
};

export type CargaContexto = {
  edicao: Mes;
  mes: Mes;
  carga_gwh: number;
  perdas_diferencas_gwh: number | null;
  consumo_epe_gwh: number | null;
  consumo_sobre_carga_pct: number | null;
};

export type ReconciliacaoPlanilha = {
  comparacoes: number;
  falhas: number;
  exemplos_falha: { campo: string; mes: Mes; planilha: number; tabela_longa: number | null; diferenca: number | null }[];
  maior_diferenca: Partial<Record<"total_mwh" | "cativo_mwh" | "livre_mwh" | "cativo_uc" | "livre_uc", number | null>>;
  identidade_planilha_violada: number;
  tolerancia: string;
  resultado: ResultadoTeste;
};

export type ReconciliacaoMmeConsumo = {
  edicao: Mes;
  mes: Mes;
  ambiente: "ACR" | "ACL" | "Total";
  medida: "mes" | "acumulado_12_meses";
  mme_gwh: number;
  epe_gwh: number | null;
  diferenca_gwh: number | null;
  resultado: ResultadoTeste | null;
};

export type DistribuidoraSamp = {
  cnpj: string;
  sigla: string | null;
  meses: number;
  livre_mwh: number | null;
  cativo_mwh: number | null;
  /** Só com os 12 meses do ano. */
  livre_pct_faturada: number | null;
  livre_uc_dez: number | null;
  livre_uc_dez_anterior: number | null;
  variacao_livre_uc: number | null;
  livre_uc_incentivada_dez: number | null;
  livre_uc_convencional_dez: number | null;
  livre_uc_autoproducao_dez: number | null;
  cativo_uc_dez: number | null;
  completo: boolean;
};

export type SampNacionalMensal = {
  mes: Mes;
  distribuidoras: number;
  /** Publicado por pelo menos 95% da mediana de distribuidoras dos 12 meses anteriores. */
  completo: boolean;
  livre_mwh: number | null;
  livre_uc: number | null;
  cativo_mwh: number | null;
  cativo_uc: number | null;
  livre_mwh_refat: number | null;
  epe_livre_uc: number | null;
  samp_sobre_epe_uc_pct: number | null;
};

export type LivreRegulado = {
  universos: UniversoConsumo[];
  kpis: KpisLivreRegulado;
  epe_versao_dados: string | null;
  epe_anos_preliminares: Ano[];
  epe_ultimo_mes: Mes;
  epe_ultimo_mes_uf: Mes | null;
  /** Mensal a partir de epe_mensal_desde; antes disso, epe_anual (o CSV nacional tem todos os meses). */
  epe_mensal_desde: Mes;
  epe_mensal: EpeMensal[];
  epe_anual: EpeAnual[];
  epe_classe_anual: EpeAberturaAnual[];
  epe_subsistema_12m: EpeAbertura12m[];
  epe_regiao_12m: EpeAbertura12m[];
  epe_uf_12m: EpeAbertura12m[];
  /** Últimos 10 anos completos; o CSV por UF tem todo o histórico. */
  epe_uf_anual: EpeUfAnual[];
  ccee_mensal: CceeMensal[];
  ccee_classes_ultimo_mes: { mes: Mes | null; linhas: CceeClasse[] };
  ccee_identidade_classes: IdentidadeClasses[];
  comparacao_universos: ComparacaoUniversos[];
  carga_contexto: CargaContexto[];
  reconciliacao: { epe_planilha: ReconciliacaoPlanilha; mme: ReconciliacaoMmeConsumo[] };
  distribuidoras: {
    ano: Ano | null;
    total: number;
    na_gold: number;
    criterio: string;
    /** CSV com a tabela completa do ano. */
    csv: string;
    linhas: DistribuidoraSamp[];
  };
  samp_nacional_mensal: SampNacionalMensal[];
};

/* ---------------------------------------------------------------- P033: agentes e migração */

export type KpisAgentes = {
  agentes_contabilizados?: { valor: number; mes: Mes; evidencia: Evidencia };
  ucs_livres?: { valor: number; mes: Mes; variacao_12m: number | null; evidencia: Evidencia };
  parcelas_carga?: { valor: number; mes: Mes; migracoes_no_mes: number | null; evidencia: Evidencia };
};

export type FluxoClasse = { entradas: number; saidas: number };

export type FluxoAssociados = {
  mes: Mes;
  estoque: number;
  /** null no primeiro mês da série ou depois de uma lacuna. */
  entradas: number | null;
  saidas: number | null;
  por_classe: Record<string, FluxoClasse>;
};

export type PerfisClasse = {
  classe: string;
  perfis_ativo?: number;
  perfis_encerrado?: number;
  perfis_perfil_especifico?: number;
  agentes_ativo?: number;
  agentes_encerrado?: number;
  agentes_perfil_especifico?: number;
};

export type Perfis = {
  /** Data da posição do cadastro (publicação do recurso). */
  posicao: string | null;
  /** Agentes por classe não se somam: um agente pode ter perfis em mais de uma classe. */
  por_classe: PerfisClasse[];
  perfis_por_agente_ativo: Partial<Record<"1" | "2" | "3_ou_mais", number>>;
  agentes_ativos: number | null;
  perfis_ativos: number | null;
};

export type ParcelasMensal = {
  mes: Mes;
  parcelas: number | null;
  perfis_com_parcela: number | null;
  cnpj_carga: number | null;
  migracoes_no_mes: number | null;
  consumo_acl_mwh: number | null;
  consumo_total_mwh: number | null;
  por_submercado: Partial<Record<SubmercadoMercado, number>>;
};

export type SampUcsLivresMensal = {
  mes: Mes;
  completo: boolean;
  livre_uc_incentivada: number | null;
  livre_uc_convencional: number | null;
  livre_uc_autoproducao: number | null;
  livre_uc_erc: number | null;
  livre_uc_outro: number | null;
};

export type AgentesMigracao = {
  kpis: KpisAgentes;
  agentes_por_classe_mensal: { mes: Mes; total: number; por_classe: Record<string, number> }[];
  associados_fluxos: FluxoAssociados[];
  perfis: Perfis;
  parcelas_mensal: ParcelasMensal[];
  parcelas_uf_ultimo_mes: { mes: Mes | null; linhas: { uf: string; parcelas: number }[] };
  /** Desligamentos por ano e tipo; a abertura por classe está em mercado_detalhe.json. */
  desligamentos_por_ano: { ano: Ano; tipo: string; desligamentos: number }[];
  detalhe: DetalheSobDemanda;
  ucs_livres_por_classe_ultimo_mes: { mes: Mes | null; linhas: { classe: ClasseEpe; livre_uc: number | null }[] };
  samp_ucs_livres_mensal: SampUcsLivresMensal[];
  agentes_aneel: {
    gerado_em: string | null;
    cadastrados: number;
    ativos: number;
    ativos_por_atividade: Record<"comercializacao" | "distribuicao" | "geracao" | "transmissao", number>;
    ativos_so_comercializacao: number;
  };
};

/* ---------------------------------------------------------------- P034: MRE e GSF */

export type GsfMensal = {
  mes: Mes;
  submercados_geracao: number;
  geracao_mre_mwmed: number | null;
  geracao_mre_cotas_mwmed: number | null;
  gf_sazonalizada_mwmed: number | null;
  /** GFIS_2: garantia física modulada ajustada pelo fator de disponibilidade (denominador do GSF). */
  gf_modulada_fdisp_mwmed: number | null;
  gf_sazonalizada_soma_submercados_mwmed: number | null;
  fator_disponibilidade_pct: number | null;
  fator_reducao_acumulado_pct: number | null;
  /** Tarifa de energia de otimização (R$/MWh). */
  teo_rs_mwh: number | null;
  valor_alocado_mre_rs: number | null;
  gsf_pct: number | null;
  horas: number;
};

export type RiscoHidrologicoLinha = {
  rh_itaipu: number | null;
  rh_repactuadas: number | null;
  rh_ccgf: number | null;
  /** Negativo no arquivo (já concedido na tarifa). */
  previsao_rh: number | null;
  premio_risco: number | null;
  rh_ccgf_repactuadas_liquido: number | null;
  /** Itaipu + repactuadas + CCGF; null se faltar componente. */
  rh_bruto: number | null;
};

export type MreGsf = {
  kpis: {
    gsf_ultimo_mes?: { valor_pct: number; mes: Mes; evidencia: Evidencia };
    gsf_12m?: { valor_pct: number; periodo: Periodo; evidencia: Evidencia };
    risco_hidrologico_acr_12m?: { valor_rs: number; periodo: Periodo; evidencia: Evidencia };
  };
  mensal: GsfMensal[];
  anual: { ano: Ano; meses: number; completo: boolean; gsf_pct: number | null; inicio: Mes; fim: Mes }[];
  submercados_ultimo_mes: {
    mes: Mes | null;
    linhas: { submercado: SubmercadoMercado; geracao_mre_mwmed: number | null; gf_sazonalizada_mwmed: number | null }[];
  };
  identidade_gf: { mes: Mes; diferenca_mwmed: number }[];
  reconciliacao_infomercado: ConferenciaInfoMercado[];
  risco_hidrologico_acr: {
    anual: ({ ano: Ano; meses: number } & RiscoHidrologicoLinha)[];
    /** A série mensal está em mercado_detalhe.json (risco_hidrologico_acr_mensal). */
    detalhe: DetalheSobDemanda;
  };
};

/* ---------------------------------------------------------------- P035: encargos e contabilização */

export type EssMensal = {
  mes: Mes;
  ro_constrained_on?: number | null;
  ro_constrained_off?: number | null;
  ro_unit_commitment?: number | null;
  suporte_reativo?: number | null;
  outros_ancilares?: number | null;
  seguranca_energetica?: number | null;
  deslocamento_hidraulico?: number | null;
  importacao?: number | null;
  reserva_operativa?: number | null;
  /** Σ dos nove tipos (sem os ressarcimentos, que detalham os outros serviços ancilares). */
  total: number | null;
  restricao_operacao: number | null;
  servicos_ancilares: number | null;
  /** OUTROS_SERVICOS_ANCILARES − Σ ressarcimentos (R$); 0 quando a identidade fecha. */
  diferenca_outros_ressarcimentos: number | null;
  /** Encargo de resposta da demanda (conjunto próprio); null quando a fonte não publicou valor. */
  resposta_demanda: number | null;
  resposta_demanda_submercados: number;
};

export type SituacaoLiquidacao = "liquidada" | "liquidacao_nao_informada" | "identidade_nao_fecha" | "sem_valor";

export type LiquidacaoMensal = {
  mes: Mes;
  a_liquidar: number | null;
  liquidado: number | null;
  inadimplencia: number | null;
  /** Só nos meses "liquidada" (a liquidar = liquidado + inadimplência). */
  inadimplencia_pct: number | null;
  fecha: boolean | null;
  situacao: SituacaoLiquidacao;
};

export type ConferenciaMmeCcee = {
  tipo: string;
  mes: Mes;
  edicao: Mes;
  mme_mil_rs: number | null;
  ccee_mil_rs: number | null;
  diferenca_mil_rs: number | null;
  tolerancia_mil_rs: number;
  resultado: ResultadoTeste | null;
};

export type ContaBandeiraAcr = {
  ess_eer: number | null;
  ressarcimento_coner: number | null;
  resultado_mcp: number | null;
  ccear_d: number | null;
  receita_faturada_bandeiras: number | null;
  repasse_conta_bandeira: number | null;
};

export type Encargos = {
  kpis: {
    ess_12m?: { valor_rs: number; periodo: Periodo; evidencia: Evidencia };
    eer_12m?: { valor_rs: number; periodo: Periodo; evidencia: Evidencia };
    inadimplencia_ultimo_mes?: { valor_pct: number | null; mes: Mes; evidencia: Evidencia };
    ess_mme_ano?: { valor_mil_rs: number; periodo: Periodo; edicao: Mes; evidencia: Evidencia };
  };
  ess_mensal: EssMensal[];
  eer_mensal: { mes: Mes; encargo_energia_reserva: number | null; saldo_efetivo_coner: number | null; pagamento_liquido_er: number | null }[];
  pagamento_mensal: {
    mes: Mes;
    pagamento_ess: number | null;
    pagamento_seguranca_energetica: number | null;
    recursos_alivio_ess: number | null;
    penalidades_alivio_ess: number | null;
  }[];
  liquidacao_mensal: LiquidacaoMensal[];
  mme: {
    edicoes: {
      edicao: Mes;
      recurso: string | null;
      pagina_encargos: string | null;
      publicado_em: string | null;
      capturado_em: string | null;
      sha256: string | null;
    }[];
    vigente: { tipo: string; mes: Mes; valor_mil_rs: number; edicao: Mes }[];
    revisoes: {
      tipo: string;
      mes: Mes;
      edicao_anterior: Mes;
      valor_anterior_mil_rs: number;
      edicao_posterior: Mes;
      valor_posterior_mil_rs: number | null;
      diferenca_mil_rs: number | null;
      nota?: string;
    }[];
    reconciliacao_ccee: ConferenciaMmeCcee[];
  };
  /** Soma nacional por ano de competência; a série mensal está em mercado_detalhe.json. */
  acr_conta_bandeira_anual: ({ ano: Ano; meses: number } & ContaBandeiraAcr)[];
  reconciliacao_infomercado: ConferenciaInfoMercado[];
  detalhe: DetalheSobDemanda;
};

/* ---------------------------------------------------------------- painéis, fontes e acesso */

export type EstadoPainel = "concluido_com_limitacao" | "parcial" | "bloqueado";

export type VerificacaoPainel = {
  nome: string;
  resultado: ResultadoTeste;
  /** false = divergência documentada entre fontes, visível mas fora do critério de aceite. */
  essencial: boolean;
  detalhe: string;
};

export type PainelMercado = {
  id: "P032" | "P033" | "P034" | "P035";
  titulo: string;
  pergunta: string;
  /** Resposta curta gerada por regra fixa a partir dos KPIs; null quando falta o dado. */
  resposta: string | null;
  /** Estado da camada de dados; a entrega do painel depende também da página e da inspeção visual. */
  estado_dados: EstadoPainel;
  criterio_aceite: string;
  verificacoes: VerificacaoPainel[];
  /** Chaves de `proveniencia` que sustentam o painel. */
  proveniencia: (keyof ProvenienciaMercado)[];
  limitacoes: string[];
};

export type BloqueioMercado = {
  id: string;
  paineis: string[];
  descricao: string;
  evidencia: {
    url: string;
    capturado_em: string | null;
    sha256: string | null;
    pdfs_encontrados: number | null;
    observacao: string;
  };
  alternativas: string[];
  efeito: string;
};

export type PendenciaMercado = {
  id: string;
  paineis: string[];
  descricao: string;
  evidencia: { url: string; capturado_em?: string | null; sha256?: string | null; observacao: string };
  efeito: string;
};

export type ConjuntoCcee = {
  conjunto: string;
  dataset: string;
  painel: string;
  titulo: string;
  url: string;
  ultima_tentativa: string | null;
  ultima_tentativa_ok: boolean | null;
  ultimo_detalhe: string | null;
  ultima_coleta_ok: string | null;
  falhas_registradas: number;
  arquivos: number;
  observacoes: number;
};

export type ProvenienciaMercado = {
  consumo_epe: Proveniencia;
  consumo_ccee: Proveniencia;
  distribuidoras_samp: Proveniencia;
  agentes_ccee: Proveniencia;
  gsf: Proveniencia;
  risco_hidrologico_acr: Proveniencia;
  encargos_ccee: Proveniencia;
  encargos_mme: Proveniencia;
};

export type FonteMercado = {
  orgao: string;
  conjunto: string;
  titulo: string;
  url: string;
  licenca: string;
  dataset_silver: string;
};

export type AcessoCcee = {
  cliente: string;
  observacao: string;
  conjuntos: { dataset: string; ultima_tentativa: string | null; tentativas_ok: number; tentativas: number }[];
};

export type MercadoGold = Cabecalho & {
  referencias: Referencias;
  definicoes: DefinicoesMercado;
  livre_regulado: LivreRegulado;
  agentes_migracao: AgentesMigracao;
  mre_gsf: MreGsf;
  encargos: Encargos;
  ccee_conjuntos: ConjuntoCcee[];
  /** Violações não críticas da validação física (as críticas viram stub). */
  ressalvas_validacao: string[];
  proveniencia: ProvenienciaMercado;
  fontes: FonteMercado[];
  paineis: PainelMercado[];
  bloqueios: BloqueioMercado[];
  pendencias: PendenciaMercado[];
  acesso_ccee: AcessoCcee;
};

/* ---------------------------------------------------------------- leitura sob demanda */

/** public/energia/series/mercado_detalhe.json: tabelas que a página mostra no modo Analisar. */
export type MercadoDetalhe = {
  dominio: "energia";
  gold: "mercado.json";
  gerado_em: string;
  descricao: string;
  mcp_submercado_mensal: {
    mes: Mes;
    submercado: SubmercadoMercado;
    be_positivo_mwh: number | null;
    be_negativo_mwh: number | null;
    resultado_venda_rs: number | null;
    resultado_compra_rs: number | null;
  }[];
  acr_conta_bandeira_mensal: ({ mes: Mes; distribuidoras: number } & ContaBandeiraAcr)[];
  risco_hidrologico_acr_mensal: ({ mes: Mes; distribuidoras: number } & RiscoHidrologicoLinha)[];
  desligamentos_anual: { ano: Ano; tipo: string; classe: string; desligamentos: number }[];
};
