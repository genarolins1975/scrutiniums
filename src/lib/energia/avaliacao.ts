import { dataBR, num, plural } from "./formato";
import type { ColunaTabela, LinhaTabela } from "./tabela";
import type {
  AvaliacaoGold,
  DefeitoAvaliacao,
  DimensaoRubrica,
  IdDimensao,
  ModuloAvaliado,
  NotaDimensao,
  PaginaAvaliada,
  Severidade,
  TipoPagina,
} from "./tipos-avaliacao";

/**
 * Derivações puras da página de avaliação dos painéis (P071): matriz de aceite, linhas das
 * tabelas, texto de resposta e ficha de evidência de cada nota. Nenhuma nota é calculada
 * aqui: notas, deduções e tetos vêm prontos de avaliacao.json (scripts/energia_avaliacao.py).
 * Este módulo não lê disco; a leitura da gold no build está em avaliacao-servidor.ts.
 *
 * Linguagem: a revisão visual e didática é de revisores em contexto limpo (agentes), e as
 * jornadas são roteiros executados por script. Nada aqui chama isso de teste com usuários.
 */

export const URL_AVALIACAO = "/energia/gold/avaliacao.json";

export const ORDEM_DIMENSOES: IdDimensao[] = [
  "didatismo",
  "visual",
  "navegacao",
  "interatividade",
  "acessibilidade",
  "completude",
  "correcao",
  "rastreabilidade",
  "atualidade",
  "desempenho",
];

export const ROTULO_CURTO: Record<IdDimensao, string> = {
  didatismo: "Didatismo",
  visual: "Visual",
  navegacao: "Navegação",
  interatividade: "Interatividade",
  acessibilidade: "Acessibilidade",
  completude: "Completude",
  correcao: "Correção",
  rastreabilidade: "Rastreabilidade",
  atualidade: "Atualidade",
  desempenho: "Desempenho",
};

export const ROTULO_TIPO: Record<TipoPagina, string> = {
  home: "Página inicial",
  painel: "Painel numérico",
  verbete: "Verbete (amostra)",
  ficha: "Ficha (amostra)",
  editorial: "Editorial",
};

export const ROTULO_SEVERIDADE: Record<Severidade, string> = { critico: "Crítico", alto: "Alto", medio: "Médio", baixo: "Baixo" };
export const ORDEM_SEVERIDADE: Severidade[] = ["critico", "alto", "medio", "baixo"];

export const ROTULO_RESULTADO_JORNADA = { cumprida: "Cumprida", interrompida: "Interrompida", falhou: "Falhou" } as const;

/** Faixas da matriz de aceite: acima de 9,0 cumpre a meta de produto; abaixo de 6,0 é defeito material. */
export const ESCALA_AVALIACAO = {
  limites: [6, 7.5, 9],
  cores: ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-5)"],
  rotulos: ["abaixo de 6,0", "de 6,0 a 7,4", "de 7,5 a 8,9", "9,0 ou mais"],
} as const;

export const metaDaDimensao = (a: AvaliacaoGold, id: IdDimensao): number => (id === "didatismo" ? a.rubrica.metas.didatismo : id === "visual" ? a.rubrica.metas.visual : a.rubrica.metas.geral);

/** "9,3", "não avaliada" ou "não se aplica": o estado nunca vira zero. */
export function textoNota(x: NotaDimensao): string {
  if (x.estado === "avaliada") return num(x.nota, 1);
  return x.estado === "nao_avaliada" ? "não avaliada" : "não se aplica";
}

export const dimensaoPorId = (a: AvaliacaoGold, id: IdDimensao): DimensaoRubrica => a.rubrica.dimensoes.find((d) => d.id === id)!;

export function pesoTotalAplicavel(p: PaginaAvaliada, a: AvaliacaoGold): number {
  return a.rubrica.dimensoes.filter((d) => p.dimensoes[d.id].estado === "avaliada").reduce((s, d) => s + d.peso, 0);
}

/* ------------------------------------------------------------------ resposta */

