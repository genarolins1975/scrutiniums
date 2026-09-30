/**
 * Tipos da gold do módulo Conta de luz (public/energia/gold/conta.json), espelho
 * exato do que pipeline/energia/modulos/conta.py publica. Valores monetários de
 * tarifa em R$/MWh (divida por 1000 para R$/kWh); ausência é null e é exibida como
 * ausência. Nenhum número é recalculado na interface, com uma exceção declarada: o
 * simulador reaplica a fórmula publicada em `simulador.formula` e deve reproduzir
 * `simulador.casos_referencia` (teste em src/tests/energia-conta.test.ts).
 *
 * O histórico por distribuidora (vigências e mudanças da tarifa B1) fica fora da gold,
 * em public/energia/series/conta_historico_b1.json (tipo `HistoricoB1`), para a página
 * carregar sob demanda (contrato dos módulos, seção 5.1).
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Proveniencia } from "./tipos";

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
  /** Fora do ranking com vigência encerrada há até 90 dias e a sucessora ainda não publicada no arquivo. */
  fora_vigencia_recente: number;
  /** Fora do ranking sem tarifa há mais de 90 dias (incorporação, extinção ou troca de CNPJ não informadas). */
  fora_sem_tarifa_ha_mais_de_90_dias: number;
};

/**
 * [mês, n de distribuidoras com tarifa no dia 1º, mediana, p25, p75, mediana em R$ do
 * último mês com IPCA]. Mediana e quartis ficam null nos meses abaixo da cobertura
 * mínima (80% do maior n mensal); a mediana real fica null sem índice do mês.
 */
export type PontoEvolucao = [string, number, number | null, number | null, number | null, number | null];

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
  /** Componentes com CDE no código (subconjunto de `encargos`; não somar aos grupos). */
  cde: number | null;
  cde_pct: number | null;
  fecha_com_total: boolean;
  confere_com_tarifas: boolean;
  codigos_sem_grupo: string[];
};

export type Composicao = {
  grupos: { id: GrupoComponenteId; rotulo: string; componentes: { codigo: string; descricao: string | null }[] }[];
  classificacao: string;
  mediana_rs_mwh: PorGrupo<number | null>;
  cde: { mediana_rs_mwh: number | null; mediana_pct: number | null; n: number; codigos: string[]; nota: string };
  distribuidoras: ComposicaoDistribuidora[];
  reconciliacao: {
    conferidas: number;
    divergentes: { sigla: string | null; te_tarifas: number | null; te_componentes: number | null; tusd_tarifas: number | null; tusd_componentes: number | null }[];
    sem_componentes: (string | null)[];
    /** Repetições da mesma componente, vigência e ato nos arquivos anuais (contadas na ingestão). */
    duplicatas_fonte: { iguais: number; conflitantes: number; arquivos_com_conflito: { arquivo: string; n: number }[]; regra: string };
  };
  excluidos: string[];
  proveniencia: Proveniencia;
  /** Participação dos encargos na distribuidora mais próxima da mediana; null sem componentes. */
  evidencia: Evidencia | null;
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
  /** Caso residencial de 150 kWh na distribuidora de referência com a bandeira do mês; null sem bandeira ou tarifa. */
  evidencia: Evidencia | null;
};

/**
 * Último evento da tarifa B1 de cada distribuidora do ranking: [cnpj, sigla, data, ato,
 * variação % do total, IPCA % desde o evento anterior, mês inicial do IPCA, mês final].
 * Ordem: data mais recente primeiro. Histórico completo em `historico_url`.
 */
export type UltimoEvento = [string, string | null, string, string, number | null, number | null, string, string];

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
  distribuidoras: [string, string | null, number | null, number | null][];
};

export type Reajustes = {
  ultimos: UltimoEvento[];
  historico_url: string;
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
  /** Mediana da variação em 12 meses contra o IPCA; null sem IPCA. */
  evidencia: Evidencia | null;
  /** Efeito médio do processo tarifário: não integrado (motivo com a evidência do bloqueio). */
  efeito_medio: { disponivel: false; motivo: string };
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
  evidencia: Evidencia | null;
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
    total_vs_categorias: { comparacoes: number; divergem: number; maior_diferenca_rs: number; divergem_por_ano: Record<string, number> };
    /** Conferido na ingestão (o silver guarda só o montante Total). */
    total_vs_previsao_mais_ajuste: { comparacoes: number; divergem: number; nota?: string };
  };
  competencias_futuras_excluidas: number;
  proveniencia: Proveniencia;
  evidencia: Evidencia | null;
};

export type GrupoCdeId =
  | "tarifa_social"
  | "descontos_tarifarios"
  | "ccc_luz_para_todos"
  | "outras_despesas"
  | "quotas_tarifa"
  | "outras_receitas";

export type FinanciamentoCde = {
  anos: string[];
  ultimo_ano: string;
  grupos: { id: GrupoCdeId; tipo: "Despesa" | "Receita"; rotulo: string; definicao: string }[];
  /** Valores em R$ nominais alinhados com `anos`; null = sem valor publicado no ano. */
  rubricas: { tipo: "Despesa" | "Receita"; fonte: string; grupo: GrupoCdeId; valores: (number | null)[] }[];
  totais: {
    ano: string;
    despesa: number | null;
    receita: number | null;
    grupos: Record<GrupoCdeId, number | null>;
    quotas_pct: number | null;
    tarifa_social_pct: number | null;
    /** Despesa e receita publicadas iguais (tolerância de R$ 1). */
    fecha: boolean;
    rubricas_sem_valor: string[];
  }[];
  nota: string;
  comparacao_com_subsidios: string;
  proveniencia: Proveniencia | null;
  evidencia: Evidencia | null;
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
    /** JSON com o histórico por distribuidora (tipo HistoricoB1), carregado sob demanda. */
    historico_url: string;
    proveniencia: Proveniencia;
    proveniencia_evolucao: Proveniencia;
    evidencia_mediana: Evidencia;
  };
  composicao: Composicao;
  simulador: Simulador;
  reajustes: Reajustes;
  bandeiras: Bandeiras;
  subsidios: Subsidios;
  financiamento_cde: FinanciamentoCde | null;
  conflitos_fonte: {
    total: number;
    por_subclasse: { subgrupo: string; subclasse: string; base: "TA" | "BE"; n: number }[];
    /** Só os que afetam a tarifa residencial de aplicação exibida; lista completa no CSV. */
    b1_residencial: ConflitoFonte[];
    regra: string;
    download: string;
  };
  downloads: Download[];
  /** Limites físicos e de domínio conferidos antes de publicar; ressalvas visíveis (violação crítica vira stub). */
  validacao: { regras: string[]; ressalvas: string[] };
};

/* ---------- public/energia/series/conta_historico_b1.json ---------- */

/** [início, fim, ato, TE, TUSD, TE + TUSD] em R$/MWh, vigência resolvida sem sobreposição. */
export type VigenciaB1 = [string, string, string, number | null, number | null, number | null];

/**
 * [data, ato, mesmo ato, total antes, total depois, variação %, variação TE %,
 * variação TUSD %, IPCA % desde o evento anterior, mês inicial do IPCA, mês final].
 */
export type EventoB1 = [
  string,
  string,
  boolean,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  string,
  string,
];

export type HistoricoB1 = {
  gerado_em: string;
  data_referencia: string;
  unidade: string;
  distribuidoras: Record<string, { sigla: string | null; nome: string | null; vigencias: VigenciaB1[]; eventos: EventoB1[] }>;
};
