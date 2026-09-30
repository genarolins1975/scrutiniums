/**
 * Tipos da gold do módulo Conta de luz (public/energia/gold/conta.json), espelho
 * exato do que pipeline/energia/modulos/conta.py publica. Valores monetários de
 * tarifa em R$/MWh (divida por 1000 para R$/kWh); ausência é null e é exibida como
 * ausência. Nenhum número é recalculado na interface, com uma exceção declarada: o
 * simulador reaplica a fórmula publicada em `simulador.formula` e deve reproduzir
 * `simulador.casos_referencia` (teste em src/tests/energia-conta.test.ts).
 */
import type { Cabecalho, Download, Proveniencia } from "./tipos";

/** [início, fim, TE + TUSD em R$/MWh] de uma vigência resolvida (TE e TUSD separadas no CSV de histórico). */
export type PedacoTarifa = [string, string, number | null];

export type Perfis = { "100": number | null; "200": number | null; "300": number | null };

export type TarifaVigente = {
  cnpj: string;
  sigla: string | null;
  nome: string | null;
  inicio: string;
  fim: string;
  ato: string;
  te: number | null;
  tusd: number | null;
  total: number;
  be_te: number | null;
  be_tusd: number | null;
  be_total: number | null;
  /** R$/mês para 100, 200 e 300 kWh, sem tributos e sem bandeira. */
  perfis: Perfis;
  /** 1 = menor tarifa. */
  posicao: number;
};

export type SemVigente = {
  cnpj: string;
  sigla: string | null;
  nome: string | null;
  ultima_vigencia: { inicio: string; fim: string; ato: string };
  /** Dias entre o fim da última vigência e a data de referência. */
  dias_sem_tarifa: number;
  motivo: string;
};

export type ResumoTarifas = {
  n: number;
  mediana: number | null;
  p25: number | null;
  p75: number | null;
  minimo: number | null;
  maximo: number | null;
  perfis_mediana: Perfis;
  ponderacao: string;
};

/**
 * [mês, n de distribuidoras com tarifa no dia 1º, mediana, p25, p75, mediana em R$ do
 * último mês com IPCA]. Mediana e quartis ficam null nos meses abaixo da cobertura
 * mínima (80% do maior n mensal); a mediana real fica null sem índice do mês.
 */
export type PontoEvolucao = [string, number, number | null, number | null, number | null, number | null];

export type Conferencia = { nome: string; resultado: string; detalhe: string };

export type FonteEvidencia = {
  orgao: string;
  conjunto: string;
  recurso: string | null;
  url: string;
  arquivo: string | null;
  sha256: string | null;
  capturado_em: string | null;
  publicado_em: string | null;
};

/** Objeto "Comprove este número" (seção 11.5 da especificação). */
export type Evidencia = {
  valor_exibido: string | null;
  valor_calculo: number | null;
  unidade: string;
  periodo: Record<string, string | null>;
  entidade: string;
  universo: string;
  filtros: string[];
  fonte: FonteEvidencia;
  chaves_origem: string[];
  formula: string;
  numerador: { descricao: string; valor: number | null } | null;
  denominador: { descricao: string; valor: number | null } | null;
  pesos: string | null;
  exclusoes: string[];
  cobertura: string | null;
  tratamento_ausencia: string;
  versao: { pipeline: string; codigo: string | null; publicacao: string };
  revisoes: Proveniencia["revisoes_conhecidas"] | null;
  testes: Conferencia[];
  reconciliacao: { descricao: string; resultado: string; tolerancia: string } | null;
  download: Download[];
  reproducao: string;
  citacao: string;
};

export type ConflitoFonte = {
  cnpj: string;
  sigla: string | null;
  subgrupo: string;
  subclasse: string;
  base: "TA" | "BE";
  dia: string;
  ate: string;
  escolhido: { inicio: string; fim: string; ato: string; te: number | null; tusd: number | null };
  alternativas: { inicio: string; fim: string; ato: string; te: number | null; tusd: number | null }[];
};

export type GrupoComponenteId = "energia" | "transmissao" | "distribuicao" | "perdas" | "encargos" | "outros";
export type PorGrupo<T> = { [K in GrupoComponenteId]: T };

