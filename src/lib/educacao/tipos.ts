/**
 * Contrato da gold do painel Educação nos municípios (pipeline/educacao/gold.py, public/educacao/gold). Listas anuais
 * alinhadas a `anos` (2005 a 2025, de dois em dois); `meta` alinhada a `anos_meta` (2007 a 2021, o primeiro ciclo).
 * null é ausência publicada pelo INEP ("-" ou "ND"), nunca zero.
 */
export type Etapa = "ai" | "af";
export const ETAPAS: readonly Etapa[] = ["ai", "af"];
export type Rede = "municipal" | "publica";

export type Motivo = "sem_matricula" | "nao_divulgado" | "participacao" | "a_pedido" | "extravio" | "sem_aprovacao" | "sem_saeb";
export const MOTIVOS: readonly Motivo[] = ["sem_matricula", "nao_divulgado", "participacao", "a_pedido", "extravio", "sem_aprovacao", "sem_saeb"];

/** Marcas do INEP na nota do Saeb do ano (ND: participação insuficiente; *: média das avaliações estaduais; **: participação abaixo de 50%). */
export type Marca = "ND" | "ND*" | "ND***" | "*" | "**" | null;

export type Serie = {
  ideb: (number | null)[];
  /** Nota média padronizada do Saeb, de 0 a 10. */
  n: (number | null)[];
  mat: (number | null)[];
  port: (number | null)[];
  /** Indicador de rendimento, de 0 a 1 (média harmônica das taxas de aprovação de cada ano escolar). */
  p: (number | null)[];
  /** Taxa de aprovação da etapa, em %. */
  aprov: (number | null)[];
  marca: Marca[];
  meta: (number | null)[];
};

export type BlocoEtapa = {
  municipal: Serie | null;
  publica: Serie | null;
  motivo_municipal: Motivo | null;
  motivo_publica: Motivo | null;
};

export const CAMPOS_CENSO = [
  "mat_total", "mat_publica", "mat_federal", "mat_estadual", "mat_municipal", "mat_privada", "mat_mun_rural",
  "creche_total", "creche_mun", "pre_total", "pre_mun",
  "ai_total", "ai_publica", "ai_mun", "af_total", "af_publica", "af_mun",
  "esc_total", "esc_publica", "esc_municipal", "esc_privada", "esc_mun_rural",
] as const;
export type CampoCenso = (typeof CAMPOS_CENSO)[number];
export type Censo = Record<CampoCenso, number>;

export type MunicipioGold = {
  id: string;
  nome: string;
  pop: number | null;
  porte: string | null;
  capital: boolean;
  ai: BlocoEtapa;
  af: BlocoEtapa;
  censo: Censo | null;
  analises: Record<Etapa, AnaliseSerie>;
  composicao_matriculas: ComposicaoMatriculas[];
};

export type ArquivoUf = {
  versao: string;
  uf: string;
  nome_uf: string;
  anos: number[];
  anos_meta: number[];
  censo_ano: number;
  municipios: MunicipioGold[];
};

export type Estatisticas = { n: number; min: number; p25: number; mediana: number; p75: number; max: number; faixas: number[] };

export type Porte = { id: string; rotulo: string; min: number; max: number | null; municipios: number };

type Arquivo = { url: string | null; sha256?: string | null; membro?: string | null; md5_publicado_inep?: string | null; modificado_em?: string | null };

export type GoldEducacao = {
  versao: string;
  gerado_por: string;
  capturado_em: string;
  referencia: string;
  hash_dados: string;
  fontes: {
    ideb: {
      orgao: string; nome: string; edicao: number; pagina: string; nota_informativa: string | null; capturado_em: string | null; publicado_em: string | null;
      /** Edição que o INEP declarou a última com a fórmula original do Ideb (nota informativa). */
      ultima_formula_original: number | null;
      arquivos: Record<"ai" | "af" | "ufs" | "brasil", Arquivo>;
      codigos_divergentes: Record<string, { coluna: number; esperado: string; codigo_na_fonte: string | null }[]>;
      notas_da_fonte: string[];
    };
    censo: {
      orgao: string; nome: string; edicao: number; pagina: string; capturado_em: string | null; publicado_em: string | null;
      url: string | null; sha256: string | null; membro: string | null; tabelas: Record<string, { aba: string; titulo: string }>;
    };
    populacao: { orgao: string; nome: string; ano: number; pagina: string; url: string | null; capturado_em: string | null };
  };
  ideb: {
    ano: number;
    anos: number[];
    anos_meta: number[];
    brasil: Record<Etapa, Record<Rede, Serie>>;
    ufs: Record<Etapa, Record<string, { publica: Serie }>>;
  };
  distribuicao: Record<Etapa, { ano: number; rede: "municipal"; brasil: Estatisticas; portes: Record<string, Estatisticas | null>; ufs: Record<string, Estatisticas | null> }>;
  metas: Record<Etapa, { ano: number; alcancou: number; nao_alcancou: number; sem_ideb: number; sem_meta: number }[]>;
  cobertura: Record<Etapa, Record<Rede, { com_ideb: number; motivos: Record<Motivo, number> }>>;
  censo: { ano: number; campos: CampoCenso[]; brasil: Censo; ufs: Record<string, Censo> };
  portes: Porte[];
  municipios: { total: number; por_uf: Record<string, number>; capitais: string[] };
};

/** Derivações publicadas pelo pipeline, sem cálculo analítico no navegador. */
export type MetaEdicao = { ano: number; estado: "alcancou" | "nao_alcancou" | "sem_ideb" | "sem_meta"; motivo: Motivo | null };
export type VariacaoIdeb = [inicio: number, fim: number, movimentoN: number, movimentoP: number, produtoInicial: number, produtoFinal: number, contribuicaoN: number | null, contribuicaoP: number | null];
export type AnaliseSerie = { metas: MetaEdicao[]; variacoes: VariacaoIdeb[] };
export type ComposicaoMatriculas = { etapa: "basica" | "creche" | "pre" | "ai" | "af"; total: number; partes: Partial<Record<"municipal" | "estadual" | "federal" | "privada" | "outras_publicas" | "demais_redes", number>> };
export type MapaEducacaoGold = { versao: string; ano: number; fonte: string; cobertura: Record<string, { total: number } & Record<Etapa, { com_ideb: number; motivos: Record<Motivo, number> }>>; municipios: { id: string; nome: string; uf: string; ai: number | null; af: number | null; motivo_ai: Motivo | null; motivo_af: Motivo | null }[] };
