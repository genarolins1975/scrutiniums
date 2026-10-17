/**
 * Lógica pura das páginas de Leilões (ACR e transmissão): linhas de gráfico e tabela, frases citáveis derivadas da gold,
 * o modelo do laboratório de leilão descendente e a escolha do logotipo de um grupo a partir do manifesto de logos.
 * A conta dos números publicados roda no pipeline (pipeline/energia/modulos/leiloes.py); aqui só se arruma o que a gold traz.
 *
 * Idioma: as frases têm as duas formas lado a lado (tx) e recebem o idioma por último (padrão: o da página); os mapas de
 * rótulo leem o idioma na hora do acesso, por getter.
 */
import type { Idioma } from "@/lib/idioma";
import { dataBR, mesAno, num, pct, reais } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import type { IdCategoria, IdEntrada, IdSituacao, LeiloesGold } from "./tipos-leiloes";

export const ROTA_LEILOES = "/setor-eletrico/leiloes";
export const ROTA_LEILOES_TRANSMISSAO = `${ROTA_LEILOES}/transmissao`;

/** Fonte dos leilões de geração (conjunto aberto da ANEEL). */
export function fonteLeiloes(idioma: Idioma = idiomaEnergia()): string {
  return tx("ANEEL, Resultado de Leilões de Geração", "ANEEL, generation auction results", idioma);
}
/** Fonte dos leilões de transmissão (conjunto aberto da ANEEL). */
export function fonteTransmissao(idioma: Idioma = idiomaEnergia()): string {
  return tx("ANEEL, Resultado de Leilões de Transmissão", "ANEEL, transmission auction results", idioma);
}

export const PAGINAS_LEILOES = [
  {
    id: "acr",
    href: ROTA_LEILOES,
    get rotulo() {
      return tx("Geração no ACR", "Generation in the ACR");
    },
    get descricao() {
      return tx("O que o mercado regulado comprou, de quem, a que preço, e o que já opera?", "What did the regulated market buy, from whom, at what price, and what is already operating?");
    },
  },
  {
    id: "transmissao",
    href: ROTA_LEILOES_TRANSMISSAO,
    get rotulo() {
      return tx("Transmissão", "Transmission");
    },
    get descricao() {
      return tx(
        "Quanto de receita anual os leilões de linhas contrataram, corrigida pelo IPCA, e com que deságio?",
        "How much annual revenue did the transmission line auctions contract, adjusted by the IPCA, and at what discount?",
      );
    },
  },
] as const;

export const ORDEM_CATEGORIAS: readonly IdCategoria[] = ["uhe", "pch", "eolica", "solar", "biomassa", "gas", "oleo", "carvao"];

/** Cor por categoria de fonte: a mesma identidade das fontes no observatório (Geração e Expansão). */
export const COR_CATEGORIA_LEILAO: Record<IdCategoria, string> = {
  uhe: "var(--serie-hidraulica)",
  pch: "var(--serie-comp-1)",
  eolica: "var(--serie-eolica)",
  solar: "var(--serie-solar)",
  biomassa: "var(--cor-sucesso)",
  gas: "var(--serie-termica)",
  oleo: "var(--serie-6)",
  carvao: "var(--serie-1)",
};
/** Nome curto da categoria para eixo e legenda; o nome completo vem da gold. */
export const CURTO_CATEGORIA: Record<IdCategoria, string> = {
  get uhe() {
    return tx("Hidrelétrica", "Hydropower");
  },
  get pch() {
    return tx("PCH e CGH", "PCH and CGH");
  },
  get eolica() {
    return tx("Eólica", "Wind");
  },
  get solar() {
    return tx("Solar", "Solar");
  },
  get biomassa() {
    return tx("Biomassa", "Biomass");
  },
  get gas() {
    return tx("Gás natural", "Natural gas");
  },
  get oleo() {
    return tx("Óleo", "Oil");
  },
  get carvao() {
    return tx("Carvão", "Coal");
  },
};