export type ComposicaoDistribuidora = {
  cnpj: string;
  sigla: string | null;
  total: number;
  grupos: PorGrupo<number | null>;
  pct: PorGrupo<number | null>;
  fecha_com_total: boolean;
  confere_com_tarifas: boolean;
  codigos_sem_grupo: string[];
};

export type Composicao = {
  grupos: { id: GrupoComponenteId; rotulo: string; componentes: { codigo: string; descricao: string | null }[] }[];
  classificacao: string;
  mediana_rs_mwh: PorGrupo<number | null>;
  distribuidoras: ComposicaoDistribuidora[];
  reconciliacao: {
    conferidas: number;
    divergentes: { sigla: string | null; te_tarifas: number | null; te_componentes: number | null; tusd_tarifas: number | null; tusd_componentes: number | null }[];
    sem_componentes: (string | null)[];
  };
  excluidos: string[];
  proveniencia: Proveniencia;
};

export type ClasseSimuladorId = "residencial" | "tarifa_social" | "desconto_social" | "rural" | "demais";
export type ChaveTarifa = "residencial" | "ts1" | "ts2" | "ds1" | "ds2" | "rural" | "demais";
export type Ligacao = "monofasico" | "bifasico" | "trifasico";
export type EstadoNorma = "CONFERIDA" | "NAO_RECONFERIDA" | "NAO_CAPTURADA";

export type Norma = {
  id: string;
  orgao: string;
  titulo: string;
  url: string;
  licenca: string;
  conferido_em: string | null;
  sha256: string | null;
  estado: EstadoNorma;
  trechos: { trecho: string; presente: boolean }[];
};

export type RegraTexto = { id: string; norma: string; texto: string; aplicacao_no_simulador: string };

export type PatamarBandeira = {
  bandeira: "Verde" | "Amarela" | "Vermelha P1" | "Vermelha P2";
  rs_mwh: number | null;
  rs_kwh: number | null;
  vigencia_tabela: string | null;
};

export type BandeiraVigente = { mes: string; bandeira: string | null; rs_mwh: number | null; aviso: string | null };

/** [classe, kWh, ligação, bandeira, total R$, parcela da bandeira R$]; null = simulação indisponível. */
export type CasoReferencia = [ClasseSimuladorId, number, Ligacao, "Verde" | "Amarela", number | null, number | null];

export type Simulador = {
  classes: { id: ClasseSimuladorId; rotulo: string; tarifas: ChaveTarifa[] }[];
  chaves_tarifa: Record<ChaveTarifa, { subgrupo: string; subclasse: string }>;
  regras: {
    custo_disponibilidade_kwh: Record<Ligacao, number>;
    tarifa_social_limite_kwh: number;
    desconto_social_limite_kwh: number;
    desconto_social_desde: string;
  };
  regras_texto: RegraTexto[];
  normas: Norma[];
  estado_regras: Record<string, EstadoNorma | null>;
  bandeiras: PatamarBandeira[];
  bandeira_vigente: BandeiraVigente | null;
  distribuidoras: {
    cnpj: string;
    sigla: string | null;
    inicio: string;
    ato: string;
    /** [TE, TUSD] em R$/MWh por chave; null quando a subclasse não tem vigência na data. */
    tarifas: Record<ChaveTarifa, [number | null, number | null] | null>;
  }[];
  cobertura_classes: Record<ChaveTarifa, number>;
  casos_referencia: { cnpj: string; sigla: string | null; criterio: string; casos: CasoReferencia[] };
  rotulo: string;
  formula: string;
  proveniencia: Proveniencia;
};

/** [data, ato, variação % da tarifa B1, IPCA % desde o evento anterior]. */
export type EventoTarifa = [string, string, number | null, number | null];

export type JanelaInflacao = {
  meses: number;
  de: string;
  ate: string;
  ipca_pct: number | null;
  ipca_meses: [string, string];
  n: number;
  excluidas_sem_tarifa_nas_duas_datas: number;
  mediana_pct: number | null;
  p25_pct: number | null;
  p75_pct: number | null;
  acima_ipca: number;
  abaixo_ou_igual_ipca: number;
  /** [cnpj, sigla, variação %, variação real %], em ordem crescente de variação. */
  distribuidoras: [string, string | null, number, number | null][];
};

