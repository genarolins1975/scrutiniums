/**
 * Contratos das golds da coleção Varejo (Observatório da Economia): public/varejo/gold/setor.json (pipeline/varejo/setor.py),
 * public/varejo/gold/empresas.json (pipeline/varejo/empresas.py) e a curadoria materializada em
 * public/varejo/gold/curadoria.json (scripts/materializar-varejo.mjs, a partir de pipeline/varejo/curadoria; contrato em
 * pipeline/varejo/curadoria/ESQUEMA.md). Ausência é sempre null: nenhuma leitura troca null por zero.
 */

export type Universo = "restrito" | "ampliado";
export type Indicador = "volume" | "receita";
/** Variáveis da PMC: índice, índice com ajuste sazonal, mês contra mês anterior (com ajuste), contra o mesmo mês do ano anterior, no ano e em 12 meses. */
export type VariavelPmc = "indice" | "indice_sa" | "mm" | "aa" | "ano" | "m12";

export type SeriePmc = Record<VariavelPmc, (number | null)[]>;
export type BlocoPmc = Record<Indicador, SeriePmc>;

export type AtividadePmc = BlocoPmc & {
  nome: string;
  /** "restrito": entra no restrito e no ampliado; "ampliado": só no ampliado; "detalhe": subdivisão de outra atividade. */
  universo: Universo | "detalhe";
  parte_de: string | null;
};

export type FonteGold = { orgao: string; nome: string; tabela: string; url: string; capturado_em: string };

export type GrupoPac = {
  nome: string;
  receita_operacional_liquida: number | null;
  receita_liquida_revenda: number | null;
  valor_adicionado: number | null;
  pessoal_ocupado: number | null;
  unidades_locais: number | null;
  empresas: number | null;
  margem_comercializacao: number | null;
  taxa_margem: number | null;
  salarios: number | null;
  compras: number | null;
  estoque_final: number | null;
};

export type UfPac = {
  empresas: number | null;
  unidades_locais: number | null;
  receita_bruta_revenda: number | null;
  margem_comercializacao: number | null;
  pessoal_ocupado: number | null;
  salarios: number | null;
};

export type SerieMacro = { unidade: string; periodicidade?: string; valores: Record<string, number | null>; variacao_interanual_pct?: Record<string, number | null> };

export type GoldSetor = {
  versao: number;
  gerado_por: string;
  capturado_em: string;
  referencia: { pmc: string; pac: string };
  notas: { pmc_base: string; pmc_pesos: string; pac: string };
  fontes: Record<
    "pmc_restrito" | "pmc_ampliado" | "pmc_atividades" | "pac_geral" | "pac_porte" | "pac_formas" | "pac_uf" | "pnadc_massa" | "ipca" | "bcb_juros",
    FonteGold
  >;
  pmc: {
    meses: string[];
    brasil: Record<Universo, BlocoPmc>;
    ufs: Record<string, Record<Universo, BlocoPmc>>;
    atividades: Record<string, AtividadePmc>;
    ufs_atividades: { mes: string; dados: Record<string, Record<string, Partial<Record<Indicador, { aa?: number | null; m12?: number | null }>>>> };
  };
  pac: {
    ano: number;
    unidade_monetaria: string;
    grupos: Record<string, GrupoPac>;
    porte_varejo: { empresas_20mais?: number | null; pessoal_20mais?: number | null };
    formas_comercializacao_20mais: { forma: string; receita_bruta_revenda: number | null }[];
    ufs_varejo: Record<string, UfPac>;
  };
  macro: {
    massa_renda_real: SerieMacro;
    ipca_alimentacao_domicilio_12m: SerieMacro;
    ipca_geral_12m: SerieMacro;
    juros_credito_livre_pf: SerieMacro;
  };
  hash_dados: string;
};

/* ------------------------------------------------------------------ empresas (CVM) */

export type Ponte100 = {
  custo: number;
  despesas_operacionais: number;
  resultado_financeiro: number;
  ir_csll: number;
  descontinuadas_e_outros: number;
  lucro_liquido: number;
};