export const ORDEM_SITUACOES: readonly IdSituacao[] = ["operacao", "construcao", "nao_iniciada", "encerrada", "sem_registro", "sem_ceg"];
export const COR_SITUACAO: Record<IdSituacao, string> = {
  operacao: "var(--cor-energia)", // i18n: dado
  construcao: "var(--escala-seq-3)",
  nao_iniciada: "var(--escala-seq-2)",
  encerrada: "var(--escala-div-neg-1)",
  sem_registro: "var(--cor-mineral-soft)",
  sem_ceg: "var(--serie-referencia)",
};
export const CURTO_SITUACAO: Record<IdSituacao, string> = {
  get operacao() {
    return tx("Em operação", "In operation");
  },
  get construcao() {
    return tx("Em construção", "Under construction");
  },
  get nao_iniciada() {
    return tx("Obra não iniciada", "Works not started");
  },
  get encerrada() {
    return tx("Outorga encerrada", "Grant terminated");
  },
  get sem_registro() {
    return tx("Sem situação identificada", "No status identified");
  },
  get sem_ceg() {
    return tx("Sem código da usina", "No plant code");
  },
};
export const ROTULO_ENTRADA: Record<IdEntrada, string> = {
  get antes_do_leilao() {
    return tx("Já operava antes do leilão (ampliação ou usina existente)", "Already operating before the auction (expansion or existing plant)");
  },
  get ate_ano_a() {
    return tx("Entrou em operação até o fim do ano A", "Started operation by the end of year A");
  },
  get depois_ano_a() {
    return tx("Entrou em operação depois do ano A", "Started operation after year A");
  },
  get sem_data() {
    return tx("Sem data de entrada no SIGA", "No start date in SIGA");
  },
};
export const COR_ENTRADA: Record<IdEntrada, string> = {
  antes_do_leilao: "var(--cor-mineral-soft)",
  ate_ano_a: "var(--cor-energia)", // i18n: dado
  depois_ano_a: "var(--escala-div-neg-1)",
  sem_data: "var(--serie-referencia)",
};

export const COR_TIPO_LEILAO: Record<string, string> = {
  "A-3": "var(--escala-seq-2)",
  "A-4": "var(--escala-seq-3)",
  "A-5": "var(--escala-seq-4)",
  "A-6": "var(--escala-seq-5)",
  "A-7": "var(--cor-energia-dark)", // i18n: dado
  LER: "var(--serie-comp-2)",
  FA: "var(--serie-comp-3)",
  Estruturante: "var(--serie-comp-1)",
};

/** "MWmédio" com separador de milhar e uma casa. */
export const mwmed = (v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()) =>
  v == null ? tx("sem dado", "no data", idioma) : tx(`${num(v, casas, idioma)} MWmédio`, `${num(v, casas, idioma)} MWavg`, idioma);
export const rsMwh = (v: number | null | undefined, casas = 2, idioma: Idioma = idiomaEnergia()) => (v == null ? tx("sem dado", "no data", idioma) : `${reais(v, casas, idioma)}/MWh`);

/** Anos do primeiro ao último leilão, inclusive os anos sem leilão na base (que viram ausência, nunca zero). */
/**
 * Número do leilão na forma em que a ANEEL o designa nos editais ("Leilão nº 10/2013"). O conjunto aberto grava "AAAA/N"
 * (NumLeilao = "2013/10"), que na prosa se confunde com ano e mês; a página exibe "10/2013" e os downloads mantêm o campo da fonte.
 */
export function numeroAneel(bruto: string | null | undefined): string {
  const m = /^(\d{4})\/(\d{1,3})$/.exec(String(bruto ?? "").trim());
  return m ? `${Number(m[2])}/${m[1]}` : String(bruto ?? "");
}

export function anosContinuos(g: Pick<LeiloesGold, "cobertura">): string[] {
  if (!g.cobertura.anos) return [];
  const [a, b] = g.cobertura.anos;
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
}

