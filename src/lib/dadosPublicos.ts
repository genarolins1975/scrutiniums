import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Camada pública mínima: números-síntese com selo lidos do gold em TEMPO DE
 * BUILD (páginas force-static). A atualização acontece a cada execução do
 * pipeline diário, que commita o gold e dispara novo deploy — nunca há
 * leitura de filesystem em runtime serverless.
 *
 * Regra da casa preservada: todo número sai com fonte, série, referência e
 * limitações declaradas; nada é interpolado nem estimado aqui.
 */

export type IndicadorDef = {
  slug: string;
  key: string;
  titulo: string;
  tituloCurto: string;
  definicao: string;
  comoLer: string;
  limitacoes: string;
  formato: "pct" | "pct_aa" | "pp" | "brl_mi";
  decimais: number;
};

/** Catálogo puro (sem I/O): importável também pelo sitemap. */
export const INDICADORES: IndicadorDef[] = [
  {
    slug: "inadimplencia",
    key: "inad_total",
    titulo: "Inadimplência do crédito no Brasil",
    tituloCurto: "Inadimplência total",
    definicao:
      "Percentual da carteira de crédito do Sistema Financeiro Nacional com parcelas em atraso superior a 90 dias, no crédito referencial do Banco Central (pessoas físicas e jurídicas, recursos livres e direcionados).",
    comoLer:
      "Quanto maior, maior a parcela do crédito que não vem sendo paga no prazo. Movimentos de décimos de ponto percentual em um mês já são relevantes; compare sempre com o padrão histórico da série.",
    limitacoes:
      "Conceito >90 dias sobre o crédito referencial: difere da inadimplência arrastada do SCR e do atraso ≥15 dias do IF.data. Renegociações podem reduzir o indicador sem melhora real da capacidade de pagamento.",
    formato: "pct",
    decimais: 2,
  },
  {
    slug: "inadimplencia-familias",
    key: "inad_pf",
    titulo: "Inadimplência das famílias",
    tituloCurto: "Inadimplência PF",
    definicao:
      "Percentual da carteira de crédito de pessoas físicas com parcelas em atraso superior a 90 dias, no crédito referencial do Banco Central.",
    comoLer:
      "Termômetro direto do estresse financeiro das famílias. Costuma reagir com defasagem a juros, desemprego e comprometimento de renda.",
    limitacoes:
      "Mesmo conceito >90 dias do crédito referencial; não captura atrasos curtos nem dívidas fora do SFN (crediário informal, contas de consumo).",
    formato: "pct",
    decimais: 2,
  },
  {
    slug: "juros-medios",
    key: "taxa_total",
    titulo: "Taxa média de juros do crédito",
    tituloCurto: "Juros médios",
    definicao:
      "Taxa média de juros das operações de crédito contratadas no mês (novas concessões), agregando pessoas físicas e jurídicas, recursos livres e direcionados, ponderada pelo volume concedido.",
    comoLer:
      "Reflete o custo do crédito NOVO, não do estoque. Cai ou sobe com a Selic, com o mix de modalidades e com o risco percebido pelos bancos.",
    limitacoes:
      "Não é CET: exclui tarifas, seguros e tributos. O mix de modalidades altera a média sem que nenhuma taxa individual mude.",
    formato: "pct_aa",
    decimais: 1,
  },
  {
    slug: "spread-bancario",
    key: "spread_total",
    titulo: "Spread bancário médio",
    tituloCurto: "Spread médio",
    definicao:
      "Diferença, em pontos percentuais, entre a taxa média de juros das concessões e o custo de captação de referência das instituições financeiras.",
    comoLer:
      "Mede quanto o sistema cobra além do que paga para captar. Embute inadimplência esperada, custos administrativos, tributos e margem.",
    limitacoes:
      "Média agregada: o spread varia enormemente entre modalidades (consignado vs. rotativo) e entre instituições. Não decompõe as causas.",
    formato: "pp",
    decimais: 1,
  },
  {
    slug: "saldo-de-credito",
    key: "saldo_total",
    titulo: "Saldo da carteira de crédito",
    tituloCurto: "Saldo de crédito",
    definicao:
      "Estoque total das operações de crédito do Sistema Financeiro Nacional, em reais correntes, somando pessoas físicas e jurídicas.",
    comoLer:
      "O tamanho do crédito na economia. Acompanhe a variação em 12 meses e a razão crédito/PIB para separar crescimento real de inflação.",
    limitacoes:
      "Valores nominais, sem deflação. Cessões de carteira e baixas para prejuízo afetam o estoque sem refletir concessão nova.",
    formato: "brl_mi",
    decimais: 2,
  },
  {
    slug: "concessoes-de-credito",
    key: "concessoes_total",
    titulo: "Concessões mensais de crédito",
    tituloCurto: "Concessões",
    definicao:
      "Volume de crédito novo contratado no mês no Sistema Financeiro Nacional, em reais correntes.",
    comoLer:
      "Fluxo, não estoque: reage mais rápido ao ciclo que o saldo. Tem sazonalidade forte (dezembro alto, janeiro baixo); prefira comparações interanuais.",
    limitacoes:
      "Série nominal e sensível a operações pontuais de grande porte no segmento PJ.",
    formato: "brl_mi",
    decimais: 1,
  },
  {
    slug: "endividamento-das-familias",
    key: "endividamento",
    titulo: "Endividamento das famílias",
    tituloCurto: "Endividamento",
    definicao:
      "Dívida total das famílias com o Sistema Financeiro Nacional em relação à renda acumulada em 12 meses.",
    comoLer:
      "Mede o peso do estoque de dívida sobre a renda anual. Sobe de forma estrutural com o aprofundamento do crédito; o problema é a velocidade, não o nível em si.",
    limitacoes:
      "Só dívidas com o SFN: exclui crediário de lojas não financeiras, dívidas informais e atrasos de contas de consumo. Divulgada com defasagem maior que as demais séries.",
    formato: "pct",
    decimais: 1,
  },
  {
    slug: "comprometimento-de-renda",
    key: "comprometimento",
    titulo: "Comprometimento de renda das famílias",
    tituloCurto: "Comprometimento de renda",
    definicao:
      "Parcela da renda mensal das famílias comprometida com o serviço da dívida (juros e amortizações) junto ao Sistema Financeiro Nacional.",
    comoLer:
      "Complementa o endividamento: dívidas longas e baratas elevam o estoque mas pesam pouco no mês; dívidas curtas e caras fazem o oposto. Acima de padrões históricos, antecipa inadimplência.",
    limitacoes:
      "Estimativa do BCB baseada em hipóteses de prazo e taxa por modalidade; revisões metodológicas alteram a série. Só captura dívidas com o SFN.",
    formato: "pct",
    decimais: 1,
  },
];

