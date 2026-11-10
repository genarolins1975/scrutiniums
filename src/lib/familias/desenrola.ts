/**
 * Leitura das golds do painel "Desenrola Brasil" (Observatório das Famílias, coleção Dívida e crédito das famílias). Só servidor.
 * A página mostra os valores de public/obs/data/gold/desenrola.json como estão. As somas e razões feitas aqui são as mesmas que a
 * vista antiga fazia no navegador (public/obs/app.js, renderDesenrola): soma das faixas 1 e 2 por mês, valor médio do mês (volume
 * dividido por operações) e a divisão das operações entre o período do programa e o que veio depois. As séries de contexto vêm de
 * pulse.json e os marcos regulatórios de regulacao.json, como na vista antiga.
 */
import { lerPublico, mesAno } from "@/lib/perguntas/leitura";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

export const ROTA_DESENROLA = "/divida-das-familias/desenrola";
export const SECAO_DESENROLA = "familias:divida:desenrola";
export const PERGUNTA_DESENROLA = "O que o Desenrola fez, e o que os dados mostram?";
export const DESCRICAO_DESENROLA =
  "Desenrola Brasil: o que o programa de renegociação de dívidas fez, quanto dele aparece nos dados públicos do Banco Central e até onde eles permitem avaliar seus efeitos.";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
export type GoldDesenrola = any;

/** Fim do prazo de adesão do programa de pessoas físicas e primeira data-base: os limites que a vista antiga usava para "durante o programa". */
const INICIO_PROGRAMA = "2023-09";
const FIM_PROGRAMA = "2024-05";

/**
 * Texto que vem da gold, na forma da plataforma: sem travessão, sem palavra em caixa alta para dar ênfase, mês como "set/2026",
 * data como dd/mm/aaaa e unidade por extenso. Siglas (SCR, BCB, UF, FGO) ficam como estão.
 */
export const textoGold = (s: unknown): string =>
  String(s ?? "")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1 a $2")
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, a: string, m: string, d: string) => `${d}/${m}/${a}`)
    .replace(/\b(\d{4})-(\d{2})\b/g, (_, a: string, m: string) => mesAno(`${a}-${m}`))
    .replace(/>\s*90 dias/g, "acima de 90 dias")
    .replace(/% a\.a\./g, "% ao ano")
    .replace(/\b(NÃO|OU|APÓS|DEPOIS|DOIS|UMA)\b/g, (p) => p.toLowerCase())
    .replace(/INDISPONÍVEL/g, "Indisponível");

export type MesDesenrola = {
  mes: string;
  /** Único mês em que a fonte acumula operações de meses anteriores (set/2023). */
  acumulado: boolean;
  /** Operações e volume (R$) por faixa; null quando a faixa não tem linha no mês (ausência, nunca zero). */
  op1: number | null;
  op2: number | null;
  opSoma: number | null;
  vol1: number | null;
  vol2: number | null;
  volSoma: number | null;
  /** Valor médio por operação do mês (volume dividido por operações, arredondado ao real, como na vista antiga). */
  vm1: number | null;
  vm2: number | null;
  vmSoma: number | null;
};

export type RecorteFaixa = "ambas" | "faixa1" | "faixa2";

export type ConcentracaoNoTempo = { recorte: RecorteFaixa; durante: number; depois: number; total: number };

export type SerieContexto = {
  chave: string;
  rotulo: string;
  unidade: string;
  casas: number;
  /** Código da série no SGS do Banco Central. */
  codigo: string;
  pontos: { mes: string; v: number | null }[];
  inicio: string;
  fim: string;
};

export type DadosDesenrola = {
  g: GoldDesenrola;
  meses: MesDesenrola[];
  concentracao: ConcentracaoNoTempo[];
  /** Marcos do painel de regulação ligados ao Desenrola que têm mês na série (os mesmos que a vista antiga marcava). */
  marcosRegulacao: { x: string; rotulo: string }[];
  contexto: SerieContexto[];
  /** Início e fim do programa de pessoas físicas, lidos da linha do tempo da gold (anúncio e encerramento). */
  programa: { inicio: string; fim: string };
};