export function respostaAvaliacao(a: AvaliacaoGold): string {
  const r = a.resumo;
  const rod = a.rodada;
  const partes = [
    `Na rodada ${rod.id}, de ${dataBR(rod.data_inspecao)}, ${plural(r.paginas, "página foi medida", "páginas foram medidas")} em ${rod.larguras.length} larguras de tela e nos modos Entender e Auditar, e ${plural(r.jornadas.total, "jornada de usuário foi executada", "jornadas de usuário foram executadas")} por roteiro.`,
    `A nota ponderada média das páginas é ${num(r.nota_ponderada_media, 1)} em 10; ${plural(r.atendem_meta, "página atende", "páginas atendem")} à meta de produto (todas as dimensões a partir de 9,0, didatismo e qualidade visual a partir de 9,5, nenhuma dimensão aplicável sem avaliação e nenhum defeito crítico).`,
  ];
  const d = r.defeitos;
  partes.push(
    `${plural(d.abertos, "defeito está aberto", "defeitos estão abertos")} (${d.por_severidade.critico} crítico${d.por_severidade.critico === 1 ? "" : "s"}, ${d.por_severidade.alto} alto${d.por_severidade.alto === 1 ? "" : "s"}, ${d.por_severidade.medio} médio${d.por_severidade.medio === 1 ? "" : "s"}, ${d.por_severidade.baixo} baixo${d.por_severidade.baixo === 1 ? "" : "s"}).`,
  );
  const ant = a.rodadas.length > 1 ? a.rodadas[a.rodadas.length - 2] : null;
  if (ant && ant.nota_ponderada_media !== null && r.nota_ponderada_media !== null) {
    const dif = Math.round((r.nota_ponderada_media - ant.nota_ponderada_media) * 10) / 10;
    partes.push(
      `Em relação à rodada ${ant.id}, a nota média ${dif === 0 ? "não mudou" : `${dif > 0 ? "subiu" : "caiu"} ${num(Math.abs(dif), 1)}`} e ${plural(d.corrigidos_desde_a_rodada_anterior, "defeito foi corrigido", "defeitos foram corrigidos")}.`,
    );
  } else {
    partes.push("Esta é a primeira rodada registrada: ainda não há rodada anterior para mostrar evolução.");
  }
  return partes.join(" ");
}

/* ------------------------------------------------------------------ matriz */

export function matrizModulos(a: AvaliacaoGold): { linhas: string[]; colunas: string[]; valores: (number | null)[][]; ids: IdDimensao[] } {
  const ids = ORDEM_DIMENSOES.filter((i) => a.rubrica.dimensoes.some((d) => d.id === i));
  return {
    linhas: a.modulos.map((m) => `${m.rotulo} (${m.paginas})`),
    colunas: ids.map((i) => ROTULO_CURTO[i]),
    valores: a.modulos.map((m) => ids.map((i) => m.dimensoes[i].media)),
    ids,
  };
}

/** Quantas células da matriz estão sem nota (não avaliada ou não aplicável): a matriz as mostra como sem dado. */
export const celulasSemNota = (a: AvaliacaoGold): number => matrizModulos(a).valores.flat().filter((v) => v === null).length;

export function dadosPorDimensao(a: AvaliacaoGold): { id: IdDimensao; rotulo: string; media: number | null; meta: number; minimo: number | null }[] {
  return ORDEM_DIMENSOES.map((i) => ({ id: i, rotulo: ROTULO_CURTO[i], media: a.resumo.por_dimensao[i].media, meta: a.resumo.por_dimensao[i].meta, minimo: a.resumo.por_dimensao[i].minimo }));
}

/* ------------------------------------------------------------------ tabelas */

export const COLUNAS_PAGINAS: ColunaTabela[] = [
  { id: "titulo", rotulo: "Página", tipo: "texto" },
  { id: "rota", rotulo: "Rota", tipo: "texto" },
  { id: "entrega", rotulo: "Entrega", tipo: "texto", categorica: true },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  ...ORDEM_DIMENSOES.map((i): ColunaTabela => ({ id: i, rotulo: ROTULO_CURTO[i], tipo: "numero", casas: 1 })),
  { id: "ponderada", rotulo: "Nota ponderada", tipo: "numero", casas: 1 },
  { id: "meta", rotulo: "Atende a meta", tipo: "texto", categorica: true },
  { id: "completa", rotulo: "Dimensões todas avaliadas", tipo: "texto", categorica: true },
  { id: "defeitos", rotulo: "Defeitos", tipo: "numero", casas: 0 },
];