/** Energia contratada por ano, empilhada por categoria ou por tipo; ano sem leilão na base sai com todas as colunas nulas. */
export function linhasEnergiaPorAno(g: Pick<LeiloesGold, "cobertura" | "por_ano">, por: "categoria" | "tipo"): Record<string, string | number | null>[] {
  const idx = new Map(g.por_ano.map((a) => [a.ano, a]));
  return anosContinuos(g).map((ano) => {
    const a = idx.get(ano);
    const linha: Record<string, string | number | null> = { ano };
    const chaves = por === "categoria" ? ORDEM_CATEGORIAS : g.cobertura.tipos_presentes.map((t) => t.id);
    for (const k of chaves) {
      const v = a ? (por === "categoria" ? a.por_categoria[k as IdCategoria] : a.por_tipo[k]) : null;
      linha[k] = a ? (v ?? 0) : null;
    }
    return linha;
  });
}

/** Preço médio por categoria e ano (uma coluna por categoria); ano sem venda da categoria é ausência (lacuna na linha). */
export function linhasPrecoPorAno(g: Pick<LeiloesGold, "cobertura" | "preco_ano_categoria">, real: boolean): Record<string, string | number | null>[] {
  const m = new Map<string, number | null>();
  for (const x of g.preco_ano_categoria) m.set(`${x.ano}|${x.categoria}`, real ? x.preco_medio_real : x.preco_medio);
  return anosContinuos(g).map((ano) => {
    const linha: Record<string, string | number | null> = { ano };
    for (const k of ORDEM_CATEGORIAS) linha[k] = m.get(`${ano}|${k}`) ?? null;
    return linha;
  });
}

/** Categorias com ao menos um preço na série (as demais não viram linha vazia na legenda). */
export function categoriasComPreco(g: Pick<LeiloesGold, "preco_ano_categoria">): IdCategoria[] {
  const presentes = new Set(g.preco_ano_categoria.filter((x) => x.preco_medio != null).map((x) => x.categoria));
  return ORDEM_CATEGORIAS.filter((k) => presentes.has(k));
}

/** Energia contratada por ano do leilão, empilhada pela situação atual. */
export function linhasEntregaPorAno(g: Pick<LeiloesGold, "cobertura" | "entrega">): Record<string, string | number | null>[] {
  const idx = new Map(g.entrega.por_ano.map((a) => [a.ano, a.situacao]));
  return anosContinuos(g).map((ano) => {
    const s = idx.get(ano);
    const linha: Record<string, string | number | null> = { ano };
    for (const k of ORDEM_SITUACOES) linha[k] = s ? s[k].energia_mwmed : null;
    return linha;
  });
}

/** Participação de uma situação na energia contratada (0 a 100); null sem energia. */
export function participacao(g: Pick<LeiloesGold, "entrega" | "totais">, s: IdSituacao): number | null {
  const t = g.totais.energia_mwmed;
  return t ? (100 * g.entrega.total[s].energia_mwmed) / t : null;
}

/** Nome de exibição de um leilão: "39º LEN (A-5)". Sem nome, o número como a ANEEL o designa ("Auction No. 10/2013" em inglês). */
export function nomeLeilao(l: { nome: string | null; tipo: string; leilao: string }, idioma: Idioma = idiomaEnergia()): string {
  return `${l.nome ?? tx(`Leilão ${numeroAneel(l.leilao)}`, `Auction No. ${numeroAneel(l.leilao)}`, idioma)} (${l.tipo})`;
}

export type FraseCitavel = { id: string; texto: string; referencia: string };

/**
 * Frases para citação, todas calculadas da gold com período e fonte. Regras: só fatos medidos, sem adjetivo; a categoria
 * entra só quando tem preço no primeiro e no último ano de venda; o grupo é dito como "controla a usina" na data do cadastro, nunca como vencedor.
 */