export type PontoSerie = { ref: string; v: number };

export type IndicadorPublico = IndicadorDef & {
  valor: number;
  ref: string;
  delta1m: number | null;
  delta12m: number | null;
  unidade: string;
  fonte: string;
  serieCodigo: string;
  frequencia: string;
  metodologia: string;
  urlFonte: string;
  primeiraRef: string;
  nObs: number;
  serie: PontoSerie[];
};

function lerGold(nome: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(process.cwd(), "public", "obs", "data", "gold", `${nome}.json`), "utf-8"),
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

/** Carrega os indicadores públicos a partir do pulse.json (build time). */
export function indicadoresPublicos(): IndicadorPublico[] {
  const pulse = lerGold("pulse") as any;
  return INDICADORES.flatMap((def) => {
    const s = pulse.series?.[def.key];
    if (!s || !Array.isArray(s.obs) || s.obs.length < 2 || s.tipo !== "DADO OBSERVADO") return [];
    const obs: PontoSerie[] = s.obs;
    const ult = obs[obs.length - 1];
    const ant = obs[obs.length - 2];
    const a12 = obs.length >= 13 ? obs[obs.length - 13] : null;
    return [{
      ...def,
      valor: ult.v,
      ref: ult.ref,
      delta1m: ant ? Math.round((ult.v - ant.v) * 1000) / 1000 : null,
      delta12m: a12 ? Math.round((ult.v - a12.v) * 1000) / 1000 : null,
      unidade: s.meta.unit,
      fonte: s.meta.source,
      serieCodigo: String(s.meta.series_code),
      frequencia: s.meta.freq,
      metodologia: s.meta.methodology,
      urlFonte: s.meta.url,
      primeiraRef: obs[0].ref,
      nObs: obs.length,
      serie: obs,
    }];
  });
}

