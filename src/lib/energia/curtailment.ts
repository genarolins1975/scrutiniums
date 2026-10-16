import { mesAnoCurto } from "./formato";
import type { FonteBalanco, RazaoRestricao, Restricao } from "./tipos-geracao";

/**
 * Seção "Curtailment" do Setor Elétrico (/setor-eletrico/geracao/curtailment): lógica pura, sem React e testável em node.
 *
 * Duas camadas que nunca se misturam:
 *  - DADOS PUBLICADOS: séries do ONS já processadas na gold (restrições de eólicas e fotovoltaicas, perfil horário do dia de referência,
 *    PLD horário). Aqui só se escolhe a linha, ordena, converte unidade (MWh para GWh, MW para GW) e conta horas que cumprem uma condição
 *    publicada. Nenhuma taxa, média ou soma oficial é refeita: a taxa e as somas de 12 meses chegam prontas da gold.
 *  - MODELO DIDÁTICO: o simulador de um dia e a conta de receita são hipotéticos. Usam o formato do dia real (o perfil horário) para que as
 *    curvas tenham a forma certa, mas as grandezas são escolhidas pela pessoa. Eles não reproduzem o despacho do ONS nem a regra de
 *    classificação das razões oficiais; mostram o mecanismo.
 */

/* ------------------------------------------------------------------ dados publicados */

export const RAZOES_GRAFICO: readonly RazaoRestricao[] = ["ENE", "CNF", "REL", "PAR", "SEM"];

/** Linha mensal do SIN em GWh por razão, com a taxa publicada e a marca de mês parcial. */
/** `parcial` é 1 no mês ainda aberto e 0 nos completos (número, para a linha caber no gráfico). */
export type LinhaMensalCorte = { mes: string; rotulo: string; parcial: 0 | 1; taxa: number | null } & Record<RazaoRestricao, number | null>;

export function serieMensalPorRazao(r: Restricao): LinhaMensalCorte[] {
  const m = r.mensal_sin;
  return m.meses.map((mes, i) => {
    const parcial = !!m.parcial[i];
    const linha = { mes, rotulo: `${mesAnoCurto(mes)}${parcial ? " (parcial)" : ""}`, parcial: parcial ? 1 : 0, taxa: m.taxa_pct[i] ?? null } as LinhaMensalCorte;
    for (const z of RAZOES_GRAFICO) {
      const v = m.energia_nao_gerada_mwh[z]?.[i];
      linha[z] = v === null || v === undefined ? null : v / 1e3;
    }
    return linha;
  });
}

/** Linha diária em GWh por razão, com o maior corte simultâneo do dia em GW. */
export type LinhaDiariaCorte = { dia: string; rotulo: string; potenciaGw: number | null } & Record<RazaoRestricao, number | null>;

