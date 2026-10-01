/**
 * Lógica pura das páginas de Carga (P025 nível e crescimento, P026 MMGD e perfil
 * horário, P027 clima e calendário), testada em node sem navegador.
 *
 * Nada aqui recalcula indicador: médias, variações, contribuições, erros e
 * contagens vêm prontos da gold (pipeline/energia/modulos/carga_detalhe.py e
 * pipeline/energia/gold/carga.py). As funções escolhem o recorte pedido na URL,
 * montam as linhas que o gráfico, a tabela equivalente e a exportação usam (as
 * mesmas linhas, para que os três nunca divirjam) e escrevem as respostas curtas
 * por regra determinística: mudar o número muda o texto, e nenhuma frase traz
 * número fixo. Ausência continua ausência (null), nunca zero.
 */
import { diaBrasilia } from "./evidencia";
import { dataBR, mesAno, num, plural, sinal } from "./formato";
import type { ColunaTabela, LinhaTabela, ValorCelula } from "./tabela";
import type { Regiao } from "./tipos";
import type {
  A07,
  AcumuladoAno,
  CargaMensal,
  ClasseDia,
  ClassesDias,
  DecomposicaoA07,
  GrupoModelo,
  JanelaComparacao,
  JanelaId,
  MetricasModelo,
  P025,
  P026,
  P027,
  PerfilTipico,
  Regime,
  VarianteModelo,
} from "./tipos-carga";

/* ---------- rotas e painéis ---------- */

export const ROTA_CARGA = "/setor-eletrico/carga";
export type PainelCarga = "p025" | "p026" | "p027";

/** Um painel por página: juntos, os três passariam da meta de cerca de 600 KB de HTML (contrato, seção 5.1). */
export const PAINEIS_CARGA: { id: PainelCarga; rotulo: string; caminho: string; pergunta: string }[] = [
  { id: "p025", rotulo: "Nível e crescimento", caminho: "", pergunta: "Quanto o sistema está consumindo?" },
  { id: "p026", rotulo: "MMGD e perfil horário", caminho: "/perfil-horario", pergunta: "Qual parcela da carga é estimada e quando ocorre o pico?" },
  { id: "p027", rotulo: "Clima e calendário", caminho: "/clima-e-calendario", pergunta: "Quanto da variação da carga é compatível com clima e calendário?" },
];