let cache: DadosDesenrola | null = null;

const valorMedio = (volume: number | null, operacoes: number | null) => (operacoes && volume != null ? Math.round(volume / operacoes) : null);

export function dadosDesenrola(): DadosDesenrola {
  if (cache) return cache;
  const g = lerPublico("obs", "data", "gold", "desenrola.json");
  if (!g?.disponivel) throw new Error("gold desenrola.json indisponível");

  const meses: MesDesenrola[] = (g.serie as any[]).map((m) => {
    const f1 = m.faixa1 ?? null, f2 = m.faixa2 ?? null;
    // a soma só existe quando ao menos uma faixa tem linha no mês; soma zero vira ausência, como na vista antiga
    const soma = (campo: "operacoes" | "volume") => (f1 || f2 ? (f1?.[campo] ?? 0) + (f2?.[campo] ?? 0) || null : null);
    const opSoma = soma("operacoes"), volSoma = soma("volume");
    return {
      mes: m.mes,
      acumulado: Boolean(m.acumulado),
      op1: f1?.operacoes || null,
      op2: f2?.operacoes || null,
      opSoma,
      vol1: f1?.volume || null,
      vol2: f2?.volume || null,
      volSoma,
      vm1: valorMedio(f1?.volume ?? null, f1?.operacoes ?? null),
      vm2: valorMedio(f2?.volume ?? null, f2?.operacoes ?? null),
      vmSoma: valorMedio(volSoma, opSoma),
    };
  });

  const campoOp: Record<RecorteFaixa, "opSoma" | "op1" | "op2"> = { ambas: "opSoma", faixa1: "op1", faixa2: "op2" };
  const concentracao = (Object.keys(campoOp) as RecorteFaixa[]).map((recorte) => {
    const somar = (lista: MesDesenrola[]) => lista.reduce((s, m) => s + (m[campoOp[recorte]] ?? 0), 0);
    const durante = somar(meses.filter((m) => m.mes >= INICIO_PROGRAMA && m.mes <= FIM_PROGRAMA));
    const depois = somar(meses.filter((m) => m.mes > FIM_PROGRAMA));
    return { recorte, durante, depois, total: durante + depois };
  });

  let marcosRegulacao: DadosDesenrola["marcosRegulacao"] = [];
  try {
    const r = lerPublico("obs", "data", "gold", "regulacao.json");
    if (r?.disponivel)
      marcosRegulacao = (r.marcos as any[])
        .filter((m) => m.serie_x && (m.paineis ?? []).includes("desenrola"))
        .map((m) => ({ x: String(m.serie_x), rotulo: String(m.ato).replace(/\s*\(.*?\)/, "").replace(/^(Resolução|Resoluções)/, "Res.").slice(0, 24) }));
  } catch {
    // sem a gold de regulação, a série fica só com os marcos do próprio programa
  }

  let contexto: SerieContexto[] = [];
  try {
    const p = lerPublico("obs", "data", "gold", "pulse.json");
    contexto = ((g.series_contexto ?? []) as any[]).flatMap((s) => {
      const serie = p?.series?.[s.chave];
      if (!serie?.obs?.length) return [];
      const pontos = (serie.obs as { ref: string; v: number | null }[]).filter((o) => o.ref >= "2019-01").map((o) => ({ mes: o.ref.slice(0, 7), v: o.v ?? null }));
      if (!pontos.length) return [];
      const unidade = textoGold(s.unidade);
      return [{ chave: String(s.chave), rotulo: textoGold(s.rotulo), unidade, casas: unidade.startsWith("R$") ? 0 : 2, codigo: String(serie.meta?.series_code ?? ""), pontos, inicio: pontos[0].mes, fim: pontos[pontos.length - 1].mes }];
    });
  } catch {
    // sem a gold do pulso, a figura de contexto não é publicada; a página diz isso em vez de desenhar série vazia
  }

  const tempo = g.linha_do_tempo as { data: string; rotulo: string }[];
  const anuncio = tempo.find((e) => /^Anúncio/.test(e.rotulo)), fim = tempo.find((e) => /^Encerramento/.test(e.rotulo));
  if (!anuncio || !fim) throw new Error("linha do tempo do Desenrola sem anúncio ou encerramento");

  cache = { g, meses, concentracao, marcosRegulacao, contexto, programa: { inicio: anuncio.data.slice(0, 7), fim: fim.data.slice(0, 7) } };
  return cache;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type FonteDesenrola = "bcb" | "relatorio" | "ibge" | "sgs";

/**
 * Proveniência do kit de painel a partir do que a gold registra. Para a base do Banco Central a gold guarda a data da coleta e o hash
 * do arquivo bruto; para as demais fontes (relatório oficial citado, população do IBGE e séries do SGS) ela não guarda captura própria,
 * e a limitação diz isso.
 */
export function provDesenrola(
  g: GoldDesenrola,
  fonte: FonteDesenrola,
  d: { indicador: string; natureza: Natureza; unidade: string; inicio: string; fim: string; limitacoes: string[]; formula?: string; transformacoes?: string[]; recurso?: string },
): Proveniencia {
  const bcb = fonte === "bcb";
  const f = {
    bcb: { orgao: "Banco Central do Brasil", dataset: "Desenrola Brasil (dados agregados do SCR)", url: String(g.url_dataset), frequencia: "mensal", licenca: String(g.licenca) },
    relatorio: { orgao: "Ministério do Planejamento e Orçamento, BID e Banco Central", dataset: "Relatório de Avaliação do Desenrola Brasil", url: String(g.avaliacao.url), frequencia: "publicação única", licenca: "Documento público" },
    ibge: { orgao: "IBGE", dataset: "Estimativas de população (SIDRA, tabela 6579)", url: "https://sidra.ibge.gov.br/tabela/6579", frequencia: "anual", licenca: "Dados públicos, uso livre com citação da fonte" },
    sgs: { orgao: "Banco Central do Brasil", dataset: "Sistema Gerenciador de Séries Temporais (SGS)", url: "https://www3.bcb.gov.br/sgspub/", frequencia: "mensal", licenca: "Dados públicos, uso livre com citação da fonte" },
  }[fonte];
  return {
    indicador: d.indicador,
    natureza: d.natureza,
    fonte: { orgao: f.orgao, dataset: f.dataset, recurso: d.recurso ?? f.dataset, url_dataset: f.url, url_primaria: f.url, licenca: f.licenca },
    unidade: d.unidade,
    frequencia: f.frequencia,
    periodo_referencia: { inicio: d.inicio, fim: d.fim },
    publicado_pela_fonte_em: fonte === "relatorio" ? String(g.avaliacao.publicado) : null,
    capturado_em: bcb ? g.coletado_em : g.gerado_em,
    validado_em: g.gerado_em,
    cobertura_historica: { inicio: d.inicio, fim: d.fim },
    transformacoes: d.transformacoes ?? [],
    formula: d.formula ?? null,
    snapshot: { id: null, sha256: bcb ? (g.bronze_sha ?? null) : null },
    versao_pipeline: "gold desenrola.json",
    versao_codigo: null,
    revisoes_conhecidas: null,
    limitacoes: bcb
      ? [...d.limitacoes, "A fonte republica a série inteira a cada mês, com as retificações das entidades remetentes: a cada coleta a série completa é substituída."]
      : [...d.limitacoes, "A gold do Desenrola não registra captura separada nem o hash desta fonte; a data de captura e de validação mostrada é a do processamento da publicação."],
    download: null,
    notas_fonte: null,
  };
}
