import { rotuloSinisa } from "./edicao";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import { meta } from "@/lib/saneamento/gold";
import { ROTA } from "@/lib/saneamento/capitulos";
import { ACESSO_TARIFAS, TARIFAS } from "@/lib/saneamento/tarifas";

/**
 * Proveniência do kit de painel (a que a FiguraAnalitica e o "Sobre este dado" leem) para as figuras do Saneamento, montada do que o
 * observatório já registra: a meta da gold (SINISA, CadÚnico, com página, captura e sha256) e as tabelas tarifárias verificadas (atos,
 * data de consulta e sha256 de cada original). Nada aqui inventa dado; o que a gold não registra fica dito nas limitações. A gold do
 * Saneamento não guarda a hora da validação: a data mostrada como validação é a da captura, e a limitação diz isso.
 */

type Base = {
  indicador: string;
  natureza: Natureza;
  unidade: string;
  /** "AAAA", "AAAA-MM" ou "AAAA-MM-DD". */
  inicio: string;
  fim: string;
  formula?: string | null;
  transformacoes?: string[];
  limitacoes?: string[];
  download?: string | null;
};

const SEM_VALIDACAO = "A gold do Saneamento não registra a hora da validação; a data de validação mostrada é a da captura da fonte.";

function montar(
  b: Base,
  fonte: Proveniencia["fonte"],
  extra: { frequencia: string; capturado_em: string | null; publicado_pela_fonte_em?: string | null; snapshot: Proveniencia["snapshot"]; notas_fonte?: string | null },
): Proveniencia {
  const m = meta();
  return {
    indicador: b.indicador,
    natureza: b.natureza,
    fonte,
    unidade: b.unidade,
    frequencia: extra.frequencia,
    periodo_referencia: { inicio: b.inicio, fim: b.fim },
    publicado_pela_fonte_em: extra.publicado_pela_fonte_em ?? null,
    capturado_em: extra.capturado_em,
    validado_em: extra.capturado_em ?? "",
    cobertura_historica: { inicio: b.inicio, fim: b.fim },
    transformacoes: b.transformacoes ?? [],
    formula: b.formula ?? null,
    snapshot: extra.snapshot,
    versao_pipeline: m?.gerado_de ?? "pipeline/observatorio_saneamento",
    versao_codigo: null,
    revisoes_conhecidas: null,
    limitacoes: [...(b.limitacoes ?? []), SEM_VALIDACAO],
    download: b.download ?? null,
    notas_fonte: extra.notas_fonte ?? null,
  };
}

/** SINISA (Ministério das Cidades), com a planilha usada quando ela é uma só. */
export function provenienciaSinisa(b: Base & { planilha?: string }): Proveniencia {
  const s = meta()?.sinisa;
  const p = b.planilha ? s?.planilhas[b.planilha] : undefined;
  return montar(
    b,
    {
      orgao: "Ministério das Cidades",
      dataset: rotuloSinisa(),
      recurso: p ? `${p.arquivo}, aba ${p.aba}` : "Resultados do SINISA por prestador e município",
      url_dataset: s?.pagina ?? "",
      url_primaria: s?.pagina ?? "",
      licenca: "Dados abertos do governo federal, uso livre com citação da fonte (Decreto 8.777/2016)",
    },
    { frequencia: "anual", capturado_em: s?.capturado_em ?? null, publicado_pela_fonte_em: s?.publicacao ?? null, snapshot: { id: p?.zip ?? null, sha256: p?.sha256 ?? null } },
  );
}

/** CadÚnico (MDS, SAGI), famílias pelo critério de renda da Lei 14.898/2024, no mês de referência. */
export function provenienciaCadUnico(b: Base & { mes: string }): Proveniencia {
  const c = meta()?.cadunico;
  const arquivo = c?.meses[b.mes];
  return montar(
    b,
    {
      orgao: "MDS",
      dataset: c?.fonte ?? "CadÚnico",
      recurso: c?.criterio ?? "Famílias com renda per capita até meio salário-mínimo",
      url_dataset: c?.url ?? "",
      url_primaria: arquivo?.url ?? c?.url ?? "",
      licenca: "Dados abertos do governo federal, uso livre com citação da fonte (Decreto 8.777/2016)",
    },
    { frequencia: "mensal", capturado_em: c?.capturado_em ?? null, snapshot: { id: b.mes, sha256: arquivo?.sha256 ?? null } },
  );
}

/** Tabelas tarifárias verificadas nos atos dos reguladores (capítulo 5.1), cada ato com o original e o sha256 na ficha. */
export function provenienciaTarifas(b: Base): Proveniencia {
  const reguladores = Array.from(new Set(TARIFAS.map((t) => t.regulador))).sort((x, y) => x.localeCompare(y, "pt-BR"));
  return montar(
    b,
    {
      orgao: "Reguladores do saneamento",
      dataset: "Tabelas tarifárias verificadas nos atos",
      recurso: `${TARIFAS.length} tabelas de ${reguladores.join(", ")}; atos e originais com sha256 nas fichas do simulador`,
      url_dataset: `${ROTA}/preco-regulado/simulador#tabelas`,
      url_primaria: `${ROTA}/preco-regulado/simulador#tabelas`,
      licenca: "Atos oficiais publicados pelos reguladores e pelos prestadores",
    },
    { frequencia: "a cada ato de reajuste ou revisão", capturado_em: ACESSO_TARIFAS, snapshot: { id: null, sha256: null } },
  );
}
