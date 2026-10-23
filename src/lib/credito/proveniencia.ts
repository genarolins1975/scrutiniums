import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import type { GoldJuros, ModalidadeJuros } from "@/lib/credito/juros";

/** Serviço do Banco Central de onde pipeline/juros.py lê as taxas por instituição (txjuros, portal Olinda). */
const URL_TXJUROS = "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo";

/**
 * Proveniência do kit de painel (a que a FiguraAnalitica e o "Sobre este dado" leem) para as consultas de juros do Crédito, montada
 * do que a gold juros.json registra: a fonte, os conceitos, a janela da modalidade e a data de processamento. A gold não guarda
 * captura separada nem hash do original; a limitação diz isso, e a data mostrada como captura e validação é a do processamento.
 */
export function provenienciaJuros(gold: GoldJuros, m: ModalidadeJuros, { indicador, natureza, formula = null }: { indicador: string; natureza: Natureza; formula?: string | null }): Proveniencia {
  const conceitos = Object.values(gold.conceitos);
  return {
    indicador,
    natureza,
    fonte: {
      orgao: "Banco Central do Brasil",
      dataset: "Taxas de juros por instituição financeira e modalidade (txjuros)",
      recurso: "Portal de dados abertos Olinda, TaxasJurosDiariaPorInicioPeriodo",
      url_dataset: URL_TXJUROS,
      url_primaria: URL_TXJUROS,
      licenca: "Dados abertos do Banco Central do Brasil, uso livre com citação da fonte",
    },
    unidade: "% ao ano",
    frequencia: "semanal (janelas de cinco dias úteis)",
    periodo_referencia: { inicio: m.janela.inicio, fim: m.janela.fim },
    publicado_pela_fonte_em: null,
    capturado_em: gold.gerado_em,
    validado_em: gold.gerado_em,
    cobertura_historica: { inicio: m.janela.inicio, fim: m.janela.fim },
    transformacoes: conceitos,
    formula,
    snapshot: { id: null, sha256: null },
    versao_pipeline: "pipeline/juros.py",
    versao_codigo: null,
    revisoes_conhecidas: null,
    limitacoes: [
      "Taxa de juros não é o CET: tarifas, seguros e tributos ficam fora.",
      "A gold de juros não registra captura separada nem o hash do arquivo original; a data de captura e de validação mostrada é a do processamento da publicação.",
    ],
    download: null,
    notas_fonte: gold.fonte,
  };
}
