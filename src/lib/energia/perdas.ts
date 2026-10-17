/**
 * Leitura da gold de Perdas (public/energia/gold/perdas.json) para a página
 * /setor-eletrico/perdas: regras de comparabilidade, medidas do mapa com classes
 * fixas, agrupamento dos municípios em áreas de distribuidora, linhas das tabelas e
 * as respostas curtas de cada painel.
 *
 * Por que aqui e não nos componentes: mapa, tabela, exportação e texto precisam ler o
 * mesmo número pela mesma regra. Se cada componente decidisse sozinho o que entra na
 * comparação, o mapa poderia pintar uma distribuidora que a tabela marca como fora.
 * Nada aqui recalcula taxa: as razões vêm prontas do pipeline (razão de somas em kWh);
 * a interface só escolhe, converte unidade (MWh em GWh) e escreve.
 *
 * As regras de validade (validoTotal, validoTecnica, validoPntBt) espelham as funções
 * _valido_para_agregado, _valido_tecnica e _valido_pnt_bt de
 * pipeline/energia/modulos/perdas.py; o teste src/tests/energia-perdas.test.ts confere
 * que, aplicadas à série anual publicada, elas reproduzem ano a ano o número de
 * distribuidoras somadas na série nacional. Os textos automáticos seguem regras
 * determinísticas: sem dado, a frase diz que não há dado, nunca preenche.
 */
import type {
  AlertaAnual,
  Associacao,
  Distribuidora,
  EstadoDecomposicao,
  EstadoReconciliacao,
  LinhaAnualPerdas,
  LinhaNacional,
  MunicipiosPerdas,
  OrigemInjetada,
  PerdasGold,
  SegmentoTecnico,
  SerieAnualPerdas,
  Territorio,
} from "./tipos-perdas";
import type { ColunaTabela, LinhaTabela } from "./tabela";
import { classeDe, diferencaPar, formatarDiferenca, quebrasFixas, sentidoDiferenca, type Classificacao } from "./escalas";
import type { Idioma } from "@/lib/idioma";
import { resumo as resumoDistribuicao } from "./distribuicao";
import { dataBR, mesAno, nomeMes, num, plural } from "./formato";
import { idiomaEnergia, tx } from "./idioma";

/* ------------------------------------------------------------------ números com ausência escrita */

/**
 * Número em pt-BR em que a ausência vira "sem dado": o formato compartilhado devolve um
 * traço ("–"), que no meio de uma frase ou de uma célula do módulo parece pontuação e
 * pode ser lido como zero. Os textos e tabelas de perdas usam estes dois.
 */
export function numOu(v: number | null | undefined, casas: number, idioma: Idioma = idiomaEnergia()): string {
  return v === null || v === undefined || !Number.isFinite(v) ? tx("sem dado", "no data", idioma) : num(v, casas, idioma);
}

/** Percentual com o símbolo, ou "sem dado" (nunca "–%"). */
export function pctOu(v: number | null | undefined, casas: number, idioma: Idioma = idiomaEnergia()): string {
  return v === null || v === undefined || !Number.isFinite(v) ? tx("sem dado", "no data", idioma) : `${num(v, casas, idioma)}%`;
}

/* ------------------------------------------------------------------ rótulos */

export function rotulosAlerta(idioma: Idioma = idiomaEnergia()): Record<AlertaAnual, string> {
  return {
    injetada_nao_positiva: tx("energia injetada nula ou negativa", "zero or negative injected energy", idioma),
    perda_total_negativa: tx("perda total negativa", "negative total loss", idioma),
    perda_total_maior_que_injetada: tx("perda total maior que a energia injetada", "total loss greater than the injected energy", idioma),
    fornecida_maior_que_injetada: tx("energia fornecida maior que a injetada", "supplied energy greater than the injected energy", idioma),
    balanco_nao_fecha: tx("balanço que não fecha (resíduo acima de 5% da injetada)", "balance that does not close (residual above 5% of the injected energy)", idioma),
    representacoes_conflitantes: tx("duas representações da mesma grandeza que não concordam", "two representations of the same quantity that do not agree", idioma),
  };
}
export const ROTULO_ALERTA: Record<AlertaAnual, string> = rotulosAlerta("pt");

export function rotulosDecomposicao(idioma: Idioma = idiomaEnergia()): Record<EstadoDecomposicao, string> {
  return {
    fecha: tx("fecha (até 2 kWh por mês)", "closes (up to 2 kWh per month)", idioma),
    diferenca_pequena: tx("diferença pequena (até 0,1% da perda total)", "small difference (up to 0.1% of the total loss)", idioma),
    nao_fecha: tx("não fecha", "does not close", idioma),
    sem_separacao: tx("sem separação publicada", "no separation published", idioma),
  };
}
export const ROTULO_DECOMPOSICAO: Record<EstadoDecomposicao, string> = rotulosDecomposicao("pt");

export function rotulosOrigem(idioma: Idioma = idiomaEnergia()): Record<OrigemInjetada, string> {
  return {
    publicada: tx("linha publicada", "published line", idioma),
    requerida: tx("fornecida + irregular + perdas (leiaute de 2024)", "supplied + irregular + losses (2024 layout)", idioma),
    mista: tx("mista (dois leiautes no ano)", "mixed (two layouts in the year)", idioma),
  };
}
export const ROTULO_ORIGEM: Record<OrigemInjetada, string> = rotulosOrigem("pt");

export function rotulosReconciliacao(idioma: Idioma = idiomaEnergia()): Record<EstadoReconciliacao, string> {
  return {
    fecha: tx("fecha (até 1 kWh por linha)", "closes (up to 1 kWh per line)", idioma),
    residuo_pequeno: tx("resíduo pequeno (até 0,1% da injetada)", "small residual (up to 0.1% of the injected energy)", idioma),
    residuo_relevante: tx("resíduo relevante", "relevant residual", idioma),
    sem_componentes: tx("sem componentes para fechar", "no components to close", idioma),
  };
}
export const ROTULO_RECONCILIACAO: Record<EstadoReconciliacao, string> = rotulosReconciliacao("pt");

export function rotulosDefinicao(idioma: Idioma = idiomaEnergia()): Record<keyof PerdasGold["definicoes"], string> {
  return {
    perdas_totais: tx("Perdas totais", "Total losses", idioma),
    perdas_tecnicas: tx("Perdas técnicas", "Technical losses", idioma),
    perdas_nao_tecnicas: tx("Perdas não técnicas", "Non-technical losses", idioma),
    energia_injetada: tx("Energia injetada", "Injected energy", idioma),
    mercado_bt: tx("Mercado de baixa tensão", "Low-voltage market", idioma),
    residuo: tx("Resíduo do balanço", "Balance residual", idioma),
    tecnica_regulatoria: tx(
      "Perda técnica informada, em trechos de razão constante (inferida pelo observatório)",
      "Reported technical loss, in constant-ratio segments (inferred by the observatory)",
      idioma,
    ),
    custo_tarifa: tx("Custo das perdas na tarifa", "Cost of losses in the tariff", idioma),
  };
}
export const ROTULO_DEFINICAO: Record<keyof PerdasGold["definicoes"], string> = rotulosDefinicao("pt");

export function rotulosGrupo(idioma: Idioma = idiomaEnergia()): Record<Distribuidora["grupo"], string> {
  return {
    concessionaria: tx("Concessionária", "Concession holder", idioma),
    permissionaria: tx("Permissionária", "Permit holder", idioma),
  };
}
export const ROTULO_GRUPO: Record<Distribuidora["grupo"], string> = rotulosGrupo("pt");

/** Estados de decomposição em que técnica + não técnica reproduzem o total (DECOMPOSICAO_OK do pipeline). */
export const DECOMPOSICAO_OK: readonly EstadoDecomposicao[] = ["fecha", "diferenca_pequena"];

/** Ordem dos campos de cada linha de perdas_anual.json (conferida contra `campos` no teste). */
export const CAMPOS_ANUAIS = [
  "ano", // i18n: dado
  "meses",
  "completo",
  "injetada_mwh",
  "perdas_totais_mwh",
  "taxa_total_pct",
  "perdas_tecnicas_mwh",
  "taxa_tecnica_pct",
  "pnt_mwh",
  "pnt_bt_pct",
  "mercado_bt_mwh",
  "residuo_pct_injetada",
  "reconciliacao",
  "alertas",
  "origem_injetada",
  "decomposicao",
  "taxa_tecnica_injetada_publicada_pct",
  "universo_muda_ano_anterior",
] as const;

/** Nome curto de uma distribuidora: sigla da fonte quando existe, senão o nome. */
export function rotuloDistribuidora(d: Pick<Distribuidora, "sigla" | "nome">): string {
  return d.sigla ?? d.nome;
}

/**
 * O que os componentes cliente recebem de cada distribuidora: só os campos que o mapa, a
 * tabela e o painel de seleção usam (as props de componente cliente viajam no HTML da
 * página; a distribuidora inteira da gold pesa o dobro).
 */
export type DistribuidoraLeve = Pick<
  Distribuidora,
  "cnpj" | "cnpj_formatado" | "sigla" | "nome" | "grupo" | "primeira_competencia" | "ultima_competencia" | "ativa" | "referencia" | "variacao" | "parcial"
> & {
  territorio: Pick<Territorio, "ufs" | "municipios" | "exclusivos" | "compartilhados" | "nao_confirmados"> | null;
  /** Competências (AAAA-MM) de absorção provável de outras distribuidoras, observadas no SAMP. */
  absorcoes: string[];
};

export function leve(d: Distribuidora): DistribuidoraLeve {
  const t = d.territorio;
  return {
    cnpj: d.cnpj,
    cnpj_formatado: d.cnpj_formatado,
    sigla: d.sigla,
    nome: d.nome,
    grupo: d.grupo,
    primeira_competencia: d.primeira_competencia,
    ultima_competencia: d.ultima_competencia,
    ativa: d.ativa,
    referencia: d.referencia,
    variacao: d.variacao,
    parcial: d.parcial,
    territorio: t ? { ufs: t.ufs, municipios: t.municipios, exclusivos: t.exclusivos, compartilhados: t.compartilhados, nao_confirmados: t.nao_confirmados } : null,
    absorcoes: d.eventos.filter((e) => e.tipo === "absorcao_provavel").map((e) => e.competencia),
  };
}

/**
 * Aviso de território para o período do mapa: a área de cada distribuidora vem da relação
 * conjunto × município de um ano só (a mais recente). Para um ano anterior, a distribuidora
 * que absorveu outra depois dele aparece com o território de hoje, maior que o que atendia;
 * o aviso nomeia essas distribuidoras em vez de deixar a cor sugerir uma área que não existia.
 */
