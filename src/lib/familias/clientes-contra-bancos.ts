/**
 * Leitura da gold de litigiosidade bancária (public/obs/data/gold/judicial.json) para o painel "Clientes contra bancos na
 * Justiça" do Observatório das Famílias. Só servidor. A página nova mostra os mesmos valores da vista antiga
 * (renderJudicial, em public/obs/app.js): nada é escrito à mão e as três contas que a vista antiga fazia no navegador
 * (soma dos registros do ramo, registros por caso do ramo e contagem de tribunais do ramo) ficam aqui, iguais.
 *
 * A base tem data própria: a gold declara `coletado_em` e `gerado_em`, e a publicação está retida na última versão íntegra
 * desde 24/09/2026 (OPERACOES.md, correção 14 de 17/10/2026). A página escreve a data da gold, nunca a do dia.
 */
import { lerPublico, mesAno } from "@/lib/perguntas/leitura";
import { datasLegiveis } from "@/lib/painel/formato";
import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

export const ROTA_CLIENTES_CONTRA_BANCOS = "/divida-das-familias/clientes-contra-bancos";
export const TITULO_CLIENTES_CONTRA_BANCOS = "Clientes contra bancos na Justiça";
export const PERGUNTA_CLIENTES_CONTRA_BANCOS = "Quanto o Judiciário é acionado em temas bancários?";
export const DESCRICAO_CLIENTES_CONTRA_BANCOS =
  "Processos sobre contratos bancários, indenizações e garantias em 15 tribunais (CNJ, DataJud) e os bancos entre os dez maiores litigantes do TST, em duas bases que não se cruzam, com a data real de cada uma.";
export const SECAO_CLIENTES_CONTRA_BANCOS = "familias:clientes-contra-bancos";

/** Endereços das fontes: o do DataJud é o que a gold de cobrança publica; o do TST é o do coletor (pipeline/sources/judicial.py). */
export const URL_DATAJUD = "https://api-publica.datajud.cnj.jus.br/";
export const URL_TST = "https://www.tst.jus.br/web/estatistica/tst/ranking-das-partes";

export type Ramo = "civel" | "trabalhista";
export const RAMOS: readonly Ramo[] = ["civel", "trabalhista"];
export const NOME_RAMO: Record<Ramo, string> = { civel: "Justiça comum (cível)", trabalhista: "Justiça do Trabalho" };

export type Categoria = { ramo: Ramo; categoria: string; rotulo: string; registros: number; casos_unicos: number; razao_reg_caso: number; part: number };
export type Assunto = { ramo: Ramo; categoria: string; codigo: number; nome: string; registros: number; casos_unicos: number };
export type Tribunal = { tribunal: string; ramo: Ramo; uf: string | null; casos_unicos: number; registros: number; por_categoria: Record<string, number | undefined> };
export type Litigante = {
  posicao: number;
  parte: string;
  processos: number;
  eh_if: boolean;
  cod_if: string | null;
  confianca: string;
  /** Parcela da parte nos casos novos dos dez maiores, em %. */
  part_top10: number | null;
  entidade_escala: string | null;
  por_100bi_ativo: number | null;
};
export type ItemCatalogo = { id: string; nome: string; definicao: string; formula: string; unidade: string; fonte: string; cobertura: string; limitacoes: string };

export type GoldJudicial = {
  disponivel: true;
  gerado_em: string;
  coletado_em: string;
  aviso_permanente: string;
  limitacao_central: string;
  camada_nacional: {
    fonte: string;
    tribunais: Tribunal[];
    n_tribunais: number;
    categorias: Categoria[];
    assuntos: Assunto[];
    cats_civel: string[];
    cats_trabalhista: string[];
    total_civel_casos: number;
    total_trabalhista_casos: number;
    nota_temporal: string;
    nota_polo: string;
  };
  camada_nominal: { fonte: string; competencia: string | null; linhas: Litigante[]; n_ifs: number; data_escala: string | null; cobertura: string };
  denominadores_indisponiveis: { metrica: string; motivo: string }[];
  catalogo: ItemCatalogo[];
  privacidade: string;
};

