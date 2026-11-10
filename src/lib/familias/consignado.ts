/**
 * Leitura das golds do painel "Consignado e aposentados" (Observatório das Famílias, coleção Dívida e crédito das famílias). Só servidor.
 * A página mostra os valores de public/obs/data/gold/consignado.json como estão; da gold municipal (consignado_mun.json, 6,8 MB) o
 * servidor tira só o resumo do recorte padrão (os 25 maiores, as faixas de dependência e os 15 índices de sensibilidade), com as mesmas
 * regras da vista antiga (src/components/familias/consignado/camadas.ts). O arquivo municipal nunca entra no HTML.
 */
import { lerPublico } from "@/lib/perguntas/leitura";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import { RECORTE_PADRAO, faixasDependencia, maioresDaCamada, maioresSensibilidade, noRecorte, type Municipio } from "@/components/familias/consignado/camadas";

export const ROTA_CONSIGNADO = "/divida-das-familias/consignado";
export const SECAO_CONSIGNADO = "familias:divida:consignado";
export const PERGUNTA_CONSIGNADO = "O consignado pesa mais onde há mais aposentados?";
export const DESCRICAO_CONSIGNADO =
  "Crédito consignado, benefícios da Previdência e envelhecimento: o que é medido no país, por estado e por município, e o que é só estimativa.";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
export type GoldConsignado = any;

export type ResumoMunicipal = {
  /** Municípios no recorte padrão (todas as regiões, sem confiabilidade baixa). */
  base: number;
  maiores60: Municipio[];
  faixas: { rotulo: string; n: number }[];
  sensiveis: Municipio[];
};

export type DadosConsignado = {
  g: GoldConsignado;
  resumo: ResumoMunicipal;
  /** Marcos do painel de regulação ligados ao consignado que têm mês na série (os mesmos que a vista antiga marcava). */
  marcosRegulacao: { x: string; rotulo: string }[];
};

let cache: DadosConsignado | null = null;

export function dadosConsignado(): DadosConsignado {
  if (cache) return cache;
  const g = lerPublico("obs", "data", "gold", "consignado.json");
  if (!g?.ok) throw new Error("gold consignado.json indisponível");
  const municipios = lerPublico("obs", "data", "gold", g.municipios_arquivo ?? "consignado_mun.json").municipios as Municipio[];
  const base = municipios.filter((m) => noRecorte(m, RECORTE_PADRAO));
  let marcosRegulacao: DadosConsignado["marcosRegulacao"] = [];
  try {
    const r = lerPublico("obs", "data", "gold", "regulacao.json");
    if (r?.disponivel)
      marcosRegulacao = (r.marcos as any[])
        .filter((m) => m.serie_x && (m.paineis ?? []).includes("consignado"))
        .map((m) => ({ x: String(m.serie_x), rotulo: String(m.ato).replace(/\s*\(.*?\)/, "").replace(/^(Resolução|Resoluções)/, "Res.").slice(0, 24) }));
  } catch {
    // sem a gold de regulação, a série fica só com as mudanças de margem da própria gold do consignado
  }
  cache = { g, resumo: { base: base.length, maiores60: maioresDaCamada(base, "p60"), faixas: faixasDependencia(base), sensiveis: maioresSensibilidade(base) }, marcosRegulacao };
  return cache;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type FonteConsignado = "sgs" | "scr" | "censo" | "mps" | "txjuros" | "consumidor";

const FONTES: Record<FonteConsignado, { orgao: string; dataset: string; url: string; frequencia: string }> = {
  sgs: { orgao: "Banco Central do Brasil", dataset: "Sistema Gerenciador de Séries Temporais (SGS), crédito consignado por vínculo do tomador", url: "https://www3.bcb.gov.br/sgspub/", frequencia: "mensal" },
  scr: { orgao: "Banco Central do Brasil", dataset: "SCR.data, carteira de crédito por ocupação do tomador e unidade da federação", url: "https://dadosabertos.bcb.gov.br/dataset/scr_data", frequencia: "mensal" },
  censo: { orgao: "IBGE", dataset: "Censo Demográfico 2022, população por idade e rendimento domiciliar", url: "https://sidra.ibge.gov.br/", frequencia: "decenal" },
  mps: { orgao: "Ministério da Previdência Social", dataset: "Estatísticas Municipais da Previdência Social, benefícios emitidos", url: "https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/Dados-estatisticos-previdencia-social-e-inss/anuarios-da-previdencia-social", frequencia: "anual (posição de dezembro)" },
  txjuros: { orgao: "Banco Central do Brasil", dataset: "Taxas de juros por instituição financeira e modalidade", url: "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo", frequencia: "semanal (janelas de cinco dias úteis)" },
  consumidor: { orgao: "Secretaria Nacional do Consumidor", dataset: "consumidor.gov.br, reclamações da categoria de beneficiários do INSS", url: "https://www.consumidor.gov.br/", frequencia: "mensal" },
};

/**
 * Proveniência do kit de painel a partir do que a gold registra. A gold do consignado não guarda captura separada nem hash dos
 * arquivos originais: a data mostrada como captura e validação é a do processamento, e a limitação diz isso.
 */
export function provConsignado(
  g: GoldConsignado,
  fonte: FonteConsignado,
  d: { indicador: string; natureza: Natureza; unidade: string; inicio: string; fim: string; limitacoes: string[]; formula?: string; transformacoes?: string[] },
): Proveniencia {
  const f = FONTES[fonte];
  return {
    indicador: d.indicador,
    natureza: d.natureza,
    fonte: { orgao: f.orgao, dataset: f.dataset, recurso: f.dataset, url_dataset: f.url, url_primaria: f.url, licenca: "Dados públicos, uso livre com citação da fonte" },
    unidade: d.unidade,
    frequencia: f.frequencia,
    periodo_referencia: { inicio: d.inicio, fim: d.fim },
    publicado_pela_fonte_em: null,
    capturado_em: g.gerado_em,
    validado_em: g.gerado_em,
    cobertura_historica: { inicio: d.inicio, fim: d.fim },
    transformacoes: d.transformacoes ?? [],
    formula: d.formula ?? null,
    snapshot: { id: null, sha256: null },
    versao_pipeline: "gold consignado.json",
    versao_codigo: null,
    revisoes_conhecidas: null,
    limitacoes: [...d.limitacoes, "A gold do consignado não registra captura separada nem o hash dos arquivos originais; a data de captura e de validação mostrada é a do processamento da publicação."],
    download: null,
    notas_fonte: null,
  };
}
