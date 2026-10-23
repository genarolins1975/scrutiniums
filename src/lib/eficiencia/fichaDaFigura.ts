import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

/**
 * Ficha de proveniência ("Sobre este dado") de uma figura do molde de painel nos temas da Eficiência Estatal (Iniciativa 1 do parecer
 * de UX de 23/10/2026). A FiguraAnalitica exige a ficha completa do contrato de auditabilidade; os snapshots dos temas do OBEE guardam
 * só parte dela (arquivo, endereço, SHA-256, publicação e captura). Esta função monta a ficha com o que o snapshot traz e escreve a
 * ausência como ausência: licença não registrada vira o texto que diz isso, nunca uma licença presumida; publicação sem data fica null.
 *
 * A validação é a da captura: os snapshots do OBEE são conferidos pelo pipeline no momento em que são gerados, e não há outra data de
 * validação registrada.
 */
export type EntradaFicha = {
  indicador: string;
  natureza: Natureza;
  orgao: string;
  conjunto: string;
  /** Arquivo ou tabela lida. */
  recurso: string;
  /** Página do conjunto na fonte. */
  url: string;
  /** Arquivo baixado, quando difere da página. */
  urlArquivo?: string;
  licenca?: string;
  unidade: string;
  frequencia: string;
  /** Período de referência do dado: "2024", "2024-06", "2015" a "2024". */
  referencia: { inicio: string; fim: string };
  cobertura?: { inicio: string; fim: string };
  publicadoEm?: string | null;
  capturadoEm: string;
  sha256?: string | null;
  snapshot?: string | null;
  versao: string;
  transformacoes?: string[];
  formula?: string | null;
  limitacoes: string[];
  notas?: string | null;
};

export const LICENCA_NAO_REGISTRADA = "Não registrada no snapshot; consulte as condições de uso na página da fonte.";

export function fichaDaFigura(e: EntradaFicha): Proveniencia {
  return {
    indicador: e.indicador,
    natureza: e.natureza,
    fonte: {
      orgao: e.orgao,
      dataset: e.conjunto,
      recurso: e.recurso,
      url_dataset: e.url,
      url_primaria: e.urlArquivo ?? e.url,
      licenca: e.licenca ?? LICENCA_NAO_REGISTRADA,
    },
    unidade: e.unidade,
    frequencia: e.frequencia,
    periodo_referencia: e.referencia,
    publicado_pela_fonte_em: e.publicadoEm ?? null,
    capturado_em: e.capturadoEm,
    validado_em: e.capturadoEm,
    cobertura_historica: e.cobertura ?? e.referencia,
    transformacoes: e.transformacoes ?? [],
    formula: e.formula ?? null,
    snapshot: { id: e.snapshot ?? null, sha256: e.sha256 ?? null },
    versao_pipeline: e.versao,
    versao_codigo: null,
    revisoes_conhecidas: null,
    limitacoes: e.limitacoes,
    // os arquivos do OBEE saem por exportação do navegador ou por rota própria do tema, nunca pelo botão da ficha
    download: null,
    notas_fonte: e.notas ?? null,
  };
}
