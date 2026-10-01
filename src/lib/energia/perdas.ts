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
import { classeDe, quebrasFixas, type Classificacao } from "./escalas";
import { dataBR, mesAno, num, plural } from "./formato";

/* ------------------------------------------------------------------ rótulos */

export const ROTULO_ALERTA: Record<AlertaAnual, string> = {
  injetada_nao_positiva: "energia injetada nula ou negativa",
  perda_total_negativa: "perda total negativa",
  perda_total_maior_que_injetada: "perda total maior que a energia injetada",
  fornecida_maior_que_injetada: "energia fornecida maior que a injetada",
  balanco_nao_fecha: "balanço que não fecha (resíduo acima de 5% da injetada)",
  representacoes_conflitantes: "duas representações da mesma grandeza que não concordam",
};

export const ROTULO_DECOMPOSICAO: Record<EstadoDecomposicao, string> = {
  fecha: "fecha (até 2 kWh por mês)",
  diferenca_pequena: "diferença pequena (até 0,1% da perda total)",
  nao_fecha: "não fecha",
  sem_separacao: "sem separação publicada",
};

export const ROTULO_ORIGEM: Record<OrigemInjetada, string> = {
  publicada: "linha publicada",
  requerida: "fornecida + irregular + perdas (leiaute de 2024)",
  mista: "mista (dois leiautes no ano)",
};

export const ROTULO_GRUPO: Record<Distribuidora["grupo"], string> = {
  concessionaria: "Concessionária",
  permissionaria: "Permissionária",
};

/** Estados de decomposição em que técnica + não técnica reproduzem o total (DECOMPOSICAO_OK do pipeline). */
export const DECOMPOSICAO_OK: readonly EstadoDecomposicao[] = ["fecha", "diferenca_pequena"];

