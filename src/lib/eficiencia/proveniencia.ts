import type { FichaExibivel } from "@/lib/eficiencia/tipos";
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

/** Fonte como as bases das capitais (Saúde, Educação) a entregam ao navegador: nome legível, páginas oficiais e data da captura. */
export type FonteFicha = { nome: string; url: string; capturado_em: string; orgao?: string; conjunto?: string };

/**
 * Proveniência de uma medida das capitais a partir da ficha do catálogo (a mesma que o diálogo "Sobre este dado" do OBEE mostra) e
 * das fontes da base: órgão e conjunto da primeira fonte citada pela ficha, a página oficial, a última captura, a fórmula, as
 * transformações e as ressalvas. O período é o da medida mostrada pela figura.
 */
export function provenienciaDaFicha(
  f: FichaExibivel,
  fontes: Record<string, FonteFicha>,
  periodo: { inicio: string; fim: string; cobertura?: { inicio: string; fim: string } },
): Proveniencia {
  const citadas = f.fontes.map((id) => fontes[id]).filter((x): x is FonteFicha => !!x);
  const principal = citadas[0];
  const capturas = citadas.map((x) => x.capturado_em).filter(Boolean).sort();
  // o nome legível vem como "Órgão, conjunto" ("Siconfi, DCA Anexo I-E"): a figura agrupa a fonte por órgão
  // quando a base separa instituição e conjunto (Educação), valem os dois campos
  const nome = principal?.nome ?? f.fontes.join(", ");
  const orgao = principal?.orgao ?? nome.split(", ")[0];
  return provenienciaObee({
    indicador: f.nome,
    natureza: f.natureza,
    orgao,
    dataset: principal?.conjunto ?? (nome.slice(orgao.length + 2) || f.localizacao_registro),
    recurso: [f.localizacao_registro, ...citadas.slice(1).map((x) => x.nome)].join("; "),
    url: principal?.url.split(" ")[0] ?? "",
    unidade: f.unidade,
    frequencia: f.periodo,
    inicio: periodo.inicio,
    fim: periodo.fim,
    cobertura: periodo.cobertura,
    capturadoEm: capturas.at(-1) ?? null,
    transformacoes: f.transformacoes,
    formula: f.formula,
    limitacoes: [...f.o_que_nao_mede, ...f.ressalvas],
    download: f.download,
    notas: f.o_que_mede,
    versao: f.versao_metodologica,
  });
}

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
