/**
 * Espelho da gold do módulo Leilões (public/energia/gold/leiloes.json), escrita por
 * pipeline/energia/modulos/leiloes.py. Campo ausente é null e aparece como ausência.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Proveniencia } from "./tipos";

export type IdCategoria = "uhe" | "pch" | "eolica" | "solar" | "biomassa" | "gas" | "oleo" | "carvao";
export type IdSituacao = "operacao" | "construcao" | "nao_iniciada" | "encerrada" | "sem_registro" | "sem_ceg";
export type IdEntrada = "antes_do_leilao" | "ate_ano_a" | "depois_ano_a" | "sem_data";

/**
 * Agregado de um conjunto de vendas (mesma função `agrega` do pipeline). `empreendimentos` conta linhas do arquivo da ANEEL: cada
 * uma é uma venda, o empreendimento vencedor em um leilão; a mesma usina pode vender em vários leilões. `usinas_distintas` conta
 * núcleos de CEG distintos (linhas sem CEG ficam fora dessa contagem).
 */
export type Agregado = {
  empreendimentos: number;
  usinas_distintas?: number;
  energia_mwmed: number;
  mw: number;
  preco_medio: number | null;
  preco_medio_real: number | null;
  teto_medio: number | null;
  desagio_agregado_pct: number | null;
  sem_preco: number;
  investimento_rs_mi: number | null;
  investimento_real_rs_mi: number | null;
  investimento_rs_mi_por_mw: number | null;
  investimento_real_rs_mi_por_mw: number | null;
  com_investimento: number;
};

export type Quartis = { n: number; p25: number | null; mediana: number | null; p75: number | null; min: number | null; max: number | null };

export type Leilao = Agregado & {
  leilao: string;
  data: string;
  ano: string;
  nome: string | null;
  tipo: string;
  ano_a: number | null;
  por_categoria: Partial<Record<IdCategoria, number>>;
  situacao_mwmed: Record<IdSituacao, number>;
};

export type SituacaoAgregada = Record<IdSituacao, { empreendimentos: number; energia_mwmed: number; mw: number }>;

export type GrupoControle = {
  cnpj: string;
  nome: string | null;
  empreendimentos: number;
  usinas: number;
  energia_mwmed: number;
  leiloes: number;
  categorias: IdCategoria[];
  /** CNPJs da cadeia de controle das usinas do grupo, do topo para baixo (menor distância ao topo primeiro). */
  cadeia_cnpjs: string[];
};