export function avisoTerritorio(
  distribuidoras: readonly Pick<DistribuidoraLeve, "sigla" | "nome" | "absorcoes">[],
  periodo: PeriodoPerdas,
  anoRelacao: number | null,
  idioma: Idioma = idiomaEnergia(),
): string | null {
  if (anoRelacao === null) return null;
  const depois = distribuidoras
    .flatMap((d) => d.absorcoes.filter((c) => Number(c.slice(0, 4)) > periodo.ano).map((c) => ({ rotulo: rotuloDistribuidora(d), c })))
    .sort((a, b) => a.c.localeCompare(b.c) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const base = tx(`Território: municípios da relação de ${anoRelacao}.`, `Territory: municipalities in the ${anoRelacao} relation.`, idioma);
  if (!depois.length) return base;
  return tx(
    `${base} Depois de ${periodo.ano}, ${depois.map((x) => `${x.rotulo} absorveu outra distribuidora (${mesAno(x.c)})`).join("; ")}: no mapa de ${periodo.ano}, a área ${
      depois.length === 1 ? "dela inclui municípios que ela" : "delas inclui municípios que elas"
    } ainda não atendia${depois.length === 1 ? "" : "m"}, e a distribuidora absorvida, sem área na relação atual, só aparece na tabela.`,
    `${base} After ${periodo.ano}, ${depois.map((x) => `${x.rotulo} absorbed another distribution utility (${mesAno(x.c, idioma)})`).join("; ")}: on the ${periodo.ano} map, ${
      depois.length === 1 ? "its area includes municipalities it did" : "their areas include municipalities they did"
    } not yet serve, and the absorbed distribution utility, with no area in the current relation, appears only in the table.`,
    idioma,
  );
}

/* ------------------------------------------------------------------ recorte por distribuidora */

/**
 * Valores de uma distribuidora num recorte (um ano civil ou o acumulado do ano aberto),
 * na mesma forma qualquer que seja a origem (gold, série anual sob demanda ou acumulado).
 */
export type RecortePerdas = {
  tipo: "ano" | "acumulado";
  ano: number;
  meses: number;
  completo: boolean;
  injetada_mwh: number | null;
  perdas_totais_mwh: number | null;
  taxa_total_pct: number | null;
  perdas_tecnicas_mwh: number | null;
  taxa_tecnica_pct: number | null;
  pnt_mwh: number | null;
  pnt_injetada_pct: number | null;
  pnt_bt_pct: number | null;
  mercado_bt_mwh: number | null;
  alertas: AlertaAnual[];
  decomposicao: EstadoDecomposicao | null;
  origem: OrigemInjetada | null;
  /** Quebra de escala ou absorção contra o ano anterior (série anual); null quando não se aplica. */
  universo_muda: boolean | null;
  /** Só no acumulado: completa e sem alerta nos dois recortes, sem quebra de escala nem absorção. */
  comparavel_acumulado: boolean | null;
  /** Só no acumulado: o mesmo período do ano anterior. */
  anterior: { taxa_total_pct: number | null; perdas_totais_mwh: number | null } | null;
};

export function recorteDaTupla(t: LinhaAnualPerdas): RecortePerdas {
  // índices literais na ordem de CAMPOS_ANUAIS (o teste confere a ordem contra o arquivo)
  const um = t[17];
  return {
    tipo: "ano", // i18n: dado
    ano: t[0],
    meses: t[1],
    completo: t[2] === 1,
    injetada_mwh: t[3],
    perdas_totais_mwh: t[4],
    taxa_total_pct: t[5],
    perdas_tecnicas_mwh: t[6],
    taxa_tecnica_pct: t[7],
    pnt_mwh: t[8],
    // a série anual não traz a não técnica sobre a injetada; ela só existe no ano de referência
    pnt_injetada_pct: null,
    pnt_bt_pct: t[9],
    mercado_bt_mwh: t[10],
    alertas: t[13],
    decomposicao: t[15],
    origem: t[14],
    universo_muda: um === null ? null : um === 1,
    comparavel_acumulado: null,
    anterior: null,
  };
}

export function recorteDaReferencia(d: Pick<DistribuidoraLeve, "referencia" | "variacao">): RecortePerdas | null {
  const r = d.referencia;
  if (!r) return null;
  return {
    tipo: "ano", // i18n: dado
    ano: r.ano,
    meses: r.meses,
    completo: r.completo,
    injetada_mwh: r.injetada_mwh,
    perdas_totais_mwh: r.perdas_totais_mwh,
    taxa_total_pct: r.taxa_total_pct,
    perdas_tecnicas_mwh: r.perdas_tecnicas_mwh,
    taxa_tecnica_pct: r.taxa_tecnica_pct,
    pnt_mwh: r.pnt_mwh,
    pnt_injetada_pct: r.pnt_injetada_pct,
    pnt_bt_pct: r.pnt_bt_pct,
    mercado_bt_mwh: r.mercado_bt_mwh,
    alertas: r.alertas,
    decomposicao: r.decomposicao,
    origem: r.origem_injetada,
    universo_muda: d.variacao ? d.variacao.quebra_escala || d.variacao.absorcao : null,
    comparavel_acumulado: null,
    anterior: null,
  };
}

export function recorteDoAcumulado(d: Pick<DistribuidoraLeve, "parcial">): RecortePerdas | null {
  const p = d.parcial;
  if (!p) return null;
  return {
    tipo: "acumulado",
    ano: p.ano,
    meses: p.meses,
    completo: p.completo,
    injetada_mwh: p.injetada_mwh,
    perdas_totais_mwh: p.perdas_totais_mwh,
    taxa_total_pct: p.taxa_total_pct,
    perdas_tecnicas_mwh: null,
    taxa_tecnica_pct: null,
    pnt_mwh: null,
    pnt_injetada_pct: null,
    pnt_bt_pct: p.pnt_bt_pct,
    mercado_bt_mwh: null,
    alertas: p.alertas,
    decomposicao: null,
    origem: p.origem_injetada,
    universo_muda: null,
    comparavel_acumulado: p.comparavel,
    anterior: { taxa_total_pct: p.anterior.taxa_total_pct, perdas_totais_mwh: p.anterior.perdas_totais_mwh },
  };
}

/* ------------------------------------------------------------------ regras de validade */

/** Entra em agregado e em comparação: 12 meses, sem alerta físico, injetada e perdas publicadas. */
export function validoTotal(a: RecortePerdas): boolean {
  if (a.tipo === "acumulado") return a.comparavel_acumulado === true && a.taxa_total_pct !== null;
  return a.completo && a.alertas.length === 0 && a.injetada_mwh !== null && a.perdas_totais_mwh !== null;
}

/** Técnica nos 12 meses e decomposição que não contradiz a linha técnica. */
export function validoTecnica(a: RecortePerdas): boolean {
  return a.tipo === "ano" && validoTotal(a) && a.perdas_tecnicas_mwh !== null && a.decomposicao !== "nao_fecha";
}

/** Não técnica e mercado BT nos 12 meses, com a decomposição fechando. */
export function validoPntBt(a: RecortePerdas): boolean {
  return (
    a.tipo === "ano" &&
    validoTotal(a) &&
    a.pnt_mwh !== null &&
    a.mercado_bt_mwh !== null &&
    a.decomposicao !== null &&
    DECOMPOSICAO_OK.includes(a.decomposicao)
  );
}

/** Por que o recorte não entra na comparação da perda total; null quando entra. */
export function motivoForaTotal(a: RecortePerdas, idioma: Idioma = idiomaEnergia()): string | null {
  const alerta = (x: AlertaAnual) => tx(`alerta físico: ${rotulosAlerta(idioma)[x]}`, `physical alert: ${rotulosAlerta(idioma)[x]}`, idioma);
  if (a.tipo === "acumulado") {
    if (a.comparavel_acumulado) return null;
    if (a.alertas.length) return alerta(a.alertas[0]);
    if (!a.completo) return tx(`${a.meses} meses publicados no recorte`, `${a.meses} months published in the selection`, idioma);
    return tx(
      "sem o mesmo recorte comparável no ano anterior (mês faltando, alerta ou mudança de escala)",
      "without the same comparable selection in the previous year (missing month, alert or change of scale)",
      idioma,
    );
  }
  // completo no pipeline = 12 meses com perdas e injetada em todos; 12 meses sem uma delas também fica fora
  if (!a.completo)
    return a.meses < 12
      ? tx(`ano incompleto: ${plural(a.meses, "mês publicado", "meses publicados")}`, `incomplete year: ${plural(a.meses, "month published", "months published", idioma)}`, idioma)
      : tx("perdas ou energia injetada ausentes em algum dos 12 meses", "losses or injected energy missing in one of the 12 months", idioma);
  if (a.alertas.length) return alerta(a.alertas[0]);
  if (a.injetada_mwh === null || a.perdas_totais_mwh === null) return tx("injetada ou perdas ausentes em algum mês", "injected energy or losses missing in some month", idioma);
  return null;
}

/* ------------------------------------------------------------------ medidas do mapa */

export type IdMedida = "taxa" | "volume" | "tecnica" | "pnt_bt" | "variacao";

export type Medida = {
  id: IdMedida;
  rotulo: string;
  /** Unidade por extenso (legenda, tabela, dica). */
  unidade: string;
  /** Sufixo curto do número ("%", " GWh", " p.p."). */
  sufixo: string;
  /**
   * Casas dos valores: as taxas chegam da gold com duas casas, e reescrevê-las com uma
   * arredondaria de novo (14,748% publicado como 14,75 viraria 14,8%, contra os 14,7% da
   * evidência). Por isso taxa e variação aparecem com as duas casas publicadas.
   */
  casas: number;
  /** Casas dos limites das classes na legenda. */
  casasCortes: number;
  /**
   * Cortes fixos, os mesmos em todos os anos: a cor de 2010 e a de 2025 querem dizer a
   * mesma faixa (seção 8.3, escala fixa entre anos). Escolhidos sobre a distribuição de
   * todas as distribuidoras válidas de 2003 a 2025 (pipeline: perdas_anual.json).
   */
  cortes: readonly number[];
  cores: readonly string[];
  explicacao: string;
  denominador: string | null;
  natureza: "OBSERVADO" | "ESTIMADO" | "CALCULADO";
  /** Só existe para o ano de referência (variação contra o ano anterior publicada na gold). */
  soReferencia: boolean;
  /** Existe no acumulado do ano aberto. */
  noAcumulado: boolean;
};

const SEQ = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"] as const;
const DIV = ["var(--escala-div-neg-2)", "var(--escala-div-neg-1)", "var(--escala-div-centro)", "var(--escala-div-pos-1)", "var(--escala-div-pos-2)"] as const;

export function medidas(idioma: Idioma = idiomaEnergia()): Record<IdMedida, Medida> {
  const injetadaRef = tx("energia injetada de referência", "reference injected energy", idioma);
  const pctInjetada = tx("% da energia injetada", "% of injected energy", idioma);
  return {
    taxa: {
      id: "taxa",
      rotulo: tx("Taxa de perdas totais", "Total loss rate", idioma),
      unidade: pctInjetada,
      sufixo: "%",
      casas: 2,
      casasCortes: 0,
      // de 5 em 5 pontos até 15% (a ordem da taxa nacional) e um degrau largo até 25%
      cortes: [5, 10, 15, 25],
      cores: SEQ,
      explicacao: tx(
        "Perdas totais medidas (energia injetada na rede que não chega como consumo medido) divididas pela energia injetada de referência da própria distribuidora no período.",
        "Measured total losses (energy injected into the grid that does not arrive as metered consumption) divided by the distribution utility's own reference injected energy in the period.",
        idioma,
      ),
      denominador: injetadaRef,
      natureza: "CALCULADO",
      soReferencia: false,
      noAcumulado: true,
    },
    volume: {
      id: "volume",
      rotulo: tx("Perdas totais em energia", "Total losses in energy", idioma),
      unidade: "GWh",
      sufixo: " GWh",
      casas: 0,
      casasCortes: 0,
      // escala próxima da logarítmica: o volume vai de menos de 1 GWh a mais de 10 TWh
      cortes: [10, 100, 1000, 5000],
      cores: SEQ,
      explicacao: tx(
        "Energia perdida no período, em GWh: a diferença que a ANEEL calcula no balanço de cada distribuidora (valor medido). Distribuidora grande perde mais em volume mesmo com taxa menor.",
        "Energy lost in the period, in GWh: the difference ANEEL calculates in each distribution utility's balance (measured value). A large distribution utility loses more in volume even with a lower rate.",
        idioma,
      ),
      denominador: null,
      natureza: "OBSERVADO",
      soReferencia: false,
      noAcumulado: true,
    },
    tecnica: {
      id: "tecnica",
      rotulo: tx("Perdas técnicas", "Technical losses", idioma),
      unidade: pctInjetada,
      sufixo: "%",
      casas: 2,
      casasCortes: 0,
      cortes: [4, 6, 8, 10],
      cores: SEQ,
      explicacao: tx(
        "Perdas técnicas sobre a energia injetada de referência. No SAMP, a técnica é a perda técnica informada no balanço de energia: estimativa, não medição, e pode diferir do percentual técnico regulatório homologado.",
        "Technical losses over the reference injected energy. In SAMP, the technical figure is the technical loss reported in the energy balance: an estimate, not a measurement, and it can differ from the ratified regulatory technical percentage.",
        idioma,
      ),
      denominador: injetadaRef,
      natureza: "ESTIMADO",
      soReferencia: false,
      noAcumulado: false,
    },
    pnt_bt: {
      id: "pnt_bt",
      rotulo: tx("Perdas não técnicas", "Non-technical losses", idioma),
      unidade: tx("% do mercado de baixa tensão", "% of the low-voltage market", idioma),
      sufixo: "%",
      casas: 2,
      casasCortes: 0,
      // a primeira classe guarda os negativos: estimativa técnica acima da perda total medida
      cortes: [0, 5, 10, 20],
      cores: SEQ,
      explicacao: tx(
        "Perdas não técnicas publicadas pela fonte divididas pelo mercado de baixa tensão medido, a base que a ANEEL usa na regulação. Incluem furto, fraude e erros de medição, leitura e faturamento, que a fonte não separa.",
        "Non-technical losses published by the source divided by the metered low-voltage market, the base ANEEL uses in regulation. They include theft, fraud and metering, reading and billing errors, which the source does not separate.",
        idioma,
      ),
      denominador: tx("mercado de baixa tensão medido", "metered low-voltage market", idioma),
      natureza: "ESTIMADO",
      soReferencia: false,
      noAcumulado: false,
    },
    variacao: {
      id: "variacao",
      rotulo: tx("Variação da taxa de perdas totais", "Change in the total loss rate", idioma),
      unidade: tx("p.p. em relação ao ano anterior", "p.p. against the previous year", idioma),
      sufixo: " p.p.",
      casas: 2,
      casasCortes: 1,
      // classe central de ±0,5 p.p.: abaixo disso a mudança é da ordem do arredondamento das taxas anuais
      cortes: [-2, -0.5, 0.5, 2],
      cores: DIV,
      explicacao: tx(
        "Diferença, em pontos percentuais, entre a taxa de perdas totais do ano de referência e a do ano anterior, só com os dois anos completos, sem alerta e sem quebra de escala nem absorção entre eles.",
        "Difference, in percentage points, between the total loss rate of the reference year and that of the previous year, only with both years complete, without alerts and with no scale break or absorption between them.",
        idioma,
      ),
      denominador: tx("energia injetada de referência de cada ano", "reference injected energy of each year", idioma),
      natureza: "CALCULADO",
      soReferencia: true,
      noAcumulado: false,
    },
  };
}
export const MEDIDAS: Record<IdMedida, Medida> = medidas("pt");

export const ORDEM_MEDIDAS: readonly IdMedida[] = ["taxa", "volume", "tecnica", "pnt_bt", "variacao"];

/* ------------------------------------------------------------------ períodos */

export type PeriodoPerdas = { id: string; rotulo: string; tipo: "ano" | "acumulado"; ano: number; referencia: boolean };

/** Anos civis completos (do mais recente ao mais antigo) e, quando existe, o acumulado do ano aberto. */
export function periodosDisponiveis(g: Pick<PerdasGold, "nacional" | "acumulado" | "referencia">, idioma: Idioma = idiomaEnergia()): PeriodoPerdas[] {
  const anos = Array.from(new Set(g.nacional.filter((l) => !l.parcial && l.ano <= g.referencia.ano).map((l) => l.ano))).sort((a, b) => b - a);
  const out: PeriodoPerdas[] = anos.map((a) => ({
    id: String(a),
    rotulo: a === g.referencia.ano ? tx(`${a} (ano de referência)`, `${a} (reference year)`, idioma) : String(a),
    tipo: "ano", // i18n: dado
    ano: a,
    referencia: a === g.referencia.ano,
  }));
  if (g.acumulado) {
    out.unshift({
      id: "acumulado",
      rotulo: tx(
        `${g.acumulado.ano}, janeiro a ${MESES_LONGOS[g.acumulado.mes_fim - 1]} (acumulado)`,
        `${g.acumulado.ano}, January to ${nomeMes(g.acumulado.mes_fim, idioma, true)} (year to date)`,
        idioma,
      ),
      tipo: "acumulado",
      ano: g.acumulado.ano,
      referencia: false,
    });
  }
  return out;
}

/** Meses por extenso em português (as frases inglesas usam nomeMes(m, "en", true)). */
export const MESES_LONGOS = Array.from({ length: 12 }, (_, i) => nomeMes(i + 1, "pt", true));

/** Medidas que fazem sentido no período (variação só no ano de referência; separação não existe no acumulado). */
export function medidasDoPeriodo(p: PeriodoPerdas): IdMedida[] {
  return ORDEM_MEDIDAS.filter((m) => (p.tipo === "acumulado" ? MEDIDAS[m].noAcumulado : !MEDIDAS[m].soReferencia || p.referencia));
}

/** Período e medida válidos juntos: a medida pedida que não existe no período cai na taxa total. */
export function ajustaConsulta(periodos: readonly PeriodoPerdas[], periodoId: string, medidaId: string, idioma: Idioma = idiomaEnergia()): { periodo: PeriodoPerdas; medida: Medida } {
  const periodo = periodos.find((p) => p.id === periodoId) ?? periodos.find((p) => p.referencia) ?? periodos[0];
  const ok = medidasDoPeriodo(periodo);
  const medida = medidas(idioma)[(ok as string[]).includes(medidaId) ? (medidaId as IdMedida) : "taxa"];
  return { periodo, medida };
}

/**
 * Recortes de todas as distribuidoras no período. Ano de referência e acumulado vêm da gold;
 * outro ano vem da série anual (sob demanda): sem ela, devolve null e a página mostra que
 * está carregando, nunca o ano de referência no lugar do pedido.
 */
export function recortesDoPeriodo(
  distribuidoras: readonly DistribuidoraLeve[],
  periodo: PeriodoPerdas,
  anual: SerieAnualPerdas | null,
): Map<string, RecortePerdas | null> | null {
  const out = new Map<string, RecortePerdas | null>();
  if (periodo.tipo === "acumulado") {
    for (const d of distribuidoras) out.set(d.cnpj, recorteDoAcumulado(d));
    return out;
  }
  if (periodo.referencia) {
    for (const d of distribuidoras) out.set(d.cnpj, d.referencia && d.referencia.ano === periodo.ano ? recorteDaReferencia(d) : null);
    return out;
  }
  if (!anual) return null;
  for (const d of distribuidoras) {
    const t = anual.distribuidoras[d.cnpj]?.find((x) => x[0] === periodo.ano);
    out.set(d.cnpj, t ? recorteDaTupla(t) : null);
  }
  return out;
}

/* ------------------------------------------------------------------ valor de mapa */

export type ValorMapa =
  | { estado: "valor"; v: number }
  | { estado: "sem-dado"; motivo: string }
  /** Valor publicado pela fonte, mas fora da comparação (ano incompleto, alerta, decomposição). */
  | { estado: "fora"; v: number | null; motivo: string };

function semDadoNoPeriodo(d: Pick<DistribuidoraLeve, "primeira_competencia" | "ultima_competencia" | "ativa">, periodo: PeriodoPerdas, idioma: Idioma): string {
  const ini = Number(d.primeira_competencia.slice(0, 4));
  const fim = Number(d.ultima_competencia.slice(0, 4));
  if (periodo.ano < ini) return tx(`série começa em ${mesAno(d.primeira_competencia)}`, `series starts in ${mesAno(d.primeira_competencia, idioma)}`, idioma);
  if (periodo.ano > fim || (!d.ativa && periodo.ano >= fim)) return tx(`série encerrada em ${mesAno(d.ultima_competencia)}`, `series ended in ${mesAno(d.ultima_competencia, idioma)}`, idioma);
  return tx(`sem balanço publicado em ${periodo.ano}`, `no balance published in ${periodo.ano}`, idioma);
}

const r = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;

/** Valor de uma medida para uma distribuidora no período, com o estado que decide a cor. */
export function valorMedida(d: DistribuidoraLeve, rec: RecortePerdas | null, medida: IdMedida, periodo: PeriodoPerdas, idioma: Idioma = idiomaEnergia()): ValorMapa {
  if (medida === "variacao") {
    const v = d.variacao;
    if (!periodo.referencia || !rec)
      return {
        estado: "sem-dado",
        motivo: rec ? tx("variação publicada só para o ano de referência", "change published only for the reference year", idioma) : semDadoNoPeriodo(d, periodo, idioma),
      };
    if (!v) return { estado: "sem-dado", motivo: tx(`sem ${periodo.ano - 1} publicado para comparar`, `no ${periodo.ano - 1} published to compare`, idioma) };
    if (!v.comparavel || v.taxa_total_pp === null) {
      const motivo = v.quebra_escala
        ? tx("quebra de escala entre os dois anos (injetada mudou mais de 30%)", "scale break between the two years (injected energy changed by more than 30%)", idioma)
        : v.absorcao
          ? tx("absorção provável de outra distribuidora entre os dois anos", "probable absorption of another distribution utility between the two years", idioma)
          : tx("um dos dois anos está incompleto ou tem alerta físico", "one of the two years is incomplete or has a physical alert", idioma);
      return { estado: "fora", v: null, motivo };
    }
    return { estado: "valor", v: v.taxa_total_pp }; // i18n: dado
  }
  if (!rec) return { estado: "sem-dado", motivo: semDadoNoPeriodo(d, periodo, idioma) };
  const foraTotal = motivoForaTotal(rec, idioma);
  if (medida === "taxa" || medida === "volume") {
    const bruto = medida === "taxa" ? rec.taxa_total_pct : rec.perdas_totais_mwh === null ? null : rec.perdas_totais_mwh / 1000;
    if (bruto === null)
      return foraTotal ? { estado: "fora", v: null, motivo: foraTotal } : { estado: "sem-dado", motivo: tx("perdas ou injetada ausentes", "losses or injected energy missing", idioma) };
    return foraTotal ? { estado: "fora", v: bruto, motivo: foraTotal } : { estado: "valor", v: bruto }; // i18n: dado
  }
  const naoFecha = tx("total diferente de técnica + não técnica (decomposição não fecha)", "total different from technical + non-technical (decomposition does not close)", idioma);
  if (medida === "tecnica") {
    if (rec.taxa_tecnica_pct === null) return { estado: "sem-dado", motivo: tx("técnica não publicada em todos os meses", "technical losses not published in every month", idioma) };
    if (foraTotal) return { estado: "fora", v: rec.taxa_tecnica_pct, motivo: foraTotal };
    if (!validoTecnica(rec)) return { estado: "fora", v: rec.taxa_tecnica_pct, motivo: naoFecha };
    return { estado: "valor", v: rec.taxa_tecnica_pct }; // i18n: dado
  }
  // pnt_bt
  if (rec.pnt_bt_pct === null) {
    return {
      estado: "sem-dado",
      motivo:
        rec.mercado_bt_mwh === null
          ? tx("mercado de baixa tensão não publicado", "low-voltage market not published", idioma)
          : tx("não técnica não publicada em todos os meses", "non-technical losses not published in every month", idioma),
    };
  }
  if (foraTotal) return { estado: "fora", v: rec.pnt_bt_pct, motivo: foraTotal };
  if (!validoPntBt(rec)) {
    const motivo =
      rec.decomposicao === "nao_fecha"
        ? naoFecha
        : tx(
            "técnica ou não técnica ausente em algum mês, sem como conferir a decomposição",
            "technical or non-technical losses missing in some month, with no way to check the decomposition",
            idioma,
          );
    return { estado: "fora", v: rec.pnt_bt_pct, motivo };
  }
  return { estado: "valor", v: rec.pnt_bt_pct }; // i18n: dado
}

export function valoresDoPeriodo(
  distribuidoras: readonly DistribuidoraLeve[],
  recortes: Map<string, RecortePerdas | null>,
  medida: IdMedida,
  periodo: PeriodoPerdas,
  idioma: Idioma = idiomaEnergia(),
): Record<string, ValorMapa> {
  const out: Record<string, ValorMapa> = {};
  for (const d of distribuidoras) out[d.cnpj] = valorMedida(d, recortes.get(d.cnpj) ?? null, medida, periodo, idioma);
  return out;
}

/** Classes fixas da medida sobre os valores comparáveis (os "fora" não entram na contagem). */
export function classificacaoMedida(medida: Medida, valores: Readonly<Record<string, ValorMapa>>, idioma: Idioma = idiomaEnergia()): Classificacao {
  const vs = Object.values(valores).map((v) => (v.estado === "valor" ? v.v : null));
  return quebrasFixas(medida.cortes, vs, { casas: medida.casasCortes, formatar: (v) => textoNumero(v, { ...medida, casas: medida.casasCortes }, idioma) });
}

/** Número com o sufixo da medida, com sinal só na variação ("+0,9 p.p."). */
export function textoNumero(v: number | null | undefined, medida: Pick<Medida, "id" | "casas" | "sufixo">, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return tx("sem dado", "no data", idioma);
  const arred = r(v, medida.casas);
  const corpo = num(Math.abs(arred), medida.casas, idioma);
  const sinal = medida.id === "variacao" ? (arred > 0 ? "+" : arred < 0 ? "−" : "") : arred < 0 ? "−" : "";
  return `${sinal}${corpo}${medida.sufixo}`;
}

export function textoValorMapa(v: ValorMapa, medida: Medida, idioma: Idioma = idiomaEnergia()): string {
  if (v.estado === "valor") return textoNumero(v.v, medida, idioma);
  if (v.estado === "sem-dado") return tx(`sem dado (${v.motivo})`, `no data (${v.motivo})`, idioma);
  return v.v === null
    ? tx(`fora da comparação (${v.motivo})`, `outside the comparison (${v.motivo})`, idioma)
    : tx(`${textoNumero(v.v, medida)}, fora da comparação (${v.motivo})`, `${textoNumero(v.v, medida, idioma)}, outside the comparison (${v.motivo})`, idioma);
}

/* ------------------------------------------------------------------ áreas do mapa */

export type AreasPerdas = {
  /** CNPJ → municípios em que a distribuidora é a única com vínculo confirmado. */
  exclusivos: Map<string, string[]>;
  /** Municípios com mais de uma distribuidora confirmada: sem cor única. */
  compartilhados: { id: string; cnpjs: string[] }[];
  /** Municípios cujo único vínculo é o cadastro de MMGD (estado 2). */
  soMmgd: Set<string>;
  /** Municípios só com vínculo não confirmado (desenhados só com contorno). */
  soNaoConfirmados: { id: string; cnpjs: string[] }[];
  /** CNPJ → municípios com vínculo não confirmado (contorno tracejado quando a distribuidora é selecionada). */
  naoConfirmadosDe: Map<string, string[]>;
  /** CNPJ → municípios compartilhados em que ela tem vínculo confirmado. */
  compartilhadosDe: Map<string, string[]>;
  /** Municípios da malha sem nenhuma distribuidora ligada. */
  semVinculo: string[];
  /** Códigos da relação que não existem na malha. */
  foraDaMalha: string[];
};

/**
 * Agrupa os municípios por distribuidora, vínculo a vínculo, sem polígono inventado: a
 * área de uma distribuidora é o conjunto dos municípios em que ela é a única confirmada;
 * município com mais de uma confirmada fica com marca própria; vínculo sem confirmação
 * só aparece como contorno (regra publicada em gold.mapa.regra).
 */
export function montarAreas(m: Pick<MunicipiosPerdas, "distribuidoras" | "municipios">, idsMalha: readonly string[]): AreasPerdas {
  const malha = new Set(idsMalha);
  const exclusivos = new Map<string, string[]>();
  const naoConfirmadosDe = new Map<string, string[]>();
  const compartilhadosDe = new Map<string, string[]>();
  const compartilhados: AreasPerdas["compartilhados"] = [];
  const soNaoConfirmados: AreasPerdas["soNaoConfirmados"] = [];
  const soMmgd = new Set<string>();
  const foraDaMalha: string[] = [];
  const empurra = (mapa: Map<string, string[]>, k: string, v: string) => {
    const l = mapa.get(k);
    if (l) l.push(v);
    else mapa.set(k, [v]);
  };
  for (const [cod, info] of Object.entries(m.municipios)) {
    if (!malha.has(cod)) {
      foraDaMalha.push(cod);
      continue;
    }
    const conf = info.d.filter(([, e]) => e === 1 || e === 2).map(([i]) => m.distribuidoras[i]);
    const naoConf = info.d.filter(([, e]) => e === 0).map(([i]) => m.distribuidoras[i]);
    for (const c of naoConf) empurra(naoConfirmadosDe, c, cod);
    if (conf.length === 1) {
      empurra(exclusivos, conf[0], cod);
      if (info.d.some(([, e]) => e === 2) && !info.d.some(([, e]) => e === 1)) soMmgd.add(cod);
    } else if (conf.length > 1) {
      compartilhados.push({ id: cod, cnpjs: conf });
      for (const c of conf) empurra(compartilhadosDe, c, cod);
    } else if (naoConf.length) {
      soNaoConfirmados.push({ id: cod, cnpjs: naoConf });
    }
  }
  const semVinculo = idsMalha.filter((id) => !(id in m.municipios));
  return { exclusivos, compartilhados, soMmgd, soNaoConfirmados, naoConfirmadosDe, compartilhadosDe, semVinculo, foraDaMalha: foraDaMalha.sort() };
}

/* ------------------------------------------------------------------ respostas do mapa (P055) */

type Extremo = { rotulo: string; v: number };

/** Menor e maior valor comparável, com desempate pelo nome (resposta estável entre execuções). */
export function extremos(valores: Readonly<Record<string, ValorMapa>>, rotulos: Readonly<Record<string, string>>): { min: Extremo; max: Extremo; n: number } | null {
  const itens: Extremo[] = [];
  for (const [id, v] of Object.entries(valores)) if (v.estado === "valor") itens.push({ rotulo: rotulos[id] ?? id, v: v.v });
  if (!itens.length) return null;
  const col = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
  itens.sort((a, b) => a.v - b.v || col.compare(a.rotulo, b.rotulo));
  return { min: itens[0], max: itens[itens.length - 1], n: itens.length };
}

/**
 * Resposta curta da consulta atual do mapa (período e medida): quantas distribuidoras
 * entram na comparação, a faixa de valores e o agregado nacional das concessionárias
 * (razão de somas do pipeline), quando a medida tem agregado.
 */
export function respostaMapa(
  a: {
    periodo: PeriodoPerdas;
    medida: Medida;
    valores: Readonly<Record<string, ValorMapa>>;
    rotulos: Readonly<Record<string, string>>;
    nacional: LinhaNacional | null;
    acumulado: PerdasGold["acumulado"];
  },
  idioma: Idioma = idiomaEnergia(),
): string {
  const { periodo, medida, valores, rotulos, nacional } = a;
  const e = extremos(valores, rotulos);
  const fora = Object.values(valores).filter((v) => v.estado === "fora").length;
  const mesFim = (a.acumulado?.mes_fim ?? 1) - 1;
  const quando =
    periodo.tipo === "acumulado"
      ? tx(`De janeiro a ${MESES_LONGOS[mesFim]} de ${periodo.ano}`, `From January to ${nomeMes(mesFim + 1, idioma, true)} ${periodo.ano}`, idioma)
      : tx(`Em ${periodo.ano}`, `In ${periodo.ano}`, idioma);
  if (!e)
    return tx(
      `${quando}, nenhuma distribuidora entra na comparação de ${medida.rotulo.toLowerCase()}.`,
      `${quando}, no distribution utility enters the comparison of ${medida.rotulo.toLowerCase()}.`,
      idioma,
    );
  const partes: string[] = [];
  const tn = (v: number) => textoNumero(v, medida, idioma);
  if (medida.id === "variacao") {
    let sobe = 0;
    let cai = 0;
    let estavel = 0;
    for (const v of Object.values(valores)) {
      if (v.estado !== "valor") continue;
      const x = r(v.v, medida.casas);
      if (x > 0) sobe++;
      else if (x < 0) cai++;
      else estavel++;
    }
    partes.push(
      tx(
        `De ${periodo.ano - 1} para ${periodo.ano}, entre ${plural(e.n, "distribuidora comparável", "distribuidoras comparáveis")}, a taxa de perdas totais subiu em ${num(sobe, 0)}, caiu em ${num(cai, 0)} e ficou igual em ${num(estavel, 0)}.`,
        `From ${periodo.ano - 1} to ${periodo.ano}, among ${plural(e.n, "comparable distribution utility", "comparable distribution utilities", idioma)}, the total loss rate rose in ${num(sobe, 0, idioma)}, fell in ${num(cai, 0, idioma)} and stayed the same in ${num(estavel, 0, idioma)}.`,
        idioma,
      ),
    );
    partes.push(
      tx(
        `Maior queda: ${e.min.rotulo} (${textoNumero(e.min.v, medida)}); maior alta: ${e.max.rotulo} (${textoNumero(e.max.v, medida)}).`,
        `Largest fall: ${e.min.rotulo} (${tn(e.min.v)}); largest rise: ${e.max.rotulo} (${tn(e.max.v)}).`,
        idioma,
      ),
    );
    const m = nacional?.mesmas_ano_anterior;
    if (m?.taxa_total_pct && m.taxa_total_pct[0] !== null && m.taxa_total_pct[1] !== null) {
      partes.push(
        tx(
          `Nas mesmas ${num(m.n_total, 0)} concessionárias válidas nos dois anos, a taxa agregada ${fraseMudanca(m.taxa_total_pct[0], m.taxa_total_pct[1])}.`,
          `In the same ${num(m.n_total, 0, idioma)} concession holders valid in both years, the aggregate rate ${fraseMudanca(m.taxa_total_pct[0], m.taxa_total_pct[1], idioma)}.`,
          idioma,
        ),
      );
    }
  } else {
    const quantas = e.n === 1 ? tx("1 distribuidora entra", "1 distribution utility enters", idioma) : tx(`${num(e.n, 0)} distribuidoras entram`, `${num(e.n, 0, idioma)} distribution utilities enter`, idioma);
    const FRASE: Record<Exclude<IdMedida, "variacao">, [string, string]> = {
      taxa: [tx("a taxa de perdas totais vai", "the total loss rate ranges", idioma), tx(" da energia injetada de referência", " of the reference injected energy", idioma)],
      volume: [tx("as perdas totais vão", "total losses range", idioma), ""],
      tecnica: [tx("as perdas técnicas vão", "technical losses range", idioma), tx(" da energia injetada de referência", " of the reference injected energy", idioma)],
      pnt_bt: [tx("as perdas não técnicas vão", "non-technical losses range", idioma), tx(" do mercado de baixa tensão medido", " of the metered low-voltage market", idioma)],
    };
    const [sujeito, base] = FRASE[medida.id];
    partes.push(
      tx(
        `${quando}, ${quantas} na comparação: ${sujeito} de ${textoNumero(e.min.v, medida)} (${e.min.rotulo}) a ${textoNumero(e.max.v, medida)} (${e.max.rotulo})${base}.`,
        `${quando}, ${quantas} the comparison: ${sujeito} from ${tn(e.min.v)} (${e.min.rotulo}) to ${tn(e.max.v)} (${e.max.rotulo})${base}.`,
        idioma,
      ),
    );
    const ag = agregadoNacional(medida.id, periodo, nacional, a.acumulado, idioma);
    if (ag) partes.push(ag);
  }
  if (fora)
    partes.push(
      tx(
        `${plural(fora, "distribuidora publicou valor que fica", "distribuidoras publicaram valores que ficam")} fora da comparação, com o motivo na tabela.`,
        `${plural(fora, "distribution utility published a value that stays", "distribution utilities published values that stay", idioma)} outside the comparison, with the reason in the table.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

/**
 * Veredito da consulta atual do mapa (período e medida): o intervalo da medida entre as distribuidoras comparáveis, com a
 * distribuidora de cada ponta, ou quantas subiram e quantas caíram na variação. Os números são os de respostaMapa; o agregado
 * nacional, os universos e as distribuidoras fora da comparação ficam na resposta completa.
 */
export function vereditoMapa(
  a: {
    periodo: PeriodoPerdas;
    medida: Medida;
    valores: Readonly<Record<string, ValorMapa>>;
    rotulos: Readonly<Record<string, string>>;
    acumulado: PerdasGold["acumulado"];
  },
  idioma: Idioma = idiomaEnergia(),
): string {
  const { periodo, medida, valores, rotulos } = a;
  const e = extremos(valores, rotulos);
  const mesFim = (a.acumulado?.mes_fim ?? 1) - 1;
  const quando =
    periodo.tipo === "acumulado"
      ? tx(`De janeiro a ${MESES_LONGOS[mesFim]} de ${periodo.ano}`, `From January to ${nomeMes(mesFim + 1, idioma, true)} ${periodo.ano}`, idioma)
      : tx(`Em ${periodo.ano}`, `In ${periodo.ano}`, idioma);
  if (!e)
    return tx(
      `${quando}, nenhuma distribuidora entra na comparação de ${medida.rotulo.toLowerCase()}.`,
      `${quando}, no distribution utility enters the comparison of ${medida.rotulo.toLowerCase()}.`,
      idioma,
    );
  if (medida.id === "variacao") {
    let sobe = 0;
    let cai = 0;
    for (const v of Object.values(valores)) {
      if (v.estado !== "valor") continue;
      const x = r(v.v, medida.casas);
      if (x > 0) sobe++;
      else if (x < 0) cai++;
    }
    return tx(
      `De ${periodo.ano - 1} para ${periodo.ano}, a taxa de perdas totais subiu em ${plural(sobe, "distribuidora", "distribuidoras")} e caiu em ${num(cai, 0)}, entre as que podem ser comparadas.`,
      `From ${periodo.ano - 1} to ${periodo.ano}, the total loss rate rose in ${plural(sobe, "distribution utility", "distribution utilities", idioma)} and fell in ${num(cai, 0, idioma)}, among those that can be compared.`,
      idioma,
    );
  }
  const FRASE: Record<Exclude<IdMedida, "variacao">, [string, string]> = {
    taxa: [tx("a taxa de perdas totais vai", "the total loss rate ranges", idioma), tx(" da energia que entrou na rede", " of the energy that entered the grid", idioma)],
    volume: [tx("as perdas totais vão", "total losses range", idioma), ""],
    tecnica: [tx("as perdas técnicas estimadas vão", "estimated technical losses range", idioma), tx(" da energia que entrou na rede", " of the energy that entered the grid", idioma)],
    pnt_bt: [tx("as perdas não técnicas estimadas vão", "estimated non-technical losses range", idioma), tx(" do mercado de baixa tensão", " of the low-voltage market", idioma)],
  };
  const [sujeito, base] = FRASE[medida.id];
  return tx(
    `${quando}, entre as distribuidoras comparáveis, ${sujeito} de ${textoNumero(e.min.v, medida)} (${e.min.rotulo}) a ${textoNumero(e.max.v, medida)} (${e.max.rotulo})${base}.`,
    `${quando}, among the comparable distribution utilities, ${sujeito} from ${textoNumero(e.min.v, medida, idioma)} (${e.min.rotulo}) to ${textoNumero(e.max.v, medida, idioma)} (${e.max.rotulo})${base}.`,
    idioma,
  );
}

function agregadoNacional(medida: IdMedida, periodo: PeriodoPerdas, nacional: LinhaNacional | null, acumulado: PerdasGold["acumulado"], idioma: Idioma): string | null {
  const n0 = (v: number) => num(v, 0, idioma);
  const n2 = (v: number) => num(v, 2, idioma);
  if (periodo.tipo === "acumulado") {
    const c = acumulado?.agregados.find((x) => x.universo === "concessionarias");
    if (!c) return null;
    // sem o mesmo período do ano anterior, a frase para no valor atual (nada de "contra sem dado")
    const contra = (v: number | null, texto: (x: number) => string) =>
      v === null ? "" : tx(`, contra ${texto(v)} no mesmo período de ${periodo.ano - 1}`, `, against ${texto(v)} in the same period of ${periodo.ano - 1}`, idioma);
    if (medida === "taxa" && c.atual.taxa_total_pct !== null)
      return tx(
        `Somadas, as ${num(c.n_distribuidoras, 0)} concessionárias comparáveis perderam ${num(c.atual.taxa_total_pct, 2)}% da energia injetada${contra(c.anterior.taxa_total_pct, (x) => `${num(x, 2)}%`)}.`,
        `Together, the ${n0(c.n_distribuidoras)} comparable concession holders lost ${n2(c.atual.taxa_total_pct)}% of the injected energy${contra(c.anterior.taxa_total_pct, (x) => `${n2(x)}%`)}.`,
        idioma,
      );
    if (medida === "volume" && c.atual.perdas_totais_mwh !== null)
      return tx(
        `Somadas, as ${num(c.n_distribuidoras, 0)} concessionárias comparáveis perderam ${num(c.atual.perdas_totais_mwh / 1000, 0)} GWh${contra(c.anterior.perdas_totais_mwh, (x) => `${num(x / 1000, 0)} GWh`)}.`,
        `Together, the ${n0(c.n_distribuidoras)} comparable concession holders lost ${n0(c.atual.perdas_totais_mwh / 1000)} GWh${contra(c.anterior.perdas_totais_mwh, (x) => `${n0(x / 1000)} GWh`)}.`,
        idioma,
      );
    return null;
  }
  if (!nacional || nacional.parcial) return null;
  if (medida === "taxa" && nacional.taxa_total_pct !== null)
    return tx(
      `Somadas, as ${num(nacional.n_distribuidoras, 0)} concessionárias válidas perderam ${num(nacional.taxa_total_pct, 2)}% da energia injetada.`,
      `Together, the ${n0(nacional.n_distribuidoras)} valid concession holders lost ${n2(nacional.taxa_total_pct)}% of the injected energy.`,
      idioma,
    );
  if (medida === "volume" && nacional.perdas_totais_mwh !== null)
    return tx(
      `Somadas, as ${num(nacional.n_distribuidoras, 0)} concessionárias válidas perderam ${num(nacional.perdas_totais_mwh / 1000, 0)} GWh.`,
      `Together, the ${n0(nacional.n_distribuidoras)} valid concession holders lost ${n0(nacional.perdas_totais_mwh / 1000)} GWh.`,
      idioma,
    );
  if (medida === "tecnica" && nacional.taxa_tecnica_pct !== null)
    return tx(
      `Nas ${num(nacional.n_com_tecnica, 0)} concessionárias que publicam a técnica (${pctOu(nacional.cobertura_tecnica_pct, 1)} da energia injetada das válidas), a técnica soma ${num(nacional.taxa_tecnica_pct, 2)}% da injetada.`,
      `In the ${n0(nacional.n_com_tecnica)} concession holders that publish technical losses (${pctOu(nacional.cobertura_tecnica_pct, 1, idioma)} of the injected energy of the valid ones), technical losses add up to ${n2(nacional.taxa_tecnica_pct)}% of the injected energy.`,
      idioma,
    );
  if (medida === "pnt_bt" && nacional.pnt_bt_pct !== null)
    return tx(
      `Nas ${num(nacional.n_com_pnt_bt, 0)} concessionárias com a separação fechando (${pctOu(nacional.cobertura_bt_pct, 1)} do mercado de baixa tensão das válidas), a não técnica soma ${num(nacional.pnt_bt_pct, 2)}% do mercado de baixa tensão.`,
      `In the ${n0(nacional.n_com_pnt_bt)} concession holders whose separation closes (${pctOu(nacional.cobertura_bt_pct, 1, idioma)} of the low-voltage market of the valid ones), non-technical losses add up to ${n2(nacional.pnt_bt_pct)}% of the low-voltage market.`,
      idioma,
    );
  return null;
}

/* ------------------------------------------------------------------ distribuidora selecionada */

/** Resposta curta sobre uma distribuidora no ano de referência, com a comparação só quando ela vale. */
export function respostaDistribuidora(d: DistribuidoraLeve, anoRef: number, idioma: Idioma = idiomaEnergia()): string {
  const nome = rotuloDistribuidora(d);
  const ufs = d.territorio?.ufs.length ? `, ${d.territorio.ufs.join(", ")}` : "";
  const cab = `${nome} (${rotulosGrupo(idioma)[d.grupo].toLowerCase()}${ufs})`;
  const rf = d.referencia;
  if (!rf || rf.ano !== anoRef) {
    return tx(
      `${cab}: sem balanço publicado em ${anoRef}; a série vai de ${mesAno(d.primeira_competencia)} a ${mesAno(d.ultima_competencia)}${d.ativa ? "" : " e foi encerrada"}.`,
      `${cab}: no balance published in ${anoRef}; the series runs from ${mesAno(d.primeira_competencia, idioma)} to ${mesAno(d.ultima_competencia, idioma)}${d.ativa ? "" : " and has ended"}.`,
      idioma,
    );
  }
  const rec = recorteDaReferencia(d)!;
  const fora = motivoForaTotal(rec, idioma);
  const partes: string[] = [];
  if (rf.taxa_total_pct === null || rf.perdas_totais_mwh === null || rf.injetada_mwh === null) {
    partes.push(
      tx(
        `${cab}: em ${anoRef}, perdas ou energia injetada ausentes em algum mês; sem taxa anual.`,
        `${cab}: in ${anoRef}, losses or injected energy missing in some month; no annual rate.`,
        idioma,
      ),
    );
    return partes.join(" ");
  }
  partes.push(
    tx(
      `${cab}: em ${anoRef}, perdas totais de ${num(rf.perdas_totais_mwh, 0)} MWh, ${num(rf.taxa_total_pct, 2)}% da energia injetada de referência (${num(rf.injetada_mwh, 0)} MWh).`,
      `${cab}: in ${anoRef}, total losses of ${num(rf.perdas_totais_mwh, 0, idioma)} MWh, ${num(rf.taxa_total_pct, 2, idioma)}% of the reference injected energy (${num(rf.injetada_mwh, 0, idioma)} MWh).`,
      idioma,
    ),
  );
  if (fora) {
    partes.push(tx(`O valor é o publicado pela fonte e fica fora das comparações: ${fora}.`, `The value is the one published by the source and stays outside the comparisons: ${fora}.`, idioma));
    return partes.join(" ");
  }
  const v = d.variacao;
  if (!v) partes.push(tx(`Sem ${anoRef - 1} publicado para comparar.`, `No ${anoRef - 1} published to compare.`, idioma));
  else if (!v.comparavel || v.taxa_total_pp === null) {
    const motivo = v.quebra_escala
      ? tx("a energia injetada mudou mais de 30% (quebra de escala)", "the injected energy changed by more than 30% (scale break)", idioma)
      : v.absorcao
        ? tx("houve absorção provável de outra distribuidora", "there was a probable absorption of another distribution utility", idioma)
        : tx("um dos dois anos está incompleto ou tem alerta", "one of the two years is incomplete or has an alert", idioma);
    partes.push(tx(`A comparação com ${v.ano_base} não é feita: ${motivo}.`, `The comparison with ${v.ano_base} is not made: ${motivo}.`, idioma));
  } else {
    const x = r(v.taxa_total_pp, 2);
    partes.push(
      x === 0
        ? tx(`A taxa ficou igual à de ${v.ano_base}.`, `The rate stayed the same as in ${v.ano_base}.`, idioma)
        : tx(
            `A taxa ${x > 0 ? "subiu" : "caiu"} ${num(Math.abs(x), 2)} p.p. em relação a ${v.ano_base}${v.atravessa_leiaute ? " (os dois anos estão em leiautes diferentes do SAMP)" : ""}.`,
            `The rate ${x > 0 ? "rose" : "fell"} ${num(Math.abs(x), 2, idioma)} p.p. against ${v.ano_base}${v.atravessa_leiaute ? " (the two years are in different SAMP layouts)" : ""}.`,
            idioma,
          ),
    );
  }
  return partes.join(" ");
}

/* ------------------------------------------------------------------ séries */

/**
 * Primeiro ano em que o SAMP traz o leiaute da REN 1.003/2022 (competências de 2024 em
 * diante): é a marca de mudança metodológica dos gráficos da série nacional. Não é número
 * de dado; o teste confere que a limitação publicada pelo pipeline na gold cita o mesmo ano.
 */
export const ANO_LEIAUTE_SAMP = 2024;

/** Primeiro e último ano completo da série nacional publicada (para período e títulos, sem ano escrito à mão). */
export function anosSerieNacional(nacional: readonly LinhaNacional[]): { inicio: number; fim: number } | null {
  const anos = nacional.filter((l) => !l.parcial && l.universo === "concessionarias").map((l) => l.ano);
  if (!anos.length) return null;
  return { inicio: Math.min(...anos), fim: Math.max(...anos) };
}

/**
 * Quantas concessionárias válidas publicaram cada parte da separação nos três últimos anos
 * completos até o de referência, lido da série nacional: substitui "cerca de metade" por
 * contagens publicadas. Ano sem linha fica de fora da frase, nunca vira zero.
 */
export function fraseCoberturaSeparacao(nacional: readonly LinhaNacional[], anoRef: number, idioma: Idioma = idiomaEnergia()): string | null {
  const linhas = [anoRef - 2, anoRef - 1, anoRef]
    .map((a) => nacional.find((l) => l.ano === a && l.universo === "concessionarias" && !l.parcial))
    .filter((l): l is LinhaNacional => !!l);
  if (!linhas.length) return null;
  const n0 = (v: number) => num(v, 0, idioma);
  const partes = linhas.map((l, i) =>
    i === 0
      ? tx(
          `em ${l.ano}, ${num(l.n_com_tecnica, 0)} de ${num(l.n_distribuidoras, 0)} concessionárias válidas entram na soma da técnica e ${num(l.n_com_pnt_bt, 0)}, na da não técnica`,
          `in ${l.ano}, ${n0(l.n_com_tecnica)} of ${n0(l.n_distribuidoras)} valid concession holders enter the technical sum and ${n0(l.n_com_pnt_bt)} the non-technical one`,
          idioma,
        )
      : tx(
          `em ${l.ano}, ${num(l.n_com_tecnica, 0)} de ${num(l.n_distribuidoras, 0)} e ${num(l.n_com_pnt_bt, 0)}`,
          `in ${l.ano}, ${n0(l.n_com_tecnica)} of ${n0(l.n_distribuidoras)} and ${n0(l.n_com_pnt_bt)}`,
          idioma,
        ),
  );
  return `${partes.join("; ")}.`;
}

/** Rótulo da marca de mudança de leiaute num gráfico da separação, com a contagem do próprio ano. */
export function marcaLeiauteSeparacao(nacional: readonly LinhaNacional[], medida: "tecnica" | "pnt_bt", idioma: Idioma = idiomaEnergia()): { x: string; rotulo: string }[] {
  const l = nacional.find((x) => x.ano === ANO_LEIAUTE_SAMP && x.universo === "concessionarias" && !x.parcial);
  if (!l) return [];
  const n0 = (v: number) => num(v, 0, idioma);
  const n =
    medida === "tecnica"
      ? tx(`${num(l.n_com_tecnica, 0)} de ${num(l.n_distribuidoras, 0)} publicam a técnica`, `${n0(l.n_com_tecnica)} of ${n0(l.n_distribuidoras)} publish technical losses`, idioma)
      : tx(`${num(l.n_com_pnt_bt, 0)} de ${num(l.n_distribuidoras, 0)} com a separação fechando`, `${n0(l.n_com_pnt_bt)} of ${n0(l.n_distribuidoras)} with the separation closing`, idioma);
  return [{ x: String(ANO_LEIAUTE_SAMP), rotulo: tx(`${ANO_LEIAUTE_SAMP}: leiaute novo; ${n}`, `${ANO_LEIAUTE_SAMP}: new layout; ${n}`, idioma) }];
}

/** Série nacional das concessionárias para o gráfico: só anos completos; ausência fica null. */
export function serieNacional(nacional: readonly LinhaNacional[]): { ano: string; taxa: number | null; tecnica: number | null; pnt_bt: number | null }[] {
  return nacional
    .filter((l) => !l.parcial)
    .sort((a, b) => a.ano - b.ano)
    .map((l) => ({ ano: String(l.ano), taxa: l.taxa_total_pct, tecnica: l.taxa_tecnica_pct, pnt_bt: l.pnt_bt_pct }));
}

export type PontoHistorico = { ano: string; taxa: number | null; tecnica: number | null; pnt_bt: number | null };

/**
 * Série anual de uma distribuidora para o gráfico: cada medida só aparece no ano em que
 * entra na comparação (as mesmas regras do mapa); o ano fora vira lacuna e é listado com
 * o motivo, e os anos com quebra de escala ou absorção viram marca no gráfico.
 */
export function historicoDistribuidora(linhas: readonly LinhaAnualPerdas[], idioma: Idioma = idiomaEnergia()): {
  pontos: PontoHistorico[];
  fora: { ano: number; motivo: string }[];
  mudancas: number[];
} {
  const pontos: PontoHistorico[] = [];
  const fora: { ano: number; motivo: string }[] = [];
  const mudancas: number[] = [];
  for (const t of [...linhas].sort((a, b) => a[0] - b[0])) {
    const rec = recorteDaTupla(t);
    const ok = validoTotal(rec);
    if (!ok) fora.push({ ano: rec.ano, motivo: motivoForaTotal(rec, idioma) ?? tx("fora da comparação", "outside the comparison", idioma) });
    if (rec.universo_muda) mudancas.push(rec.ano);
    pontos.push({
      ano: String(rec.ano),
      taxa: ok ? rec.taxa_total_pct : null,
      tecnica: validoTecnica(rec) ? rec.taxa_tecnica_pct : null,
      pnt_bt: validoPntBt(rec) ? rec.pnt_bt_pct : null,
    });
  }
  return { pontos, fora, mudancas };
}

/**
 * Linhas do comparador: um ano por linha, uma coluna por CNPJ (taxa total comparável) e a
 * taxa agregada das concessionárias como referência.
 */
export function serieComparacao(ids: readonly string[], anual: SerieAnualPerdas, nacional: readonly LinhaNacional[]): Record<string, string | number | null>[] {
  const anos = new Set<number>();
  const porId = new Map<string, Map<number, number | null>>();
  for (const id of ids) {
    const m = new Map<number, number | null>();
    for (const p of historicoDistribuidora(anual.distribuidoras[id] ?? []).pontos) {
      m.set(Number(p.ano), p.taxa);
      anos.add(Number(p.ano));
    }
    porId.set(id, m);
  }
  const nac = new Map(nacional.filter((l) => !l.parcial).map((l) => [l.ano, l.taxa_total_pct]));
  return (
    Array.from(anos)
      .sort((a, b) => a - b)
      .map((ano) => {
        const linha: Record<string, string | number | null> = { ano: String(ano), brasil: nac.get(ano) ?? null };
        for (const id of ids) linha[id] = porId.get(id)?.get(ano) ?? null;
        return linha;
      })
      // ano sem nenhum valor comparável (o ano aberto) não estica o eixo com uma linha vazia
      .filter((l) => Object.entries(l).some(([k, v]) => k !== "ano" && v !== null))
  );
}

/* ------------------------------------------------------------------ tabela do explorador (P055) */

export function colunasDistribuidoras(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "distribuidora", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "cnpj", rotulo: "CNPJ", tipo: "texto", ordenavel: false },
    { id: "grupo", rotulo: tx("Tipo", "Type", idioma), tipo: "texto", categorica: true },
    { id: "ufs", rotulo: tx("UF", "State (UF)", idioma), tipo: "texto", categorica: true },
    { id: "classe_mapa", rotulo: tx("Classe no mapa", "Class on the map", idioma), tipo: "texto", categorica: true },
    { id: "valor_mapa", rotulo: tx("Valor no mapa", "Value on the map", idioma), tipo: "numero", casas: 2 },
    { id: "meses", rotulo: tx("Meses publicados", "Months published", idioma), tipo: "numero", casas: 0 },
    { id: "perdas_gwh", rotulo: tx("Perdas totais", "Total losses", idioma), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "injetada_gwh", rotulo: tx("Energia injetada de referência", "Reference injected energy", idioma), tipo: "numero", unidade: "GWh", casas: 1 },
    { id: "taxa_total", rotulo: tx("Taxa de perdas totais", "Total loss rate", idioma), tipo: "percentual", casas: 2 },
    { id: "taxa_tecnica", rotulo: tx("Técnicas", "Technical", idioma), tipo: "percentual", casas: 2 },
    { id: "pnt_bt", rotulo: tx("Não técnicas sobre a BT", "Non-technical over the BT (low voltage)", idioma), tipo: "percentual", casas: 2 },
    { id: "variacao_pp", rotulo: tx("Variação da taxa", "Change in the rate", idioma), tipo: "numero", unidade: "p.p.", casas: 2 },
    { id: "taxa_anterior", rotulo: tx("Taxa no mesmo período do ano anterior", "Rate in the same period of the previous year", idioma), tipo: "percentual", casas: 2 },
    { id: "comparacao", rotulo: tx("Comparação", "Comparison", idioma), tipo: "texto", categorica: true },
    { id: "decomposicao", rotulo: tx("Decomposição", "Decomposition", idioma), tipo: "texto", categorica: true },
    { id: "origem", rotulo: tx("Origem da injetada", "Origin of the injected energy", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_DISTRIBUIDORAS: ColunaTabela[] = colunasDistribuidoras("pt");

/**
 * Colunas que existem no período (variação só no ano de referência; anterior só no
 * acumulado). As duas colunas do mapa levam o nome e a unidade da medida pintada: são
 * a tabela equivalente do mapa, com o mesmo valor e a mesma classe de cada área.
 */
export function colunasDoPeriodo(periodo: PeriodoPerdas, medida: Medida, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return colunasDistribuidoras(idioma)
    .filter((c) => {
      if (c.id === "variacao_pp") return periodo.referencia;
      if (c.id === "taxa_anterior") return periodo.tipo === "acumulado";
      if (c.id === "taxa_tecnica" || c.id === "decomposicao") return periodo.tipo === "ano";
      return true;
    })
    .map((c) =>
      c.id === "valor_mapa"
        ? { ...c, rotulo: tx(`${medida.rotulo} (mapa)`, `${medida.rotulo} (map)`, idioma), unidade: medida.unidade, casas: medida.id === "volume" ? 1 : 2 }
        : c.id === "classe_mapa"
          ? { ...c, rotulo: tx(`Classe no mapa (${medida.rotulo.toLowerCase()})`, `Class on the map (${medida.rotulo.toLowerCase()})`, idioma) }
          : c,
    );
}

/** Texto da classe de um valor do mapa (o mesmo da legenda) ou o estado sem cor. */
export function classeDoValor(v: ValorMapa, c: Classificacao, idioma: Idioma = idiomaEnergia()): string {
  if (v.estado === "sem-dado") return tx("sem dado", "no data", idioma);
  if (v.estado === "fora") return tx("fora da comparação", "outside the comparison", idioma);
  const k = classeDe(v.v, c);
  return typeof k === "number" ? c.classes[k].rotulo : tx("sem dado", "no data", idioma);
}

const gwh = (v: number | null) => (v === null ? null : v / 1000);

/**
 * Linhas da tabela do explorador: as mesmas distribuidoras e os mesmos valores que o mapa
 * pinta no período. Valor fora da comparação aparece com o número da fonte e o motivo na
 * coluna "Comparação"; ausência é célula vazia, nunca zero.
 */
export function linhasDistribuidoras(
  distribuidoras: readonly DistribuidoraLeve[],
  recortes: Map<string, RecortePerdas | null>,
  periodo: PeriodoPerdas,
  mapa: { valores: Readonly<Record<string, ValorMapa>>; classes: Classificacao },
  idioma: Idioma = idiomaEnergia(),
): LinhaTabela[] {
  const grupo = rotulosGrupo(idioma);
  const decomp = rotulosDecomposicao(idioma);
  const origem = rotulosOrigem(idioma);
  return distribuidoras.map((d) => {
    const rec = recortes.get(d.cnpj) ?? null;
    const fora = rec ? motivoForaTotal(rec, idioma) : null;
    const v = periodo.referencia ? valorMedida(d, rec, "variacao", periodo, idioma) : null;
    const vm: ValorMapa = mapa.valores[d.cnpj] ?? { estado: "sem-dado", motivo: tx("sem dado", "no data", idioma) };
    return {
      id: d.cnpj,
      distribuidora: d.sigla ? `${d.sigla} · ${d.nome}` : d.nome,
      cnpj: d.cnpj_formatado,
      grupo: grupo[d.grupo],
      ufs: d.territorio?.ufs.join("/") || null,
      classe_mapa: classeDoValor(vm, mapa.classes, idioma),
      valor_mapa: vm.estado === "sem-dado" ? null : vm.v,
      meses: rec ? rec.meses : null,
      perdas_gwh: rec ? gwh(rec.perdas_totais_mwh) : null,
      injetada_gwh: rec ? gwh(rec.injetada_mwh) : null,
      taxa_total: rec ? rec.taxa_total_pct : null,
      taxa_tecnica: rec ? rec.taxa_tecnica_pct : null,
      pnt_bt: rec ? rec.pnt_bt_pct : null,
      variacao_pp: v && v.estado === "valor" ? v.v : null,
      taxa_anterior: rec?.anterior ? rec.anterior.taxa_total_pct : null,
      comparacao: !rec ? semDadoNoPeriodo(d, periodo, idioma) : fora ? tx(`fora: ${fora}`, `excluded: ${fora}`, idioma) : tx("comparável", "comparable", idioma),
      decomposicao: rec?.decomposicao ? decomp[rec.decomposicao] : null,
      origem: rec?.origem ? origem[rec.origem] : null,
    };
  });
}

/* ------------------------------------------------------------------ composição (P056) */

export type LinhaComposicao = {
  id: string;
  rotulo: string;
  tecnica: number;
  nao_tecnica: number;
  total: number;
  /**
   * Valores sem arredondar para desenhar as barras: a técnica exata e a não técnica como o que falta para a taxa total exata. A pilha do gráfico
   * soma as duas partes, e a soma das partes já arredondadas pode diferir em 0,01 do total arredondado (NEOENERGIA BRASÍLIA: 7,64 + 6,58 contra
   * 14,23). Com estes valores a soma da pilha é o total exato, que arredonda uma vez, meio para cima, no mesmo número da tabela; cada parte,
   * arredondada, também é a da tabela (conferido para todas as linhas no teste da página).
   */
  tecnica_barra: number;
  nao_tecnica_barra: number;
  pnt_bt: number | null;
  residuo_mwh: number | null;
  decomposicao: EstadoDecomposicao;
};

/**
 * Distribuidoras cuja composição pode ser empilhada no ano de referência: técnica e não
 * técnica sobre a mesma injetada de referência, com a decomposição fechando (só então a
 * soma das duas reproduz a taxa total). As demais ficam fora do gráfico, contadas.
 */
export function linhasComposicao(distribuidoras: readonly Distribuidora[]): { linhas: LinhaComposicao[]; fora: number; semSeparacao: number } {
  const linhas: LinhaComposicao[] = [];
  let fora = 0;
  let semSeparacao = 0;
  for (const d of distribuidoras) {
    const rec = recorteDaReferencia(d);
    if (!rec || !validoTotal(rec)) continue;
    const rf = d.referencia!;
    if (rf.taxa_tecnica_pct === null || rf.pnt_injetada_pct === null) {
      semSeparacao++;
      continue;
    }
    if (!DECOMPOSICAO_OK.includes(rf.decomposicao) || rf.taxa_total_pct === null) {
      fora++;
      continue;
    }
    const exato = rf.injetada_mwh && rf.perdas_totais_mwh !== null && rf.perdas_tecnicas_mwh !== null ? { total: (100 * rf.perdas_totais_mwh) / rf.injetada_mwh, tecnica: (100 * rf.perdas_tecnicas_mwh) / rf.injetada_mwh } : null;
    linhas.push({
      id: d.cnpj,
      rotulo: rotuloDistribuidora(d),
      tecnica: rf.taxa_tecnica_pct,
      nao_tecnica: rf.pnt_injetada_pct,
      total: rf.taxa_total_pct,
      tecnica_barra: exato ? exato.tecnica : rf.taxa_tecnica_pct,
      nao_tecnica_barra: exato ? exato.total - exato.tecnica : rf.pnt_injetada_pct,
      pnt_bt: validoPntBt(rec) ? rf.pnt_bt_pct : null,
      residuo_mwh: rf.residuo_decomposicao_mwh,
      decomposicao: rf.decomposicao,
    });
  }
  linhas.sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return { linhas, fora, semSeparacao };
}

/** Resposta curta da composição no ano de referência, com o universo e a cobertura ditos. */
export function respostaComposicao(g: Pick<PerdasGold, "nacional" | "referencia" | "universo_fixo">, idioma: Idioma = idiomaEnergia()): string {
  const l = g.nacional.find((x) => x.ano === g.referencia.ano && x.universo === "concessionarias");
  if (!l || l.taxa_total_pct === null) return tx(`Sem soma nacional das concessionárias em ${g.referencia.ano}.`, `No national sum of the concession holders in ${g.referencia.ano}.`, idioma);
  const partes: string[] = [];
  const n0 = (v: number) => num(v, 0, idioma);
  const n2 = (v: number) => num(v, 2, idioma);
  if (l.taxa_tecnica_pct !== null) {
    partes.push(
      tx(
        `Em ${l.ano}, ${num(l.n_com_tecnica, 0)} das ${num(l.n_distribuidoras, 0)} concessionárias válidas publicaram a perda técnica nos 12 meses (${pctOu(l.cobertura_tecnica_pct, 1)} da energia injetada); nelas, a técnica foi ${num(l.taxa_tecnica_pct, 2)}% da energia injetada.`,
        `In ${l.ano}, ${n0(l.n_com_tecnica)} of the ${n0(l.n_distribuidoras)} valid concession holders published technical losses for the 12 months (${pctOu(l.cobertura_tecnica_pct, 1, idioma)} of the injected energy); in them, technical losses were ${n2(l.taxa_tecnica_pct)}% of the injected energy.`,
        idioma,
      ),
    );
  } else partes.push(tx(`Em ${l.ano}, nenhuma concessionária válida publicou a perda técnica nos 12 meses.`, `In ${l.ano}, no valid concession holder published technical losses for the 12 months.`, idioma));
  if (l.pnt_bt_pct !== null) {
    partes.push(
      tx(
        `A não técnica, em ${num(l.n_com_pnt_bt, 0)} concessionárias com a separação fechando (${pctOu(l.cobertura_bt_pct, 1)} do mercado de baixa tensão), foi ${num(l.pnt_bt_pct, 2)}% do mercado de baixa tensão.`,
        `Non-technical losses, in ${n0(l.n_com_pnt_bt)} concession holders whose separation closes (${pctOu(l.cobertura_bt_pct, 1, idioma)} of the low-voltage market), were ${n2(l.pnt_bt_pct)}% of the low-voltage market.`,
        idioma,
      ),
    );
  }
  const uf = g.universo_fixo;
  const prim = uf.linhas[0];
  const ult = uf.linhas[uf.linhas.length - 1];
  if (prim && ult && prim.pnt_bt_pct !== null && ult.pnt_bt_pct !== null && uf.linhas.length > 1) {
    partes.push(
      tx(
        `Nas mesmas ${num(uf.n_distribuidoras, 0)} concessionárias de ${prim.ano} a ${ult.ano}, a não técnica passou de ${num(prim.pnt_bt_pct, 2)}% para ${num(ult.pnt_bt_pct, 2)}% do mercado de baixa tensão.`,
        `In the same ${n0(uf.n_distribuidoras)} concession holders from ${prim.ano} to ${ult.ano}, non-technical losses went from ${n2(prim.pnt_bt_pct)}% to ${n2(ult.pnt_bt_pct)}% of the low-voltage market.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/* ------------------------------------------------------------------ referência regulatória (P057) */

export type LinhaRegulatorio = {
  id: string;
  rotulo: string;
  /** Percentual do trecho de referência mais recente (6 meses ou mais). */
  atual: number;
  /** Percentual do trecho de referência imediatamente anterior; null quando a série só tem um trecho de referência. */
  anterior: number | null;
  inicio: string;
  fim: string;
  meses: number;
  /** Período do trecho de referência anterior (null sem trecho anterior). */
  anterior_inicio: string | null;
  anterior_fim: string | null;
  anterior_meses: number | null;
  /**
   * A diferença que a página mostra, com um só nome e uma só conta no gráfico, na frase, na tabela e no arquivo exportado: percentual do
   * trecho mais recente menos o do trecho de referência anterior, em p.p. Null sem trecho anterior.
   */
  diferenca: number | null;
  /**
   * Do pipeline, e NÃO é a diferença acima: variação contra o trecho imediatamente anterior de 2 meses ou mais, curto ou não, ou, no primeiro
   * trecho da série, contra a razão do mês anterior ao início. Serve só à associação da resolução homologatória; a página não a exibe.
   */
  troca_pp: number | null;
  resolucao: string | null;
  inicio_vigencia: string | null;
  n_segmentos: number;
  n_curtos: number;
};

/** Trecho mais recente de cada distribuidora e o anterior (para nível e evolução do parâmetro). */
export function linhasRegulatorio(distribuidoras: readonly Distribuidora[]): LinhaRegulatorio[] {
  const out: LinhaRegulatorio[] = [];
  for (const d of distribuidoras) {
    const t = d.tecnica_regulatoria;
    if (!t || !t.segmentos.length) continue;
    const segs = [...t.segmentos].sort((a, b) => a.inicio.localeCompare(b.inicio));
    const ult = segs[segs.length - 1];
    const ant = segs.length > 1 ? segs[segs.length - 2] : null;
    out.push({
      id: d.cnpj,
      rotulo: rotuloDistribuidora(d),
      atual: ult.pct,
      anterior: ant ? ant.pct : null,
      inicio: ult.inicio,
      fim: ult.fim,
      meses: ult.meses,
      anterior_inicio: ant ? ant.inicio : null,
      anterior_fim: ant ? ant.fim : null,
      anterior_meses: ant ? ant.meses : null,
      diferenca: ant ? diferencaPar(ult.pct, ant.pct) : null,
      troca_pp: ult.troca_pp,
      resolucao: ult.reh?.resolucao ?? null,
      inicio_vigencia: ult.reh?.inicio_vigencia ?? null,
      n_segmentos: t.n_segmentos,
      n_curtos: t.n_curtos,
    });
  }
  return out.sort((a, b) => b.atual - a.atual || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/**
 * Nome curto de uma resolução homologatória como a fonte a escreve
 * ("RESOLUÇÃO HOMOLOGATÓRIA Nº 2.396, DE 22 DE MAIO DE 2018" vira "REH nº 2.396/2018");
 * texto em outro formato volta como veio.
 */
export function rotuloResolucao(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /RESOLU[ÇC][ÃA]O\s+HOMOLOGAT[ÓO]RIA\s+N[º°O.]*\s*([\d.]+)\s*,?\s*DE\s+\d{1,2}\s+DE\s+[A-ZÇÃÉÊÍÓÔÚ]+\s+DE\s+(\d{4})/i.exec(t);
  return m ? `REH nº ${m[1]}/${m[2]}` : t;
}

/** Meses AAAA-MM de início a fim, inclusive. */
export function mesesEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let [a, m] = inicio.split("-").map(Number);
  const [af, mf] = fim.split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
  }
  return out;
}

/**
 * Série mensal em degraus a partir dos trechos publicados: o percentual vale em cada mês do
 * trecho; o mês de troca e qualquer mês entre trechos ficam sem valor (a fonte mistura as duas
 * taxas no mês de troca, e o trecho curto não é referência), nunca repetidos.
 */
export function degrausRegulatorio(segmentos: readonly SegmentoTecnico[]): { m: string; pct: number | null }[] {
  const segs = [...segmentos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!segs.length) return [];
  const valor = new Map<string, number>();
  for (const s of segs) for (const m of mesesEntre(s.inicio, s.fim)) valor.set(m, s.pct);
  return mesesEntre(segs[0].inicio, segs[segs.length - 1].fim).map((m) => ({ m, pct: valor.get(m) ?? null }));
}

/**
 * Uma linha por trecho de referência publicado, para a tabela e o arquivo exportado: a diferença é a MESMA do gráfico e da frase (percentual do
 * trecho menos o do trecho de referência imediatamente anterior da lista, pela mesma conta e arredondamento de `diferencaPar`). O primeiro trecho
 * da lista fica sem diferença: ou é o primeiro da série, ou o anterior não consta na lista (a gold traz os três mais recentes).
 */
export type LinhaTrechoRegulatorio = {
  id: string;
  cnpj: string;
  rotulo: string;
  inicio: string;
  fim: string;
  meses: number;
  pct: number;
  pct_anterior: number | null;
  diferenca: number | null;
  resolucao: string | null;
  inicio_vigencia: string | null;
};

export function linhasTrechosRegulatorio(segmentos: Readonly<Record<string, readonly SegmentoTecnico[]>>, rotulos: Readonly<Record<string, string>>): LinhaTrechoRegulatorio[] {
  return Object.entries(segmentos).flatMap(([cnpj, segs]) => {
    const ord = [...segs].sort((a, b) => a.inicio.localeCompare(b.inicio));
    return ord.map((s, i) => {
      const ant = i > 0 ? ord[i - 1] : null;
      return {
        id: `${cnpj}-${s.inicio}`,
        cnpj,
        rotulo: rotulos[cnpj] ?? cnpj,
        inicio: s.inicio,
        fim: s.fim,
        meses: s.meses,
        pct: s.pct,
        pct_anterior: ant ? ant.pct : null,
        diferenca: ant ? diferencaPar(s.pct, ant.pct) : null,
        resolucao: s.reh?.resolucao ?? null,
        inicio_vigencia: s.reh?.inicio_vigencia ?? null,
      };
    });
  });
}

/**
 * Frase da distribuidora escolhida no gráfico do percentual técnico: o trecho mais recente, o trecho de referência anterior e a diferença entre
 * os dois valores que a própria frase mostra (a mesma do gráfico e da tabela). Nada vem de `troca_pp`, que é outra referência. `nListados` é
 * quantos trechos de referência a gold traz para a distribuidora.
 */
export function fraseSelecaoRegulatorio(l: LinhaRegulatorio, nListados: number, idioma: Idioma = idiomaEnergia()): string {
  const base = tx(
    `${l.rotulo}: ${num(l.atual, 3)}% da energia injetada publicada de ${mesAno(l.inicio)} a ${mesAno(l.fim)} (${plural(l.meses, "mês", "meses")})`,
    `${l.rotulo}: ${num(l.atual, 3, idioma)}% of the published injected energy from ${mesAno(l.inicio, idioma)} to ${mesAno(l.fim, idioma)} (${plural(l.meses, "month", "months", idioma)})`,
    idioma,
  );
  const anterior =
    l.anterior !== null && l.anterior_inicio && l.anterior_fim && l.anterior_meses !== null
      ? tx(
          `; trecho anterior de referência: ${num(l.anterior, 3)}% de ${mesAno(l.anterior_inicio)} a ${mesAno(l.anterior_fim)} (${plural(l.anterior_meses, "mês", "meses")}); diferença de ${formatarDiferenca(l.diferenca, 3, "p.p.")}`,
          `; previous reference segment: ${num(l.anterior, 3, idioma)}% from ${mesAno(l.anterior_inicio, idioma)} to ${mesAno(l.anterior_fim, idioma)} (${plural(l.anterior_meses, "month", "months", idioma)}); difference of ${formatarDiferenca(l.diferenca, 3, "p.p.")}`,
          idioma,
        )
      : tx("; sem trecho anterior de referência para comparar", "; no previous reference segment to compare", idioma);
  const reh = l.resolucao
    ? tx(
        `; o início do trecho coincide com o início de vigência da ${rotuloResolucao(l.resolucao)}${l.inicio_vigencia ? ` em ${dataBR(l.inicio_vigencia)}` : ""} (coincidência de datas, não vínculo declarado pela fonte)`,
        `; the start of the segment coincides with the start of validity of ${rotuloResolucao(l.resolucao)}${l.inicio_vigencia ? ` on ${dataBR(l.inicio_vigencia, idioma)}` : ""} (a coincidence of dates, not a link declared by the source)`,
        idioma,
      )
    : "";
  const lista =
    l.n_segmentos > nListados
      ? tx(
          `. A lista traz os ${nListados} trechos de referência mais recentes de ${l.n_segmentos}; os demais estão no arquivo para baixar.`,
          `. The list shows the ${nListados} most recent reference segments of ${l.n_segmentos}; the others are in the download file.`,
          idioma,
        )
      : ".";
  return `${base}${anterior}${reh}${lista}`;
}

/** Quantas distribuidoras têm o percentual do trecho mais recente maior, menor ou igual ao do anterior (na precisão exibida) e quantas não têm trecho anterior. */
export function sinteseRegulatorio(linhas: readonly LinhaRegulatorio[]): { n: number; maior: number; menor: number; igual: number; semAnterior: number } {
  let maior = 0;
  let menor = 0;
  let igual = 0;
  let semAnterior = 0;
  for (const l of linhas) {
    const s = sentidoDiferenca(l.diferenca, 3);
    if (s === "acima") maior++;
    else if (s === "abaixo") menor++;
    else if (s === "igual") igual++;
    else semAnterior++;
  }
  return { n: linhas.length, maior, menor, igual, semAnterior };
}

export function respostaRegulatorio(linhas: readonly LinhaRegulatorio[], idioma: Idioma = idiomaEnergia()): string {
  if (!linhas.length) return tx("Nenhum percentual técnico regulatório foi identificado na série do SAMP.", "No regulatory technical percentage was identified in the SAMP series.", idioma);
  const desc = [...linhas].sort((a, b) => b.atual - a.atual || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const max = desc[0];
  const min = desc[desc.length - 1];
  const comReh = linhas.filter((l) => l.resolucao).length;
  return tx(
    `Percentual técnico regulatório implícito no SAMP, em ${plural(linhas.length, "distribuidora", "distribuidoras")}: no trecho mais recente de cada uma, vai de ${num(min.atual, 3)}% (${min.rotulo}, ${mesAno(min.inicio)} a ${mesAno(min.fim)}) a ${num(max.atual, 3)}% (${max.rotulo}, ${mesAno(max.inicio)} a ${mesAno(max.fim)}) da energia injetada publicada. ${plural(comReh, "trecho recente coincide", "trechos recentes coincidem")} com o início de vigência de uma resolução homologatória.`,
    `Regulatory technical percentage implicit in SAMP, in ${plural(linhas.length, "distribution utility", "distribution utilities", idioma)}: in the most recent segment of each, it ranges from ${num(min.atual, 3, idioma)}% (${min.rotulo}, ${mesAno(min.inicio, idioma)} to ${mesAno(min.fim, idioma)}) to ${num(max.atual, 3, idioma)}% (${max.rotulo}, ${mesAno(max.inicio, idioma)} to ${mesAno(max.fim, idioma)}) of the published injected energy. ${plural(comReh, "recent segment coincides", "recent segments coincide", idioma)} with the start of validity of a ratification resolution.`,
    idioma,
  );
}

/**
 * Veredito do P057: o que o gráfico mostra de fato (o percentual técnico regulatório do trecho mais recente contra o do
 * trecho anterior de cada distribuidora) e o limite de leitura: a diferença é mudança de parâmetro entre processos, não
 * desempenho. A comparação com a perda não técnica realizada não é feita; o aviso dela fica na caixa da página, uma vez só.
 */
export function vereditoRegulatorio(linhas: readonly LinhaRegulatorio[], idioma: Idioma = idiomaEnergia()): string {
  if (!linhas.length) return tx("Nenhum percentual técnico regulatório foi identificado na série do SAMP.", "No regulatory technical percentage was identified in the SAMP series.", idioma);
  return tx(
    `O gráfico compara, em ${plural(linhas.length, "distribuidora", "distribuidoras")}, o percentual técnico regulatório do trecho mais recente com o do trecho anterior. A diferença é mudança de parâmetro entre processos tarifários, não desempenho da distribuidora.`,
    `The chart compares, in ${plural(linhas.length, "distribution utility", "distribution utilities", idioma)}, the regulatory technical percentage of the most recent segment with that of the previous segment. The difference is a change of parameter between tariff processes, not the distribution utility's performance.`,
    idioma,
  );
}

/* ------------------------------------------------------------------ custo e contexto (P058) */

export type LinhaCusto = {
  id: string;
  rotulo: string;
  /** Série ainda publicada no SAMP (falso: distribuidora encerrada ou incorporada). */
  ativa: boolean;
  resolucao: string | null;
  inicio: string;
  fim: string | null;
  situacao: "vigente" | "vigencia_encerrada";
  pt: number;
  pnt: number;
  rede_basica: number;
  perdas: number;
  total: number;
  participacao_perdas_pct: number | null;
  participacao_pnt_pct: number | null;
};

export function linhasCusto(distribuidoras: readonly Distribuidora[]): LinhaCusto[] {
  const out: LinhaCusto[] = [];
  for (const d of distribuidoras) {
    const t = d.tarifa;
    if (!t) continue;
    out.push({
      id: d.cnpj,
      rotulo: rotuloDistribuidora(d),
      ativa: d.ativa,
      resolucao: t.resolucao,
      inicio: t.inicio,
      fim: t.fim,
      situacao: t.situacao,
      pt: t.pt,
      pnt: t.pnt,
      rede_basica: t.rede_basica,
      perdas: t.perdas,
      total: t.total,
      participacao_perdas_pct: t.participacao_perdas_pct,
      participacao_pnt_pct: t.participacao_pnt_pct,
    });
  }
  return out.sort((a, b) => b.perdas - a.perdas || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

export function respostaCusto(linhas: readonly LinhaCusto[], consultadaEm: string, idioma: Idioma = idiomaEnergia()): string {
  const vig = linhas.filter((l) => l.situacao === "vigente" && l.participacao_perdas_pct !== null);
  const enc = linhas.filter((l) => l.situacao === "vigencia_encerrada").length;
  if (!vig.length)
    return tx(
      `Nenhuma distribuidora tem processo tarifário vigente em ${dataBR(consultadaEm)} no arquivo de componentes tarifárias.`,
      `No distribution utility has a tariff process in force on ${dataBR(consultadaEm, idioma)} in the tariff components file.`,
      idioma,
    );
  const porPart = [...vig].sort((a, b) => (a.participacao_perdas_pct as number) - (b.participacao_perdas_pct as number) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const porRs = [...vig].sort((a, b) => a.perdas - b.perdas || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const pmin = porPart[0];
  const pmax = porPart[porPart.length - 1];
  const n2 = (v: number | null) => num(v, 2, idioma);
  const partes = [
    tx(
      `Na base econômica da tarifa residencial B1 vigente em ${dataBR(consultadaEm)} (base de cálculo tarifário, não a tarifa de aplicação que aparece na conta), sem tributos, as componentes de perdas (técnicas, não técnicas e na Rede Básica) vão de ${num(porRs[0].perdas, 2)} R$/MWh (${porRs[0].rotulo}) a ${num(porRs[porRs.length - 1].perdas, 2)} R$/MWh (${porRs[porRs.length - 1].rotulo}) em ${plural(vig.length, "distribuidora", "distribuidoras")}; em participação na tarifa, de ${num(pmin.participacao_perdas_pct, 2)}% (${pmin.rotulo}) a ${num(pmax.participacao_perdas_pct, 2)}% (${pmax.rotulo}).`,
      `In the economic base of the B1 residential tariff in force on ${dataBR(consultadaEm, idioma)} (the tariff calculation base, not the applied tariff that appears on the bill), before taxes, the loss components (technical, non-technical and in the Rede Básica, the basic transmission grid) range from ${n2(porRs[0].perdas)} R$/MWh (${porRs[0].rotulo}) to ${n2(porRs[porRs.length - 1].perdas)} R$/MWh (${porRs[porRs.length - 1].rotulo}) in ${plural(vig.length, "distribution utility", "distribution utilities", idioma)}; as a share of the tariff, from ${n2(pmin.participacao_perdas_pct)}% (${pmin.rotulo}) to ${n2(pmax.participacao_perdas_pct)}% (${pmax.rotulo}).`,
      idioma,
    ),
  ];
  const encAtivas = linhas.filter((l) => l.situacao === "vigencia_encerrada" && l.ativa).length;
  if (encAtivas)
    partes.push(
      tx(
        `${plural(encAtivas, "distribuidora ativa só tem", "distribuidoras ativas só têm")} processo com vigência encerrada no arquivo da fonte: a tarifa em vigor ${encAtivas === 1 ? "dela" : "delas"} é desconhecida até a próxima publicação, e ${encAtivas === 1 ? "ela fica" : "elas ficam"} fora da faixa.`,
        `${plural(encAtivas, "active distribution utility only has a", "active distribution utilities only have a", idioma)} process whose validity has ended in the source file: ${encAtivas === 1 ? "its" : "their"} tariff in force is unknown until the next release, and ${encAtivas === 1 ? "it stays" : "they stay"} outside the range.`,
        idioma,
      ),
    );
  if (enc > encAtivas)
    partes.push(
      tx(
        `Outras ${num(enc - encAtivas, 0)} têm o último processo encerrado, e a série delas no SAMP também terminou.`,
        `Another ${num(enc - encAtivas, 0, idioma)} have their last process ended, and their SAMP series has also ended.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

/**
 * Veredito do P058: quanto da tarifa residencial B1 remunera perdas, em R$/MWh, no menor e no maior valor entre as
 * distribuidoras com processo vigente. O valor é o da coluna Perdas (soma das componentes antes do arredondamento), o mesmo
 * da resposta completa.
 */
export function vereditoCusto(linhas: readonly LinhaCusto[], consultadaEm: string, idioma: Idioma = idiomaEnergia()): string {
  const vig = linhas.filter((l) => l.situacao === "vigente" && l.participacao_perdas_pct !== null);
  if (!vig.length)
    return tx(
      `Nenhuma distribuidora tem processo tarifário vigente em ${dataBR(consultadaEm)} no arquivo de componentes tarifárias.`,
      `No distribution utility has a tariff process in force on ${dataBR(consultadaEm, idioma)} in the tariff components file.`,
      idioma,
    );
  const porRs = [...vig].sort((a, b) => a.perdas - b.perdas || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const menor = porRs[0];
  const maior = porRs[porRs.length - 1];
  return tx(
    `Na base econômica da tarifa residencial B1 de ${dataBR(consultadaEm)} (base de cálculo tarifário, não a tarifa que aparece na conta), a parte que remunera perdas, sem tributos, vai de ${num(menor.perdas, 2)} R$/MWh (${menor.rotulo}) a ${num(maior.perdas, 2)} R$/MWh (${maior.rotulo}), conforme a distribuidora.`,
    `In the economic base of the B1 residential tariff of ${dataBR(consultadaEm, idioma)} (the tariff calculation base, not the tariff that appears on the bill), the part that pays for losses, before taxes, ranges from ${num(menor.perdas, 2, idioma)} R$/MWh (${menor.rotulo}) to ${num(maior.perdas, 2, idioma)} R$/MWh (${maior.rotulo}), depending on the distribution utility.`,
    idioma,
  );
}

/**
 * Valores de desenho das barras de custo. A pilha do gráfico soma as três componentes, e a soma das componentes já arredondadas em duas casas
 * pode diferir em 0,01 da coluna Perdas, que soma antes de arredondar (CERPRO: 9,98 + 0,00 + 4,66 contra 14,65). Para o total no fim da barra, na
 * dica, no texto para leitor de tela e na tabela do gráfico serem o MESMO número da tabela da página, cada componente não nula recebe a mesma fração
 * (0,0034, abaixo de meio centésimo) no sentido da diferença: cada parte, arredondada, segue sendo a da tabela, e a soma arredonda uma vez, meio
 * para cima, no total publicado. A diferença entre o total e a soma das partes arredondadas é de no máximo 0,01 (três partes que erram menos de
 * meio centésimo cada), então duas ou três partes não nulas bastam; com uma só parte a diferença é sempre nula. O teste da página confere todas as linhas.
 */
export function componentesParaBarra(l: Pick<LinhaCusto, "pt" | "pnt" | "rede_basica" | "perdas">): { pt: number; pnt: number; rede_basica: number } {
  const delta = Math.round((l.perdas - (l.pt + l.pnt + l.rede_basica)) * 100) / 100;
  if (delta === 0) return { pt: l.pt, pnt: l.pnt, rede_basica: l.rede_basica };
  const passo = delta > 0 ? 0.0034 : -0.0034;
  const ajusta = (x: number) => (x > 0 ? x + passo : x);
  return { pt: ajusta(l.pt), pnt: ajusta(l.pnt), rede_basica: ajusta(l.rede_basica) };
}

/**
 * Distribuidoras vigentes em que a soma das três componentes, já arredondadas em duas casas (o que a barra do gráfico soma),
 * difere da coluna Perdas (soma antes do arredondamento). A diferença é de arredondamento, no máximo 0,01 R$/MWh.
 */
export function divergenciaArredondamentoCusto(linhas: readonly LinhaCusto[]): { n: number; de: number; exemplo: { rotulo: string; barra: number; tabela: number } | null } {
  const vig = linhas.filter((l) => l.situacao === "vigente");
  const dif = vig.filter((l) => r(l.pt + l.pnt + l.rede_basica, 2) !== r(l.perdas, 2));
  // o exemplo é a divergência de menor valor: é a ponta baixa que o veredito cita
  const ex = [...dif].sort((a, b) => a.perdas - b.perdas)[0];
  return { n: dif.length, de: vig.length, exemplo: ex ? { rotulo: ex.rotulo, barra: r(ex.pt + ex.pnt + ex.rede_basica, 2), tabela: r(ex.perdas, 2) } : null };
}

/** Limites da escala de |ρ| (nula, fraca, moderada), a mesma regra fixa que o texto da página declara. */
export const LIMITES_RHO = [0.1, 0.3, 0.5] as const;

/** Intensidade da correlação de postos por regra fixa (|ρ| < 0,1; 0,3; 0,5). */
export function intensidadeRho(rho: number): string {
  return intensidadeRhoNoIdioma(rho, idiomaEnergia());
}

/** A mesma regra, com o idioma explícito (função de lib chamada também por componente de cliente). */
export function intensidadeRhoNoIdioma(rho: number, idioma: Idioma): string {
  const a = Math.abs(rho);
  if (a < LIMITES_RHO[0]) return tx("praticamente nula", "practically nil", idioma);
  if (a < LIMITES_RHO[1]) return tx("fraca", "weak", idioma);
  if (a < LIMITES_RHO[2]) return tx("moderada", "moderate", idioma);
  return tx("forte", "strong", idioma);
}

export function respostaAssociacao(a: Pick<Associacao, "spearman_taxa_total" | "n_taxa_total" | "spearman_pnt_bt" | "n_pnt_bt" | "ano_perdas">, idioma: Idioma = idiomaEnergia()): string {
  const partes: string[] = [];
  const fr = (rho: number | null, n: number, medida: string) => {
    if (rho === null || n < 3) return tx(`Com ${medida}, não há pares suficientes para a correlação.`, `For ${medida}, there are not enough pairs for the correlation.`, idioma);
    const sentido =
      rho < 0
        ? tx("renda média maior aparece com valores menores", "higher average income appears with lower values", idioma)
        : rho > 0
          ? tx("renda média maior aparece com valores maiores", "higher average income appears with higher values", idioma)
          : tx("não há tendência", "there is no trend", idioma);
    return tx(
      `Com ${medida}, a associação é ${intensidadeRhoNoIdioma(rho, idioma)} (ρ de Spearman = ${num(rho, 3)}, ${plural(n, "concessionária", "concessionárias")}): ${sentido}.`,
      `For ${medida}, the association is ${intensidadeRhoNoIdioma(rho, idioma)} (Spearman's ρ = ${num(rho, 3, idioma)}, ${plural(n, "concession holder", "concession holders", idioma)}): ${sentido}.`,
      idioma,
    );
  };
  partes.push(
    tx(
      `Em ${a.ano_perdas}, ano do Censo, comparando áreas de concessão pela renda média domiciliar per capita dos seus municípios.`,
      `In ${a.ano_perdas}, the Census year, comparing concession areas by the average household income per capita of their municipalities.`,
      idioma,
    ),
  );
  partes.push(fr(a.spearman_taxa_total, a.n_taxa_total, tx("a taxa de perdas totais", "the total loss rate", idioma)));
  partes.push(fr(a.spearman_pnt_bt, a.n_pnt_bt, tx("a não técnica sobre o mercado de baixa tensão", "non-technical losses over the low-voltage market", idioma)));
  partes.push(
    tx(
      `Escala do observatório para |ρ|: praticamente nula abaixo de ${num(LIMITES_RHO[0], 1)}, fraca até ${num(LIMITES_RHO[1], 1)}, moderada até ${num(LIMITES_RHO[2], 1)} e forte a partir daí.`,
      `Observatory scale for |ρ|: practically nil below ${num(LIMITES_RHO[0], 1, idioma)}, weak up to ${num(LIMITES_RHO[1], 1, idioma)}, moderate up to ${num(LIMITES_RHO[2], 1, idioma)} and strong from there on.`,
      idioma,
    ),
  );
  partes.push(tx("É descrição entre áreas, não causa.", "It is a description across areas, not a cause.", idioma));
  return partes.join(" ");
}

/**
 * Veredito do painel de contexto: o sentido da associação entre a renda média da área e a taxa de perdas totais, em
 * palavras comuns e sem o coeficiente (que fica na segunda camada, com a escala), e o limite de leitura.
 */
export function vereditoAssociacao(a: Pick<Associacao, "spearman_taxa_total" | "n_taxa_total" | "ano_perdas">, idioma: Idioma = idiomaEnergia()): string {
  const rho = a.spearman_taxa_total;
  if (rho === null || a.n_taxa_total < 3)
    return tx("Não há pares suficientes para comparar a renda média das áreas com a taxa de perdas.", "There are not enough pairs to compare the average income of the areas with the loss rate.", idioma);
  const sentido =
    rho < 0
      ? tx("quanto maior a renda média da área, menor tende a ser a taxa de perdas totais", "the higher the average income of the area, the lower the total loss rate tends to be", idioma)
      : rho > 0
        ? tx("quanto maior a renda média da área, maior tende a ser a taxa de perdas totais", "the higher the average income of the area, the higher the total loss rate tends to be", idioma)
        : tx("a renda média da área não indica tendência na taxa de perdas totais", "the average income of the area shows no trend in the total loss rate", idioma);
  return tx(
    `Em ${a.ano_perdas}, nas ${num(a.n_taxa_total, 0)} concessionárias, ${sentido}. É uma associação entre áreas, não uma causa.`,
    `In ${a.ano_perdas}, across the ${num(a.n_taxa_total, 0, idioma)} concession holders, ${sentido}. It is an association across areas, not a cause.`,
    idioma,
  );
}

/* ------------------------------------------------------------------ indicadores de destaque */

/** Diferença, em p.p., entre o ano e o anterior nas mesmas distribuidoras (par publicado pelo pipeline). */
export function variacaoMesmas(par: [number | null, number | null] | null | undefined): number | null {
  if (!par || par[0] === null || par[1] === null) return null;
  return r(par[1] - par[0], 2);
}

/** Linha nacional das concessionárias de um ano. */
export function linhaNacional(g: Pick<PerdasGold, "nacional">, ano: number): LinhaNacional | null {
  return g.nacional.find((l) => l.ano === ano && l.universo === "concessionarias") ?? null;
}

/* ------------------------------------------------------------------ leitura sob demanda */

const cacheJson = new Map<string, Promise<unknown>>();

/**
 * Busca um JSON público uma vez por página (pedidos iguais compartilham a promessa; falha
 * não fica em cache, para o "tentar de novo" funcionar). Só roda no navegador, em efeito.
 */
export function carregarJson<T>(url: string): Promise<T> {
  let p = cacheJson.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`resposta ${r.status}`);
        return r.json() as Promise<unknown>;
      })
      .catch((e: unknown) => {
        cacheJson.delete(url);
        throw e;
      });
    cacheJson.set(url, p);
  }
  return p as Promise<T>;
}

/* ------------------------------------------------------------------ dados dos painéis cliente */

/** Por que uma distribuidora não aparece nas barras de composição do ano de referência. */
export function motivosComposicao(distribuidoras: readonly Distribuidora[], anoRef: number, idioma: Idioma = idiomaEnergia()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of distribuidoras) {
    const rec = recorteDaReferencia(d);
    if (!rec || d.referencia?.ano !== anoRef) {
      out[d.cnpj] = tx(`sem balanço publicado em ${anoRef}`, `no balance published in ${anoRef}`, idioma);
      continue;
    }
    const fora = motivoForaTotal(rec, idioma);
    if (fora) out[d.cnpj] = tx(`fora da comparação (${fora})`, `outside the comparison (${fora})`, idioma);
    else if (d.referencia.taxa_tecnica_pct === null || d.referencia.pnt_injetada_pct === null)
      out[d.cnpj] = tx(
        "a fonte não publicou a separação técnica e não técnica em todos os meses do ano",
        "the source did not publish the technical and non-technical separation in every month of the year",
        idioma,
      );
    else if (!DECOMPOSICAO_OK.includes(d.referencia.decomposicao))
      out[d.cnpj] = tx(
        "perdas totais diferentes de técnicas + não técnicas (decomposição não fecha)",
        "total losses different from technical + non-technical (decomposition does not close)",
        idioma,
      );
  }
  return out;
}

/** Trechos de referência do percentual técnico por CNPJ (os publicados na gold). */
export function segmentosPorDistribuidora(distribuidoras: readonly Distribuidora[]): Record<string, SegmentoTecnico[]> {
  const out: Record<string, SegmentoTecnico[]> = {};
  for (const d of distribuidoras) if (d.tecnica_regulatoria?.segmentos.length) out[d.cnpj] = d.tecnica_regulatoria.segmentos;
  return out;
}

/** Pontos da associação com a renda: o CNPJ publicado vira o rótulo da distribuidora. */
export function pontosAssociacao(a: Pick<Associacao, "pontos">, rotulos: Readonly<Record<string, string>>) {
  return a.pontos.map(([cnpj, renda, pnt_bt, taxa]) => ({ id: cnpj, rotulo: rotulos[cnpj] ?? cnpj, renda, taxa, pnt_bt }));
}

/** Linhas da tabela de território e contexto social (municípios confirmados da relação vigente). */
export function linhasContexto(distribuidoras: readonly Distribuidora[]): LinhaTabela[] {
  return distribuidoras
    .filter((d) => d.territorio || d.contexto)
    .map((d) => ({
      id: d.cnpj,
      rotulo: d.sigla ? `${d.sigla} · ${d.nome}` : d.nome,
      ufs: d.territorio?.ufs.join("/") || null,
      municipios: d.territorio?.municipios ?? null,
      confirmados: d.territorio?.confirmados ?? null,
      exclusivos: d.territorio?.exclusivos ?? null,
      populacao: d.contexto?.populacao_confirmados ?? null,
      area_km2: d.contexto?.area_km2_confirmados ?? null,
      renda: d.contexto?.renda_media_pc_confirmados ?? null,
      cobertura_exclusivos: d.contexto?.cobertura_exclusivos_pct ?? null,
    }));
}

/* ------------------------------------------------------------------ respostas gerais */

/** Como a taxa mudou entre dois valores do mesmo universo, decidido na primeira casa decimal. */
export function fraseMudanca(antes: number, depois: number, idioma: Idioma = idiomaEnergia()): string {
  // as duas taxas chegam com duas casas: a comparação e o texto usam as duas, sem novo arredondamento
  const x = r(depois - antes, 2);
  if (x === 0) return tx(`ficou igual (${num(antes, 2)}%)`, `stayed the same (${num(antes, 2, idioma)}%)`, idioma);
  return tx(
    `${x > 0 ? "subiu" : "caiu"} de ${num(antes, 2)}% para ${num(depois, 2)}%`,
    `${x > 0 ? "rose" : "fell"} from ${num(antes, 2, idioma)}% to ${num(depois, 2, idioma)}%`,
    idioma,
  );
}

/**
 * Resposta curta da página: volume e taxa das concessionárias no ano de referência, a
 * comparação com o ano anterior nas mesmas distribuidoras e o acumulado do ano aberto
 * contra o mesmo período, todos da gold.
 */
export function respostaGeral(g: Pick<PerdasGold, "nacional" | "referencia" | "acumulado">, idioma: Idioma = idiomaEnergia()): string {
  const l = linhaNacional(g, g.referencia.ano);
  if (!l || l.taxa_total_pct === null || l.perdas_totais_mwh === null)
    return tx(`Sem soma nacional das concessionárias em ${g.referencia.ano}.`, `No national sum of the concession holders in ${g.referencia.ano}.`, idioma);
  const n0 = (v: number) => num(v, 0, idioma);
  const n2 = (v: number) => num(v, 2, idioma);
  const partes = [
    tx(
      `Em ${l.ano}, as ${num(l.n_distribuidoras, 0)} concessionárias com o ano completo e sem alerta perderam ${num(l.perdas_totais_mwh / 1e6, 1)} TWh, ${num(l.taxa_total_pct, 2)}% da energia injetada de referência.`,
      `In ${l.ano}, the ${n0(l.n_distribuidoras)} concession holders with a complete year and no alert lost ${num(l.perdas_totais_mwh / 1e6, 1, idioma)} TWh, ${n2(l.taxa_total_pct)}% of the reference injected energy.`,
      idioma,
    ),
  ];
  const m = l.mesmas_ano_anterior;
  if (m?.taxa_total_pct && m.taxa_total_pct[0] !== null && m.taxa_total_pct[1] !== null) {
    partes.push(
      tx(
        `Nas mesmas ${num(m.n_total, 0)} concessionárias, a taxa ${fraseMudanca(m.taxa_total_pct[0], m.taxa_total_pct[1])} de ${l.ano - 1} para ${l.ano}.`,
        `In the same ${n0(m.n_total)} concession holders, the rate ${fraseMudanca(m.taxa_total_pct[0], m.taxa_total_pct[1], idioma)} from ${l.ano - 1} to ${l.ano}.`,
        idioma,
      ),
    );
  }
  const c = g.acumulado?.agregados.find((x) => x.universo === "concessionarias");
  if (g.acumulado && c && c.atual.taxa_total_pct !== null && c.anterior.taxa_total_pct !== null) {
    partes.push(
      tx(
        `De janeiro a ${MESES_LONGOS[g.acumulado.mes_fim - 1]} de ${g.acumulado.ano}, nas ${num(c.n_distribuidoras, 0)} concessionárias comparáveis, a taxa foi ${num(c.atual.taxa_total_pct, 2)}%, contra ${num(c.anterior.taxa_total_pct, 2)}% no mesmo período de ${g.acumulado.ano - 1}. ` +
          `As ${num(c.n_distribuidoras, 0)} são as que têm os mesmos meses publicados nos dois anos; ${num(l.n_distribuidoras, 0)} têm o ano de ${l.ano} completo.`,
        `From January to ${nomeMes(g.acumulado.mes_fim, idioma, true)} ${g.acumulado.ano}, in the ${n0(c.n_distribuidoras)} comparable concession holders, the rate was ${n2(c.atual.taxa_total_pct)}%, against ${n2(c.anterior.taxa_total_pct)}% in the same period of ${g.acumulado.ano - 1}. ` +
          `The ${n0(c.n_distribuidoras)} are those with the same months published in both years; ${n0(l.n_distribuidoras)} have the complete year ${l.ano}.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/** "0,01 ponto percentual a mais" / "a menos" / "o mesmo valor": a diferença entre duas taxas de duas casas, na precisão exibida. */
function frasePontos(antes: number, depois: number, anoBase: number, idioma: Idioma): string {
  const x = r(depois - antes, 2);
  if (x === 0) return tx(`o mesmo valor de ${anoBase}`, `the same value as in ${anoBase}`, idioma);
  return tx(
    `${num(Math.abs(x), 2)} ${Math.abs(x) > 1 ? "pontos percentuais" : "ponto percentual"} ${x > 0 ? "a mais" : "a menos"} que em ${anoBase}`,
    `${num(Math.abs(x), 2, idioma)} ${Math.abs(x) === 1 ? "percentage point" : "percentage points"} ${x > 0 ? "more" : "less"} than in ${anoBase}`,
    idioma,
  );
}

/**
 * Veredito da página: quanto as concessionárias com o ano completo perderam, em % da energia que entrou na rede, e como isso
 * se compara ao ano anterior nas mesmas empresas. Os dois números são os de respostaGeral; o volume em TWh, os universos e o
 * acumulado do ano aberto ficam na resposta completa.
 */
export function vereditoGeral(g: Pick<PerdasGold, "nacional" | "referencia">, idioma: Idioma = idiomaEnergia()): string {
  const l = linhaNacional(g, g.referencia.ano);
  if (!l || l.taxa_total_pct === null) return tx(`Sem soma nacional das concessionárias em ${g.referencia.ano}.`, `No national sum of the concession holders in ${g.referencia.ano}.`, idioma);
  const m = l.mesmas_ano_anterior;
  const comparacao =
    m?.taxa_total_pct && m.taxa_total_pct[0] !== null && m.taxa_total_pct[1] !== null
      ? tx(
          `, ${frasePontos(m.taxa_total_pct[0], m.taxa_total_pct[1], l.ano - 1, idioma)} nas mesmas empresas`,
          `, ${frasePontos(m.taxa_total_pct[0], m.taxa_total_pct[1], l.ano - 1, idioma)} in the same companies`,
          idioma,
        )
      : "";
  return tx(
    `Em ${l.ano}, as concessionárias com o ano completo perderam ${num(l.taxa_total_pct, 2)}% da energia que entrou na rede${comparacao}.`,
    `In ${l.ano}, the concession holders with a complete year lost ${num(l.taxa_total_pct, 2, idioma)}% of the energy that entered the grid${comparacao}.`,
    idioma,
  );
}

/** Veredito da composição: as duas parcelas, cada uma na sua base, e o aviso de que as bases são diferentes e não se somam. */
export function vereditoComposicao(g: Pick<PerdasGold, "nacional" | "referencia">, idioma: Idioma = idiomaEnergia()): string {
  const l = linhaNacional(g, g.referencia.ano);
  if (!l || l.taxa_total_pct === null) return tx(`Sem soma nacional das concessionárias em ${g.referencia.ano}.`, `No national sum of the concession holders in ${g.referencia.ano}.`, idioma);
  if (l.taxa_tecnica_pct === null)
    return tx(`Em ${l.ano}, nenhuma concessionária válida publicou a perda técnica nos 12 meses.`, `In ${l.ano}, no valid concession holder published technical losses for the 12 months.`, idioma);
  const tecnica = tx(
    `as perdas técnicas foram ${num(l.taxa_tecnica_pct, 2)}% da energia que entrou na rede`,
    `technical losses were ${num(l.taxa_tecnica_pct, 2, idioma)}% of the energy that entered the grid`,
    idioma,
  );
  if (l.pnt_bt_pct === null)
    return tx(
      `Em ${l.ano}, nas concessionárias que publicam a separação, ${tecnica}. Nenhuma publicou a parcela não técnica fechando com a total.`,
      `In ${l.ano}, in the concession holders that publish the separation, ${tecnica}. None published the non-technical share closing with the total.`,
      idioma,
    );
  return tx(
    `Em ${l.ano}, nas concessionárias que publicam a separação, ${tecnica} e as não técnicas, ${num(l.pnt_bt_pct, 2)}% do mercado de baixa tensão. As duas porcentagens têm bases diferentes e não se somam.`,
    `In ${l.ano}, in the concession holders that publish the separation, ${tecnica} and non-technical losses ${num(l.pnt_bt_pct, 2, idioma)}% of the low-voltage market. The two percentages have different bases and do not add up.`,
    idioma,
  );
}

/** Série nacional em tabela: uma linha por ano completo, com universo e comparação nas mesmas. */
export function linhasNacionais(nacional: readonly LinhaNacional[], idioma: Idioma = idiomaEnergia()): (string | number | null)[][] {
  return nacional
    .filter((l) => !l.parcial)
    .sort((a, b) => a.ano - b.ano)
    .map((l) => {
      const m = l.mesmas_ano_anterior;
      const par = m?.taxa_total_pct;
      return [
        // ano como texto: como número, a tabela o formataria com separador de milhar ("2.003")
        String(l.ano),
        l.n_distribuidoras,
        l.n_publicadas,
        l.perdas_totais_mwh === null ? null : l.perdas_totais_mwh / 1000,
        l.injetada_mwh === null ? null : l.injetada_mwh / 1000,
        l.taxa_total_pct,
        l.universo_igual_ano_anterior === null ? null : l.universo_igual_ano_anterior.total ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
        par && par[0] !== null && par[1] !== null ? `${num(par[0], 2, idioma)}% → ${num(par[1], 2, idioma)}% (${num(m!.n_total, 0, idioma)})` : null,
        Object.entries(l.excluidos)
          .map(([k, n]) => `${k === "ano_incompleto" ? tx("ano incompleto", "incomplete year", idioma) : (rotulosAlerta(idioma) as Record<string, string>)[k] ?? k}: ${n}`)
          .join("; ") || tx("nenhuma", "none", idioma),
      ];
    });
}

/** Separação nacional em tabela: técnica e não técnica com o universo e a cobertura de cada ano. */
export function linhasSeparacaoNacional(nacional: readonly LinhaNacional[], idioma: Idioma = idiomaEnergia()): (string | number | null)[][] {
  return nacional
    .filter((l) => !l.parcial)
    .sort((a, b) => a.ano - b.ano)
    .map((l) => [
      String(l.ano),
      l.n_com_tecnica,
      l.cobertura_tecnica_pct,
      l.taxa_tecnica_pct,
      l.taxa_tecnica_injetada_publicada_pct,
      l.n_com_pnt_bt,
      l.cobertura_bt_pct,
      l.pnt_bt_pct,
      l.universo_igual_ano_anterior === null ? null : l.universo_igual_ano_anterior.pnt_bt ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
    ]);
}

/** Resposta curta da série nacional: menor e maior taxa anual das concessionárias, com o ano. */
export function respostaEvolucao(nacional: readonly LinhaNacional[], anoRef: number, idioma: Idioma = idiomaEnergia()): string {
  const serie = serieNacional(nacional).filter((l): l is typeof l & { taxa: number } => l.taxa !== null);
  if (!serie.length) return tx("Sem série nacional das concessionárias publicada.", "No national series of the concession holders published.", idioma);
  const ordem = [...serie].sort((a, b) => a.taxa - b.taxa || Number(a.ano) - Number(b.ano));
  const min = ordem[0];
  const max = ordem[ordem.length - 1];
  const ult = serie.find((l) => Number(l.ano) === anoRef);
  return tx(
    `De ${serie[0].ano} a ${serie[serie.length - 1].ano}, a taxa anual das concessionárias ficou entre ${num(min.taxa, 2)}% (${min.ano}) e ${num(max.taxa, 2)}% (${max.ano})${
      ult ? `; em ${anoRef}, ${num(ult.taxa, 2)}%` : ""
    }. Os anos não têm todos o mesmo conjunto de distribuidoras: a tabela diz onde o universo mudou.`,
    `From ${serie[0].ano} to ${serie[serie.length - 1].ano}, the annual rate of the concession holders stayed between ${num(min.taxa, 2, idioma)}% (${min.ano}) and ${num(max.taxa, 2, idioma)}% (${max.ano})${
      ult ? `; in ${anoRef}, ${num(ult.taxa, 2, idioma)}%` : ""
    }. Not all years have the same group of distribution utilities: the table shows where the universe changed.`,
    idioma,
  );
}

/** Veredito da série nacional: a faixa da taxa anual das concessionárias e o aviso de que o conjunto de distribuidoras muda de ano a ano. */
export function vereditoEvolucao(nacional: readonly LinhaNacional[], idioma: Idioma = idiomaEnergia()): string {
  const serie = serieNacional(nacional).filter((l): l is typeof l & { taxa: number } => l.taxa !== null);
  if (!serie.length) return tx("Sem série nacional das concessionárias publicada.", "No national series of the concession holders published.", idioma);
  const ordem = [...serie].sort((a, b) => a.taxa - b.taxa || Number(a.ano) - Number(b.ano));
  return tx(
    `De ${serie[0].ano} a ${serie[serie.length - 1].ano}, a taxa anual das concessionárias ficou entre ${num(ordem[0].taxa, 2)}% e ${num(ordem[ordem.length - 1].taxa, 2)}%. Os anos não têm sempre as mesmas distribuidoras.`,
    `From ${serie[0].ano} to ${serie[serie.length - 1].ano}, the annual rate of the concession holders stayed between ${num(ordem[0].taxa, 2, idioma)}% and ${num(ordem[ordem.length - 1].taxa, 2, idioma)}%. The years do not always have the same distribution utilities.`,
    idioma,
  );
}

/* ------------------------------------------------------------------ faixa de comparação entre distribuidoras */

/** "a, b e c" ("a, b and c" em inglês). */
function juntar(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/** Um extremo observado: o valor e todas as distribuidoras que o têm (os empates não se perdem). */
export type PontaFaixa = { v: number; rotulos: string[] };

/**
 * A faixa de comparação entre distribuidoras numa medida e num período: quantas entram (valor comparável), de que tipo são, o menor e o
 * maior valor observados com todos os empates, a mediana simples (sem ponderar pelo tamanho) e quantas ficam de fora (valor publicado
 * fora da comparação, ou sem dado). É outro universo e outra conta que o agregado das concessionárias da série nacional (razão entre
 * somas): a página diz os dois lado a lado, cada um com a sua contagem.
 *
 * Lê os mesmos `valores` que pintam o mapa e preenchem a tabela e a exportação: o que o mapa pinta com a cor de uma classe é o que
 * entra aqui. Extremos são valores observados, não metas nem classificação de desempenho.
 */
export type FaixaComparacao = {
  n: number;
  /** Quantas das comparáveis são concessionárias e quantas são permissionárias; null quando os tipos não foram informados. */
  porGrupo: { concessionaria: number; permissionaria: number } | null;
  minimo: PontaFaixa | null;
  maximo: PontaFaixa | null;
  /** Mediana simples entre as comparáveis (quantil tipo 7 de distribuicao.ts). */
  mediana: number | null;
  /** Valor publicado pela fonte, mas fora da comparação (ano incompleto, alerta físico, decomposição que não fecha). */
  fora: number;
  semDado: number;
  /** Distribuidoras do recorte: comparáveis, fora da comparação e sem dado. */
  total: number;
};

export function faixaComparacao(
  valores: Readonly<Record<string, ValorMapa>>,
  rotulos: Readonly<Record<string, string>>,
  grupos?: Readonly<Record<string, Distribuidora["grupo"]>>,
): FaixaComparacao {
  const col = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
  const comp: { id: string; v: number }[] = [];
  let fora = 0;
  let semDado = 0;
  for (const [id, x] of Object.entries(valores)) {
    if (x.estado === "valor") comp.push({ id, v: x.v });
    else if (x.estado === "fora") fora++;
    else semDado++;
  }
  const ponta = (alvo: number): PontaFaixa => ({ v: alvo, rotulos: comp.filter((c) => c.v === alvo).map((c) => rotulos[c.id] ?? c.id).sort(col.compare) });
  let minimo: PontaFaixa | null = null;
  let maximo: PontaFaixa | null = null;
  if (comp.length) {
    let mn = comp[0].v;
    let mx = comp[0].v;
    for (const c of comp) {
      if (c.v < mn) mn = c.v;
      if (c.v > mx) mx = c.v;
    }
    minimo = ponta(mn);
    maximo = ponta(mx);
  }
  return {
    n: comp.length,
    porGrupo: grupos
      ? { concessionaria: comp.filter((c) => grupos[c.id] === "concessionaria").length, permissionaria: comp.filter((c) => grupos[c.id] === "permissionaria").length }
      : null,
    minimo,
    maximo,
    mediana: comp.length ? resumoDistribuicao(comp.map((c) => c.v)).mediana : null,
    fora,
    semDado,
    total: comp.length + fora + semDado,
  };
}

/** "83 distribuidoras comparáveis (51 concessionárias e 32 permissionárias)": o universo da faixa, dito com as suas contagens. */
export function textoUniversoFaixa(f: FaixaComparacao, idioma: Idioma = idiomaEnergia()): string {
  const base = tx(plural(f.n, "distribuidora comparável", "distribuidoras comparáveis"), plural(f.n, "comparable distribution utility", "comparable distribution utilities", idioma), idioma);
  if (!f.porGrupo) return base;
  return tx(
    `${base} (${plural(f.porGrupo.concessionaria, "concessionária", "concessionárias")} e ${plural(f.porGrupo.permissionaria, "permissionária", "permissionárias")})`,
    `${base} (${plural(f.porGrupo.concessionaria, "concession holder", "concession holders", idioma)} and ${plural(f.porGrupo.permissionaria, "permit holder", "permit holders", idioma)})`,
    idioma,
  );
}

/** O extremo com o nome de todas as distribuidoras empatadas: "3,25% (EFLUL)". */
export function textoPontaFaixa(p: PontaFaixa, medida: Pick<Medida, "id" | "casas" | "sufixo">, idioma: Idioma = idiomaEnergia()): string {
  return `${textoNumero(p.v, medida, idioma)} (${juntar(p.rotulos, idioma)})`;
}

/**
 * Frase da faixa de comparação: o universo, o menor e o maior valor observados e a mediana simples. A frase não diz "melhor" nem "pior": a
 * ordem é a da medida, e a distribuidora de cada ponta é só a que tem o valor.
 */
export function textoFaixa(f: FaixaComparacao, medida: Pick<Medida, "id" | "casas" | "sufixo">, idioma: Idioma = idiomaEnergia()): string {
  if (!f.minimo || !f.maximo) return tx("Nenhuma distribuidora tem valor comparável nesta medida e neste período.", "No distribution utility has a comparable value in this measure and period.", idioma);
  const mediana =
    f.mediana === null
      ? ""
      : tx(
          `; a mediana simples, sem ponderar pelo tamanho da distribuidora, é ${textoNumero(f.mediana, medida)}`,
          `; the simple median, not weighted by the size of the distribution utility, is ${textoNumero(f.mediana, medida, idioma)}`,
          idioma,
        );
  return tx(
    `Entre ${textoUniversoFaixa(f)}, o menor valor observado é ${textoPontaFaixa(f.minimo, medida)} e o maior, ${textoPontaFaixa(f.maximo, medida)}${mediana}.`,
    `Among ${textoUniversoFaixa(f, idioma)}, the lowest observed value is ${textoPontaFaixa(f.minimo, medida, idioma)} and the highest, ${textoPontaFaixa(f.maximo, medida, idioma)}${mediana}.`,
    idioma,
  );
}

/** Quem fica fora da faixa: "20 com valor publicado fora da comparação e 20 sem dado no período"; vazio quando todas entram. */
export function textoForaDaFaixa(f: Pick<FaixaComparacao, "fora" | "semDado">, idioma: Idioma = idiomaEnergia()): string {
  const partes: string[] = [];
  if (f.fora)
    partes.push(
      tx(
        `${num(f.fora, 0)} com valor publicado fora da comparação (ano incompleto, alerta físico ou decomposição que não fecha)`,
        `${num(f.fora, 0, idioma)} with a published value outside the comparison (incomplete year, physical alert or decomposition that does not close)`,
        idioma,
      ),
    );
  if (f.semDado) partes.push(tx(`${num(f.semDado, 0)} sem dado no período`, `${num(f.semDado, 0, idioma)} with no data in the period`, idioma));
  return partes.length ? tx(`Ficam de fora: ${juntar(partes)}.`, `Excluded: ${juntar(partes, idioma)}.`, idioma) : "";
}

/* ------------------------------------------------------------------ cobertura da separação técnica e não técnica */

/**
 * Contagens e cobertura da separação no agregado das concessionárias de um ano (série nacional): a técnica e a não técnica são
 * estimativas publicadas por parte das concessionárias válidas, e cada uma tem a sua cobertura (injetada para a técnica, mercado de baixa
 * tensão para a não técnica). As frases saem destas mesmas contagens na abertura, na faixa da página de composição e na resposta.
 */
export function coberturaSeparacao(l: LinhaNacional, publicaramTecnica?: number, idioma: Idioma = idiomaEnergia()): { tecnica: string; pntBt: string } {
  // a contagem da série nacional é a de quem entra na soma; quem publicou a técnica mas tem a decomposição quebrada fica fora dela
  const fora = publicaramTecnica !== undefined && publicaramTecnica > l.n_com_tecnica ? publicaramTecnica - l.n_com_tecnica : 0;
  const n0 = (v: number) => num(v, 0, idioma);
  const foraTexto = fora
    ? tx(
        `. ${fora === 1 ? "Outra publicou" : `${num(fora, 0)} outras publicaram`} a técnica e ${fora === 1 ? "fica fora da soma: a decomposição dela não fecha" : "ficam fora da soma: a decomposição delas não fecha"}`,
        `. ${fora === 1 ? "Another one published" : `${n0(fora)} others published`} technical losses and ${fora === 1 ? "is excluded from the sum: its decomposition does not close" : "are excluded from the sum: their decomposition does not close"}`,
        idioma,
      )
    : "";
  return {
    tecnica: tx(
      `${num(l.n_com_tecnica, 0)} de ${num(l.n_distribuidoras, 0)} concessionárias válidas entram na soma da técnica (publicaram a técnica nos 12 meses, sem a decomposição quebrada), ${pctOu(l.cobertura_tecnica_pct, 1)} da energia injetada das válidas${foraTexto}`,
      `${n0(l.n_com_tecnica)} of ${n0(l.n_distribuidoras)} valid concession holders enter the technical sum (they published technical losses for the 12 months, with no broken decomposition), ${pctOu(l.cobertura_tecnica_pct, 1, idioma)} of the injected energy of the valid ones${foraTexto}`,
      idioma,
    ),
    pntBt: tx(
      `${num(l.n_com_pnt_bt, 0)} de ${num(l.n_distribuidoras, 0)} concessionárias válidas entram na soma da não técnica (a separação fecha com a total), ${pctOu(l.cobertura_bt_pct, 1)} do mercado de baixa tensão das válidas`,
      `${n0(l.n_com_pnt_bt)} of ${n0(l.n_distribuidoras)} valid concession holders enter the non-technical sum (the separation closes with the total), ${pctOu(l.cobertura_bt_pct, 1, idioma)} of the low-voltage market of the valid ones`,
      idioma,
    ),
  };
}

/** Concessionárias válidas do ano de referência que publicaram a perda técnica nos 12 meses, com a decomposição fechando ou não (a série nacional conta só as que entram na soma). */
export function nPublicaramTecnica(distribuidoras: readonly Distribuidora[]): number {
  return distribuidoras.filter((d) => {
    if (d.grupo !== "concessionaria") return false;
    const rec = recorteDaReferencia(d);
    const pt = d.referencia?.perdas_tecnicas_mwh;
    return !!rec && validoTotal(rec) && pt !== null && pt !== undefined;
  }).length;
}

/* ------------------------------------------------------------------ elegibilidade da comparação regulatória */

/**
 * Perímetro da página de referência regulatória: quantas distribuidoras têm ao menos um trecho de referência identificado (de quantas têm
 * série no SAMP), o mês em que termina o trecho mais recente de cada uma (do mais antigo ao mais novo) e em quantas a troca mais recente
 * coincide com o início de vigência de uma resolução homologatória. Lê as mesmas linhas do gráfico, da tabela e da exportação.
 */
export function perimetroRegulatorio(linhas: readonly LinhaRegulatorio[], totalDistribuidoras: number): {
  comTrecho: number;
  total: number;
  fimMaisAntigo: string | null;
  fimMaisRecente: string | null;
  comResolucao: number;
} {
  const fins = linhas.map((l) => l.fim).sort();
  return {
    comTrecho: linhas.length,
    total: totalDistribuidoras,
    fimMaisAntigo: fins[0] ?? null,
    fimMaisRecente: fins.length ? fins[fins.length - 1] : null,
    comResolucao: linhas.filter((l) => l.troca_pp !== null && l.resolucao).length,
  };
}
