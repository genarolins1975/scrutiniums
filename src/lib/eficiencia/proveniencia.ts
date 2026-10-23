import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

/**
 * Proveniência no contrato do kit de painel (src/lib/painel/tipos.ts) a partir do que a Eficiência Estatal já publica em cada base:
 * ficha do indicador, fonte com página oficial e data de captura, fórmula, transformações e ressalvas. A FiguraAnalitica exige uma
 * proveniência para o rodapé de fonte e o diálogo "Sobre este dado"; as bases do OBEE não têm o arquivo de proveniência do Setor
 * Elétrico, e esta função só reorganiza os campos que existem, sem inventar nenhum: o que a base não traz fica `null` (o diálogo
 * escreve "não informado pela fonte") ou com a regra declarada da base (a cobertura histórica é o período publicado).
 *
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o mesmo adaptador serve a todas as páginas do OBEE que migram.
 */
export type OrigemObee = {
  /** Nome do indicador como a página o mostra. */
  indicador: string;
  natureza: Natureza;
  /** Órgão produtor ("MDS", "IBGE", "Ministério da Saúde"). */
  orgao: string;
  /** Conjunto de dados ("Censo SUAS 2025", "PNAD Contínua"). */
  dataset: string;
  /** Arquivo, tabela ou variável lida, quando a base registra. */
  recurso?: string;
  /** Página oficial do conjunto. */
  url: string;
  /** Arquivo baixado da fonte, quando diferente da página. */
  urlPrimaria?: string;
  licenca?: string;
  unidade: string;
  frequencia: string;
  /** Início e fim do período de referência: "2025", "2025-08", "2025-08-31" (nunca exibidos crus: a figura e o diálogo formatam). */
  inicio: string;
  fim: string;
  /** Cobertura histórica publicada; padrão: o próprio período de referência. */
  cobertura?: { inicio: string; fim: string };
  publicadoEm?: string | null;
  capturadoEm?: string | null;
  /** Data da última validação da base; padrão: a captura ou o fim do período. */
  validadoEm?: string | null;
  transformacoes?: readonly string[];
  formula?: string | null;
  limitacoes: readonly string[];
  /** Arquivo da série completa (rota fechada). */
  download?: string | null;
  notas?: string | null;
  versao?: string;
};

export function provenienciaObee(o: OrigemObee): Proveniencia {
  return {
    indicador: o.indicador,
    natureza: o.natureza,
    fonte: {
      orgao: o.orgao,
      dataset: o.dataset,
      recurso: o.recurso ?? o.dataset,
      url_dataset: o.url,
      url_primaria: o.urlPrimaria ?? o.url,
      licenca: o.licenca ?? "Dados abertos publicados pela fonte oficial",
    },
    unidade: o.unidade,
    frequencia: o.frequencia,
    periodo_referencia: { inicio: o.inicio, fim: o.fim },
    publicado_pela_fonte_em: o.publicadoEm ?? null,
    capturado_em: o.capturadoEm ?? null,
    validado_em: o.validadoEm ?? o.capturadoEm ?? o.fim,
    cobertura_historica: o.cobertura ?? { inicio: o.inicio, fim: o.fim },
    transformacoes: [...(o.transformacoes ?? [])],
    formula: o.formula ?? null,
    snapshot: { id: null, sha256: null },
    versao_pipeline: o.versao ?? "Eficiência Estatal",
    versao_codigo: null,
    revisoes_conhecidas: null,
    limitacoes: [...o.limitacoes],
    download: o.download ?? null,
    notas_fonte: o.notas ?? null,
  };
}
