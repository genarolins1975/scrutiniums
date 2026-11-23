import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import type { GoldSetor } from "./tipos";

/**
 * Proveniência de uma figura da coleção Varejo, montada do que a gold publica de cada fonte (órgão, tabela, endereço e data de
 * captura). Nenhum número passa por aqui: só a descrição da origem que a FiguraAnalitica exige.
 */
export function provVarejo(
  g: GoldSetor,
  fonte: keyof GoldSetor["fontes"],
  o: { indicador: string; natureza: Natureza; unidade: string; frequencia: string; inicio: string; fim: string; formula?: string; transformacoes?: string[]; limitacoes?: string[]; download?: string },
): Proveniencia {
  const f = g.fontes[fonte];
  return provenienciaMontada({
    indicador: o.indicador,
    natureza: o.natureza,
    orgao: f.orgao,
    dataset: f.nome,
    recurso: f.tabela,
    url: f.url,
    unidade: o.unidade,
    frequencia: o.frequencia,
    inicio: o.inicio,
    fim: o.fim,
    capturadoEm: f.capturado_em,
    validadoEm: g.capturado_em,
    formula: o.formula ?? null,
    transformacoes: o.transformacoes ?? [],
    limitacoes: o.limitacoes ?? [],
    download: o.download ?? null,
    versaoPipeline: `${g.gerado_por}, versão ${g.versao}`,
    sha256: g.hash_dados,
  });
}