export function frasesCitaveis(g: LeiloesGold, idioma: Idioma = idiomaEnergia()): FraseCitavel[] {
  const out: FraseCitavel[] = [];
  const ref = g.referencias;
  const D = (iso: string | null | undefined) => dataBR(iso, idioma);
  const N = (v: number | null | undefined) => num(v, 0, idioma);
  const P = (v: number | null | undefined, casas = 1) => pct(v, casas, idioma);
  const M = (v: number | null | undefined) => mwmed(v, 1, idioma);
  const R = (v: number | null | undefined) => rsMwh(v, 2, idioma);
  const base = tx(`${fonteLeiloes(idioma)} (arquivo gerado em ${D(ref.arquivo_gerado_em ?? ref.ultimo_leilao)})`, `${fonteLeiloes(idioma)} (file generated on ${D(ref.arquivo_gerado_em ?? ref.ultimo_leilao)})`, idioma);
  const t = g.totais;
  out.push({
    id: "total", // i18n: dado
    texto: tx(
      `Entre ${D(ref.primeiro_leilao)} e ${D(ref.ultimo_leilao)}, os ${N(g.cobertura.leiloes)} leilões de geração do ACR na base aberta da ANEEL contrataram ${M(t.energia_mwmed)} em ${N(t.empreendimentos)} vendas${t.usinas_distintas ? ` de ${N(t.usinas_distintas)} usinas distintas (a mesma usina pode vender em mais de um leilão)` : ""}.`,
      `Between ${D(ref.primeiro_leilao)} and ${D(ref.ultimo_leilao)}, the ${N(g.cobertura.leiloes)} ACR generation auctions in ANEEL's open database contracted ${M(t.energia_mwmed)} in ${N(t.empreendimentos)} sales${t.usinas_distintas ? ` from ${N(t.usinas_distintas)} distinct plants (the same plant can sell in more than one auction)` : ""}.`,
      idioma,
    ),
    referencia: tx(
      `${base}. Não inclui leilões de energia existente, de ajuste, de reserva de capacidade e de sistemas isolados.`,
      `${base}. Does not include existing energy, adjustment, capacity reserve or isolated systems auctions.`,
      idioma,
    ),
  });
  const op = participacao(g, "operacao");
  const enc = participacao(g, "encerrada");
  const sem = participacao(g, "sem_registro");
  if (op != null && ref.siga) {
    out.push({
      id: "entrega",
      texto: tx(
        `${P(op)} da energia contratada nesses leilões vem de usinas que estavam em operação no cadastro da ANEEL em ${D(ref.siga)}; ${P(enc)} vem de usinas com outorga revogada ou extinta desde 2015 e ${P(sem)} de usinas fora do cadastro sem ato de encerramento identificado.`,
        `${P(op)} of the energy contracted in these auctions comes from plants that were in operation in the ANEEL registry on ${D(ref.siga)}; ${P(enc)} comes from plants whose grant was revoked or extinguished since 2015 and ${P(sem)} from plants outside the registry with no termination act identified.`,
        idioma,
      ),
      referencia: tx(
        `${base}; ANEEL, SIGA de ${D(ref.siga)} e atos de outorga até ${D(ref.atos)}. Situação da usina, não cumprimento do contrato.`,
        `${base}; ANEEL, SIGA as of ${D(ref.siga)} and grant acts up to ${D(ref.atos)}. Plant status, not contract compliance.`,
        idioma,
      ),
    });
  }
  const u = g.ultimo_leilao;
  if (u.preco_medio != null) {
    out.push({
      id: "ultimo",
      texto: tx(
        `O leilão mais recente da base, o ${nomeLeilao(u, idioma)}, de ${D(u.data)}, contratou ${M(u.energia_mwmed)} a ${R(u.preco_medio)} em média (ponderada pela energia), com deságio agregado de ${P(u.desagio_agregado_pct, 2)} sobre o preço teto.`,
        `The most recent auction in the database, the ${nomeLeilao(u, idioma)}, on ${D(u.data)}, contracted ${M(u.energia_mwmed)} at ${R(u.preco_medio)} on average (weighted by energy), with an aggregate discount of ${P(u.desagio_agregado_pct, 2)} below the ceiling price.`,
        idioma,
      ),
      referencia: base,
    });
  }
  for (const k of ["eolica", "solar"] as const) {
    const c = g.por_categoria.find((x) => x.id === k);
    if (!c?.primeiro_ano || !c.ultimo_ano || c.primeiro_ano.ano === c.ultimo_ano.ano) continue;
    if (c.primeiro_ano.preco_medio_real == null || c.ultimo_ano.preco_medio_real == null) continue;
    const mes = mesAno(ref.ipca_ate, idioma);
    out.push({
      id: `preco-${k}`,
      texto: tx(
        `Em reais de ${mes}, a energia ${k === "eolica" ? "eólica" : "solar"} foi contratada a ${R(c.primeiro_ano.preco_medio_real)} em ${c.primeiro_ano.ano} e a ${R(c.ultimo_ano.preco_medio_real)} em ${c.ultimo_ano.ano} (médias ponderadas pela energia vendida no ano; em valores da época, ${R(c.primeiro_ano.preco_medio)} e ${R(c.ultimo_ano.preco_medio)}).`,
        `In reais of ${mes}, ${k === "eolica" ? "wind" : "solar"} energy was contracted at ${R(c.primeiro_ano.preco_medio_real)} in ${c.primeiro_ano.ano} and at ${R(c.ultimo_ano.preco_medio_real)} in ${c.ultimo_ano.ano} (averages weighted by the energy sold in the year; in values of the time, ${R(c.primeiro_ano.preco_medio)} and ${R(c.ultimo_ano.preco_medio)}).`,
        idioma,
      ),
      referencia: tx(
        `${base}; IBGE, IPCA (tabela 1737) até ${mes}. O preço corrigido é régua de comparação, não o preço vigente do contrato.`,
        `${base}; IBGE, IPCA (table 1737) up to ${mes}. The adjusted price is a yardstick for comparison, not the current contract price.`,
        idioma,
      ),
    });
  }
  const q = g.desagio.geral;
  if (q.mediana != null) {
    out.push({
      id: "desagio",
      texto: tx(
        `Metade das ${N(q.n)} vendas com preço teve deságio de até ${P(q.mediana, 2)} sobre o preço teto; um quarto teve deságio acima de ${P(q.p75, 2)}.`,
        `Half of the ${N(q.n)} sales with a price had a discount of up to ${P(q.mediana, 2)} below the ceiling price; a quarter had a discount above ${P(q.p75, 2)}.`,
        idioma,
      ),
      referencia: tx(
        `${base}. Deságio mede a distância ao teto do edital; o número de proponentes não está no arquivo.`,
        `${base}. The discount measures the distance from the tender's ceiling; the number of bidders is not in the file.`,
        idioma,
      ),
    });
  }
  const gc = g.grupos_controle?.maiores[0];
  if (gc && ref.siga) {
    out.push({
      id: "grupo",
      texto: tx(
        `Pelo controle das usinas em ${D(ref.siga)}, o grupo ${gc.nome ?? "sem nome publicado"} reúne a maior parcela da energia contratada nesses leilões: ${M(gc.energia_mwmed)} em ${N(gc.empreendimentos)} vendas. Esse grupo não é necessariamente o vencedor na data do leilão.`,
        `By control of the plants on ${D(ref.siga)}, the ${gc.nome ?? "unnamed"} group holds the largest share of the energy contracted in these auctions: ${M(gc.energia_mwmed)} in ${N(gc.empreendimentos)} sales. This group is not necessarily the winner on the auction date.`,
        idioma,
      ),
      referencia: tx(
        `${base}; ANEEL, SIGA e Composição Societária, como publicados no módulo Empresas.`,
        `${base}; ANEEL, SIGA and Composição Societária (shareholding structure), as published in the Companies module.`,
        idioma,
      ),
    });
  }
  return out;
}