export function indicadorPorSlug(slug: string): IndicadorPublico | null {
  return indicadoresPublicos().find((i) => i.slug === slug) ?? null;
}

export type ResumoDiario = {
  geradoEm: string;
  frase: string;
  refDiagnostico: string;
  confianca: string;
  metodo: string;
  ibcc: { atual: number; percentil: number; delta1m: number | null; delta3m: number | null; delta12m: number | null; ref: string };
  deterioracoes: MudancaResumo[];
  melhoras: MudancaResumo[];
};

export type MudancaResumo = {
  indicador: string;
  anterior: number;
  atual: number;
  delta1m: number;
  unidade: string;
  fonte: string;
  serie: string;
  interpretacao: string;
};

/** Monta o resumo diário a partir do overview.json (build time). */
export function resumoDiario(): ResumoDiario | null {
  const o = lerGold("overview") as any;
  const meta = lerGold("meta") as any;
  if (!o?.diagnostico?.ok) return null;
  const mud = (r: any): MudancaResumo => ({
    indicador: r.indicador,
    anterior: r.anterior,
    atual: r.atual,
    delta1m: r.delta_1m,
    unidade: r.unidade,
    fonte: r.fonte,
    serie: String(r.serie),
    interpretacao: r.interpretacao,
  });
  return {
    geradoEm: meta?.gerado_em ?? o.gerado_em,
    frase: o.diagnostico.frase,
    refDiagnostico: o.diagnostico.ref,
    confianca: o.diagnostico.confianca,
    metodo: o.diagnostico.metodo,
    ibcc: {
      atual: o.ibcc_posicao.atual,
      percentil: o.ibcc_posicao.percentil_historico,
      delta1m: o.ibcc_posicao.delta_1m,
      delta3m: o.ibcc_posicao.delta_3m,
      delta12m: o.ibcc_posicao.delta_12m,
      ref: o.ibcc_posicao.ref,
    },
    deterioracoes: (o.mudancas?.top_deterioracoes ?? []).slice(0, 3).map(mud),
    melhoras: (o.mudancas?.top_melhoras ?? []).slice(0, 3).map(mud),
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-05-01" → "mai/2026" (sem Date: evita fuso). */
export function fmtRefMes(iso: string): string {
  const m = Number(iso.slice(5, 7));
  return `${MESES[m - 1] ?? "?"}/${iso.slice(0, 4)}`;
}

const nbr = (v: number, dec: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Valor principal formatado conforme o tipo do indicador. */
export function fmtValor(i: { formato: IndicadorDef["formato"]; decimais: number }, v: number): string {
  if (i.formato === "brl_mi") {
    return v >= 1e6 ? `R$ ${nbr(v / 1e6, i.decimais)} tri` : `R$ ${nbr(v / 1e3, i.decimais)} bi`;
  }
  if (i.formato === "pct") return `${nbr(v, i.decimais)}%`;
  if (i.formato === "pct_aa") return `${nbr(v, i.decimais)}% a.a.`;
  return `${nbr(v, i.decimais)} p.p.`;
}

/** Variação mensal formatada com sinal, na unidade natural da série. */
export function fmtDelta(i: IndicadorPublico, d: number | null): string {
  if (d == null) return "";
  const sinal = d > 0 ? "+" : "";
  if (i.formato === "brl_mi") return `${sinal}${nbr(d / 1e3, 1)} bi`;
  return `${sinal}${nbr(d, 2)} p.p.`;
}