/** As rubricas de um período (um exercício anual ou um acumulado até o trimestre), como a gold as publica. */
export type Demonstracao = {
  base?: string;
  receita_liquida: number | null;
  custo: number | null;
  lucro_bruto: number | null;
  despesas_operacionais: number | null;
  ebit: number | null;
  resultado_financeiro: number | null;
  ir_csll: number | null;
  lucro_liquido: number | null;
  margem_bruta_pct?: number | null;
  margem_operacional_pct?: number | null;
  margem_liquida_pct?: number | null;
  ponte_100: Ponte100 | null;
  documento?: { versao?: number; recebido_em?: string; link?: string; denominacao?: string; cnpj?: string } | null;
  reapresentado_no_exercicio_seguinte?: { receita_liquida: number | null; lucro_liquido: number | null };
  caixa_operacional?: number | null;
  caixa_operacional_apos_convenio?: number | null;
  convenio_fornecedores_no_financiamento?: number | null;
  capex?: number | null;
  var_estoques?: number | null;
  var_fornecedores?: number | null;
  var_recebiveis?: number | null;
  divida_liquida_sem_arrendamento?: number | null;
  passivo_arrendamento?: number | null;
  estoques?: number | null;
  fornecedores?: number | null;
  operacoes_descontinuadas?: number | null;
  abre_despesas?: LinhaConta[];
  abre_financeiro?: LinhaConta[];
  abre_giro?: LinhaConta[];
  abre_financiamento?: LinhaConta[];
  [campo: string]: unknown;
};

export type PeriodoEmpresa = Demonstracao & { exercicio: number; data_base: string };

export type LinhaConta = { conta?: string; descricao?: string; valor?: number | null };

/** O acumulado do ano até o último trimestre entregue, contra o mesmo período do ano anterior. */
export type UltimoTrimestre = {
  data_base?: string;
  periodo?: string;
  atual?: Demonstracao | null;
  mesmo_periodo_ano_anterior?: Demonstracao | null;
  documento?: Demonstracao["documento"];
};

export type EmpresaGold = {
  nome: string;
  cd_cvm: string;
  cnpj: string;
  denominacao_cvm: string;
  anuais: PeriodoEmpresa[];
  ultimo_trimestre?: UltimoTrimestre | null;
};

export type GoldEmpresas = {
  versao: number;
  gerado_por: string;
  capturado_em: string;
  unidade: string;
  fontes: Record<"dfp" | "itr", { orgao: string; nome: string; url: string; capturado_em: string; exercicios: number[] }>;
  formulas: Record<string, string>;
  empresas: Record<string, EmpresaGold>;
  hash_dados: string;
};

/* ------------------------------------------------------------------ curadoria */

export type FonteCuradoria = { titulo?: string; nome?: string; url?: string; pagina?: string | number; periodo?: string; consultado_em?: string; edicao?: string };

export type GrupoRanking = {
  posicao: number;
  posicao_anterior: number | null;
  slug: string;
  grupo: string;
  bandeiras?: string[];
  segmento_irtt?: string;
  segmento?: string;
  vendas_milhoes: number | null;
  vendas_ano_anterior_milhoes?: number | null;
  crescimento_pct?: number | null;
  lojas?: number | null;
  funcionarios?: number | null;
  capital?: string;
  sede_uf?: string;
  natureza?: string;
  empresa_gold?: string | null;
  /** Campos que a curadoria acrescentou além do contrato mínimo; todos opcionais. */
  crescimento_pct_calculado?: number | null;
  lojas_ano_anterior?: number | null;
  funcionarios_ano_anterior?: number | null;
  estados?: string;
  n_estados?: number | null;
  /** Posição na hierarquia de fontes do IRTT (1 a 5; 5 é estimativa do instituto). */
  nota_fonte?: number | null;
  pagina?: number | string | null;
  nota?: string;
};

export type LiderSegmento = {
  segmento_irtt: string;
  lider: string;
  slug?: string | null;
  posicao_geral?: number | null;
  vendas_milhoes?: number | null;
  pagina?: number | string | null;
  natureza?: string;
  vendas_segmento_bilhoes?: number | null;
  empresas_no_segmento?: number | null;
  participacao_no_top300_pct?: number | null;
  nota?: string;
};

export type LinhaMarketplace = {
  posicao?: number;
  nome: string;
  segmento_irtt?: string;
  gmv_digital_2025_milhoes?: number | null;
  gmv_digital_2024_milhoes?: number | null;
  venda_de_sellers_2025_milhoes?: number | null;
  nota_fonte?: number | null;
  natureza?: string;
  pagina?: number | string | null;
};