export function linhasPaginas(a: AvaliacaoGold): LinhaTabela[] {
  const rotulo = new Map(a.modulos.map((m) => [m.id, m.rotulo]));
  return a.paginas.map((p) => ({
    titulo: p.titulo ?? p.rota,
    rota: p.rota,
    entrega: rotulo.get(p.modulo ?? "") ?? "",
    tipo: ROTULO_TIPO[p.tipo],
    ...Object.fromEntries(ORDEM_DIMENSOES.map((i) => [i, p.dimensoes[i].estado === "avaliada" ? p.dimensoes[i].nota : null])),
    ponderada: p.nota_ponderada,
    meta: p.atende_meta ? "sim" : "não",
    completa: p.completa ? "sim" : "não",
    defeitos: p.defeitos.length,
  }));
}

export const COLUNAS_DEFEITOS: ColunaTabela[] = [
  { id: "id", rotulo: "Defeito", tipo: "texto" },
  { id: "severidade", rotulo: "Severidade", tipo: "texto", categorica: true },
  { id: "dimensao", rotulo: "Dimensão", tipo: "texto", categorica: true },
  { id: "descricao", rotulo: "Descrição", tipo: "texto" },
  { id: "n_paginas", rotulo: "Páginas afetadas", tipo: "numero", casas: 0 },
  { id: "exemplo", rotulo: "Primeira página", tipo: "texto" },
];

const ROTULO_DIMENSAO_DEFEITO: Record<string, string> = { ...ROTULO_CURTO };

export function linhasDefeitos(defeitos: DefeitoAvaliacao[]): LinhaTabela[] {
  return defeitos.map((d) => ({
    id: d.id,
    severidade: ROTULO_SEVERIDADE[d.severidade],
    dimensao: ROTULO_DIMENSAO_DEFEITO[d.dimensao] ?? d.dimensao,
    descricao: d.descricao,
    n_paginas: d.n_paginas,
    exemplo: d.paginas[0] ?? "",
  }));
}

/* ------------------------------------------------------------------ ficha de uma página */

export type ResumoFicha = { rota: string; titulo: string; notaPonderada: string; atendeMeta: boolean; faltas: string[] };

export function resumoFicha(p: PaginaAvaliada): ResumoFicha {
  return { rota: p.rota, titulo: p.titulo ?? p.rota, notaPonderada: p.nota_ponderada === null ? "não avaliada" : num(p.nota_ponderada, 1), atendeMeta: p.atende_meta, faltas: p.abaixo_da_meta };
}

/** Texto da dedução ou do teto, para a ficha: pontos com vírgula decimal. */
export const textoDeducao = (d: { pontos: number; motivo: string }) => `menos ${num(d.pontos, d.pontos % 1 === 0 ? 0 : 2)}: ${d.motivo}`;
export const textoTeto = (t: { valor: number; motivo: string }) => `teto ${num(t.valor, 1)}: ${t.motivo}`;

/** Módulo da página, para o rótulo da ficha. */
export const moduloDaPagina = (a: AvaliacaoGold, p: PaginaAvaliada): ModuloAvaliado | undefined => a.modulos.find((m) => m.id === p.modulo);

export function evolucao(a: AvaliacaoGold): { id: string; data: string; paginas: number; nota: string; atendem: number; defeitos: string; jornadas: number }[] {
  return a.rodadas.map((r) => ({
    id: r.id,
    data: dataBR(r.data),
    paginas: r.paginas,
    nota: num(r.nota_ponderada_media, 1),
    atendem: r.atendem_meta,
    defeitos: `${r.defeitos_por_severidade.critico} / ${r.defeitos_por_severidade.alto} / ${r.defeitos_por_severidade.medio} / ${r.defeitos_por_severidade.baixo}`,
    jornadas: r.jornadas_cumpridas,
  }));
}
