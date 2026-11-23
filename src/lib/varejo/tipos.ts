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

export type PeriodoEmpresa = {
  exercicio: number;
  data_base: string;
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
  [campo: string]: unknown;
};

export type EmpresaGold = {
  nome: string;
  cd_cvm: string;
  cnpj: string;
  denominacao_cvm: string;
  anuais: PeriodoEmpresa[];
  ultimo_trimestre?: Record<string, unknown> | null;
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
};

export type RankingCuradoria = {
  fonte: FonteCuradoria & { exercicio?: number; metodologia?: string; conceito_venda?: string };
  grupos: GrupoRanking[];
  soma_top300_milhoes?: number | null;
};

export type SegmentoCuradoria = {
  slug: string;
  nome: string;
  atividades_pmc: string[];
  classes_pac?: string[];
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

export type SegmentosCuradoria = { segmentos: SegmentoCuradoria[]; ecommerce?: { texto?: string; fonte?: FonteCuradoria } };

export type FichaCuradoria = { slug: string; grupo: string; resumo?: string; [campo: string]: unknown };

/** O arquivo único que as páginas leem. Parte ausente na curadoria fica null: a página diz "em apuração". */
export type CuradoriaVarejo = {
  gerado_em: string | null;
  ranking: RankingCuradoria | null;
  segmentos: SegmentosCuradoria | null;
  fichas: Record<string, FichaCuradoria>;
  /** Arquivos da curadoria que o materializador recusou, com o motivo (não entram nas páginas). */
  recusados: { arquivo: string; motivo: string }[];
};