export type Marketplaces = { tratamento?: string; pagina?: number | string; base?: string; unidade?: string; observacao_da_fonte?: string; lista?: LinhaMarketplace[]; legenda_marketplace?: string };

export type Conferencia = {
  fonte: string;
  edicao?: string;
  url?: string;
  pagina?: number | string;
  consultado_em?: string;
  conceito_faturamento?: string;
  o_que_confere?: string;
  valores_abras_reais?: Record<string, number>;
  divergencias?: { grupo?: string; valor_irtt?: number | null; valor_outra?: number | null; motivo?: string }[];
  nao_acessado?: string;
};

export type RankingCuradoria = {
  fonte: FonteCuradoria & { exercicio?: number; metodologia?: string; conceito_venda?: string; paginas?: string; unidade?: string; hierarquia_fontes?: Record<string, string>; nota_crescimento?: string };
  grupos: GrupoRanking[];
  soma_top300_milhoes?: number | null;
  soma_top300_nota?: { texto?: string; comparacao_ibge_citada_pela_fonte?: string };
  lideres_por_segmento?: LiderSegmento[];
  marketplaces?: Marketplaces;
  conferencias?: Conferencia[];
};

export type SegmentoCuradoria = {
  slug: string;
  nome: string;
  atividades_pmc: string[];
  classes_pac?: string[];
  /** Códigos dos grupos da PAC (chaves de `pac.grupos` na gold setorial) que correspondem ao segmento. */
  classes_pac_ids?: string[];
  equivalencia: "direta" | "parcial" | "sem_equivalencia";
  nota_equivalencia?: string;
  o_que_se_vende?: string;
  quem_compra?: string;
  canais?: string;
  o_que_determina_a_demanda?: string;
  onde_se_forma_a_margem?: string;
  concorrentes?: { nome: string; slug?: string | null; tipo?: string; fonte?: FonteCuradoria }[];
  indicador_operacional?: { nome: string; formula?: string; por_que?: string; empresas?: string[] };
  fontes?: FonteCuradoria[];
};

export type SegmentosCuradoria = { segmentos: SegmentoCuradoria[]; nota_geral?: { sustentacao_da_equivalencia?: string }; ecommerce?: { texto?: string; fonte?: FonteCuradoria } };

export type ValorOperacional = { periodo?: string; valor?: number | null; natureza?: string; nota?: string };
export type Operacional = { indicador: string; unidade?: string; nota?: string; valores?: ValorOperacional[]; fonte?: FonteCuradoria };
export type EventoFicha = { data?: string; tipo?: string; descricao?: string; fonte?: FonteCuradoria };

/** Ficha de um grupo (pipeline/varejo/curadoria/fichas/<slug>.json). Só `slug` e `grupo` são garantidos pelo materializador. */
export type FichaCuradoria = {
  slug: string;
  grupo: string;
  resumo?: string;
  controlador?: { nome?: string | null; nota?: string; fonte?: FonteCuradoria };
  capital?: string;
  empresa_gold?: string | null;
  bandeiras?: { nome: string; formato?: string; nota?: string }[];
  formatos?: string[];
  regioes?: { texto?: string; estados?: string[] };
  canais?: string[];
  clientes?: string;
  fontes_de_receita?: { nome: string; descricao?: string }[];
  concorrentes?: { nome: string; slug?: string | null }[];
  operacionais?: Operacional[];
  eventos?: EventoFicha[];
  alcance_do_dado?: string;
  analise?: { crescimento?: string; rentabilidade_caixa?: string; acompanhar?: { indicador?: string; reforca?: string; enfraquece?: string } };
  campos_sem_divulgacao?: string[];
  fontes?: FonteCuradoria[];
};

/** O arquivo único que as páginas leem. Parte ausente na curadoria fica null: a página diz "em apuração". */
export type CuradoriaVarejo = {
  gerado_em: string | null;
  ranking: RankingCuradoria | null;
  segmentos: SegmentosCuradoria | null;
  fichas: Record<string, FichaCuradoria>;
  /** Arquivos da curadoria que o materializador recusou, com o motivo (não entram nas páginas). */
  recusados: { arquivo: string; motivo: string }[];
};