export type Reajustes = {
  /** Por CNPJ, eventos desde 2019 (lista completa no CSV). */
  eventos: Record<string, EventoTarifa[]>;
  comparacao_inflacao: {
    referencia: string;
    ultimo_ipca: string;
    janelas: JanelaInflacao[];
    conferencia_ipca_12m: {
      mes: string;
      calculado_pct: number | null;
      publicado_pct: number | null;
      confere: boolean;
      tolerancia_pp: number;
      justificativa: string;
    };
  } | null;
  proveniencia: Proveniencia;
  proveniencia_ipca: Proveniencia;
  nota: string;
};

export type Bandeiras = {
  acionamento: { m: string; bandeira: string | null; rs_mwh: number | null }[];
  adicionais: { vigencia: string; resolucao: string | null; valores: Record<string, number | null> }[];
  patamares: PatamarBandeira[];
  vigente: BandeiraVigente | null;
  contagem_por_ano: Record<string, Record<string, number>>;
  conferencia: {
    meses: number;
    conferem: number;
    divergem: { mes: string; bandeira: string | null; acionamento: number | null; tabela: number | null }[];
  };
  proveniencia: Proveniencia;
  evidencia: Evidencia;
};

export type SubsidioAno = {
  ano: string;
  meses: number;
  parcial: boolean;
  categorias: Record<string, number | null>;
  soma_categorias: number | null;
  total_publicado: number | null;
};

export type Subsidios = {
  anual: SubsidioAno[];
  ultimo_ano_completo: string | null;
  /** Total por distribuidora no último ano completo (por categoria no CSV). */
  distribuidoras_ultimo_ano: { cnpj: string; sigla: string | null; nome: string | null; total: number | null }[];
  categorias: { categoria: string; definicao: string }[];
  nota: string;
  checagem: {
    total_vs_categorias: { comparacoes: number; divergem: number; maior_diferenca_rs: number };
    /** Conferido na ingestão (o silver guarda só o montante Total). */
    total_vs_previsao_mais_ajuste: { comparacoes: number; divergem: number; nota?: string };
  };
  competencias_futuras_excluidas: number;
  proveniencia: Proveniencia;
  evidencia: Evidencia;
};

export type ContaGold = Cabecalho & {
  data_referencia: string;
  gerado_pela_fonte_em: string | null;
  perfis_kwh: number[];
  definicoes: Record<
    "tarifa_homologada" | "tarifa_base_economica" | "tarifa_media_fornecimento" | "conta_simulada" | "perfil" | "nao_e_conta",
    string
  >;
  regras: Record<"sobreposicao" | "zero_publicado" | "vigencia" | "unidade", string>;
  /** Contagem do recorte na última vintage do CSV de tarifas, por motivo de exclusão. */
  universo_tarifas: Record<string, number>;
  /** CNPJ cuja sigla no conjunto de tarifas é 'Não Informado': sigla do mesmo CNPJ no conjunto de subsídios. */
  siglas_substituidas: { cnpj: string; sigla_tarifas: string | null; sigla_usada: string; fonte: string }[];
  tarifas: {
    resumo: ResumoTarifas;
    vigentes: TarifaVigente[];
    sem_vigente: SemVigente[];
    evolucao: PontoEvolucao[];
    /** Por CNPJ: vigências B1 residencial desde 2016. */
    historico: Record<string, PedacoTarifa[]>;
    proveniencia: Proveniencia;
    proveniencia_evolucao: Proveniencia;
    evidencia_mediana: Evidencia;
  };
  composicao: Composicao;
  simulador: Simulador;
  reajustes: Reajustes;
  bandeiras: Bandeiras;
  subsidios: Subsidios;
  conflitos_fonte: {
    total: number;
    por_subclasse: { subgrupo: string; subclasse: string; base: "TA" | "BE"; n: number }[];
    /** Só os que afetam a tarifa residencial de aplicação exibida; lista completa no CSV. */
    b1_residencial: ConflitoFonte[];
    regra: string;
    download: string;
  };
  downloads: Download[];
};