/** Frases citáveis da página de transmissão, do último ano com leilão no arquivo. */
export function frasesTransmissao(g: LeiloesGold, idioma: Idioma = idiomaEnergia()): FraseCitavel[] {
  const t = g.transmissao;
  const u = t.por_ano.at(-1);
  if (!u) return [];
  const mes = mesAno(g.referencias.ipca_ate, idioma);
  const base = tx(
    `${fonteTransmissao(idioma)}, até ${dataBR(t.periodo.fim, idioma)}; IBGE, IPCA até ${mes}`,
    `${fonteTransmissao(idioma)}, up to ${dataBR(t.periodo.fim, idioma)}; IBGE, IPCA up to ${mes}`,
    idioma,
  );
  const out: FraseCitavel[] = [
    {
      id: "ultimo-ano",
      texto: tx(
        `Os leilões de transmissão de ${u.ano} contrataram ${num(u.lotes_contratados, 0, idioma)} lotes com receita anual permitida (RAP) de R$ ${num(u.rap_vencedora_rs_mi, 1, idioma)} milhões em valores da época, ou R$ ${num(u.rap_vencedora_real_rs_mi, 1, idioma)} milhões em reais de ${mes}, com deságio agregado de ${pct(u.desagio_agregado_pct, 2, idioma)} sobre a RAP do edital.`,
        `The ${u.ano} transmission auctions contracted ${num(u.lotes_contratados, 0, idioma)} lots with an allowed annual revenue (RAP) of R$ ${num(u.rap_vencedora_rs_mi, 1, idioma)} million in values of the time, or R$ ${num(u.rap_vencedora_real_rs_mi, 1, idioma)} million in reais of ${mes}, with an aggregate discount of ${pct(u.desagio_agregado_pct, 2, idioma)} below the tender RAP.`,
        idioma,
      ),
      referencia: base,
    },
  ];
  if (t.desagio_lotes.mediana != null) {
    const inicio = t.periodo.inicio?.slice(0, 4);
    out.push({
      id: "desagio-lotes",
      texto: tx(
        `Nos ${num(t.desagio_lotes.n, 0, idioma)} lotes contratados desde ${inicio ?? "o início do arquivo"}, o deságio mediano foi de ${pct(t.desagio_lotes.mediana, 2, idioma)}; ${num(t.lotes_desagio_zero, 0, idioma)} lotes saíram sem deságio.`,
        `In the ${num(t.desagio_lotes.n, 0, idioma)} lots contracted since ${inicio ?? "the start of the file"}, the median discount was ${pct(t.desagio_lotes.mediana, 2, idioma)}; ${num(t.lotes_desagio_zero, 0, idioma)} lots were awarded with no discount.`,
        idioma,
      ),
      referencia: base,
    });
  }
  return out;
}

