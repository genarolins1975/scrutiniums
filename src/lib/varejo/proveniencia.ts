import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import type { CuradoriaVarejo, GoldEmpresas, GoldSetor } from "./tipos";

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

/**
 * Proveniência de uma figura do ranking dos grupos: a origem é o documento do IRTT que a curadoria leu (endereço, páginas e
 * data da consulta). O documento é anual e o valor é o que a fonte publica; estimativa da fonte fica dita em `limitacoes`.
 */
export function provRanking(c: CuradoriaVarejo, o: { indicador: string; natureza: Natureza; unidade: string; formula?: string; transformacoes?: string[]; limitacoes?: string[]; download?: string }): Proveniencia {
  const f = c.ranking?.fonte;
  const ano = f?.exercicio ? String(f.exercicio) : "";
  return provenienciaMontada({
    indicador: o.indicador,
    natureza: o.natureza,
    orgao: "IRTT",
    dataset: `Top 300 do Varejo Brasileiro${f?.edicao ? `, edição ${f.edicao.replace(/\s*\(.*\)\s*$/, "")}` : ""}`,
    recurso: f?.paginas ? `páginas ${f.paginas}` : undefined,
    url: f?.url ?? "https://irtt.com.br",
    unidade: o.unidade,
    frequencia: "anual",
    inicio: ano,
    fim: ano,
    capturadoEm: f?.consultado_em ?? null,
    validadoEm: c.gerado_em,
    formula: o.formula ?? null,
    transformacoes: o.transformacoes ?? [],
    limitacoes: o.limitacoes ?? [],
    download: o.download ?? null,
    versaoPipeline: "pipeline/varejo/curadoria, materializada por scripts/materializar-varejo.mjs",
  });
}

/** Proveniência de uma figura das demonstrações das companhias abertas (CVM, DFP), montada da gold das empresas. */
export function provCvm(e: GoldEmpresas, o: { indicador: string; natureza: Natureza; unidade: string; inicio: string; fim: string; formula?: string; transformacoes?: string[]; limitacoes?: string[] }): Proveniencia {
  const f = e.fontes.dfp;
  return provenienciaMontada({
    indicador: o.indicador,
    natureza: o.natureza,
    orgao: f.orgao,
    dataset: f.nome,
    url: f.url,
    unidade: o.unidade,
    frequencia: "anual",
    inicio: o.inicio,
    fim: o.fim,
    capturadoEm: f.capturado_em,
    validadoEm: e.capturado_em,
    formula: o.formula ?? null,
    transformacoes: o.transformacoes ?? [],
    limitacoes: o.limitacoes ?? [],
    versaoPipeline: `${e.gerado_por}, versão ${e.versao}`,
    sha256: e.hash_dados,
  });
}
