import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import { fontesPorId, goldGas } from "./gold";

/**
 * Proveniência do kit de painel (a que a FiguraAnalitica e o "Sobre este dado" leem) a partir das fontes da meta do gás
 * (public/gas/gold/meta.json). Nada aqui inventa dado: órgão, conjunto, licença, frequência, captura e hash vêm da meta, e o que a
 * gold do gás não registra fica dito. A gold não guarda a hora da validação (o pipeline só a escreve depois de
 * validacoes.conferir); a data mostrada como validação é a da última captura integrada, e a limitação diz isso.
 */
export function provenienciaGas({
  fonte,
  indicador,
  natureza,
  unidade,
  inicio,
  fim,
  formula = null,
  transformacoes = [],
  limitacoes = [],
  download = null,
}: {
  /** Id da fonte na meta (anp_precos_estados, ibge_ipca). */
  fonte: string;
  indicador: string;
  natureza: Natureza;
  unidade: string;
  /** "AAAA-MM": o primeiro e o último mês da série desenhada. */
  inicio: string;
  fim: string;
  formula?: string | null;
  transformacoes?: string[];
  limitacoes?: string[];
  /** Arquivo da série (/gas/series/<id>.csv, com conta). */
  download?: string | null;
}): Proveniencia {
  const [f] = fontesPorId([fonte]);
  if (!f) throw new Error(`fonte do gás sem registro na meta: ${fonte}`);
  const meta = goldGas.meta();
  return {
    indicador,
    natureza,
    fonte: { orgao: f.orgao, dataset: f.conjunto, recurso: f.url ?? f.pagina, url_dataset: f.pagina, url_primaria: f.url ?? f.pagina, licenca: f.licenca },
    unidade,
    frequencia: f.frequencia,
    periodo_referencia: { inicio, fim },
    publicado_pela_fonte_em: null,
    capturado_em: f.capturado_em,
    validado_em: meta.dados_capturados_em ?? "",
    cobertura_historica: { inicio, fim },
    transformacoes: [...(f.recorte ? [`Recorte da fonte: ${f.recorte}.`] : []), ...transformacoes],
    formula,
    snapshot: { id: f.seed, sha256: f.sha256_original },
    versao_pipeline: meta.versao_pipeline,
    versao_codigo: meta.versao_codigo,
    revisoes_conhecidas: null,
    limitacoes: [
      ...limitacoes,
      "A gold do gás não registra a hora da validação; a data de validação mostrada é a da última captura integrada, e a gold só é escrita depois das conferências do pipeline.",
    ],
    download,
    notas_fonte: f.nota,
  };
}