/* ===================================================================== produtos A-x */

export type LinhaProduto = {
  tipo: string;
  anoLeilao: number;
  /** Ano A de início do suprimento; null quando o nome do produto não fixa (reserva, fontes alternativas, estruturante). */
  anoA: number | null;
  /** Anos do eixo, do leilão ao ano A mais dois (ou cinco anos, sem ano A). */
  anos: number[];
};

export function linhaProduto(tipo: string, anoLeilao: number): LinhaProduto {
  const m = /^A-(\d)$/.exec(tipo);
  const anoA = m ? anoLeilao + Number(m[1]) : null;
  const fim = (anoA ?? anoLeilao + 5) + 2;
  return { tipo, anoLeilao, anoA, anos: Array.from({ length: fim - anoLeilao + 1 }, (_, i) => anoLeilao + i) };
}

/* ===================================================================== laboratório */

export type ParametrosLeilao = {
  /** Preço teto do produto (R$/MWh). */
  teto: number;
  /** Demanda declarada pelas distribuidoras (MWmédio). */
  demanda: number;
  /** Número de proponentes, cada um com um lote do mesmo tamanho. */
  proponentes: number;
  /** Energia oferecida por proponente (MWmédio). */
  lote: number;
  /** Menor e maior custo entre os proponentes (R$/MWh), espalhados de modo uniforme. */
  custoMin: number;
  custoMax: number;
  /** Quanto o preço cai a cada rodada (R$/MWh). */
  passo: number;
};