export function serieDiariaPorRazao(r: Restricao): LinhaDiariaCorte[] {
  const d = r.diario_recente;
  return d.dias.map((dia, i) => {
    const pot = d.potencia_max_cortada_mw[i];
    const linha = { dia, rotulo: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`, potenciaGw: pot === null || pot === undefined ? null : pot / 1e3 } as LinhaDiariaCorte;
    for (const z of RAZOES_GRAFICO) {
      const v = d.energia_nao_gerada_mwh[z]?.[i];
      linha[z] = v === null || v === undefined ? null : v / 1e3;
    }
    return linha;
  });
}

/** Razões com energia publicada maior que zero em alguma linha: a razão que nunca aparece não vira série vazia no gráfico. */
export function razoesPresentes(linhas: Record<RazaoRestricao, number | null>[]): RazaoRestricao[] {
  return RAZOES_GRAFICO.filter((z) => linhas.some((l) => (l[z] ?? 0) > 0));
}

/** Perfil horário do SIN no dia de referência, em GW (a gold publica MW médios por hora). */
export type LinhaPerfil = { h: string } & Record<FonteBalanco, number | null>;

export function perfilEmGw(perfil: ({ h: string } & Record<FonteBalanco, number | null>)[]): LinhaPerfil[] {
  return perfil.map((p) => ({
    h: p.h,
    hidraulica: p.hidraulica === null ? null : p.hidraulica / 1e3,
    termica: p.termica === null ? null : p.termica / 1e3,
    eolica: p.eolica === null ? null : p.eolica / 1e3,
    solar: p.solar === null ? null : p.solar / 1e3,
  }));
}

/** A hora em que a solar atinge o máximo no dia de referência e a hidráulica naquela hora contra o seu próprio máximo do dia. */
export function leituraPerfil(perfil: LinhaPerfil[]) {
  const comSolar = perfil.filter((p) => p.solar !== null && p.hidraulica !== null);
  if (comSolar.length < 2) return null;
  const pico = comSolar.reduce((a, b) => ((b.solar as number) > (a.solar as number) ? b : a));
  const maxHidro = comSolar.reduce((a, b) => ((b.hidraulica as number) > (a.hidraulica as number) ? b : a));
  return { horaPicoSolar: pico.h, solarGw: pico.solar as number, hidroNoPicoGw: pico.hidraulica as number, horaMaxHidro: maxHidro.h, hidroMaxGw: maxHidro.hidraulica as number };
}

/**
 * Quantos dias, em cada hora do dia, o PLD do submercado ficou no menor valor horário do ano (o valor publicado na gold, que não é o piso
 * regulatório: a gold diz que o limite oficial não foi auditado). Só conta linhas; não faz média.
 */
export function horasNoMenorValor(horario: { t: string; [sm: string]: string | number | null }[], sm: string, menorValorAno: number | null) {
  if (menorValorAno === null) return { linhas: [], dias: 0 };
  const dias = new Set(horario.map((x) => x.t.slice(0, 10)));
  const linhas = Array.from({ length: 24 }, (_, h) => {
    const hh = `${String(h).padStart(2, "0")}:00`;
    const naHora = horario.filter((x) => x.t.slice(11, 16) === hh && typeof x[sm] === "number");
    const noMinimo = naHora.filter((x) => Math.abs((x[sm] as number) - menorValorAno) < 0.005).length;
    return { h: hh, dias: noMinimo, comDado: naHora.length };
  });
  return { linhas, dias: dias.size };
}

/* ------------------------------------------------------------------ modelo didático: um dia no sistema */

/** Formas normalizadas (0 a 1) de um dia real: a curva de cada recurso dividida pelo seu máximo. */
export type Formas = { demanda: number[]; eolica: number[]; solar: number[] };

/**
 * Formas do dia de referência: demanda aproximada pela soma da geração verificada (no balanço do dia, geração ≈ carga mais perdas e
 * intercâmbio, o que basta para a forma da curva), eólica e solar pelas próprias curvas. Cada curva vai de 0 a 1.
 */
export function formasDoDia(perfil: LinhaPerfil[]): Formas | null {
  if (perfil.length !== 24 || perfil.some((p) => p.hidraulica === null || p.termica === null || p.eolica === null || p.solar === null)) return null;
  const total = perfil.map((p) => (p.hidraulica as number) + (p.termica as number) + (p.eolica as number) + (p.solar as number));
  const norm = (xs: number[]) => {
    const m = Math.max(...xs);
    return m > 0 ? xs.map((x) => Math.max(0, x) / m) : xs.map(() => 0);
  };
  return { demanda: norm(total), eolica: norm(perfil.map((p) => p.eolica as number)), solar: norm(perfil.map((p) => p.solar as number)) };
}

export type ParametrosDia = {
  /** Pico da demanda do SIN no dia (GW). */
  demandaPicoGw: number;
  /** Eólica e solar disponíveis no pico de cada uma (GW): o recurso que existiria sem nenhum corte. */
  eolicaPicoGw: number;
  solarPicoGw: number;
  /** Mínimo técnico das usinas que giram em sincronismo (hidráulicas e térmicas que não podem desligar), em GW. */
  minimoSincronoGw: number;
  /** Parcela mínima da demanda que precisa vir de máquinas síncronas a cada hora, pela segurança do sistema (inércia, controle de frequência), em %. */
  exigenciaSincronaPct: number;
  /** Capacidade de escoar energia do Nordeste para o resto do país (GW). */
  escoamentoGw: number;
  /** Parcelas no Nordeste: da demanda, da eólica e da solar (%). */
  nordesteDemandaPct: number;
  nordesteEolicaPct: number;
  nordesteSolarPct: number;
  /** Bateria do sistema: potência (GW) e energia (GWh). Rendimento de ida e volta fixo em 85%. */
  bateriaGw: number;
  bateriaGwh: number;
};

export const RENDIMENTO_BATERIA = 0.85;

export type HoraSimulada = {
  hora: string;
  demanda: number;
  disponivel: number;
  sincrona: number;
  renovavelUsada: number;
  bateriaCarga: number;
  bateriaDescarga: number;
  ENE: number;
  CNF: number;
  REL: number;
};

export type DiaSimulado = {
  horas: HoraSimulada[];
  disponivelGwh: number;
  usadaGwh: number;
  cortadaGwh: number;
  porRazaoGwh: { ENE: number; CNF: number; REL: number };
  taxaPct: number;
  picoCorteGw: number;
  horaPicoCorte: string | null;
  bateriaCarregadaGwh: number;
  bateriaDevolvidaGwh: number;
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Um dia, hora a hora, com três regras aplicadas em ordem e uma bateria que guarda sobra para a noite:
 *  1. Elétrica (REL): o que o Nordeste produz além da própria demanda e da capacidade de escoamento não chega a quem consome.
 *  2. Energética (ENE): no país inteiro, eólica e solar além da demanda menos o mínimo técnico das máquinas síncronas não têm destino.
 *  3. Confiabilidade (CNF): se a segurança exige mais máquinas síncronas que o mínimo técnico, a renovável cede o espaço que falta.
 * A bateria carrega só com a sobra que seria cortada e descarrega quando há máquina síncrona acima da exigência para substituir.
 * Balanço de cada hora: síncrona + renovável usada + descarga = demanda; e renovável disponível = usada + carga da bateria + cortes.
 */
export function simularDia(p: ParametrosDia, f: Formas): DiaSimulado {
  const pct = (x: number) => Math.min(100, Math.max(0, x)) / 100;
  const ne = { d: pct(p.nordesteDemandaPct), w: pct(p.nordesteEolicaPct), s: pct(p.nordesteSolarPct) };
  const etaCarga = Math.sqrt(RENDIMENTO_BATERIA);
  const etaDescarga = Math.sqrt(RENDIMENTO_BATERIA);
  let soc = 0; // GWh armazenados; o dia começa com a bateria vazia
  const horas: HoraSimulada[] = [];
  for (let i = 0; i < 24; i++) {
    const D = Math.max(0, p.demandaPicoGw) * f.demanda[i];
    const W = Math.max(0, p.eolicaPicoGw) * f.eolica[i];
    const S = Math.max(0, p.solarPicoGw) * f.solar[i];
    const disponivel = W + S;
    const M = Math.min(Math.max(0, p.minimoSincronoGw), D);
    const exigida = Math.min(D, Math.max(M, pct(p.exigenciaSincronaPct) * D));

    // 1. elétrica: o excedente do Nordeste acima do escoamento
    const renovNE = W * ne.w + S * ne.s;
    const excedenteNE = renovNE + M * ne.d - D * ne.d;
    const REL = Math.min(renovNE, Math.max(0, excedenteNE - Math.max(0, p.escoamentoGw)));
    const R1 = disponivel - REL;

    // 2 e 3. o que não cabe ao lado das máquinas síncronas exigidas; a bateria absorve antes do corte
    const excesso = Math.max(0, R1 - (D - exigida));
    const carga = Math.min(Math.max(0, p.bateriaGw), Math.max(0, p.bateriaGwh - soc) / etaCarga, excesso);
    soc += carga * etaCarga;
    const resto = excesso - carga;
    const energeticoBruto = Math.max(0, R1 - (D - M));
    const ENE = Math.min(resto, Math.max(0, energeticoBruto - carga));
    const CNF = resto - ENE;
    const renovavelUsada = R1 - carga - resto;

    // descarga: só substitui máquina síncrona acima da exigência, nunca na hora em que houve sobra
    const folga = Math.max(0, D - renovavelUsada - exigida);
    const descarga = excesso > 0 ? 0 : Math.min(Math.max(0, p.bateriaGw), soc * etaDescarga, folga);
    soc -= descarga / etaDescarga;
    const sincrona = D - renovavelUsada - descarga;

    horas.push({
      hora: `${String(i).padStart(2, "0")}:00`,
      demanda: r3(D),
      disponivel: r3(disponivel),
      sincrona: r3(sincrona),
      renovavelUsada: r3(renovavelUsada),
      bateriaCarga: r3(carga),
      bateriaDescarga: r3(descarga),
      ENE: r3(ENE),
      CNF: r3(CNF),
      REL: r3(REL),
    });
  }
  const soma = (k: keyof HoraSimulada) => horas.reduce((s, h) => s + (h[k] as number), 0);
  const porRazaoGwh = { ENE: soma("ENE"), CNF: soma("CNF"), REL: soma("REL") };
  const cortadaGwh = porRazaoGwh.ENE + porRazaoGwh.CNF + porRazaoGwh.REL;
  const disponivelGwh = soma("disponivel");
  const corteHora = horas.map((h) => h.ENE + h.CNF + h.REL);
  const picoCorteGw = Math.max(0, ...corteHora);
  return {
    horas,
    disponivelGwh,
    usadaGwh: soma("renovavelUsada"),
    cortadaGwh,
    porRazaoGwh,
    taxaPct: disponivelGwh > 0 ? (100 * cortadaGwh) / disponivelGwh : 0,
    picoCorteGw,
    horaPicoCorte: picoCorteGw > 0 ? horas[corteHora.indexOf(picoCorteGw)].hora : null,
    bateriaCarregadaGwh: soma("bateriaCarga"),
    bateriaDevolvidaGwh: soma("bateriaDescarga"),
  };
}

/** Ponto de partida do simulador: escolhido para mostrar as três razões, não para reproduzir um dia real. */
export const PARAMETROS_INICIAIS: ParametrosDia = {
  demandaPicoGw: 95,
  eolicaPicoGw: 32,
  solarPicoGw: 60,
  minimoSincronoGw: 30,
  exigenciaSincronaPct: 40,
  escoamentoGw: 30,
  nordesteDemandaPct: 17,
  nordesteEolicaPct: 90,
  nordesteSolarPct: 55,
  bateriaGw: 0,
  bateriaGwh: 0,
};

export type Cenario = { id: string; rotulo: string; explicacao: string; mudanca: Partial<ParametrosDia> };

/** Cenários prontos: cada um muda uma alavanca a partir do ponto de partida, para isolar o efeito dela. */
export const CENARIOS_DIA: Cenario[] = [
  { id: "partida", rotulo: "Ponto de partida", explicacao: "Os valores iniciais: no meio do dia há corte pelas três razões.", mudanca: {} },
  {
    id: "transmissao",
    rotulo: "Mais escoamento do Nordeste",
    explicacao: "O escoamento cresce 10 GW e o corte elétrico some, mas o total não cai: nessas horas o país inteiro já tinha sobra, e o corte passa a ser energético.",
    mudanca: { escoamentoGw: 40 },
  },
  {
    id: "bateria",
    rotulo: "Bateria de 10 GW por 4 horas",
    explicacao: "40 GWh de armazenamento guardam parte da sobra do meio do dia e a devolvem à noite, no lugar de hidráulicas e térmicas. O corte cai, e 15% do que entra se perde no ciclo.",
    mudanca: { bateriaGw: 10, bateriaGwh: 40 },
  },
  { id: "domingo", rotulo: "Domingo de demanda baixa", explicacao: "A demanda cai 15%: o mesmo recurso sobra em mais horas e o corte energético cresce.", mudanca: { demandaPicoGw: 81 } },
  {
    id: "seguranca",
    rotulo: "Mais máquinas síncronas exigidas",
    explicacao: "A exigência de máquinas síncronas sobe de 40% para 55% da demanda: a renovável cede o espaço e cresce o corte por confiabilidade.",
    mudanca: { exigenciaSincronaPct: 55 },
  },
  {
    id: "flexivel",
    rotulo: "Hidráulicas e térmicas mais flexíveis",
    explicacao: "O mínimo técnico cai de 30 para 20 GW, mas a segurança ainda exige 40% da demanda em máquinas síncronas: o corte total não cai, só muda de razão.",
    mudanca: { minimoSincronoGw: 20 },
  },
  {
    id: "solar",
    rotulo: "Mais 20 GW de solar",
    explicacao: "A solar cresce 20 GW no pico sem outra mudança: quase toda a energia nova chega nas horas em que já sobrava e vira corte.",
    mudanca: { solarPicoGw: 80 },
  },
];

/* ------------------------------------------------------------------ modelo didático: quem gera */

export type ParametrosReceita = {
  potenciaMw: number;
  fatorCapacidadePct: number;
  taxaCortePct: number;
  /** Parcela do corte com razão elétrica (indisponibilidade externa), em %. */
  parcelaEletricaPct: number;
  precoContrato: number;
  pldNasHorasDeCorte: number;
};

export type ResultadoReceita = {
  possivelMwh: number;
  cortadaMwh: number;
  geradaMwh: number;
  eletricaMwh: number;
  valorContrato: number;
  valorPld: number;
  receitaPerdidaPct: number;
};

/**
 * Conta de um ano, para uma usina hipotética: energia possível = potência × fator de capacidade × 8.760 horas; cortada = possível × taxa.
 * Dois valores para a mesma energia: a preço de contrato (o que a energia valeria na venda) e ao PLD das horas de corte (o que custa repor
 * no mercado de curto prazo quem vendeu por quantidade, ou o que deixa de receber quem vende no curto prazo). Sem ressarcimento, garantia
 * física, MRE, tributos ou regras de contrato: são essas regras que decidem quem arca com o corte, e elas não estão modeladas.
 */
export function receitaDoCorte(p: ParametrosReceita): ResultadoReceita {
  const possivelMwh = Math.max(0, p.potenciaMw) * (Math.min(100, Math.max(0, p.fatorCapacidadePct)) / 100) * 8760;
  const cortadaMwh = possivelMwh * (Math.min(100, Math.max(0, p.taxaCortePct)) / 100);
  return {
    possivelMwh,
    cortadaMwh,
    geradaMwh: possivelMwh - cortadaMwh,
    eletricaMwh: cortadaMwh * (Math.min(100, Math.max(0, p.parcelaEletricaPct)) / 100),
    valorContrato: cortadaMwh * Math.max(0, p.precoContrato),
    valorPld: cortadaMwh * Math.max(0, p.pldNasHorasDeCorte),
    receitaPerdidaPct: Math.min(100, Math.max(0, p.taxaCortePct)),
  };
}

/* ------------------------------------------------------------------ modelo didático: uma meia hora */

/**
 * A regra do ONS numa meia hora, para uma usina: com limitação, a energia não gerada é a referência menos a verificada; sem limitação, nada
 * é contado, mesmo que a usina gere abaixo da referência por falta de vento ou de sol. MWh = MW × 0,5 hora.
 */
export function meiaHora(referenciaMw: number, limiteMw: number, limitada: boolean, recursoMw: number) {
  const ref = Math.max(0, referenciaMw);
  if (limitada) {
    const verificadaMw = Math.min(ref, Math.max(0, limiteMw));
    return { verificadaMw, naoGeradaMw: ref - verificadaMw, naoGeradaMwh: (ref - verificadaMw) / 2, contada: true };
  }
  const verificadaMw = Math.min(ref, Math.max(0, recursoMw));
  return { verificadaMw, naoGeradaMw: 0, naoGeradaMwh: 0, contada: false };
}

/* ------------------------------------------------------------------ efeito para o setor e a sociedade */

/**
 * Ordem de grandeza: a energia não gerada de eólicas e fotovoltaicas em 12 meses (ONS) ao lado do consumo na rede do país (EPE). São
 * universos diferentes (estimativa do ONS contra consumo informado à EPE), por isso a comparação só é feita quando as duas janelas de 12
 * meses coincidem, e o resultado é uma proporção de escala, não uma participação no consumo.
 */
export function escalaNacional(
  restricoes: Partial<Record<"eolica" | "solar", Restricao | null>>,
  consumo: { total_mwh: number; periodo: { inicio: string; fim: string } } | null | undefined,
) {
  const partes = (["eolica", "solar"] as const).map((f) => restricoes[f]?.ultimos_12m).filter((u): u is NonNullable<typeof u> => !!u);
  if (!partes.length || partes.some((u) => u.energia_nao_gerada_mwh === null)) return null;
  const inicio = partes[0].inicio;
  const fim = partes[0].fim;
  if (partes.some((u) => u.inicio !== inicio || u.fim !== fim)) return null;
  const cortadaMwh = partes.reduce((s, u) => s + (u.energia_nao_gerada_mwh as number), 0);
  const mesmaJanela = !!consumo && consumo.periodo.inicio === inicio && consumo.periodo.fim === fim;
  return {
    inicio,
    fim,
    cortadaTwh: cortadaMwh / 1e6,
    consumoTwh: consumo ? consumo.total_mwh / 1e6 : null,
    proporcaoPct: mesmaJanela && consumo && consumo.total_mwh > 0 ? (100 * cortadaMwh) / consumo.total_mwh : null,
    mesmaJanela,
  };
}

/** UFs com consumo na rede de 12 meses (EPE) abaixo e acima de uma energia dada, em TWh; UF sem janela fica fora. */
export function ufsContraEnergia(ufs: { chave: string; cativo_mwh: number | null; livre_mwh: number | null }[], energiaTwh: number) {
  const linhas = ufs
    .filter((u) => u.cativo_mwh !== null && u.livre_mwh !== null)
    .map((u) => ({ uf: u.chave, twh: ((u.cativo_mwh as number) + (u.livre_mwh as number)) / 1e6 }))
    .sort((a, b) => b.twh - a.twh || a.uf.localeCompare(b.uf));
  return { linhas, acima: linhas.filter((u) => u.twh > energiaTwh), abaixo: linhas.filter((u) => u.twh <= energiaTwh) };
}

/** Encargo de serviços do sistema por restrição de operação constrained-off (CCEE), por mês, em R$ milhões, como publicado. */
export function serieEssConstrainedOff(ess: { mes: string; ro_constrained_off?: number | null }[]) {
  return ess.map((x) => ({
    mes: x.mes,
    rotulo: mesAnoCurto(x.mes),
    valor: x.ro_constrained_off === null || x.ro_constrained_off === undefined ? null : x.ro_constrained_off / 1e6,
  }));
}