export type Indisponivel = { disponivel: false; motivo: string };

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
/** A gold inteira, ou a indisponibilidade declarada por ela (o builder grava um stub com o motivo quando falta tribunal). */
export function goldJudicial(): GoldJudicial | Indisponivel {
  let g: any;
  try {
    g = lerPublico("obs", "data", "gold", "judicial.json");
  } catch {
    return { disponivel: false, motivo: "A base de ações judiciais não está nesta publicação do site." };
  }
  if (!g || !g.disponivel) return { disponivel: false, motivo: prosa(String(g?.motivo ?? g?.error ?? "A fonte não publicou a base nesta execução.")) };
  return g as GoldJudicial;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Texto da gold na forma da página: o travessão usado como pontuação vira ponto e vírgula, o intervalo de anos com meia-risca
 * vira "a", a sigla IF sai por extenso e data ISO solta vira data brasileira. Nenhuma palavra de conteúdo muda.
 */
export function prosa(texto: string): string {
  return datasLegiveis(
    texto
      .replace(/\s+—\s+/g, "; ")
      .replace(/(\d)\s*–\s*(\d)/g, "$1 a $2")
      .replace(/\bISO-8601\b/g, "ISO 8601")
      .replace(/\bpela IF\b/g, "pela instituição financeira")
      .replace(/\bPELA instituição\b/g, "pela instituição")
      .replace(/\bNÃO\b/g, "não"),
    "pt",
  );
}

/** Nome de fonte da gold ("CNJ — API Pública do DataJud") com vírgula no lugar do travessão. */
export function nomeFonte(texto: string): string {
  return texto.replace(/\s+—\s+/g, ", ").replace(/\s+·\s+/g, ", ");
}

/** "2026-09-24T15:14:06+00:00" → "24/09/2026" (o dia em Brasília). */
export function diaBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10).split("-").reverse().join("/");
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "2026-09-24T15:14:06+00:00" → "2026-09-24" (o dia em Brasília), para os campos de período da proveniência. */
export function diaIso(iso: string): string {
  return diaBr(iso).split("/").reverse().join("-");
}

/** Data-base da escala como a gold grava ("202606") → "jun/2026"; ausência fica ausência. */
export function dataEscala(d: string | null): string | null {
  return d && /^\d{6}$/.test(d) ? mesAno(`${d.slice(0, 4)}-${d.slice(4, 6)}`) : null;
}

/** Competência do TST como publicada ("Junho de 2026"), em minúscula no meio da frase. */
export function competencia(c: string | null): string | null {
  return c ? c.charAt(0).toLowerCase() + c.slice(1) : null;
}

export type RecorteRamo = {
  ramo: Ramo;
  categorias: Categoria[];
  /** Ids das categorias na ordem que a gold declara para o ramo. */
  ordemCategorias: string[];
  assuntos: Assunto[];
  tribunais: Tribunal[];
  casos: number;
  /** Soma dos registros das categorias do ramo (a mesma conta da vista antiga). */
  registros: number;
  /** Registros ÷ casos únicos do ramo; null quando o ramo não tem caso (nunca zero). */
  registrosPorCaso: number | null;
};

export function recorteDoRamo(g: GoldJudicial, ramo: Ramo): RecorteRamo {
  const N = g.camada_nacional;
  const categorias = N.categorias.filter((c) => c.ramo === ramo);
  const casos = ramo === "civel" ? N.total_civel_casos : N.total_trabalhista_casos;
  const registros = categorias.reduce((s, c) => s + c.registros, 0);
  return {
    ramo,
    categorias,
    ordemCategorias: ramo === "civel" ? N.cats_civel : N.cats_trabalhista,
    assuntos: N.assuntos.filter((a) => a.ramo === ramo),
    tribunais: N.tribunais.filter((t) => t.ramo === ramo),
    casos,
    registros,
    registrosPorCaso: casos > 0 ? registros / casos : null,
  };
}