export type Rodada = { rodada: number; preco: number; proponentes: number; oferta: number };

export type ResultadoLeilao = {
  custos: number[];
  rodadas: Rodada[];
  /** Preço de fechamento (R$/MWh): o da rodada em que a oferta coube na demanda; null se ninguém ofertou no teto. */
  preco: number | null;
  desagioPct: number | null;
  vencedores: number;
  contratada: number;
  /** Demanda que ficou sem contratar (MWmédio). */
  faltou: number;
  /** Margem média dos vencedores sobre o próprio custo (R$/MWh). */
  margemMedia: number | null;
};

export const PARAMETROS_LEILAO_INICIAIS: ParametrosLeilao = { teto: 400, demanda: 600, proponentes: 10, lote: 100, custoMin: 180, custoMax: 380, passo: 5 };

/**
 * Leilão de preço descendente, simplificado: a cada rodada o preço cai `passo`; quem tem custo acima do preço sai; o leilão
 * para quando a oferta restante cabe na demanda. Todos os vencedores recebem o preço de fechamento. Fora do modelo: lances
 * por produto, fase discriminatória, sobra de oferta, garantias, margem de transmissão e custo de capital.
 */
export function leilaoDescendente(p: ParametrosLeilao): ResultadoLeilao {
  const n = Math.max(1, Math.round(p.proponentes));
  const custos = Array.from({ length: n }, (_, i) => (n === 1 ? p.custoMin : p.custoMin + ((p.custoMax - p.custoMin) * i) / (n - 1)));
  const rodadas: Rodada[] = [];
  const ativos = (preco: number) => custos.filter((c) => c <= preco + 1e-9).length;
  let preco = p.teto;
  let k = ativos(preco);
  rodadas.push({ rodada: 1, preco, proponentes: k, oferta: k * p.lote });
  if (k === 0) return { custos, rodadas, preco: null, desagioPct: null, vencedores: 0, contratada: 0, faltou: p.demanda, margemMedia: null };
  const passo = Math.max(0.5, p.passo);
  while (k * p.lote > p.demanda && preco - passo >= 0) {
    const proximo = preco - passo;
    const kp = ativos(proximo);
    // a rodada seguinte esvaziaria o leilão: fecha no preço atual com os que ainda cabem na demanda
    if (kp === 0) break;
    preco = proximo;
    k = kp;
    rodadas.push({ rodada: rodadas.length + 1, preco, proponentes: k, oferta: k * p.lote });
  }
  const cabem = Math.min(k, Math.floor(p.demanda / p.lote));
  const vencedoresCustos = custos.filter((c) => c <= preco + 1e-9).slice(0, cabem);
  const contratada = vencedoresCustos.length * p.lote;
  return {
    custos,
    rodadas,
    preco,
    desagioPct: p.teto ? 100 * (1 - preco / p.teto) : null,
    vencedores: vencedoresCustos.length,
    contratada,
    faltou: Math.max(0, p.demanda - contratada),
    margemMedia: vencedoresCustos.length ? vencedoresCustos.reduce((s, c) => s + (preco - c), 0) / vencedoresCustos.length : null,
  };
}

/* ===================================================================== logos */

/** Tom do fundo para o qual a companhia desenhou o arquivo (manifesto): a placa do logo segue esse tom. */
export type FundoLogo = "claro" | "escuro" | null;
export type LogoGrupo = { src: string; nome: string; cnpj: string; origem: string | null; data: string | null; noTopo: boolean; papel: string | null; fundo: FundoLogo; largura: number | null; altura: number | null };
export type EntradaLogo = { arquivo: string; nome: string; cnpjs: string[]; origem: string | null; data: string | null; papel: string | null; fundo: FundoLogo; largura: number | null; altura: number | null };