/** Ordem dos campos de cada linha de perdas_anual.json (conferida contra `campos` no teste). */
export const CAMPOS_ANUAIS = [
  "ano",
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
> & { territorio: Pick<Territorio, "ufs" | "municipios" | "exclusivos" | "compartilhados" | "nao_confirmados"> | null };

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
  };
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
    tipo: "ano",
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
    tipo: "ano",
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
export function motivoForaTotal(a: RecortePerdas): string | null {
  if (a.tipo === "acumulado") {
    if (a.comparavel_acumulado) return null;
    if (a.alertas.length) return `alerta físico: ${ROTULO_ALERTA[a.alertas[0]]}`;
    if (!a.completo) return `${a.meses} meses publicados no recorte`;
    return "sem o mesmo recorte comparável no ano anterior (mês faltando, alerta ou mudança de escala)";
  }
  if (!a.completo) return `ano incompleto: ${plural(a.meses, "mês publicado", "meses publicados")}`;
  if (a.alertas.length) return `alerta físico: ${ROTULO_ALERTA[a.alertas[0]]}`;
  if (a.injetada_mwh === null || a.perdas_totais_mwh === null) return "injetada ou perdas ausentes em algum mês";
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

export const MEDIDAS: Record<IdMedida, Medida> = {
  taxa: {
    id: "taxa",
    rotulo: "Taxa de perdas totais",
    unidade: "% da energia injetada",
    sufixo: "%",
    casas: 2,
    casasCortes: 0,
    // de 5 em 5 pontos até 15% (a ordem da taxa nacional) e um degrau largo até 25%
    cortes: [5, 10, 15, 25],
    cores: SEQ,
    explicacao:
      "Perdas totais medidas (energia injetada na rede que não chega como consumo medido) divididas pela energia injetada de referência da própria distribuidora no período.",
    denominador: "energia injetada de referência",
    natureza: "CALCULADO",
    soReferencia: false,
    noAcumulado: true,
  },
  volume: {
    id: "volume",
    rotulo: "Perdas totais em energia",
    unidade: "GWh",
    sufixo: " GWh",
    casas: 0,
    casasCortes: 0,
    // escala próxima da logarítmica: o volume vai de menos de 1 GWh a mais de 10 TWh
    cortes: [10, 100, 1000, 5000],
    cores: SEQ,
    explicacao:
      "Energia perdida no período, em GWh: a diferença que a ANEEL calcula no balanço de cada distribuidora (valor medido). Distribuidora grande perde mais em volume mesmo com taxa menor.",
    denominador: null,
    natureza: "OBSERVADO",
    soReferencia: false,
    noAcumulado: true,
  },
  tecnica: {
    id: "tecnica",
    rotulo: "Perdas técnicas",
    unidade: "% da energia injetada",
    sufixo: "%",
    casas: 2,
    casasCortes: 0,
    cortes: [4, 6, 8, 10],
    cores: SEQ,
    explicacao:
      "Perdas técnicas sobre a energia injetada de referência. No SAMP, a técnica é o percentual regulatório do processo tarifário aplicado à energia injetada: estimativa, não medição.",
    denominador: "energia injetada de referência",
    natureza: "ESTIMADO",
    soReferencia: false,
    noAcumulado: false,
  },
  pnt_bt: {
    id: "pnt_bt",
    rotulo: "Perdas não técnicas",
    unidade: "% do mercado de baixa tensão",
    sufixo: "%",
    casas: 2,
    casasCortes: 0,
    // a primeira classe guarda os negativos: estimativa técnica acima da perda total medida
    cortes: [0, 5, 10, 20],
    cores: SEQ,
    explicacao:
      "Perdas não técnicas publicadas pela fonte divididas pelo mercado de baixa tensão medido, a base que a ANEEL usa na regulação. Incluem furto, fraude e erros de medição, leitura e faturamento, que a fonte não separa.",
    denominador: "mercado de baixa tensão medido",
    natureza: "ESTIMADO",
    soReferencia: false,
    noAcumulado: false,
  },
  variacao: {
    id: "variacao",
    rotulo: "Variação da taxa de perdas totais",
    unidade: "p.p. em relação ao ano anterior",
    sufixo: " p.p.",
    casas: 2,
    casasCortes: 1,
    // classe central de ±0,5 p.p.: abaixo disso a mudança é da ordem do arredondamento das taxas anuais
    cortes: [-2, -0.5, 0.5, 2],
    cores: DIV,
    explicacao:
      "Diferença, em pontos percentuais, entre a taxa de perdas totais do ano de referência e a do ano anterior, só com os dois anos completos, sem alerta e sem quebra de escala nem absorção entre eles.",
    denominador: "energia injetada de referência de cada ano",
    natureza: "CALCULADO",
    soReferencia: true,
    noAcumulado: false,
  },
};

export const ORDEM_MEDIDAS: readonly IdMedida[] = ["taxa", "volume", "tecnica", "pnt_bt", "variacao"];

/* ------------------------------------------------------------------ períodos */

export type PeriodoPerdas = { id: string; rotulo: string; tipo: "ano" | "acumulado"; ano: number; referencia: boolean };

/** Anos civis completos (do mais recente ao mais antigo) e, quando existe, o acumulado do ano aberto. */
export function periodosDisponiveis(g: Pick<PerdasGold, "nacional" | "acumulado" | "referencia">): PeriodoPerdas[] {
  const anos = Array.from(new Set(g.nacional.filter((l) => !l.parcial && l.ano <= g.referencia.ano).map((l) => l.ano))).sort((a, b) => b - a);
  const out: PeriodoPerdas[] = anos.map((a) => ({ id: String(a), rotulo: a === g.referencia.ano ? `${a} (ano de referência)` : String(a), tipo: "ano", ano: a, referencia: a === g.referencia.ano }));
  if (g.acumulado) {
    out.unshift({
      id: "acumulado",
      rotulo: `${g.acumulado.ano}, janeiro a ${MESES_LONGOS[g.acumulado.mes_fim - 1]} (acumulado)`,
      tipo: "acumulado",
      ano: g.acumulado.ano,
      referencia: false,
    });
  }
  return out;
}

export const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Medidas que fazem sentido no período (variação só no ano de referência; separação não existe no acumulado). */
export function medidasDoPeriodo(p: PeriodoPerdas): IdMedida[] {
  return ORDEM_MEDIDAS.filter((m) => (p.tipo === "acumulado" ? MEDIDAS[m].noAcumulado : !MEDIDAS[m].soReferencia || p.referencia));
}

/** Período e medida válidos juntos: a medida pedida que não existe no período cai na taxa total. */
export function ajustaConsulta(periodos: readonly PeriodoPerdas[], periodoId: string, medidaId: string): { periodo: PeriodoPerdas; medida: Medida } {
  const periodo = periodos.find((p) => p.id === periodoId) ?? periodos.find((p) => p.referencia) ?? periodos[0];
  const ok = medidasDoPeriodo(periodo);
  const medida = MEDIDAS[(ok as string[]).includes(medidaId) ? (medidaId as IdMedida) : "taxa"];
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

function semDadoNoPeriodo(d: Pick<DistribuidoraLeve, "primeira_competencia" | "ultima_competencia" | "ativa">, periodo: PeriodoPerdas): string {
  const ini = Number(d.primeira_competencia.slice(0, 4));
  const fim = Number(d.ultima_competencia.slice(0, 4));
  if (periodo.ano < ini) return `série começa em ${mesAno(d.primeira_competencia)}`;
  if (periodo.ano > fim || (!d.ativa && periodo.ano >= fim)) return `série encerrada em ${mesAno(d.ultima_competencia)}`;
  return `sem balanço publicado em ${periodo.ano}`;
}

const r = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;

/** Valor de uma medida para uma distribuidora no período, com o estado que decide a cor. */
export function valorMedida(d: DistribuidoraLeve, rec: RecortePerdas | null, medida: IdMedida, periodo: PeriodoPerdas): ValorMapa {
  if (medida === "variacao") {
    const v = d.variacao;
    if (!periodo.referencia || !rec) return { estado: "sem-dado", motivo: rec ? "variação publicada só para o ano de referência" : semDadoNoPeriodo(d, periodo) };
    if (!v) return { estado: "sem-dado", motivo: `sem ${periodo.ano - 1} publicado para comparar` };
    if (!v.comparavel || v.taxa_total_pp === null) {
      const motivo = v.quebra_escala
        ? "quebra de escala entre os dois anos (injetada mudou mais de 30%)"
        : v.absorcao
          ? "absorção provável de outra distribuidora entre os dois anos"
          : "um dos dois anos está incompleto ou tem alerta físico";
      return { estado: "fora", v: null, motivo };
    }
    return { estado: "valor", v: v.taxa_total_pp };
  }
  if (!rec) return { estado: "sem-dado", motivo: semDadoNoPeriodo(d, periodo) };
  const foraTotal = motivoForaTotal(rec);
  if (medida === "taxa" || medida === "volume") {
    const bruto = medida === "taxa" ? rec.taxa_total_pct : rec.perdas_totais_mwh === null ? null : rec.perdas_totais_mwh / 1000;
    if (bruto === null) return foraTotal ? { estado: "fora", v: null, motivo: foraTotal } : { estado: "sem-dado", motivo: "perdas ou injetada ausentes" };
    return foraTotal ? { estado: "fora", v: bruto, motivo: foraTotal } : { estado: "valor", v: bruto };
  }
  if (medida === "tecnica") {
    if (rec.taxa_tecnica_pct === null) return { estado: "sem-dado", motivo: "técnica não publicada em todos os meses" };
    if (foraTotal) return { estado: "fora", v: rec.taxa_tecnica_pct, motivo: foraTotal };
    if (!validoTecnica(rec)) return { estado: "fora", v: rec.taxa_tecnica_pct, motivo: "total diferente de técnica + não técnica (decomposição não fecha)" };
    return { estado: "valor", v: rec.taxa_tecnica_pct };
  }
  // pnt_bt
  if (rec.pnt_bt_pct === null) {
    return { estado: "sem-dado", motivo: rec.mercado_bt_mwh === null ? "mercado de baixa tensão não publicado" : "não técnica não publicada em todos os meses" };
  }
  if (foraTotal) return { estado: "fora", v: rec.pnt_bt_pct, motivo: foraTotal };
  if (!validoPntBt(rec)) {
    const motivo =
      rec.decomposicao === "nao_fecha"
        ? "total diferente de técnica + não técnica (decomposição não fecha)"
        : "técnica ou não técnica ausente em algum mês, sem como conferir a decomposição";
    return { estado: "fora", v: rec.pnt_bt_pct, motivo };
  }
  return { estado: "valor", v: rec.pnt_bt_pct };
}

export function valoresDoPeriodo(
  distribuidoras: readonly DistribuidoraLeve[],
  recortes: Map<string, RecortePerdas | null>,
  medida: IdMedida,
  periodo: PeriodoPerdas,
): Record<string, ValorMapa> {
  const out: Record<string, ValorMapa> = {};
  for (const d of distribuidoras) out[d.cnpj] = valorMedida(d, recortes.get(d.cnpj) ?? null, medida, periodo);
  return out;
}

/** Classes fixas da medida sobre os valores comparáveis (os "fora" não entram na contagem). */
export function classificacaoMedida(medida: Medida, valores: Readonly<Record<string, ValorMapa>>): Classificacao {
  const vs = Object.values(valores).map((v) => (v.estado === "valor" ? v.v : null));
  return quebrasFixas(medida.cortes, vs, { casas: medida.casasCortes, formatar: (v) => textoNumero(v, { ...medida, casas: medida.casasCortes }) });
}

/** Número com o sufixo da medida, com sinal só na variação ("+0,9 p.p."). */
export function textoNumero(v: number | null | undefined, medida: Pick<Medida, "id" | "casas" | "sufixo">): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  const arred = r(v, medida.casas);
  const corpo = num(Math.abs(arred), medida.casas);
  const sinal = medida.id === "variacao" ? (arred > 0 ? "+" : arred < 0 ? "−" : "") : arred < 0 ? "−" : "";
  return `${sinal}${corpo}${medida.sufixo}`;
}

export function textoValorMapa(v: ValorMapa, medida: Medida): string {
  if (v.estado === "valor") return textoNumero(v.v, medida);
  if (v.estado === "sem-dado") return `sem dado (${v.motivo})`;
  return v.v === null ? `fora da comparação (${v.motivo})` : `${textoNumero(v.v, medida)}, fora da comparação (${v.motivo})`;
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
export function respostaMapa(a: {
  periodo: PeriodoPerdas;
  medida: Medida;
  valores: Readonly<Record<string, ValorMapa>>;
  rotulos: Readonly<Record<string, string>>;
  nacional: LinhaNacional | null;
  acumulado: PerdasGold["acumulado"];
}): string {
  const { periodo, medida, valores, rotulos, nacional } = a;
  const e = extremos(valores, rotulos);
  const fora = Object.values(valores).filter((v) => v.estado === "fora").length;
  const quando = periodo.tipo === "acumulado" ? `De janeiro a ${MESES_LONGOS[(a.acumulado?.mes_fim ?? 1) - 1]} de ${periodo.ano}` : `Em ${periodo.ano}`;
  if (!e) return `${quando}, nenhuma distribuidora entra na comparação de ${medida.rotulo.toLowerCase()}.`;
  const partes: string[] = [];
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
      `De ${periodo.ano - 1} para ${periodo.ano}, entre ${plural(e.n, "distribuidora comparável", "distribuidoras comparáveis")}, a taxa de perdas totais subiu em ${num(sobe, 0)}, caiu em ${num(cai, 0)} e ficou igual em ${num(estavel, 0)}.`,
    );
    partes.push(`Maior queda: ${e.min.rotulo} (${textoNumero(e.min.v, medida)}); maior alta: ${e.max.rotulo} (${textoNumero(e.max.v, medida)}).`);
    const m = nacional?.mesmas_ano_anterior;
    if (m?.taxa_total_pct && m.taxa_total_pct[0] !== null && m.taxa_total_pct[1] !== null) {
      partes.push(`Nas mesmas ${num(m.n_total, 0)} concessionárias válidas nos dois anos, a taxa agregada ${fraseMudanca(m.taxa_total_pct[0], m.taxa_total_pct[1])}.`);
    }
  } else {
    const quantas = e.n === 1 ? "1 distribuidora entra" : `${num(e.n, 0)} distribuidoras entram`;
    const FRASE: Record<Exclude<IdMedida, "variacao">, [string, string]> = {
      taxa: ["a taxa de perdas totais vai", " da energia injetada de referência"],
      volume: ["as perdas totais vão", ""],
      tecnica: ["as perdas técnicas vão", " da energia injetada de referência"],
      pnt_bt: ["as perdas não técnicas vão", " do mercado de baixa tensão medido"],
    };
    const [sujeito, base] = FRASE[medida.id];
    partes.push(`${quando}, ${quantas} na comparação: ${sujeito} de ${textoNumero(e.min.v, medida)} (${e.min.rotulo}) a ${textoNumero(e.max.v, medida)} (${e.max.rotulo})${base}.`);
    const ag = agregadoNacional(medida.id, periodo, nacional, a.acumulado);
    if (ag) partes.push(ag);
  }
  if (fora) partes.push(`${plural(fora, "distribuidora publicou valor que fica", "distribuidoras publicaram valores que ficam")} fora da comparação, com o motivo na tabela.`);
  return partes.join(" ");
}