export type LeiloesGold = Cabecalho & {
  referencias: {
    arquivo_gerado_em: string | null;
    publicado_pela_fonte_em: string | null;
    capturado_em: string | null;
    primeiro_leilao: string;
    ultimo_leilao: string;
    ipca_ate: string;
    ipca_desde: string;
    siga: string | null;
    atos: string | null;
    ralie: string | null;
    encerramentos_desde: string;
    leiloes_transmissao_ate: string | null;
  };
  regras: Record<"energia" | "preco" | "preco_real" | "desagio" | "zeros" | "situacao" | "ano_a" | "categoria", string>;
  cobertura: {
    linhas: number;
    leiloes: number;
    usinas_distintas: number;
    linhas_sem_ceg: number;
    tipos_presentes: { id: string; rotulo: string }[];
    anos: [number, number] | null;
    anos_sem_leilao_na_base: number[];
    lacunas_numeracao_ccee: Record<string, number[]>;
    descricao_fonte: string;
    ausentes: string;
  };
  categorias: { id: IdCategoria; rotulo: string }[];
  tipos: { id: string; rotulo: string; antecedencia: number | null }[];
  situacoes: { id: IdSituacao; rotulo: string; definicao: string }[];
  totais: Agregado & { usinas_distintas: number };
  leiloes: Leilao[];
  por_ano: (Agregado & { ano: string; leiloes: number; por_categoria: Record<IdCategoria, number>; por_tipo: Record<string, number> })[];
  por_categoria: (Agregado & {
    id: IdCategoria;
    rotulo: string;
    leiloes: number;
    primeiro: string;
    ultimo: string;
    primeiro_ano: (Agregado & { ano: string }) | null;
    ultimo_ano: (Agregado & { ano: string }) | null;
    desagio: Quartis;
    preco_real_quartis: Quartis;
  })[];
  preco_ano_categoria: (Agregado & { ano: string; categoria: IdCategoria; leiloes: number })[];
  por_tipo: (Agregado & { id: string; rotulo: string; leiloes: number })[];
  desagio: {
    geral: Quartis;
    zero: number;
    confere: number;
    nao_confere: { linha: number; leilao: string; empreendimento: string }[];
    valores: number[];
    /** Índice da categoria (ordem de `categorias`) de cada valor; 99 sem categoria. */
    categorias: number[];
    por_ano: (Quartis & { ano: string; agregado_pct: number | null })[];
  };
  por_uf: (Agregado & { uf: string; usinas: number; por_categoria: Partial<Record<IdCategoria, number>> })[];
  entrega: {
    total: SituacaoAgregada;
    por_categoria: { id: IdCategoria; situacao: SituacaoAgregada }[];
    por_tipo: { id: string; situacao: SituacaoAgregada }[];
    por_ano: { ano: string; situacao: SituacaoAgregada }[];
    entrada_vs_ano_a: Record<string, Record<IdEntrada, { empreendimentos: number; energia_mwmed: number }>>;
    operacao_com_ato_encerramento: number;
    ceg_repetido: { leilao: string; nucleo: number; empreendimentos: string[]; vencedoras: string[]; linhas: number[] }[];
    ralie_situacao_obra: Record<string, number>;
    nao_operando_fora_do_ralie: number;
  };
  vencedoras: {
    nomes_distintos: number;
    maiores: { nome: string | null; empreendimentos: number; energia_mwmed: number; leiloes: number; categorias: IdCategoria[] }[];
    regra: string;
  };
  grupos_controle: {
    regra: string;
    grupos_total: number;
    energia_vinculada_mwmed: number;
    maiores: GrupoControle[];
    demais: { grupos: number; empreendimentos: number; energia_mwmed: number };
    sem_vinculo: { id: string; rotulo: string; empreendimentos: number; energia_mwmed: number }[];
  } | null;
  transmissao: {
    lotes_contratados: number;
    lotes_com_rap: number;
    periodo: { inicio: string | null; fim: string | null };
    por_ano: {
      ano: string;
      lotes_contratados: number;
      rap_vencedora_rs_mi: number;
      rap_vencedora_real_rs_mi: number | null;
      rap_edital_rs_mi: number;
      investimento_rs_mi: number | null;
      investimento_real_rs_mi: number | null;
      desagio_agregado_pct: number | null;
      desagio_mediano_lote_pct: number | null;
      desagio_p25_pct: number | null;
      desagio_p75_pct: number | null;
    }[];
    desagio_lotes: Quartis;
    desagios: number[];
    lotes_desagio_zero: number;
    vencedores: { nome: string | null; lotes: number; rap_vencedora_real_rs_mi: number | null }[];
    vencedores_distintos: number;
    regra_desagio: string;
    regra_real: string;
  };
  ultimo_leilao: Leilao;
  insumos: { chave: string; arquivo: string; url: string; sha256: string; bytes: number; modulo: string; gerado_em: string | null }[];
  conferencias: {
    estruturantes_mwmed: { empreendimento: string; leilao: string; energia_mwmed: number; garantia_fisica_mwmed: number | null }[];
    desagio_publicado_confere: string;
    energia_acima_da_garantia_fisica: { linha: number; leilao: string; empreendimento: string; energia_mwmed: number; garantia_fisica_mwmed: number }[];
    zeros_tratados: { preco: number; garantia_fisica: number; investimento: number };
  };
  ressalvas: string[];
  downloads: { rotulo: string; url: string }[];
  proveniencia: Record<"resultado" | "preco_real" | "situacao" | "controle" | "transmissao", Proveniencia>;
  evidencias: Partial<Record<"energia_total" | "ultimo_preco" | "pct_operacao", Evidencia>>;
};

/** Arquivo leiloes_empreendimentos.json (dispersão sob demanda). */
export type PontosLeiloes = {
  gerado_em: string;
  ipca_ate: string;
  colunas: string[];
  categorias: IdCategoria[];
  situacoes: IdSituacao[];
  linhas: [string, string, string, number | null, string | null, number, number | null, number | null, number | null, number | null, number, string | null][];
};