export function rotaPainel(id: PainelCarga): string {
  return `${ROTA_CARGA}${PAINEIS_CARGA.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function perguntaPainel(id: PainelCarga): string {
  return PAINEIS_CARGA.find((p) => p.id === id)?.pergunta ?? "";
}

/* ---------- regiões, classes e rótulos ---------- */

export const REGIOES: readonly Regiao[] = ["SIN", "SE", "S", "NE", "N"];
export const SUBSISTEMAS: readonly Regiao[] = ["SE", "S", "NE", "N"];
export const NOME_REGIAO: Record<Regiao, string> = { SIN: "SIN", SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" };
export const CURTO_REGIAO: Record<Regiao, string> = { SIN: "SIN", SE: "SE/CO", S: "S", NE: "NE", N: "N" };
/** "a carga do SIN", "a carga do Sul": contração com o artigo de cada nome. */
export const DO_REGIAO: Record<Regiao, string> = { SIN: "do SIN", SE: "do Sudeste/Centro-Oeste", S: "do Sul", NE: "do Nordeste", N: "do Norte" };
export const COR_REGIAO: Record<Regiao, string> = {
  SIN: "var(--cor-energia)",
  SE: "var(--serie-sm-se)",
  S: "var(--serie-sm-s)",
  NE: "var(--serie-sm-ne)",
  N: "var(--serie-sm-n)",
};
export const COR_COMPARACAO = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"] as const;

export const ROTULO_CLASSE: Record<ClasseDia, string> = { util: "dia útil", sabado: "sábado", domingo_feriado: "domingo ou feriado" };
export const ROTULO_GRUPO: Record<GrupoModelo, string> = {
  calendario: "Calendário",
  temperatura: "Temperatura",
  sazonalidade: "Sazonalidade",
  nivel_tendencia: "Nível e tendência",
};
export const GRUPOS_MODELO: readonly GrupoModelo[] = ["calendario", "temperatura", "sazonalidade", "nivel_tendencia"];

export type TipoComparacao = "equivalente" | "mesmas_datas";
export const TIPOS_COMPARACAO: readonly TipoComparacao[] = ["equivalente", "mesmas_datas"];
export const ROTULO_TIPO: Record<TipoComparacao, string> = {
  equivalente: "mesmos dias da semana, 52 semanas antes",
  mesmas_datas: "mesmas datas do ano anterior",
};
export const JANELAS: readonly JanelaId[] = ["7d", "28d", "mes_corrente", "ultimo_mes_completo", "52_semanas"];

export const VARIANTES: readonly VarianteModelo[] = [
  "principal",
  "sem_temperatura",
  "temperatura_linear",
  "temperatura_maxima",
  "sem_pontos_facultativos",
  "janela_longa",
];

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "a, b e c". */
export function listaTexto(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Hora local de início com dois dígitos ("07h"). */
export function rotuloHora(h: number): string {
  return `${String(h).padStart(2, "0")}h`;
}

/* ---------- calendário ---------- */

/** "5 dias úteis, 1 sábado e 1 domingo ou feriado"; classes com zero dia não aparecem. */
export function textoClasses(c: ClassesDias): string {
  const partes: string[] = [];
  if (c.util) partes.push(plural(c.util, "dia útil", "dias úteis"));
  if (c.sabado) partes.push(plural(c.sabado, "sábado", "sábados"));
  if (c.domingo_feriado) partes.push(plural(c.domingo_feriado, "domingo ou feriado", "domingos ou feriados"));
  if (c.sem_classe) partes.push(`${plural(c.sem_classe, "dia", "dias")} sem classificação de calendário (antes de 2003)`);
  return partes.length ? listaTexto(partes) : "nenhum dia classificado";
}

/** Composição de calendário da janela de comparação do tipo pedido. */
export function classesComparacao(j: JanelaComparacao, tipo: TipoComparacao): ClassesDias | null {
  return tipo === "equivalente" ? j.classes_equivalente : j.classes_mesmas_datas;
}

export function calendarioEquivalente(j: JanelaComparacao, tipo: TipoComparacao): boolean {
  return tipo === "equivalente" ? j.calendario_equivalente_364d : j.calendario_equivalente_mesmas_datas;
}

/** Frase sobre a composição de dias das duas janelas (regra: igualdade publicada pelo pipeline). */
export function textoCalendarioJanela(j: JanelaComparacao, tipo: TipoComparacao): string {
  const ant = classesComparacao(j, tipo);
  if (!ant) return "A janela inclui um 29 de fevereiro, sem par nas mesmas datas do ano anterior.";
  if (calendarioEquivalente(j, tipo)) return `As duas janelas têm a mesma composição de calendário: ${textoClasses(j.classes)}.`;
  return `As janelas não têm a mesma composição de calendário: ${textoClasses(j.classes)} nesta, ${textoClasses(ant)} na de comparação.`;
}

/* ---------- P025: nível e crescimento ---------- */

export type LinhaComparacao = {
  id: string;
  sm: Regiao;
  regiao: string;
  comparacao: string;
  janela: JanelaId;
  rotulo: string;
  tipo: TipoComparacao;
  inicio: string;
  fim: string;
  dias: number;
  inicio_ant: string | null;
  fim_ant: string | null;
  media: number | null;
  media_ant: number | null;
  variacao_pct: number | null;
  mesmo_regime: boolean | null;
  dias_uteis: number;
  dias_uteis_ant: number | null;
  calendario_equivalente: boolean;
};

/**
 * Linhas da comparação de uma região num tipo (equivalente ou mesmas datas), uma por
 * janela, na ordem publicada. São as mesmas linhas do gráfico de pontos pareados e da
 * tabela equivalente; a ausência de comparação (janela incompleta) é linha com nulos.
 */
export function linhasComparacao(p: Pick<P025, "comparacoes">, sm: Regiao, tipo: TipoComparacao): LinhaComparacao[] {
  const s = p.comparacoes.subsistemas.find((x) => x.sm === sm);
  return p.comparacoes.janelas.map((j) => {
    const n = s?.janelas[j.id]?.[tipo] ?? null;
    const ant = classesComparacao(j, tipo);
    return {
      id: `${sm}:${j.id}:${tipo}`,
      sm,
      regiao: NOME_REGIAO[sm],
      comparacao: ROTULO_TIPO[tipo],
      janela: j.id,
      rotulo: cap(j.rotulo),
      tipo,
      inicio: j.inicio,
      fim: j.fim,
      dias: j.dias,
      inicio_ant: n?.inicio_ant ?? null,
      fim_ant: n?.fim_ant ?? null,
      media: n?.media ?? null,
      media_ant: n?.media_ant ?? null,
      variacao_pct: n?.variacao_pct ?? null,
      mesmo_regime: n ? n.mesmo_regime : null,
      dias_uteis: j.classes.util,
      dias_uteis_ant: ant ? ant.util : null,
      calendario_equivalente: calendarioEquivalente(j, tipo),
    };
  });
}

/** Todas as regiões, janelas e tipos: as mesmas linhas de carga_comparacoes.csv. */
export function linhasComparacoesTodas(p: Pick<P025, "comparacoes">): LinhaComparacao[] {
  return REGIOES.flatMap((sm) => TIPOS_COMPARACAO.flatMap((t) => linhasComparacao(p, sm, t)));
}

/** Resposta curta do P025 para a região, a janela e o tipo de comparação escolhidos. */
export function respostaNivel(p: Pick<P025, "comparacoes">, sm: Regiao, janela: JanelaId, tipo: TipoComparacao): string {
  const j = p.comparacoes.janelas.find((x) => x.id === janela);
  const quem = DO_REGIAO[sm];
  if (!j) return `A gold desta publicação não traz a janela pedida para a carga ${quem}.`;
  // o rótulo já diz a duração quando traz número ("últimos 7 dias", "últimas 52 semanas")
  const rot = /\d/.test(j.rotulo) ? j.rotulo : `${j.rotulo}, ${plural(j.dias, "dia", "dias")}`;
  const periodo = `de ${dataBR(j.inicio)} a ${dataBR(j.fim)} (${rot})`;
  const n = p.comparacoes.subsistemas.find((x) => x.sm === sm)?.janelas[janela]?.[tipo] ?? null;
  if (!n) {
    return `${cap(periodo)}, a carga ${quem} não tem comparação (${ROTULO_TIPO[tipo]}): falta dia aceito pela validação física numa das janelas, e a média não é calculada com dia ausente.`;
  }
  const base = `${cap(periodo)}, a carga ${quem} teve média de ${num(n.media, 0)} MWmed`;
  const ant = `${num(n.media_ant, 0)} MWmed, de ${dataBR(n.inicio_ant)} a ${dataBR(n.fim_ant)}`;
  if (n.variacao_pct === null) {
    return `${base}. A janela de comparação (${ant}) está em outro regime metodológico do ONS, e por isso a diferença não é publicada como variação.`;
  }
  const ref = tipo === "equivalente" ? "a dos mesmos dias da semana 52 semanas antes" : "a das mesmas datas do ano anterior";
  // duas casas, a precisão publicada na gold: arredondar de novo para uma casa um valor já arredondado
  // para duas pode divergir do valor completo (11,4498 vira 11,45 e depois 11,5, quando o certo é 11,4)
  return `${base}, variação de ${sinal(n.variacao_pct, 2)}% sobre ${ref} (${ant}). ${textoCalendarioJanela(j, tipo)}`;
}

/** Resposta do acumulado do ano, com a composição de calendário das duas janelas. */
export function respostaAcumulado(a: AcumuladoAno, sm: Regiao): string {
  const s = a.sm[sm];
  const quem = DO_REGIAO[sm];
  if (!s) return `Sem acumulado do ano para a carga ${quem}: falta dia aceito pela validação física de ${dataBR(a.inicio)} a ${dataBR(a.fim)} ou na janela de comparação.`;
  const base = `No acumulado de ${dataBR(a.inicio)} a ${dataBR(a.fim)}, a carga ${quem} teve média de ${num(s.media, 0)} MWmed`;
  const ant = `${num(s.media_ant, 0)} MWmed de ${dataBR(a.inicio_ant)} a ${dataBR(a.fim_ant)}, mesmos dias da semana`;
  if (s.variacao_pct === null) return `${base}; a janela de comparação (${ant}) está em outro regime do ONS, sem variação publicada.`;
  if (a.calendario_equivalente) return `${base}, variação de ${sinal(s.variacao_pct, 2)}% sobre ${ant}, com a mesma composição de calendário (${textoClasses(a.classes)}).`;
  const feriados = (xs: string[]) => (xs.length ? listaTexto(xs.map(dataBR)) : "nenhum");
  return (
    `${base}, variação de ${sinal(s.variacao_pct, 2)}% sobre ${ant}, mas o calendário não é equivalente: ` +
    `${plural(a.classes.util, "dia útil", "dias úteis")} contra ${a.classes_ant.util}; feriados em dia útil: ${feriados(a.feriados_dia_util)} nesta janela e ${feriados(a.feriados_dia_util_ant)} na de comparação.`
  );
}

export type LinhaAcumulado = {
  id: Regiao;
  regiao: string;
  media: number | null;
  media_ant: number | null;
  variacao_pct: number | null;
  mesmo_regime: boolean | null;
};

export function linhasAcumulado(a: AcumuladoAno): LinhaAcumulado[] {
  return REGIOES.map((sm) => {
    const s = a.sm[sm];
    return { id: sm, regiao: NOME_REGIAO[sm], media: s?.media ?? null, media_ant: s?.media_ant ?? null, variacao_pct: s?.variacao_pct ?? null, mesmo_regime: s ? s.mesmo_regime : null };
  });
}

/**
 * O que a série mensal faz com o mês corrente: a gold publica só meses completos, então o mês
 * em curso fica de fora e aparece na janela "mês corrente"; se um dia a gold trouxer o mês
 * parcial, o texto diz que ele compara os mesmos dias.
 */
export function textoMesCorrente(mensal: readonly { m: string }[], janelas: readonly JanelaComparacao[]): string {
  const ult = mensal[mensal.length - 1]?.m;
  if (!ult) return "Sem série mensal nesta publicação.";
  const mc = janelas.find((j) => j.id === "mes_corrente");
  if (mc && mc.inicio.slice(0, 7) === ult) return `O último mês (${mesAno(ult)}) é parcial, até ${dataBR(mc.fim)}, e compara os mesmos dias do mês do ano anterior.`;
  if (mc && mc.inicio.slice(0, 7) > ult) {
    return `A série mensal termina no último mês completo (${mesAno(ult)}); o mês corrente, parcial (${dataBR(mc.inicio)} a ${dataBR(mc.fim)}), está na janela “${mc.rotulo}” do seletor acima.`;
  }
  return `A série mensal termina em ${mesAno(ult)}.`;
}

/** Linhas mensais (36 meses): as mesmas do gráfico de variação e da tabela. */
export type LinhaMensal = CargaMensal & { id: string; mes: string };
export function linhasMensal(p: Pick<P025, "mensal">): LinhaMensal[] {
  return p.mensal.map((m) => ({ ...m, id: m.m, mes: mesAno(m.m) }));
}

export type LinhaAnual = {
  id: string;
  ano: string;
  /** Rótulo da barra: ano incompleto leva a contagem de dias com valor. */
  rotulo: string;
  dias: number;
  completo: boolean;
  regimes: string;
} & Record<Regiao, number | null> & Record<`var_${Regiao}`, number | null>;

/** Médias anuais; a variação só existe entre anos completos no mesmo regime (null nos demais). */
export function linhasAnual(p: Pick<P025, "anual">): LinhaAnual[] {
  return p.anual.map((a) => {
    const linha = {
      id: String(a.ano),
      ano: String(a.ano),
      rotulo: a.completo ? String(a.ano) : `${a.ano} (${a.dias} dias)`,
      dias: a.dias,
      completo: a.completo,
      regimes: a.regimes.join(" e "),
    } as LinhaAnual;
    for (const sm of REGIOES) {
      linha[sm] = a[sm];
      linha[`var_${sm}`] = a.variacao_pct?.[sm] ?? null;
    }
    return linha;
  });
}

/** Ponto da série diária de uma região com o mesmo dia da semana 364 dias antes (busca por data, não por posição). */
export type PontoReferencia = { d: string; atual: number | null; ref364: number | null };

export function deslocaDias(iso: string, dias: number): string {
  const t = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Série diária em colunas (um vetor de datas e um de valores por região): o mesmo
 * conteúdo da série da gold em cerca de metade dos bytes, porque as props de um
 * componente cliente viajam no HTML (contrato, seção 5.1).
 */
export type SerieColunar = { d: string[] } & Record<Regiao, (number | null)[]>;

export function serieColunar(serie: readonly ({ d: string } & Partial<Record<Regiao, number | null>>)[]): SerieColunar {
  const out = { d: serie.map((p) => p.d) } as SerieColunar;
  for (const sm of REGIOES) out[sm] = serie.map((p) => p[sm] ?? null);
  return out;
}

/** Série da região com o valor do mesmo dia da semana 364 dias antes, procurado pela data (nunca pela posição). */
export function serieComReferencia(serie: SerieColunar, sm: Regiao): PontoReferencia[] {
  const valores = serie[sm] ?? [];
  const porDia = new Map(serie.d.map((d, i) => [d, valores[i] ?? null]));
  return serie.d.map((d, i) => ({ d, atual: valores[i] ?? null, ref364: porDia.get(deslocaDias(d, -364)) ?? null }));
}

/** Mudanças de regime dentro do período mostrado, como marcos do gráfico. */
export function marcosRegimes(regimes: (Regime & { observado_nos_dados?: string })[], inicio: string, fim: string, formato: "dia" | "mes" = "dia"): { x: string; rotulo: string }[] {
  const out: { x: string; rotulo: string }[] = [];
  for (const r of regimes.slice(1)) {
    const x = formato === "mes" ? r.inicio.slice(0, 7) : r.inicio;
    if (x < inicio.slice(0, x.length) || x > fim.slice(0, x.length)) continue;
    out.push({ x, rotulo: `${dataBR(r.inicio)}: mudança de regime do ONS` });
    if (r.observado_nos_dados && r.observado_nos_dados !== r.inicio) {
      const xo = formato === "mes" ? r.observado_nos_dados.slice(0, 7) : r.observado_nos_dados;
      if (xo !== x) out.push({ x: xo, rotulo: `${dataBR(r.observado_nos_dados)}: observado nos dados` });
    }
  }
  return out;
}

/* ---------- regimes do ONS nos textos (as datas vêm da gold, nunca do código) ---------- */

type RegimeGold = Regime & { observado_nos_dados?: string };

/** Regime cuja descrição publicada cita o termo ("MMGD", "não despachadas"); null quando a gold não o traz. */
export function regimeCom(regimes: readonly RegimeGold[], termo: RegExp): RegimeGold | null {
  return regimes.find((r) => termo.test(r.descricao)) ?? null;
}

/** "declarada para 29/04/2023, observada nos dados em 01/05/2023", ou só a data declarada quando os dados não mostram outra. */
export function datasRegime(r: RegimeGold): string {
  return r.observado_nos_dados && r.observado_nos_dados !== r.inicio
    ? `declarada para ${dataBR(r.inicio)}, observada nos dados em ${dataBR(r.observado_nos_dados)}`
    : `a partir de ${dataBR(r.inicio)}`;
}

/** Inclusão da MMGD na carga, entre parênteses, com as datas da gold ("" se a gold não traz o regime). */
export function parentesesMmgd(regimes: readonly RegimeGold[]): string {
  const r = regimeCom(regimes, /MMGD/);
  return r ? ` (${datasRegime(r)})` : "";
}

/** Aviso do histórico mensal: o que a série deixa de incluir antes de cada mudança de regime publicada. */
export function textoAvisoRegimes(regimes: readonly RegimeGold[]): string {
  const desp = regimeCom(regimes, /não despachadas/);
  const mmgd = regimeCom(regimes, /MMGD/);
  const partes: string[] = [];
  if (desp) partes.push(`antes de ${dataBR(desp.inicio)} a série não inclui a previsão de usinas não despachadas`);
  if (mmgd) partes.push(`antes da inclusão da MMGD (${datasRegime(mmgd)}) não inclui a MMGD estimada`);
  if (!partes.length) return "A série muda de conteúdo em cada mudança de regime do ONS: o salto depois de cada marca não é, por si, aumento de consumo.";
  return `${cap(listaTexto(partes))}: o salto depois de cada marca não é, por si, aumento de consumo.`;
}

/** Índice do regime que contém o mês inteiro ("2021-08"); null quando o mês atravessa uma mudança ou fica fora. */
export function regimeDoMes(regimes: readonly RegimeGold[], mes: string): number | null {
  const ini = `${mes}-01`;
  // dia 0 do mês seguinte é o último dia deste
  const ultimo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const i = regimes.findIndex((r) => r.inicio <= ini && (r.fim === null || r.fim >= ini));
  if (i < 0) return null;
  const fim = regimes[i].fim;
  return fim === null || fim >= ultimo ? i : null;
}

/** O que o regime acrescentou, pela primeira frase da descrição publicada ("Inclui a previsão..." vira "a previsão..."). */
function acrescimoRegime(r: RegimeGold): string {
  return r.descricao.split(". ")[0].replace(/\.$/, "").replace(/^Inclui (também )?/, "");
}

/**
 * Aviso de comparação de perfis da curva entre meses de regimes diferentes do ONS (a curva mudou de
 * conteúdo em cada regime), com o que entrou e quando, lidos da gold. null quando todos os meses
 * estão no mesmo regime.
 */
export function textoQuebraCurva(regimes: readonly RegimeGold[], meses: readonly string[]): string | null {
  if (meses.length < 2) return null;
  const idx = meses.map((m) => regimeDoMes(regimes, m));
  if (idx.every((i) => i !== null && i === idx[0])) return null;
  const a = meses.reduce((x, y) => (y < x ? y : x));
  const b = meses.reduce((x, y) => (y > x ? y : x));
  const mudancas = regimes
    .slice(1)
    .filter((r) => r.inicio.slice(0, 7) > a && r.inicio.slice(0, 7) <= b)
    .map((r) => `${acrescimoRegime(r)} (${datasRegime(r)})`);
  return (
    `A curva de carga mudou de conteúdo entre os meses escolhidos${mudancas.length ? `: passou a incluir ${listaTexto(mudancas)}` : ""}. ` +
    "A diferença entre as curvas mistura mudança de medida e de consumo. Na carga verificada a definição é a mesma em todos os anos."
  );
}

/* ---------- diferença entre a carga global da API e a curva, por hora ---------- */

export type DiferencaHora = { hora: number; horas: number; diferenca_mwmed: number | null; diferenca_pct: number | null };

/**
 * Onde a carga global da API fica mais longe da curva, nas mesmas horas: a menor e a maior
 * diferença por hora do dia, lidas da gold (nada de "mais à noite" escrito à mão).
 */
export function textoDiferencaHoraria(porHora: readonly DiferencaHora[]): string | null {
  const v = porHora.filter((x): x is DiferencaHora & { diferenca_pct: number } => x.diferenca_pct !== null && x.horas > 0);
  if (!v.length) return null;
  const max = v.reduce((a, b) => (b.diferenca_pct > a.diferenca_pct ? b : a));
  const min = v.reduce((a, b) => (b.diferenca_pct < a.diferenca_pct ? b : a));
  const dias = Math.max(...v.map((x) => x.horas));
  const quadro = v.every((x) => x.diferenca_pct > 0)
    ? "a carga global ficou acima da curva em todas as horas do dia"
    : v.every((x) => x.diferenca_pct < 0)
      ? "a carga global ficou abaixo da curva em todas as horas do dia"
      : "a diferença entre a carga global e a curva muda de sinal ao longo do dia";
  return (
    `${dias === 1 ? "no último dia" : `nos últimos ${num(dias, 0)} dias`} do SIN, ${quadro}, de ${sinal(min.diferenca_pct, 2)}% na hora das ${rotuloHora(min.hora)} ` +
    `a ${sinal(max.diferenca_pct, 2)}% na hora das ${rotuloHora(max.hora)}`
  );
}

/** Resumo das revisões entre capturas, com a magnitude (seção 11.6: magnitude e alcance, não só contagem). */
export function textoRevisoes(r: P025["revisoes"]): string {
  if (!r.total) return `Nenhum valor revisado entre as ${plural(r.capturas_diaria.length, "captura", "capturas")} da carga diária guardadas.`;
  const mag =
    r.mediana_abs_pct === null || r.max_abs_pct === null
      ? "sem valor anterior positivo para medir a magnitude"
      : `nas ${plural(r.revisoes_com_percentual, "revisão", "revisões")} com valor anterior positivo, mediana de ${num(r.mediana_abs_pct, 4)}% e máximo de ${num(r.max_abs_pct, 2)}% em módulo`;
  const corr = r.linhas.filter((l) => l.situacao === "correcao_de_valor_fora_do_dominio").length;
  return (
    `Entre ${plural(r.capturas_diaria.length, "captura", "capturas")} da carga diária, ${plural(r.total, "valor foi revisado", "valores foram revisados")} em ${plural(r.dias_revisados, "dia", "dias")}: ${mag}` +
    (corr ? `; ${plural(corr, "correção", "correções")} de valor fora do domínio (não positivo) fica à parte.` : ".")
  );
}

/** Situação de atualidade: a fonte publica todo dia; mais de `folgaDias` entre o dado e o processamento é defasagem. */
export function situacaoAtualidade(diaReferencia: string, geradoEm: string, folgaDias = 3): { defasada: boolean; dias: number; texto: string } {
  const proc = diaBrasilia(geradoEm) ?? geradoEm.slice(0, 10);
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - Date.parse(`${diaReferencia}T00:00:00Z`)) / 86_400_000);
  if (dias > folgaDias) {
    return {
      defasada: true,
      dias,
      texto: `Fonte defasada: o dia mais recente é ${dataBR(diaReferencia)}, ${plural(dias, "dia", "dias")} antes do processamento (${dataBR(proc)}), mais que a atualização diária declarada pelo ONS. Os números são os da última publicação válida.`,
    };
  }
  return { defasada: false, dias, texto: `Dado até ${dataBR(diaReferencia)}, processado em ${dataBR(proc)} (${plural(dias, "dia", "dias")} depois; o ONS publica a carga do dia anterior).` };
}

/* ---------- P026: MMGD e perfil horário ---------- */

/** Mês mais recente com todos os dias na API, para a região. */
export function ultimoMesCompletoMmgd(p: P026, sm: Regiao) {
  const ls = p.mmgd_mensal.filter((x) => x.sm === sm && x.dias === x.dias_no_mes);
  return ls.length ? ls.reduce((a, b) => (b.m > a.m ? b : a)) : null;
}

/** Dias do ano civil (366 nos bissextos). */
export function diasNoAno(ano: number): number {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0 ? 366 : 365;
}

/** Hora com mais dias de pico (empate: a primeira); null quando nenhum dia tem pico. */
export function horaModal(contagem: readonly number[]): { hora: number; dias: number } | null {
  let melhor = 0;
  let hora = -1;
  contagem.forEach((c, i) => {
    if (c > melhor) {
      melhor = c;
      hora = i;
    }
  });
  return hora >= 0 ? { hora, dias: melhor } : null;
}

/** Resposta curta do P026 para a região escolhida. */
export function respostaPerfil(p: P026, sm: Regiao): string {
  const quem = DO_REGIAO[sm];
  const partes: string[] = [];
  const m = ultimoMesCompletoMmgd(p, sm);
  partes.push(
    m
      ? `Em ${mesAno(m.m)}, a MMGD estimada pelo ONS foi ${num(m.mmgd_pct, 2)}% da carga global ${quem} na carga verificada (${num(m.mmgd, 0)} de ${num(m.global, 0)} MWmed, média do mês).`
      : `A carga verificada não tem mês completo com MMGD para a região ${quem.replace(/^do /, "")}.`,
  );
  const anos = p.hora_pico_por_ano[sm] ?? [];
  const ult = anos.length ? anos[anos.length - 1] : null;
  const moda = ult ? horaModal(ult.contagem) : null;
  if (ult && moda) {
    const parcial = ult.dias < diasNoAno(ult.ano) ? `, ${plural(ult.dias, "dia", "dias")} até ${dataBR(p.ultimo_dia_curva)}` : "";
    let pico = `Em ${ult.ano}${parcial}, o pico diário da curva de carga ${quem} caiu mais vezes na hora que começa às ${rotuloHora(moda.hora)} (${plural(moda.dias, "dia", "dias")})`;
    if (sm === "SIN") {
      const api = p.hora_pico_api_sin_por_ano.find((x) => x.ano === ult.ano);
      const ml = api ? horaModal(api.contagem_liquida) : null;
      if (ml) pico += `; o da carga líquida de MMGD, às ${rotuloHora(ml.hora)} (${plural(ml.dias, "dia", "dias")})`;
    }
    partes.push(`${pico}.`);
  }
  const rec = p.recordes_anuais.filter((r) => r.sm === sm).reduce<P026["recordes_anuais"][number] | null>((a, b) => (!a || b.ano > a.ano ? b : a), null);
  if (rec) partes.push(`O maior valor horário de ${rec.ano} foi ${num(rec.pico, 0)} MWmed, em ${dataBR(rec.dia)} às ${rotuloHora(rec.hora)}.`);
  return partes.join(" ");
}

/** Situação das duas fontes horárias: a curva e a API podem terminar em dias diferentes. */
export function textoAtualidadeHoraria(p: P026): string {
  if (p.ultimo_dia_curva === p.ultimo_dia_api) return `A curva de carga e a carga verificada vão até ${dataBR(p.ultimo_dia_curva)}.`;
  return `A curva de carga vai até ${dataBR(p.ultimo_dia_curva)} e a carga verificada até ${dataBR(p.ultimo_dia_api)}: cada gráfico mostra a própria fonte até o seu último dia, sem completar a outra.`;
}

export type LinhaHoraria = { id: string; h: string } & Partial<Record<Regiao | "global" | "mmgd" | "liquida", number | null>>;

/** Últimas horas (curva e API lado a lado, nunca subtraídas): as mesmas linhas dos dois gráficos e da tabela. */
export function linhasRecente(p: P026): LinhaHoraria[] {
  return p.recente.map((r) => ({ ...r, id: r.h }));
}

export function opcoesPerfil(p: P026): { mes: string; classes: ClasseDia[] }[] {
  const out: { mes: string; classes: ClasseDia[] }[] = [];
  for (const x of p.perfil_sin_12m) {
    let o = out.find((y) => y.mes === x.mes);
    if (!o) out.push((o = { mes: x.mes, classes: [] }));
    if (!o.classes.includes(x.classe)) o.classes.push(x.classe);
  }
  return out;
}

/** Perfil escolhido; mês ou classe inválidos caem no mês mais recente e na primeira classe publicada. */
export function perfilEscolhido(lista: PerfilTipico[], mes: string, classe: ClasseDia, sm?: Regiao): PerfilTipico | null {
  const daRegiao = sm ? lista.filter((x) => x.sm === sm) : lista;
  return (
    daRegiao.find((x) => x.mes === mes && x.classe === classe) ??
    daRegiao.find((x) => x.mes === mes) ??
    daRegiao.filter((x) => x.classe === classe).reduce<PerfilTipico | null>((a, b) => (!a || b.mes > a.mes ? b : a), null) ??
    daRegiao[daRegiao.length - 1] ??
    null
  );
}

export type LinhaPerfil = { id: string; hora: string; carga: number | null; global: number | null; mmgd: number | null; liquida: number | null };

export function linhasPerfil(perfil: PerfilTipico): LinhaPerfil[] {
  return Array.from({ length: 24 }, (_, h) => ({
    id: String(h),
    hora: rotuloHora(h),
    carga: perfil.carga[h] ?? null,
    global: perfil.global[h] ?? null,
    mmgd: perfil.mmgd[h] ?? null,
    liquida: perfil.liquida[h] ?? null,
  }));
}

/** Frase do perfil escolhido: maior e menor hora da carga líquida e o pico da MMGD (só API). */
export function respostaPerfilTipico(perfil: PerfilTipico): string {
  const ls = linhasPerfil(perfil);
  const quem = DO_REGIAO[perfil.sm];
  const ext = (k: "liquida" | "mmgd" | "carga", maior: boolean) =>
    ls.reduce<LinhaPerfil | null>((a, b) => (b[k] === null ? a : !a || (maior ? b[k]! > a[k]! : b[k]! < a[k]!) ? b : a), null);
  const dias = `${plural(perfil.dias_api, "dia", "dias")} de ${ROTULO_CLASSE[perfil.classe]} em ${mesAno(perfil.mes)}`;
  const lMax = ext("liquida", true);
  const lMin = ext("liquida", false);
  const mMax = ext("mmgd", true);
  if (!lMax || !lMin || !mMax) {
    const cMax = ext("carga", true);
    return cMax
      ? `Na curva de carga ${quem} (${plural(perfil.dias_curva, "dia", "dias")} de ${ROTULO_CLASSE[perfil.classe]} em ${mesAno(perfil.mes)}), a hora de maior carga média começa às ${cMax.hora} (${num(cMax.carga, 0)} MWmed). A carga verificada não tem dia completo neste recorte.`
      : `Sem perfil publicado para a carga ${quem} neste recorte.`;
  }
  return `Na média de ${dias}, a carga líquida de MMGD ${quem} vai de ${num(lMin.liquida, 0)} MWmed (hora das ${lMin.hora}) a ${num(lMax.liquida, 0)} MWmed (hora das ${lMax.hora}); a MMGD estimada chega a ${num(mMax.mmgd, 0)} MWmed na hora das ${mMax.hora}.`;
}

export type LinhaMmgdMensal = { id: string; mes: string; parcial: boolean } & Partial<Record<Regiao, number | null>>;

/** Parcela mensal da MMGD na carga global por região, em linhas largas (uma por mês): gráfico e tabela. */
export function linhasMmgdMensal(p: P026): LinhaMmgdMensal[] {
  const porMes = new Map<string, LinhaMmgdMensal>();
  for (const x of p.mmgd_mensal) {
    let l = porMes.get(x.m);
    if (!l) porMes.set(x.m, (l = { id: x.m, mes: x.m, parcial: false }));
    l[x.sm] = x.mmgd_pct;
    if (x.dias < x.dias_no_mes) l.parcial = true;
  }
  return Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Matriz ano × hora com os dias de pico em cada hora (MapaCalor). */
export function matrizHoraPico(
  p: Pick<P026, "hora_pico_por_ano">,
  sm: Regiao,
  desde?: number,
): { anos: { id: string; rotulo: string; dias: number; regimes: number[] }[]; valores: number[][] } {
  const anos = (p.hora_pico_por_ano[sm] ?? []).filter((a) => desde === undefined || a.ano >= desde);
  return {
    anos: anos.map((a) => ({ id: String(a.ano), rotulo: a.dias < diasNoAno(a.ano) ? `${a.ano} (${a.dias} dias)` : String(a.ano), dias: a.dias, regimes: a.regimes })),
    valores: anos.map((a) => a.contagem.slice(0, 24)),
  };
}

export type LinhaHoraPicoApi = { id: string; hora: string; liquida: number | null; global: number | null };

/** Dias com pico em cada hora no ano, carga líquida e carga global da API (SIN); hora sem contagem publicada é ausência, não zero. */
export function linhasHoraPicoApi(p: P026, ano: number): LinhaHoraPicoApi[] {
  const a = p.hora_pico_api_sin_por_ano.find((x) => x.ano === ano);
  if (!a) return [];
  return Array.from({ length: 24 }, (_, h) => ({ id: String(h), hora: rotuloHora(h), liquida: a.contagem_liquida[h] ?? null, global: a.contagem_global[h] ?? null }));
}

export type MedidaPerfil = "liquida" | "global" | "mmgd" | "carga";
export const MEDIDAS_PERFIL: readonly MedidaPerfil[] = ["liquida", "global", "mmgd", "carga"];
export const ROTULO_MEDIDA: Record<MedidaPerfil, string> = {
  liquida: "Carga líquida de MMGD (carga verificada)",
  global: "Carga global (carga verificada)",
  mmgd: "MMGD estimada (carga verificada)",
  carga: "Carga da curva horária",
};

const MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "agosto" para "2026-08". */
export function nomeMes(mes: string): string {
  return MESES_EXTENSO[Number(mes.slice(5, 7)) - 1] ?? mes;
}

/** Mês e tipo de dia do perfil comparado entre anos, lidos da gold ("dia útil", "agosto"); null sem perfil. */
export function recorteEvolucao(p: Pick<P026, "perfil_evolucao">): { mes: string; classe: string; desde: string } | null {
  const pf = p.perfil_evolucao[0];
  return pf ? { mes: nomeMes(pf.mes), classe: ROTULO_CLASSE[pf.classe], desde: pf.mes.slice(0, 4) } : null;
}

export function anosEvolucao(p: P026): string[] {
  return p.perfil_evolucao.map((x) => x.mes.slice(0, 4));
}

/** Padrão do comparador de anos: o primeiro, o último e dois intermediários igualmente espaçados. */
export function anosPadraoEvolucao(anos: readonly string[], max = 4): string[] {
  if (anos.length <= max) return [...anos];
  const idx = Array.from({ length: max }, (_, i) => Math.round((i * (anos.length - 1)) / (max - 1)));
  return Array.from(new Set(idx)).map((i) => anos[i]);
}

/** Linhas hora × ano da medida escolhida para os anos escolhidos (gráfico e tabela). */
export function linhasEvolucao(p: P026, anos: readonly string[], medida: MedidaPerfil): ({ id: string; hora: string } & Record<string, number | null | string>)[] {
  const perfis = anos.map((a) => p.perfil_evolucao.find((x) => x.mes.startsWith(a))).filter((x): x is PerfilTipico => !!x);
  return Array.from({ length: 24 }, (_, h) => {
    const l: { id: string; hora: string } & Record<string, number | null | string> = { id: String(h), hora: rotuloHora(h) };
    for (const pf of perfis) l[pf.mes.slice(0, 4)] = pf[medida][h] ?? null;
    return l;
  });
}

export type LinhaA11 = { id: string; d: string; carga_menos_global: number | null; meio_dia_curva_menos_global: number | null; mmgd_meio_dia: number | null; solar_balanco: number | null };

/* ---------- P027: decomposição estatística ---------- */

type P027Pronto = NonNullable<P027>;

/** Resposta curta do P027 para a região escolhida, com a cobertura dos intervalos diante da nominal. */
export function respostaClima(p: Pick<P027Pronto, "metricas" | "periodo_avaliacao">, sm: Regiao): string {
  const m: MetricasModelo | undefined = p.metricas[sm];
  if (!m) return `Sem métricas fora da amostra para a carga ${DO_REGIAO[sm]} nesta publicação.`;
  const per = p.periodo_avaliacao;
  const ref =
    m.mape_referencia_364d_pct === null
      ? ""
      : `; a referência ingênua (o mesmo dia da semana 364 dias antes) errou ${num(m.mape_referencia_364d_pct, 2)}%`;
  const abaixo80 = m.cobertura_80_pct < 80;
  const abaixo95 = m.cobertura_95_pct < 95;
  const cobertura =
    abaixo80 || abaixo95
      ? ": abaixo do nominal, os intervalos são mais estreitos que a incerteza real"
      : ", no nível nominal ou acima";
  return (
    `Fora da amostra (${plural(m.dias, "dia", "dias")} de ${dataBR(per.inicio)} a ${dataBR(per.fim)}, ${plural(m.origens, "origem mensal", "origens mensais")}), ` +
    `a decomposição por calendário, temperatura, sazonalidade e tendência errou em média ${num(m.mape_pct, 2)}% a carga diária ${DO_REGIAO[sm]}${ref}. ` +
    `O intervalo de 80% cobriu ${num(m.cobertura_80_pct, 1)}% dos dias e o de 95%, ${num(m.cobertura_95_pct, 1)}%${cobertura}.`
  );
}

/** Defasagem da temperatura: a avaliação termina antes do último dia de carga quando a NASA POWER ainda não publicou. */
export function textoDefasagemTemperatura(p: Pick<P027Pronto, "periodo_avaliacao">, diaReferencia: string): string {
  const fim = p.periodo_avaliacao.fim;
  if (fim >= diaReferencia) return `A decomposição cobre até ${dataBR(fim)}, o último dia de carga publicado.`;
  const dias = Math.round((Date.parse(`${diaReferencia}T00:00:00Z`) - Date.parse(`${fim}T00:00:00Z`)) / 86_400_000);
  return `A decomposição vai até ${dataBR(fim)}, ${plural(dias, "dia", "dias")} antes do último dia de carga (${dataBR(diaReferencia)}): a temperatura da NASA POWER chega com defasagem, e dia sem temperatura não é previsto.`;
}

export function decomposicaoEscolhida(a07: Pick<A07, "decomposicao">, sm: Regiao, variante: VarianteModelo, comparacao: TipoComparacao): DecomposicaoA07 | null {
  return a07.decomposicao.find((d) => d.sm === sm && d.variante === variante && d.comparacao === comparacao) ?? null;
}

export type BarraDecomposicao = { id: GrupoModelo | "residuo"; rotulo: string; valor: number };

/** Barras de contribuição (log × 100) e o resíduo: somadas, dão a diferença real entre as janelas. */
export function barrasDecomposicao(d: DecomposicaoA07): BarraDecomposicao[] {
  return [...GRUPOS_MODELO.map((g) => ({ id: g, rotulo: ROTULO_GRUPO[g], valor: d.contribuicoes_log100[g] })), { id: "residuo" as const, rotulo: "Resíduo", valor: d.residuo_log100 }];
}

/** Texto da decomposição escolhida, só com os números da linha (associação, não causa). */
export function respostaDecomposicao(d: DecomposicaoA07): string {
  // duas casas, a precisão da gold (com uma casa, 2,65 viraria 2,7 aqui e 2,6 no texto do pipeline)
  const partes = barrasDecomposicao(d).map((b) => `${b.rotulo.toLowerCase()} ${num(b.valor, 2)}`);
  const tipo = d.comparacao === "equivalente" ? "mesmos dias da semana" : "mesmas datas";
  return (
    `De ${dataBR(d.inicio)} a ${dataBR(d.fim)} contra ${dataBR(d.inicio_ant)} a ${dataBR(d.fim_ant)} (${tipo}, ${plural(d.dias, "dia", "dias")}), ` +
    `a carga média ${DO_REGIAO[d.sm]} variou ${sinal(d.variacao_real_pct, 2)}%. Em log × 100, a diferença de ${num(d.real_log100, 2)} se divide em ${listaTexto(partes)} ` +
    `(modelo estimado até ${dataBR(d.ultimo_dia_treino)}). É associação estatística, não causa: o resíduo é o que o modelo não reproduz.`
  );
}

export type LinhaSensibilidade = MetricasModelo & { id: VarianteModelo; rotulo: string; mape_principal: number | null };

/** Variantes do modelo para a região, com o MAPE do principal como referência (pontos pareados e tabela). */
export function linhasSensibilidade(p: Pick<P027Pronto, "sensibilidade">, sm: Regiao): LinhaSensibilidade[] {
  const ls = p.sensibilidade.filter((x) => x.sm === sm);
  const principal = ls.find((x) => x.variante === "principal")?.mape_pct ?? null;
  return VARIANTES.map((v) => ls.find((x) => x.variante === v))
    .filter((x): x is (typeof ls)[number] => !!x)
    .map(({ sm: _sm, variante, ...resto }) => ({ ...resto, id: variante, mape_principal: principal }));
}

/** Resposta da carga à temperatura por região, em linhas por grau (união das faixas observadas). */
export function linhasRespostaTemperatura(p: Pick<P027Pronto, "resposta_temperatura">): ({ id: string; t: string } & Partial<Record<Regiao, number | null>>)[] {
  const porT = new Map<number, { id: string; t: string } & Partial<Record<Regiao, number | null>>>();
  for (const sm of REGIOES) {
    for (const [t, ef] of p.resposta_temperatura[sm]?.pontos ?? []) {
      let l = porT.get(t);
      if (!l) porT.set(t, (l = { id: String(t), t: `${num(t, 0)} °C` }));
      l[sm] = ef;
    }
  }
  return Array.from(porT.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, l]) => {
      for (const sm of REGIOES) if (!(sm in l)) l[sm] = null;
      return l;
    });
}

/** Linhas da série recente decomposta (SIN): as mesmas do gráfico real × previsto, do gráfico de contribuições e da tabela. */
export function linhasRecenteModelo(p: Pick<P027Pronto, "recente_sin">) {
  return p.recente_sin.map((x) => ({ ...x, id: x.d, dentro_80: x.real >= x.p10 && x.real <= x.p90 }));
}

/** Frase do último dia previsto: real diante do intervalo de 80%. */
export function respostaUltimoDia(p: Pick<P027Pronto, "recente_sin">): string {
  const u = p.recente_sin[p.recente_sin.length - 1];
  if (!u) return "Sem dia previsto fora da amostra nesta publicação.";
  const pos = u.real > u.p90 ? "acima do intervalo de 80%" : u.real < u.p10 ? "abaixo do intervalo de 80%" : "dentro do intervalo de 80%";
  return `Em ${dataBR(u.d)}, a carga do SIN foi ${num(u.real, 0)} MWmed contra ${num(u.previsto, 0)} MWmed previstos com a origem de ${dataBR(u.origem)} (${sinal(u.residuo_pct, 1)}%), ${pos} (${num(u.p10, 0)} a ${num(u.p90, 0)} MWmed).`;
}

/* ---------- tabelas equivalentes ---------- */

/**
 * Linhas planas para a TabelaInterativa e a exportação: verdadeiro e falso viram
 * "sim" e "não", listas viram texto; números e nulos passam iguais (o arquivo
 * guarda o valor completo, e a ausência continua célula vazia).
 */
export function paraTabela<T extends object>(linhas: readonly T[]): LinhaTabela[] {
  return linhas.map((l) =>
    Object.fromEntries(
      Object.entries(l)
        .filter(([, v]) => v === null || typeof v !== "object" || Array.isArray(v))
        .map(([k, v]) => [k, typeof v === "boolean" ? (v ? "sim" : "não") : Array.isArray(v) ? v.join(", ") : (v as ValorCelula)]),
    ),
  );
}

export const COLUNAS_COMPARACAO: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Janela", tipo: "texto" },
  { id: "inicio", rotulo: "Início", tipo: "data" },
  { id: "fim", rotulo: "Fim", tipo: "data" },
  { id: "media", rotulo: "Média da janela", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "inicio_ant", rotulo: "Início da comparação", tipo: "data" },
  { id: "fim_ant", rotulo: "Fim da comparação", tipo: "data" },
  { id: "media_ant", rotulo: "Média da comparação", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "variacao_pct", rotulo: "Variação", tipo: "percentual", casas: 2 },
  { id: "dias_uteis", rotulo: "Dias úteis", tipo: "numero", casas: 0 },
  { id: "dias_uteis_ant", rotulo: "Dias úteis na comparação", tipo: "numero", casas: 0 },
  { id: "calendario_equivalente", rotulo: "Calendário equivalente", tipo: "texto", categorica: true },
  { id: "mesmo_regime", rotulo: "Mesmo regime do ONS", tipo: "texto", categorica: true },
];

/** Tabela completa (todas as regiões e tipos), igual a carga_comparacoes.csv. */
export const COLUNAS_COMPARACOES_TODAS: ColunaTabela[] = [
  { id: "regiao", rotulo: "Região", tipo: "texto", categorica: true },
  { id: "comparacao", rotulo: "Comparação", tipo: "texto", categorica: true },
  ...COLUNAS_COMPARACAO,
];

export const COLUNAS_MENSAL: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "texto" },
  { id: "dias_uteis", rotulo: "Dias úteis", tipo: "numero", casas: 0 },
  { id: "dias_uteis_ant", rotulo: "Dias úteis no mesmo mês do ano anterior", tipo: "numero", casas: 0 },
  ...REGIOES.flatMap((sm): ColunaTabela[] => [
    { id: sm, rotulo: `${CURTO_REGIAO[sm]}, média`, tipo: "numero", unidade: "MWmed", casas: 0 },
    { id: `var_${sm}`, rotulo: `${CURTO_REGIAO[sm]}, variação`, tipo: "percentual", casas: 2 },
  ]),
];

export const COLUNAS_ANUAL: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "dias", rotulo: "Dias com valor", tipo: "numero", casas: 0 },
  { id: "completo", rotulo: "Ano completo", tipo: "texto", categorica: true },
  { id: "regimes", rotulo: "Regimes do ONS no ano", tipo: "texto", categorica: true },
  ...REGIOES.flatMap((sm): ColunaTabela[] => [
    { id: sm, rotulo: `${CURTO_REGIAO[sm]}, média`, tipo: "numero", unidade: "MWmed", casas: 0 },
    { id: `var_${sm}`, rotulo: `${CURTO_REGIAO[sm]}, variação`, tipo: "percentual", casas: 2 },
  ]),
];

export const COLUNAS_ACUMULADO: ColunaTabela[] = [
  { id: "regiao", rotulo: "Região", tipo: "texto" },
  { id: "media", rotulo: "Média no ano", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "media_ant", rotulo: "Média na comparação", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "variacao_pct", rotulo: "Variação", tipo: "percentual", casas: 2 },
  { id: "mesmo_regime", rotulo: "Mesmo regime do ONS", tipo: "texto" },
];

/** Rótulos legíveis dos identificadores que a gold publica (a tabela mostra o rótulo; o CSV da fonte guarda o identificador). */
export const ROTULO_JANELA_A07: Record<string, string> = {
  "2026": "2026",
  "2025_mesmas_datas": "2025, mesmas datas",
  "2025_equivalente": "2025, mesmos dias da semana",
};
export const ROTULO_SITUACAO_REVISAO: Record<string, string> = {
  revisao: "revisão",
  correcao_de_valor_fora_do_dominio: "correção de valor fora do domínio",
};