/** Rótulo de uma categoria como a gold o publica, com a sigla IF por extenso. */
export function rotuloCategoria(g: GoldJudicial, id: string): string {
  return prosa(g.camada_nacional.categorias.find((c) => c.categoria === id)?.rotulo ?? id);
}

const LIMITE_PARTES = "A API pública do DataJud não publica as partes: nenhum processo é atribuído a uma instituição.";

/** Proveniência da camada nacional (DataJud), montada do que a gold registra; o que ela não guarda sai como ausência. */
export function provenienciaNacional(g: GoldJudicial, o: { indicador: string; natureza: Natureza; unidade: string; formula?: string | null }): Proveniencia {
  const dia = diaIso(g.coletado_em);
  return provenienciaMontada({
    indicador: o.indicador,
    natureza: o.natureza,
    orgao: "CNJ",
    dataset: "DataJud, API pública",
    recurso: "Índices por tribunal, agregação por assunto das Tabelas Processuais Unificadas",
    url: URL_DATAJUD,
    licenca: "dados abertos do CNJ (chave pública)",
    unidade: o.unidade,
    frequencia: "acervo acumulado do índice, sem recorte temporal",
    inicio: dia,
    fim: dia,
    capturadoEm: g.coletado_em,
    validadoEm: g.gerado_em,
    transformacoes: ["Contagem de processos distintos pelo número único do CNJ, por assunto e tribunal.", "Agrupamento dos assuntos em categorias por natureza da ação."],
    formula: o.formula ?? null,
    limitacoes: [
      LIMITE_PARTES,
      prosa(g.camada_nacional.nota_temporal),
      "A publicação desta base está retida na última versão íntegra: a data de referência é a da coleta, não a de hoje.",
      "A gold não registra o hash dos arquivos de origem.",
    ],
    versaoPipeline: "pipeline/judicial.py",
    notas: nomeFonte(g.camada_nacional.fonte),
  });
}

/** Proveniência da camada nominal (ranking do TST, com a escala do IF.data quando o indicador é normalizado). */
export function provenienciaNominal(g: GoldJudicial, o: { indicador: string; natureza: Natureza; unidade: string; formula?: string | null }): Proveniencia {
  const dia = diaIso(g.coletado_em);
  return provenienciaMontada({
    indicador: o.indicador,
    natureza: o.natureza,
    orgao: "TST",
    dataset: "Ranking das Partes",
    recurso: `Dez maiores litigantes em casos novos, competência ${g.camada_nominal.competencia ?? "não informada"}`,
    url: URL_TST,
    unidade: o.unidade,
    frequencia: "mensal (competência publicada pelo tribunal)",
    inicio: dia,
    fim: dia,
    capturadoEm: g.coletado_em,
    validadoEm: g.gerado_em,
    transformacoes: ["Identificação manual das partes que são instituições financeiras, com o grau de confiança declarado por linha."],
    formula: o.formula ?? null,
    limitacoes: [prosa(g.camada_nominal.cobertura), "A data de referência mostrada é a da coleta; a competência do ranking é a publicada pelo TST."],
    versaoPipeline: "pipeline/judicial.py",
    notas: nomeFonte(g.camada_nominal.fonte),
  });
}

/** CSV dos assuntos, com as mesmas colunas e o mesmo separador do arquivo da vista antiga (judCSV). */
export function csvAssuntos(g: GoldJudicial): string {
  const linhas = g.camada_nacional.assuntos.map((a) => [a.ramo, a.categoria, a.codigo, `"${a.nome.replace(/"/g, '""')}"`, a.casos_unicos, a.registros].join(";"));
  return `﻿ramo;categoria;codigo_tpu;assunto;casos_unicos;registros\n${linhas.join("\n")}`;
}
