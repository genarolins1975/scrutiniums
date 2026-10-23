import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

/**
 * Proveniência montada a partir do que a gold de um domínio já publica (fonte, período, captura, ressalvas), para os painéis que
 * entram no molde (Iniciativa 1 do parecer de UX de 23/10/2026) sem que o pipeline do domínio escreva o bloco completo do Setor
 * Elétrico. A FiguraAnalitica exige uma proveniência por figura: aqui os campos que o domínio não tem saem como ausência declarada
 * (null, lista vazia, "não informado"), nunca inventados. Nenhum número passa por aqui; só a descrição da origem.
 */
export type OrigemMontada = {
  indicador: string;
  natureza: Natureza;
  /** Órgão e conjunto como o leitor os reconhece ("ANP", "Levantamento de Preços de Combustíveis"). */
  orgao: string;
  dataset: string;
  /** Recurso ou arquivo dentro do conjunto; padrão: o próprio conjunto. */
  recurso?: string;
  url: string;
  /** URL do arquivo primário, quando diferente da página do conjunto. */
  urlPrimaria?: string;
  licenca?: string;
  unidade: string;
  frequencia: string;
  /** AAAA, AAAA-MM ou AAAA-MM-DD (a figura escreve na forma da página). */
  inicio: string;
  fim: string;
  /** Cobertura da série inteira, quando a figura mostra só um recorte dela. */
  coberturaInicio?: string;
  coberturaFim?: string;
  capturadoEm?: string | null;
  publicadoEm?: string | null;
  /** Data em que a gold passou nas conferências do pipeline; padrão: a captura. */
  validadoEm?: string | null;
  transformacoes?: string[];
  formula?: string | null;
  limitacoes?: string[];
  download?: string | null;
  versaoPipeline?: string;
  versaoCodigo?: string | null;
  sha256?: string | null;
  notas?: string | null;
};

export function provenienciaMontada(o: OrigemMontada): Proveniencia {
  return {
    indicador: o.indicador,
    natureza: o.natureza,
    fonte: {
      orgao: o.orgao,
      dataset: o.dataset,
      recurso: o.recurso ?? o.dataset,
      url_dataset: o.url,
      url_primaria: o.urlPrimaria ?? o.url,
      licenca: o.licenca ?? "não informada pela fonte",
    },
    unidade: o.unidade,
    frequencia: o.frequencia,
    periodo_referencia: { inicio: o.inicio, fim: o.fim },
    publicado_pela_fonte_em: o.publicadoEm ?? null,
    capturado_em: o.capturadoEm ?? null,
    validado_em: o.validadoEm ?? o.capturadoEm ?? "",
    cobertura_historica: { inicio: o.coberturaInicio ?? o.inicio, fim: o.coberturaFim ?? o.fim },
    transformacoes: o.transformacoes ?? [],
    formula: o.formula ?? null,
    snapshot: { id: null, sha256: o.sha256 ?? null },
    versao_pipeline: o.versaoPipeline ?? "não informada",
    versao_codigo: o.versaoCodigo ?? null,
    revisoes_conhecidas: null,
    limitacoes: o.limitacoes ?? [],
    download: o.download ?? null,
    notas_fonte: o.notas ?? null,
  };
}