function agregadoNacional(medida: IdMedida, periodo: PeriodoPerdas, nacional: LinhaNacional | null, acumulado: PerdasGold["acumulado"]): string | null {
  if (periodo.tipo === "acumulado") {
    const c = acumulado?.agregados.find((x) => x.universo === "concessionarias");
    if (!c) return null;
    if (medida === "taxa" && c.atual.taxa_total_pct !== null)
      return `Somadas, as ${num(c.n_distribuidoras, 0)} concessionárias comparáveis perderam ${num(c.atual.taxa_total_pct, 2)}% da energia injetada, contra ${num(c.anterior.taxa_total_pct, 2)}% no mesmo período de ${periodo.ano - 1}.`;
    if (medida === "volume" && c.atual.perdas_totais_mwh !== null)
      return `Somadas, as ${num(c.n_distribuidoras, 0)} concessionárias comparáveis perderam ${num(c.atual.perdas_totais_mwh / 1000, 0)} GWh, contra ${num((c.anterior.perdas_totais_mwh ?? NaN) / 1000, 0)} GWh no mesmo período de ${periodo.ano - 1}.`;
    return null;
  }
  if (!nacional || nacional.parcial) return null;
  if (medida === "taxa" && nacional.taxa_total_pct !== null)
    return `Somadas, as ${num(nacional.n_distribuidoras, 0)} concessionárias válidas perderam ${num(nacional.taxa_total_pct, 2)}% da energia injetada.`;
  if (medida === "volume" && nacional.perdas_totais_mwh !== null)
    return `Somadas, as ${num(nacional.n_distribuidoras, 0)} concessionárias válidas perderam ${num(nacional.perdas_totais_mwh / 1000, 0)} GWh.`;
  if (medida === "tecnica" && nacional.taxa_tecnica_pct !== null)
    return `Nas ${num(nacional.n_com_tecnica, 0)} concessionárias que publicam a técnica (${num(nacional.cobertura_tecnica_pct, 1)}% da energia injetada das válidas), a técnica soma ${num(nacional.taxa_tecnica_pct, 2)}% da injetada.`;
  if (medida === "pnt_bt" && nacional.pnt_bt_pct !== null)
    return `Nas ${num(nacional.n_com_pnt_bt, 0)} concessionárias com a separação fechando (${num(nacional.cobertura_bt_pct, 1)}% do mercado de baixa tensão das válidas), a não técnica soma ${num(nacional.pnt_bt_pct, 2)}% do mercado de baixa tensão.`;
  return null;
}