const so14 = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 14 ? d : null;
};

/**
 * Lê o manifesto de logos (public/energia/logos/manifesto.json) de forma tolerante: aceita `{ logos: [...] }`, `{ itens: [...] }`
 * ou uma lista; em cada item, os CNPJs em `cnpj_holding`, `cnpj_grupo`, `cnpj`, `holding_cnpj`, `grupo_cnpj` ou `cnpjs`; o arquivo
 * em `arquivo`, `src` ou `url` (relativo a /energia/logos/ quando não começa por "/"). Item sem arquivo ou sem CNPJ válido sai.
 */
export function normalizaManifestoLogos(bruto: unknown): EntradaLogo[] {
  const lista = Array.isArray(bruto)
    ? bruto
    : bruto && typeof bruto === "object"
      ? ((bruto as Record<string, unknown>).logos ?? (bruto as Record<string, unknown>).itens ?? [])
      : [];
  if (!Array.isArray(lista)) return [];
  const out: EntradaLogo[] = [];
  for (const it of lista) {
    if (!it || typeof it !== "object") continue;
    const x = it as Record<string, unknown>;
    const arq = String(x.arquivo ?? x.src ?? x.url ?? "").trim();
    if (!arq || /^[a-z]+:/i.test(arq) || arq.includes("..") || arq.startsWith("//")) continue;
    const src = arq.startsWith("/") ? arq : `/energia/logos/${arq.replace(/^\.?\/+/, "")}`;
    const cnpjs = [x.cnpj_holding, x.cnpj_grupo, x.cnpj, x.holding_cnpj, x.grupo_cnpj, ...(Array.isArray(x.cnpjs) ? x.cnpjs : [])]
      .map(so14)
      .filter((c): c is string => !!c);
    if (!cnpjs.length) continue;
    out.push({
      arquivo: src,
      nome: String(x.nome_exibicao ?? x.nome ?? x.empresa ?? x.rotulo ?? "").trim() || "logotipo",
      cnpjs: Array.from(new Set(cnpjs)),
      origem: x.url_origem != null ? String(x.url_origem) : x.origem != null ? String(x.origem) : x.fonte != null ? String(x.fonte) : null,
      data: x.data != null ? String(x.data) : x.capturado_em != null ? String(x.capturado_em) : null,
      papel: x.papel != null ? String(x.papel) : null,
      fundo: x.fundo === "escuro" ? "escuro" : x.fundo === "claro" ? "claro" : null,
      largura: typeof x.largura === "number" ? x.largura : null,
      altura: typeof x.altura === "number" ? x.altura : null,
    });
  }
  return out;
}

/**
 * Logotipo de um grupo: primeiro o do próprio grupo (topo da cadeia); senão, o da holding mais alta da cadeia de controle que tenha
 * logotipo no manifesto (a gold publica a cadeia do topo para baixo). Sem correspondência por CNPJ, null (a página mostra só o nome). Nunca por semelhança de nome.
 */
export function logoDoGrupo(manifesto: readonly EntradaLogo[], grupo: { cnpj: string; cadeia_cnpjs: readonly string[] }): LogoGrupo | null {
  if (!manifesto.length) return null;
  const por = new Map<string, EntradaLogo>();
  for (const e of manifesto) for (const c of e.cnpjs) if (!por.has(c)) por.set(c, e);
  const candidatos = [grupo.cnpj, ...grupo.cadeia_cnpjs];
  for (const c of candidatos) {
    const e = por.get(c);
    if (e) return { src: e.arquivo, nome: e.nome, cnpj: c, origem: e.origem, data: e.data, noTopo: c === grupo.cnpj, papel: e.papel, fundo: e.fundo, largura: e.largura, altura: e.altura };
  }
  return null;
}
