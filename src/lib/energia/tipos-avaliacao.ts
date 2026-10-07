import type { Cabecalho, Proveniencia } from "./tipos";
import type { Evidencia } from "./evidencia";

/**
 * Formato de public/energia/gold/avaliacao.json (P071, seção 15 da especificação), escrito por
 * scripts/energia_avaliacao.py. Nota só existe com evidência medida ou revisão registrada;
 * dimensão sem teste fica "nao_avaliada" e não satisfaz o aceite.
 */

export type IdDimensao =
  | "didatismo"
  | "visual"
  | "navegacao"
  | "interatividade"
  | "acessibilidade"
  | "completude"
  | "correcao"
  | "rastreabilidade"
  | "atualidade"
  | "desempenho";

export type EstadoDimensao = "avaliada" | "nao_avaliada" | "nao_aplicavel";
export type Severidade = "critico" | "alto" | "medio" | "baixo";
export type TipoPagina = "home" | "painel" | "verbete" | "ficha" | "editorial";

export type NotaDimensao = {
  nota: number | null;
  /** Ponto de partida da nota: o menor teto aplicável (10 quando não há teto). */
  partida?: number;
  estado: EstadoDimensao;
  evidencias: string[];
  deducoes: { pontos: number; motivo: string }[];
  tetos: { valor: number; motivo: string }[];
  defeitos: { codigo: string; severidade: Severidade; descricao: string }[];
  /** Completude: fração de cada item da anatomia (0 a 1). */
  itens?: Record<string, number>;
  revisor?: string | null;
};

export type PaginaAvaliada = {
  rota: string;
  titulo: string | null;
  modulo: string | null;
  tipo: TipoPagina;
  amostra: boolean;
  nota_ponderada: number | null;
  completa: boolean;
  atende_meta: boolean;
  abaixo_da_meta: string[];
  defeitos: string[];
  golds: string[];
  dimensoes: Record<IdDimensao, NotaDimensao>;
};

export type DimensaoRubrica = {
  id: IdDimensao;
  nome: string;
  peso: number;
  fonte_da_nota: "revisao" | "medicao" | "evidencia_gold";
  evidencia: string;
  regras: string[];
  tetos: { valor: number | null; motivo: string }[];
};

export type ResumoDimensao = {
  avaliadas: number;
  nao_avaliadas: number;
  nao_aplicaveis: number;
  media: number | null;
  minimo: number | null;
  atendem_meta: number;
  meta: number;
};

export type ModuloAvaliado = {
  id: string;
  rotulo: string;
  paginas: number;
  rotas: string[];
  dimensoes: Record<IdDimensao, { media: number | null; minimo: number | null; avaliadas: number; nao_avaliadas: number }>;
  nota_ponderada: number | null;
  atendem_meta: number;
  completas: number;
};

export type PassoJornada = { descricao: string; resultado: "ok" | "falhou" | "nao_executado"; observado?: string };

export type JornadaExecutada = {
  id: string;
  titulo: string;
  perfil: string;
  largura: number;
  movel: boolean;
  resultado: "cumprida" | "interrompida" | "falhou";
  passos_ok: number;
  passos_total: number;
  cliques: number;
  duracao_ms: number;
  erros_console: string[];
  paginas_visitadas: string[];
  passos: PassoJornada[];
  atritos?: string[];
  limite?: string;
};

export type DefeitoAvaliacao = {
  id: string;
  severidade: Severidade;
  dimensao: string;
  descricao: string;
  n_paginas: number;
  paginas: string[];
  estado: "aberto" | "corrigido";
  chave: string;
};

export type RodadaRegistro = {
  id: string;
  data: string;
  versao_codigo: string;
  paginas: number;
  nota_ponderada_media: number | null;
  atendem_meta: number;
  defeitos: { chave: string; severidade: Severidade; dimensao: string; descricao: string; n_paginas: number }[];
  defeitos_por_severidade: Record<Severidade, number>;
  medias_por_dimensao: Record<string, number | null>;
  jornadas_cumpridas: number;
};

export type AvaliacaoGold = Cabecalho & {
  versao_rubrica: string;
  painel: "P071";
  rodada: {
    id: string;
    data_inspecao: string;
    inspecao_gerada_em: string | null;
    base: string | null;
    navegador: string | null;
    larguras: number[];
    modos: string[];
    rotas_medidas: number;
    rotas_construidas: number | null;
    familias: Record<string, number> | null;
    referencia_dos_dados: string | null;
    /** Correções que entraram no código depois da medição desta rodada e ainda não foram medidas. */
    corrigido_depois_da_medicao: string[];
  };
  metodo: { resumo: string; scripts: string[]; entradas: string };
  rubrica: {
    dimensoes: DimensaoRubrica[];
    metas: { geral: number; didatismo: number; visual: number };
    escala: string;
    estados: Record<EstadoDimensao, string>;
  };
  resumo: {
    paginas: number;
    completas: number;
    atendem_meta: number;
    nota_ponderada_media: number | null;
    por_dimensao: Record<IdDimensao, ResumoDimensao>;
    defeitos: { abertos: number; por_severidade: Record<Severidade, number>; corrigidos_desde_a_rodada_anterior: number };
    jornadas: { total: number; cumpridas: number; interrompidas: number; falhas: number };
    defeito_critico_conhecido: boolean;
  };
  modulos: ModuloAvaliado[];
  paginas: PaginaAvaliada[];
  jornadas: JornadaExecutada[];
  defeitos: DefeitoAvaliacao[];
  corrigidos: RodadaRegistro["defeitos"];
  /** Revisão visual e didática: método, revisores e os problemas que cada um viu em várias páginas. */
  revisao: { metodo: string | null; revisores: { id: string; escopo: string; paginas: number }[]; problemas_entre_paginas: Record<string, string[]> };
  rodadas: RodadaRegistro[];
  limites: string[];
  proveniencia: { avaliacao: Proveniencia };
  evidencias: { nota_media: Evidencia; atendem_meta: Evidencia; defeitos: Evidencia };
};