/* ------------------------------------------------------------------ distribuidora selecionada */

/** Resposta curta sobre uma distribuidora no ano de referência, com a comparação só quando ela vale. */
export function respostaDistribuidora(d: DistribuidoraLeve, anoRef: number): string {
  const nome = rotuloDistribuidora(d);
  const ufs = d.territorio?.ufs.length ? `, ${d.territorio.ufs.join(", ")}` : "";
  const cab = `${nome} (${ROTULO_GRUPO[d.grupo].toLowerCase()}${ufs})`;
  const rf = d.referencia;
  if (!rf || rf.ano !== anoRef) {
    return `${cab}: sem balanço publicado em ${anoRef}; a série vai de ${mesAno(d.primeira_competencia)} a ${mesAno(d.ultima_competencia)}${d.ativa ? "" : " e foi encerrada"}.`;
  }
  const rec = recorteDaReferencia(d)!;
  const fora = motivoForaTotal(rec);
  const partes: string[] = [];
  if (rf.taxa_total_pct === null || rf.perdas_totais_mwh === null || rf.injetada_mwh === null) {
    partes.push(`${cab}: em ${anoRef}, perdas ou energia injetada ausentes em algum mês; sem taxa anual.`);
    return partes.join(" ");
  }
  partes.push(
    `${cab}: em ${anoRef}, perdas totais de ${num(rf.perdas_totais_mwh, 0)} MWh, ${num(rf.taxa_total_pct, 2)}% da energia injetada de referência (${num(rf.injetada_mwh, 0)} MWh).`,
  );
  if (fora) {
    partes.push(`O valor é o publicado pela fonte e fica fora das comparações: ${fora}.`);
    return partes.join(" ");
  }
  const v = d.variacao;
  if (!v) partes.push(`Sem ${anoRef - 1} publicado para comparar.`);
  else if (!v.comparavel || v.taxa_total_pp === null) {
    const motivo = v.quebra_escala ? "a energia injetada mudou mais de 30% (quebra de escala)" : v.absorcao ? "houve absorção provável de outra distribuidora" : "um dos dois anos está incompleto ou tem alerta";
    partes.push(`A comparação com ${v.ano_base} não é feita: ${motivo}.`);
  } else {
    const x = r(v.taxa_total_pp, 2);
    partes.push(
      x === 0
        ? `A taxa ficou igual à de ${v.ano_base}.`
        : `A taxa ${x > 0 ? "subiu" : "caiu"} ${num(Math.abs(x), 2)} p.p. em relação a ${v.ano_base}${v.atravessa_leiaute ? " (os dois anos estão em leiautes diferentes do SAMP)" : ""}.`,
    );
  }
  return partes.join(" ");
}

