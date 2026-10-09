import type { FichaExibivel, ReferenciaExternaSaude, StatusDado } from "./tipos";

/** Tipos do payload que a página entrega ao navegador. Arquivo seguro para o cliente: não lê disco. */

export const GRUPOS_REF = ["todas", "N", "NE", "SE", "S", "CO"] as const;

/** [indicador, capital, ano, componente, valor, estado, nota, participação, elegível, nota material, situação, motivo, quebra, numerador, denominador, extra] */
export type ObsC = [number, number, number, number, number | null, number, number, number | null, 0 | 1, 0 | 1, number, number, 0 | 1, number | null, number | null, number | null];
/** [indicador, componente, ano, grupo, capitais no grupo, com valor, n, média, mediana, mínimo, máximo, q1, q3, quartis exibidos, soma num., soma den., razão agregada, capitais do mínimo, capitais do máximo] */
export type RefC = [number, number, number, number, number, number, number, number | null, number | null, number | null, number | null, number | null, number | null, 0 | 1, number | null, number | null, number | null, number[], number[]];

export type CapitalSaude = { id: string; cod: number; nome: string; uf: string; regiao: string };

export type DadosSaude = {
  capitais: CapitalSaude[];
  regioes: Record<string, string>;
  indicadores: string[];
  componentes: string[];
  status: StatusDado[];
  notas: string[];
  situacoes: string[];
  obs: ObsC[];
  refs: RefC[];
  externas: ReferenciaExternaSaude[];
  fichas: (FichaExibivel & { motivo_nao_publicacao?: string[] })[];
  rotulos: { subfuncoes: Record<string, string>; natureza: Record<string, string>; fontes: Record<string, string>; grupos: Record<string, string>; equipes: Record<string, string>; ubs: Record<string, string> };
  /** fontes citadas pelas fichas: nome legível, endereço e data da última captura (para as exportações, que precisam servir fora do site) */
  fontes: Record<string, { nome: string; url: string; capturado_em: string }>;
  /** base da população do exercício (estimativa anterior ao Censo, Censo 2022, estimativa posterior), por ano */
  basePopulacional: Record<number, string>;
  meta: { gerado_em: string; dados_capturados_ate: string; hash_dados: string; versao_catalogo: string };
};

