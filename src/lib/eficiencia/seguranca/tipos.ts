/**
 * Contrato da gold do painel Segurança pública por UF (public/eficiencia/seguranca-publica/gold/seguranca.json),
 * gerada por pipeline/seguranca/gold.py. Os arrays seguem a ordem de `anos`.
 */

/** ok: valor publicado (zero incluído); incompleto e sem_registro: ausência, nunca zero; fora: o ano não existe na fonte; parcial: Brasil com UFs de fora. */
export type Situacao = "ok" | "incompleto" | "sem_registro" | "fora" | "parcial";

export type FonteId = "sinesp" | "sim" | "siconfi";
export type GrupoId = "letalidade" | "mulheres" | "patrimonio" | "resposta" | "qualidade" | "recursos";
export type Denominador = "populacao" | "mulheres" | null;

export type Indicador = {
  id: string;
  fonte: FonteId;
  grupo: GrupoId;
  titulo: string;
  unidade: string;
  denominador: Denominador;
  /** 100000 para taxa por 100 mil; 1 para valor por habitante */
  escala: number;
  base: "ocorrencia" | "residencia" | "governo_estadual";
  nome_na_fonte?: string;
  definicao?: string;
};

export type SerieUF = {
  n: (number | null)[];
  situacao: Situacao[];
  motivo: (string | null)[];
  taxa: (number | null)[] | null;
  posicao?: (number | null)[];
  diferenca?: (number | null)[];
  razao?: (number | null)[];
};

export type SerieBrasil = {
  n: (number | null)[];
  situacao: Situacao[];
  cobertura: number[];
  fora: string[][];
  taxa: (number | null)[] | null;
  variacao: (number | null)[];
  comparadas?: number[];
};

export type SeriePercentual = { pct: (number | null)[]; n?: (number | null)[]; externas?: (number | null)[]; situacao?: Situacao[]; cobertura?: number[] };

export type UF = { codigo: number; sigla: string; nome: string; regiao: string };

export type GoldSeguranca = {
  versao: string;
  hash_dados: string;
  capturado_em: string;
  anos: number[];
  ufs: UF[];
  regra_ausencia: { limiar_ano: number; prob_meses_zerados: number };
  fontes: {
    sinesp: {
      nome: string; pagina: string; notas: string; capturado_em: string; abrangencia: string; anos: number[];
      ano_parcial: { ano: number; meses: number } | null;
      arquivos: Record<string, { url: string; bytes: number; sha256: string; linhas: number; meses: number }>;
    };
    sim: {
      nome: string; pagina: string; notas_tecnicas: string; capturado_em: string; anos: number[];
      situacao: Record<string, "final" | "preliminar">; final_ate: number; extracao_final: string;
      extracao_preliminar: Record<string, string>; previas_fora: Record<string, { edicao: number; extracao: string }>;
    };
    siconfi: { nome: string; pagina: string; url: string; capturado_em: string; anos: number[]; conta: string; coluna: string };
    ibge: { nome: string; url: string; metodo: string; capturado_em: string; sha256: string };
  };
  indicadores: Indicador[];
  populacao: Record<string, { total: number[]; mulheres: number[] }>;
  series: Record<string, Record<string, SerieUF | SerieBrasil | SeriePercentual>>;
  policia_saude: Record<string, (number | null)[]>;
  ausencias: { indicador: string; uf: string; ano: number; situacao: "sem_registro" | "incompleto" }[];
};

export const BRASIL = "BR";