/* ------------------------------------------------------------------ séries */

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
export function historicoDistribuidora(linhas: readonly LinhaAnualPerdas[]): {
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
    if (!ok) fora.push({ ano: rec.ano, motivo: motivoForaTotal(rec) ?? "fora da comparação" });
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

export const COLUNAS_DISTRIBUIDORAS: ColunaTabela[] = [
  { id: "distribuidora", rotulo: "Distribuidora", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto", ordenavel: false },
  { id: "grupo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "ufs", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "classe_mapa", rotulo: "Classe no mapa", tipo: "texto", categorica: true },
  { id: "valor_mapa", rotulo: "Valor no mapa", tipo: "numero", casas: 2 },
  { id: "meses", rotulo: "Meses publicados", tipo: "numero", casas: 0 },
  { id: "perdas_gwh", rotulo: "Perdas totais", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "injetada_gwh", rotulo: "Energia injetada de referência", tipo: "numero", unidade: "GWh", casas: 1 },
  { id: "taxa_total", rotulo: "Taxa de perdas totais", tipo: "percentual", casas: 2 },
  { id: "taxa_tecnica", rotulo: "Técnicas", tipo: "percentual", casas: 2 },
  { id: "pnt_bt", rotulo: "Não técnicas sobre a BT", tipo: "percentual", casas: 2 },
  { id: "variacao_pp", rotulo: "Variação da taxa", tipo: "numero", unidade: "p.p.", casas: 2 },
  { id: "taxa_anterior", rotulo: "Taxa no mesmo período do ano anterior", tipo: "percentual", casas: 2 },
  { id: "comparacao", rotulo: "Comparação", tipo: "texto", categorica: true },
  { id: "decomposicao", rotulo: "Decomposição", tipo: "texto", categorica: true },
  { id: "origem", rotulo: "Origem da injetada", tipo: "texto", categorica: true },
];

/**
 * Colunas que existem no período (variação só no ano de referência; anterior só no
 * acumulado). As duas colunas do mapa levam o nome e a unidade da medida pintada: são
 * a tabela equivalente do mapa, com o mesmo valor e a mesma classe de cada área.
 */
export function colunasDoPeriodo(periodo: PeriodoPerdas, medida: Medida): ColunaTabela[] {
  return COLUNAS_DISTRIBUIDORAS.filter((c) => {
    if (c.id === "variacao_pp") return periodo.referencia;
    if (c.id === "taxa_anterior") return periodo.tipo === "acumulado";
    if (c.id === "taxa_tecnica" || c.id === "decomposicao") return periodo.tipo === "ano";
    return true;
  }).map((c) =>
    c.id === "valor_mapa"
      ? { ...c, rotulo: `${medida.rotulo} (mapa)`, unidade: medida.unidade, casas: medida.id === "volume" ? 1 : 2 }
      : c.id === "classe_mapa"
        ? { ...c, rotulo: `Classe no mapa (${medida.rotulo.toLowerCase()})` }
        : c,
  );
}

/** Texto da classe de um valor do mapa (o mesmo da legenda) ou o estado sem cor. */
export function classeDoValor(v: ValorMapa, c: Classificacao): string {
  if (v.estado === "sem-dado") return "sem dado";
  if (v.estado === "fora") return "fora da comparação";
  const k = classeDe(v.v, c);
  return typeof k === "number" ? c.classes[k].rotulo : "sem dado";
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
): LinhaTabela[] {
  return distribuidoras.map((d) => {
    const rec = recortes.get(d.cnpj) ?? null;
    const fora = rec ? motivoForaTotal(rec) : null;
    const v = periodo.referencia ? valorMedida(d, rec, "variacao", periodo) : null;
    const vm: ValorMapa = mapa.valores[d.cnpj] ?? { estado: "sem-dado", motivo: "sem dado" };
    return {
      id: d.cnpj,
      distribuidora: d.sigla ? `${d.sigla} · ${d.nome}` : d.nome,
      cnpj: d.cnpj_formatado,
      grupo: ROTULO_GRUPO[d.grupo],
      ufs: d.territorio?.ufs.join("/") || null,
      classe_mapa: classeDoValor(vm, mapa.classes),
      valor_mapa: vm.estado === "sem-dado" ? null : vm.v,
      meses: rec ? rec.meses : null,
      perdas_gwh: rec ? gwh(rec.perdas_totais_mwh) : null,
      injetada_gwh: rec ? gwh(rec.injetada_mwh) : null,
      taxa_total: rec ? rec.taxa_total_pct : null,
      taxa_tecnica: rec ? rec.taxa_tecnica_pct : null,
      pnt_bt: rec ? rec.pnt_bt_pct : null,
      variacao_pp: v && v.estado === "valor" ? v.v : null,
      taxa_anterior: rec?.anterior ? rec.anterior.taxa_total_pct : null,
      comparacao: !rec ? semDadoNoPeriodo(d, periodo) : fora ? `fora: ${fora}` : "comparável",
      decomposicao: rec?.decomposicao ? ROTULO_DECOMPOSICAO[rec.decomposicao] : null,
      origem: rec?.origem ? ROTULO_ORIGEM[rec.origem] : null,
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
    linhas.push({
      id: d.cnpj,
      rotulo: rotuloDistribuidora(d),
      tecnica: rf.taxa_tecnica_pct,
      nao_tecnica: rf.pnt_injetada_pct,
      total: rf.taxa_total_pct,
      pnt_bt: validoPntBt(rec) ? rf.pnt_bt_pct : null,
      residuo_mwh: rf.residuo_decomposicao_mwh,
      decomposicao: rf.decomposicao,
    });
  }
  linhas.sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return { linhas, fora, semSeparacao };
}

/** Resposta curta da composição no ano de referência, com o universo e a cobertura ditos. */
export function respostaComposicao(g: Pick<PerdasGold, "nacional" | "referencia" | "universo_fixo">): string {
  const l = g.nacional.find((x) => x.ano === g.referencia.ano && x.universo === "concessionarias");
  if (!l || l.taxa_total_pct === null) return `Sem soma nacional das concessionárias em ${g.referencia.ano}.`;
  const partes: string[] = [];
  if (l.taxa_tecnica_pct !== null) {
    partes.push(
      `Em ${l.ano}, ${num(l.n_com_tecnica, 0)} das ${num(l.n_distribuidoras, 0)} concessionárias válidas publicaram a perda técnica nos 12 meses (${num(l.cobertura_tecnica_pct, 1)}% da energia injetada); nelas, a técnica foi ${num(l.taxa_tecnica_pct, 2)}% da energia injetada.`,
    );
  } else partes.push(`Em ${l.ano}, nenhuma concessionária válida publicou a perda técnica nos 12 meses.`);
  if (l.pnt_bt_pct !== null) {
    partes.push(
      `A não técnica, em ${num(l.n_com_pnt_bt, 0)} concessionárias com a separação fechando (${num(l.cobertura_bt_pct, 1)}% do mercado de baixa tensão), foi ${num(l.pnt_bt_pct, 2)}% do mercado de baixa tensão.`,
    );
  }
  const uf = g.universo_fixo;
  const prim = uf.linhas[0];
  const ult = uf.linhas[uf.linhas.length - 1];
  if (prim && ult && prim.pnt_bt_pct !== null && ult.pnt_bt_pct !== null && uf.linhas.length > 1) {
    partes.push(
      `Nas mesmas ${num(uf.n_distribuidoras, 0)} concessionárias de ${prim.ano} a ${ult.ano}, a não técnica passou de ${num(prim.pnt_bt_pct, 2)}% para ${num(ult.pnt_bt_pct, 2)}% do mercado de baixa tensão.`,
    );
  }
  return partes.join(" ");
}

/* ------------------------------------------------------------------ referência regulatória (P057) */

export type LinhaRegulatorio = {
  id: string;
  rotulo: string;
  atual: number;
  anterior: number | null;
  inicio: string;
  fim: string;
  meses: number;
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

export function respostaRegulatorio(linhas: readonly LinhaRegulatorio[], bloqueada: boolean): string {
  const partes: string[] = [];
  if (bloqueada)
    partes.push(
      "A diferença entre a perda não técnica realizada e a referência regulatória não pode ser medida com as bases abertas acessíveis: a ANEEL não publica os percentuais regulatórios de perdas não técnicas em recurso aberto que um programa consiga ler.",
    );
  if (!linhas.length) {
    partes.push("Nenhum percentual técnico regulatório foi identificado na série do SAMP.");
    return partes.join(" ");
  }
  const desc = [...linhas].sort((a, b) => b.atual - a.atual || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const max = desc[0];
  const min = desc[desc.length - 1];
  const comReh = linhas.filter((l) => l.resolucao).length;
  partes.push(
    `O que se observa: o percentual técnico regulatório implícito no SAMP, em ${plural(linhas.length, "distribuidora", "distribuidoras")}; no trecho mais recente de cada uma, vai de ${num(min.atual, 3)}% (${min.rotulo}, ${mesAno(min.inicio)} a ${mesAno(min.fim)}) a ${num(max.atual, 3)}% (${max.rotulo}, ${mesAno(max.inicio)} a ${mesAno(max.fim)}) da energia injetada publicada. ${plural(comReh, "trecho recente coincide", "trechos recentes coincidem")} com o início de vigência de uma resolução homologatória.`,
  );
  return partes.join(" ");
}

/* ------------------------------------------------------------------ custo e contexto (P058) */

export type LinhaCusto = {
  id: string;
  rotulo: string;
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

export function respostaCusto(linhas: readonly LinhaCusto[], consultadaEm: string): string {
  const vig = linhas.filter((l) => l.situacao === "vigente" && l.participacao_perdas_pct !== null);
  const enc = linhas.filter((l) => l.situacao === "vigencia_encerrada").length;
  if (!vig.length) return `Nenhuma distribuidora tem processo tarifário vigente em ${dataBR(consultadaEm)} no arquivo de componentes tarifárias.`;
  const porPart = [...vig].sort((a, b) => (a.participacao_perdas_pct as number) - (b.participacao_perdas_pct as number) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const porRs = [...vig].sort((a, b) => a.perdas - b.perdas || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const pmin = porPart[0];
  const pmax = porPart[porPart.length - 1];
  const partes = [
    `Na tarifa residencial B1 vigente em ${dataBR(consultadaEm)}, sem tributos, as componentes de perdas (técnicas, não técnicas e na Rede Básica) vão de ${num(porRs[0].perdas, 2)} R$/MWh (${porRs[0].rotulo}) a ${num(porRs[porRs.length - 1].perdas, 2)} R$/MWh (${porRs[porRs.length - 1].rotulo}) em ${plural(vig.length, "distribuidora", "distribuidoras")}; em participação na tarifa, de ${num(pmin.participacao_perdas_pct, 2)}% (${pmin.rotulo}) a ${num(pmax.participacao_perdas_pct, 2)}% (${pmax.rotulo}).`,
  ];
  if (enc) partes.push(`${plural(enc, "distribuidora só tem", "distribuidoras só têm")} processo com vigência encerrada no arquivo da fonte e fica fora da faixa.`);
  return partes.join(" ");
}

/** Intensidade da correlação de postos por regra fixa (|ρ| < 0,1; 0,3; 0,5). */
export function intensidadeRho(rho: number): string {
  const a = Math.abs(rho);
  if (a < 0.1) return "praticamente nula";
  if (a < 0.3) return "fraca";
  if (a < 0.5) return "moderada";
  return "forte";
}

export function respostaAssociacao(a: Pick<Associacao, "spearman_taxa_total" | "n_taxa_total" | "spearman_pnt_bt" | "n_pnt_bt" | "ano_perdas">): string {
  const partes: string[] = [];
  const fr = (rho: number | null, n: number, medida: string) => {
    if (rho === null || n < 3) return `Com ${medida}, não há pares suficientes para a correlação.`;
    const sentido = rho < 0 ? "renda média maior aparece com valores menores" : rho > 0 ? "renda média maior aparece com valores maiores" : "não há tendência";
    return `Com ${medida}, a associação é ${intensidadeRho(rho)} (ρ de Spearman = ${num(rho, 3)}, ${plural(n, "concessionária", "concessionárias")}): ${sentido}.`;
  };
  partes.push(`Em ${a.ano_perdas}, ano do Censo, comparando áreas de concessão pela renda média domiciliar per capita dos seus municípios.`);
  partes.push(fr(a.spearman_taxa_total, a.n_taxa_total, "a taxa de perdas totais"));
  partes.push(fr(a.spearman_pnt_bt, a.n_pnt_bt, "a não técnica sobre o mercado de baixa tensão"));
  partes.push("É descrição entre áreas, não causa.");
  return partes.join(" ");
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
export function motivosComposicao(distribuidoras: readonly Distribuidora[], anoRef: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of distribuidoras) {
    const rec = recorteDaReferencia(d);
    if (!rec || d.referencia?.ano !== anoRef) {
      out[d.cnpj] = `sem balanço publicado em ${anoRef}`;
      continue;
    }
    const fora = motivoForaTotal(rec);
    if (fora) out[d.cnpj] = `fora da comparação (${fora})`;
    else if (d.referencia.taxa_tecnica_pct === null || d.referencia.pnt_injetada_pct === null) out[d.cnpj] = "a fonte não publicou a separação técnica e não técnica em todos os meses do ano";
    else if (!DECOMPOSICAO_OK.includes(d.referencia.decomposicao)) out[d.cnpj] = "perdas totais diferentes de técnicas + não técnicas (decomposição não fecha)";
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
export function fraseMudanca(antes: number, depois: number): string {
  // as duas taxas chegam com duas casas: a comparação e o texto usam as duas, sem novo arredondamento
  const x = r(depois - antes, 2);
  if (x === 0) return `ficou igual (${num(antes, 2)}%)`;
  return `${x > 0 ? "subiu" : "caiu"} de ${num(antes, 2)}% para ${num(depois, 2)}%`;
}

/**
 * Resposta curta da página: volume e taxa das concessionárias no ano de referência, a
 * comparação com o ano anterior nas mesmas distribuidoras e o acumulado do ano aberto
 * contra o mesmo período, todos da gold.
 */
export function respostaGeral(g: Pick<PerdasGold, "nacional" | "referencia" | "acumulado">): string {
  const l = linhaNacional(g, g.referencia.ano);
  if (!l || l.taxa_total_pct === null || l.perdas_totais_mwh === null) return `Sem soma nacional das concessionárias em ${g.referencia.ano}.`;
  const partes = [
    `Em ${l.ano}, as ${num(l.n_distribuidoras, 0)} concessionárias com o ano completo e sem alerta perderam ${num(l.perdas_totais_mwh / 1e6, 1)} TWh, ${num(l.taxa_total_pct, 2)}% da energia injetada de referência.`,
  ];
  const m = l.mesmas_ano_anterior;
  if (m?.taxa_total_pct && m.taxa_total_pct[0] !== null && m.taxa_total_pct[1] !== null) {
    partes.push(`Nas mesmas ${num(m.n_total, 0)} concessionárias, a taxa ${fraseMudanca(m.taxa_total_pct[0], m.taxa_total_pct[1])} de ${l.ano - 1} para ${l.ano}.`);
  }
  const c = g.acumulado?.agregados.find((x) => x.universo === "concessionarias");
  if (g.acumulado && c && c.atual.taxa_total_pct !== null && c.anterior.taxa_total_pct !== null) {
    partes.push(
      `De janeiro a ${MESES_LONGOS[g.acumulado.mes_fim - 1]} de ${g.acumulado.ano}, nas ${num(c.n_distribuidoras, 0)} concessionárias comparáveis, a taxa foi ${num(c.atual.taxa_total_pct, 2)}%, contra ${num(c.anterior.taxa_total_pct, 2)}% no mesmo período de ${g.acumulado.ano - 1}.`,
    );
  }
  return partes.join(" ");
}

/** Série nacional em tabela: uma linha por ano completo, com universo e comparação nas mesmas. */
export function linhasNacionais(nacional: readonly LinhaNacional[]): (string | number | null)[][] {
  return nacional
    .filter((l) => !l.parcial)
    .sort((a, b) => a.ano - b.ano)
    .map((l) => {
      const m = l.mesmas_ano_anterior;
      const par = m?.taxa_total_pct;
      return [
        l.ano,
        l.n_distribuidoras,
        l.n_publicadas,
        l.perdas_totais_mwh === null ? null : l.perdas_totais_mwh / 1000,
        l.injetada_mwh === null ? null : l.injetada_mwh / 1000,
        l.taxa_total_pct,
        l.universo_igual_ano_anterior === null ? null : l.universo_igual_ano_anterior.total ? "sim" : "não",
        par && par[0] !== null && par[1] !== null ? `${num(par[0], 2)}% → ${num(par[1], 2)}% (${num(m!.n_total, 0)})` : null,
        Object.entries(l.excluidos)
          .map(([k, n]) => `${k === "ano_incompleto" ? "ano incompleto" : ROTULO_ALERTA[k as AlertaAnual] ?? k}: ${n}`)
          .join("; ") || null,
      ];
    });
}

/** Separação nacional em tabela: técnica e não técnica com o universo e a cobertura de cada ano. */
export function linhasSeparacaoNacional(nacional: readonly LinhaNacional[]): (string | number | null)[][] {
  return nacional
    .filter((l) => !l.parcial)
    .sort((a, b) => a.ano - b.ano)
    .map((l) => [
      l.ano,
      l.n_com_tecnica,
      l.cobertura_tecnica_pct,
      l.taxa_tecnica_pct,
      l.taxa_tecnica_injetada_publicada_pct,
      l.n_com_pnt_bt,
      l.cobertura_bt_pct,
      l.pnt_bt_pct,
      l.universo_igual_ano_anterior === null ? null : l.universo_igual_ano_anterior.pnt_bt ? "sim" : "não",
    ]);
}

/** Resposta curta da série nacional: menor e maior taxa anual das concessionárias, com o ano. */
export function respostaEvolucao(nacional: readonly LinhaNacional[], anoRef: number): string {
  const serie = serieNacional(nacional).filter((l): l is typeof l & { taxa: number } => l.taxa !== null);
  if (!serie.length) return "Sem série nacional das concessionárias publicada.";
  const ordem = [...serie].sort((a, b) => a.taxa - b.taxa || Number(a.ano) - Number(b.ano));
  const min = ordem[0];
  const max = ordem[ordem.length - 1];
  const ult = serie.find((l) => Number(l.ano) === anoRef);
  return `De ${serie[0].ano} a ${serie[serie.length - 1].ano}, a taxa anual das concessionárias ficou entre ${num(min.taxa, 2)}% (${min.ano}) e ${num(max.taxa, 2)}% (${max.ano})${
    ult ? `; em ${anoRef}, ${num(ult.taxa, 2)}%` : ""
  }. Os anos não têm todos o mesmo conjunto de distribuidoras: a tabela diz onde o universo mudou.`;
}
