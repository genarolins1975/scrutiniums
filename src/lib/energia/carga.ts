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
import { dataBR, mesAno, nomeMes as nomeDoMes, nomeSubmercado, num, plural, sinal } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import { ACRESCIMO_REGIME_EN, JANELA_CARGA_EN, rotuloDaGold } from "./i18n/agua-carga-rede";
import type { Idioma } from "@/lib/idioma";
import type { ColunaTabela, LinhaTabela, ValorCelula } from "./tabela";
import type { Regiao } from "./tipos";
import type {
  A07,
  AcumuladoAno,
  CargaMensal,
  ClasseDia,
  ClassesDias,
  DecomposicaoA07,
  EventoCurto,
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
export function paineisCarga(idioma: Idioma = idiomaEnergia()): { id: PainelCarga; rotulo: string; caminho: string; pergunta: string }[] {
  return [
    { id: "p025", rotulo: tx("Nível e crescimento", "Level and growth", idioma), caminho: "", pergunta: tx("Quanto o sistema está consumindo?", "How much is the system consuming?", idioma) },
    {
      id: "p026",
      rotulo: tx("MMGD e perfil horário", "MMGD and hourly profile", idioma),
      caminho: "/perfil-horario",
      pergunta: tx("Qual parcela da carga é estimada e quando ocorre o pico?", "What share of the load is estimated and when does the peak occur?", idioma),
    },
    {
      id: "p027",
      rotulo: tx("Clima e calendário", "Climate and calendar", idioma),
      caminho: "/clima-e-calendario",
      pergunta: tx("Quanto da variação da carga é compatível com clima e calendário?", "How much of the change in load is compatible with climate and calendar?", idioma),
    },
  ];
}
export const PAINEIS_CARGA = paineisCarga("pt");

export function rotaPainel(id: PainelCarga): string {
  return `${ROTA_CARGA}${PAINEIS_CARGA.find((p) => p.id === id)?.caminho ?? ""}`;
}

export function perguntaPainel(id: PainelCarga, idioma: Idioma = idiomaEnergia()): string {
  return paineisCarga(idioma).find((p) => p.id === id)?.pergunta ?? "";
}

/* ---------- regiões, classes e rótulos ---------- */

export const REGIOES: readonly Regiao[] = ["SIN", "SE", "S", "NE", "N"];
export const SUBSISTEMAS: readonly Regiao[] = ["SE", "S", "NE", "N"];
export const NOME_REGIAO: Record<Regiao, string> = { SIN: "SIN", SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" }; // i18n: dado (nomeRegiao traduz)
export const CURTO_REGIAO: Record<Regiao, string> = { SIN: "SIN", SE: "SE/CO", S: "S", NE: "NE", N: "N" };
/** "a carga do SIN", "a carga do Sul": contração com o artigo de cada nome. */
export const DO_REGIAO: Record<Regiao, string> = { SIN: "do SIN", SE: "do Sudeste/Centro-Oeste", S: "do Sul", NE: "do Nordeste", N: "do Norte" }; // i18n: dado (doRegiao traduz)
export const COR_REGIAO: Record<Regiao, string> = {
  SIN: "var(--cor-energia)", // i18n: dado
  SE: "var(--serie-sm-se)",
  S: "var(--serie-sm-s)",
  NE: "var(--serie-sm-ne)",
  N: "var(--serie-sm-n)",
};
export const COR_COMPARACAO = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"] as const;

/** Nome da região no idioma: o SIN fica "SIN"; os subsistemas, pelo nome do submercado ("Southeast/Center-West"). */
export function nomeRegiao(r: Regiao, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" && r !== "SIN" ? nomeSubmercado(r, "en") : NOME_REGIAO[r];
}

/** Nome curto no idioma ("SE/CO" vira "SE/CW"). */
export function curtoRegiao(r: Regiao, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" && r === "SE" ? "SE/CW" : CURTO_REGIAO[r];
}

/** "do Sul" em português; "of the South" em inglês ("of the SIN"). */
export function doRegiao(r: Regiao, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? `of the ${nomeRegiao(r, "en")}` : DO_REGIAO[r];
}

export function rotuloClasse(c: ClasseDia, idioma: Idioma = idiomaEnergia()): string {
  return { util: tx("dia útil", "working day", idioma), sabado: tx("sábado", "Saturday", idioma), domingo_feriado: tx("domingo ou feriado", "Sunday or holiday", idioma) }[c];
}
export const ROTULO_CLASSE: Record<ClasseDia, string> = { util: rotuloClasse("util", "pt"), sabado: rotuloClasse("sabado", "pt"), domingo_feriado: rotuloClasse("domingo_feriado", "pt") };
export function rotuloGrupo(g: GrupoModelo, idioma: Idioma = idiomaEnergia()): string {
  return {
    calendario: tx("Calendário", "Calendar", idioma),
    temperatura: tx("Temperatura", "Temperature", idioma),
    sazonalidade: tx("Sazonalidade", "Seasonality", idioma),
    nivel_tendencia: tx("Nível e tendência", "Level and trend", idioma),
  }[g];
}
export const ROTULO_GRUPO: Record<GrupoModelo, string> = {
  calendario: rotuloGrupo("calendario", "pt"),
  temperatura: rotuloGrupo("temperatura", "pt"),
  sazonalidade: rotuloGrupo("sazonalidade", "pt"),
  nivel_tendencia: rotuloGrupo("nivel_tendencia", "pt"),
};
export const GRUPOS_MODELO: readonly GrupoModelo[] = ["calendario", "temperatura", "sazonalidade", "nivel_tendencia"];

export type TipoComparacao = "equivalente" | "mesmas_datas";
export const TIPOS_COMPARACAO: readonly TipoComparacao[] = ["equivalente", "mesmas_datas"];
export function rotuloTipo(t: TipoComparacao, idioma: Idioma = idiomaEnergia()): string {
  return {
    equivalente: tx("mesmos dias da semana, 52 semanas antes", "same days of the week, 52 weeks earlier", idioma),
    mesmas_datas: tx("mesmas datas do ano anterior", "same dates of the previous year", idioma),
  }[t];
}
export const ROTULO_TIPO: Record<TipoComparacao, string> = { equivalente: rotuloTipo("equivalente", "pt"), mesmas_datas: rotuloTipo("mesmas_datas", "pt") };
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

/** Rótulo da janela de comparação publicado na gold, no idioma. */
export function rotuloJanela(rotulo: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDaGold(JANELA_CARGA_EN, rotulo, idioma);
}

/** "a, b e c" ("a, b and c"). */
export function listaTexto(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/** Hora local de início com dois dígitos ("07h"; "07:00" em inglês). */
export function rotuloHora(h: number, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? `${String(h).padStart(2, "0")}:00` : `${String(h).padStart(2, "0")}h`;
}

/* ---------- calendário ---------- */

/** "5 dias úteis, 1 sábado e 1 domingo ou feriado"; classes com zero dia não aparecem. */
export function textoClasses(c: ClassesDias, idioma: Idioma = idiomaEnergia()): string {
  const partes: string[] = [];
  if (c.util) partes.push(tx(plural(c.util, "dia útil", "dias úteis", "pt"), plural(c.util, "working day", "working days", "en"), idioma));
  if (c.sabado) partes.push(tx(plural(c.sabado, "sábado", "sábados", "pt"), plural(c.sabado, "Saturday", "Saturdays", "en"), idioma));
  if (c.domingo_feriado) partes.push(tx(plural(c.domingo_feriado, "domingo ou feriado", "domingos ou feriados", "pt"), plural(c.domingo_feriado, "Sunday or holiday", "Sundays or holidays", "en"), idioma));
  if (c.sem_classe)
    partes.push(
      tx(
        `${plural(c.sem_classe, "dia", "dias", "pt")} sem classificação de calendário (antes de 2003)`,
        `${plural(c.sem_classe, "day", "days", "en")} without calendar classification (before 2003)`,
        idioma,
      ),
    );
  return partes.length ? listaTexto(partes, idioma) : tx("nenhum dia classificado", "no day classified", idioma);
}

/** Composição de calendário da janela de comparação do tipo pedido. */
export function classesComparacao(j: JanelaComparacao, tipo: TipoComparacao): ClassesDias | null {
  return tipo === "equivalente" ? j.classes_equivalente : j.classes_mesmas_datas;
}

export function calendarioEquivalente(j: JanelaComparacao, tipo: TipoComparacao): boolean {
  return tipo === "equivalente" ? j.calendario_equivalente_364d : j.calendario_equivalente_mesmas_datas;
}

/** Frase sobre a composição de dias das duas janelas (regra: igualdade publicada pelo pipeline). */
export function textoCalendarioJanela(j: JanelaComparacao, tipo: TipoComparacao, idioma: Idioma = idiomaEnergia()): string {
  const ant = classesComparacao(j, tipo);
  if (!ant) return tx("A janela inclui um 29 de fevereiro, sem par nas mesmas datas do ano anterior.", "The window includes a February 29, with no match in the same dates of the previous year.", idioma);
  if (calendarioEquivalente(j, tipo))
    return tx(`As duas janelas têm a mesma composição de calendário: ${textoClasses(j.classes, "pt")}.`, `Both windows have the same calendar composition: ${textoClasses(j.classes, "en")}.`, idioma);
  return tx(
    `As janelas não têm a mesma composição de calendário: ${textoClasses(j.classes, "pt")} nesta, ${textoClasses(ant, "pt")} na de comparação.`,
    `The windows do not have the same calendar composition: ${textoClasses(j.classes, "en")} in this one, ${textoClasses(ant, "en")} in the comparison window.`,
    idioma,
  );
}

/**
 * Feriados e pontos facultativos de cada janela, na base escolhida: os da janela e os da janela de comparação (as mesmas datas do ano
 * anterior ou os mesmos dias da semana deslocados 364 dias). Lidos da gold, nunca escritos aqui. O nome do feriado é nome próprio e fica em
 * português nas duas versões.
 */
export function textoEventosJanela(j: JanelaComparacao, tipo: TipoComparacao, idioma: Idioma = idiomaEnergia()): string {
  const nomes = (xs: readonly EventoCurto[]) => listaTexto(xs.map(([d, nome]) => `${nome} (${dataBR(d, idioma)})`), idioma);
  const ant = tipo === "equivalente" ? j.eventos_equivalente : j.eventos_mesmas_datas;
  if (!j.eventos.length && !ant.length) return tx("Nenhum feriado nem ponto facultativo nas duas janelas.", "No public holiday or optional holiday in either window.", idioma);
  const nenhum = tx("nenhum", "none", idioma);
  return tx(
    `Feriados e pontos facultativos: ${j.eventos.length ? nomes(j.eventos) : nenhum} nesta janela; ${ant.length ? nomes(ant) : nenhum} na de comparação.`,
    `Public holidays and optional holidays: ${j.eventos.length ? nomes(j.eventos) : nenhum} in this window; ${ant.length ? nomes(ant) : nenhum} in the comparison window.`,
    idioma,
  );
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
export function linhasComparacao(p: Pick<P025, "comparacoes">, sm: Regiao, tipo: TipoComparacao, idioma: Idioma = idiomaEnergia()): LinhaComparacao[] {
  const s = p.comparacoes.subsistemas.find((x) => x.sm === sm);
  return p.comparacoes.janelas.map((j) => {
    const n = s?.janelas[j.id]?.[tipo] ?? null;
    const ant = classesComparacao(j, tipo);
    return {
      id: `${sm}:${j.id}:${tipo}`,
      sm,
      regiao: nomeRegiao(sm, idioma),
      comparacao: rotuloTipo(tipo, idioma),
      janela: j.id,
      rotulo: cap(rotuloJanela(j.rotulo, idioma)),
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

/** A base da comparação escrita no plural, em minúsculas, para rótulos e frases. */
export function baseCurta(t: TipoComparacao, idioma: Idioma = idiomaEnergia()): string {
  return { equivalente: tx("mesmos dias da semana", "same days of the week", idioma), mesmas_datas: tx("mesmas datas", "same dates", idioma) }[t];
}
export const BASE_CURTA: Record<TipoComparacao, string> = { equivalente: baseCurta("equivalente", "pt"), mesmas_datas: baseCurta("mesmas_datas", "pt") };

/** Uma linha de explicação de cada base, para o controle que alterna entre elas. */
export function explicacaoBase(t: TipoComparacao, idioma: Idioma = idiomaEnergia()): string {
  return {
    equivalente: tx("Cada dia contra o dia de mesma posição na semana, 52 semanas antes (364 dias).", "Each day against the day in the same position in the week, 52 weeks earlier (364 days).", idioma),
    mesmas_datas: tx(
      "Cada dia contra a mesma data do ano anterior; os dias caem em outros dias da semana.",
      "Each day against the same date of the previous year; the days fall on other days of the week.",
      idioma,
    ),
  }[t];
}
export const EXPLICACAO_BASE: Record<TipoComparacao, string> = { equivalente: explicacaoBase("equivalente", "pt"), mesmas_datas: explicacaoBase("mesmas_datas", "pt") };

export function outraBase(t: TipoComparacao): TipoComparacao {
  return t === "equivalente" ? "mesmas_datas" : "equivalente";
}

/** A linha da janela escolhida, a mesma que alimenta o gráfico de pontos, a tabela equivalente e a exportação (null sem a janela). */
export function linhaDaJanela(p: Pick<P025, "comparacoes">, sm: Regiao, janela: JanelaId, tipo: TipoComparacao, idioma: Idioma = idiomaEnergia()): LinhaComparacao | null {
  return linhasComparacao(p, sm, tipo, idioma).find((l) => l.janela === janela) ?? null;
}

/**
 * Frase da abertura que diz o que a outra base daria para a mesma janela. A janela é a mesma e as duas taxas são certas: o que muda
 * é a janela de comparação (as mesmas datas do ano anterior caem em outros dias da semana; os mesmos dias da semana deslocam a
 * janela em 364 dias). Vazia quando a janela não existe.
 */
export function textoOutraBase(p: Pick<P025, "comparacoes">, sm: Regiao, janela: JanelaId, tipo: TipoComparacao, idioma: Idioma = idiomaEnergia()): string {
  if (!p.comparacoes.janelas.some((j) => j.id === janela)) return "";
  const outra = outraBase(tipo);
  const l = linhaDaJanela(p, sm, janela, outra, idioma);
  const nome =
    outra === "equivalente"
      ? tx("os mesmos dias da semana, 52 semanas antes", "the same days of the week, 52 weeks earlier", idioma)
      : tx("as mesmas datas do ano anterior", "the same dates of the previous year", idioma);
  if (!l || l.variacao_pct === null || l.inicio_ant === null || l.fim_ant === null)
    return tx(`Com ${nome}, esta janela não tem variação publicada.`, `With ${nome}, this window has no published change.`, idioma);
  const diferenca =
    outra === "mesmas_datas"
      ? tx("nas mesmas datas, os dias do ano anterior caem em outros dias da semana", "on the same dates, the days of the previous year fall on other days of the week", idioma)
      : tx("nos mesmos dias da semana, a janela de comparação é deslocada 364 dias", "on the same days of the week, the comparison window is shifted by 364 days", idioma);
  const d = (x: string) => dataBR(x, idioma);
  return tx(
    `Com ${nome} (${d(l.inicio_ant)} a ${d(l.fim_ant)}), a variação da mesma janela é ${sinal(l.variacao_pct, 2, "", idioma)}%. As duas taxas usam bases diferentes: ${diferenca}.`,
    `With ${nome} (${d(l.inicio_ant)} to ${d(l.fim_ant)}), the change for the same window is ${sinal(l.variacao_pct, 2, "", idioma)}%. The two rates use different bases: ${diferenca}.`,
    idioma,
  );
}

/** Todas as regiões, janelas e tipos: as mesmas linhas de carga_comparacoes.csv. */
export function linhasComparacoesTodas(p: Pick<P025, "comparacoes">, idioma: Idioma = idiomaEnergia()): LinhaComparacao[] {
  return REGIOES.flatMap((sm) => TIPOS_COMPARACAO.flatMap((t) => linhasComparacao(p, sm, t, idioma)));
}

/** Duração da janela no idioma: o rótulo já a diz quando traz número ("últimos 7 dias"); senão, acrescenta os dias. */
function rotuloComDias(j: JanelaComparacao, idioma: Idioma): string {
  const r = rotuloJanela(j.rotulo, idioma);
  return /\d/.test(j.rotulo) ? r : `${r}, ${plural(j.dias, tx("dia", "day", idioma), tx("dias", "days", idioma), idioma)}`;
}

/** Resposta curta do P025 para a região, a janela e o tipo de comparação escolhidos. */
export function respostaNivel(p: Pick<P025, "comparacoes">, sm: Regiao, janela: JanelaId, tipo: TipoComparacao, idioma: Idioma = idiomaEnergia()): string {
  const j = p.comparacoes.janelas.find((x) => x.id === janela);
  const quem = doRegiao(sm, idioma);
  if (!j) return tx(`A gold desta publicação não traz a janela pedida para a carga ${quem}.`, `This release's gold file does not include the requested window for the load ${quem}.`, idioma);
  // o rótulo já diz a duração quando traz número ("últimos 7 dias", "últimas 52 semanas")
  const rot = rotuloComDias(j, idioma);
  const d = (x: string | null) => dataBR(x, idioma);
  const periodo = tx(`de ${d(j.inicio)} a ${d(j.fim)} (${rot})`, `from ${d(j.inicio)} to ${d(j.fim)} (${rot})`, idioma);
  const n = p.comparacoes.subsistemas.find((x) => x.sm === sm)?.janelas[janela]?.[tipo] ?? null;
  if (!n) {
    return tx(
      `${cap(periodo)}, a carga ${quem} não tem comparação (${rotuloTipo(tipo, "pt")}): falta dia aceito pela validação física numa das janelas, e a média não é calculada com dia ausente.`,
      `${cap(periodo)}, the load ${quem} has no comparison (${rotuloTipo(tipo, "en")}): a day accepted by physical validation is missing in one of the windows, and the average is not calculated with a missing day.`,
      idioma,
    );
  }
  const n0 = (v: number | null | undefined) => num(v, 0, idioma);
  const base = tx(`${cap(periodo)}, a carga ${quem} teve média de ${n0(n.media)} MWmed`, `${cap(periodo)}, the load ${quem} averaged ${n0(n.media)} MWavg`, idioma);
  const ant = tx(`${n0(n.media_ant)} MWmed, de ${d(n.inicio_ant)} a ${d(n.fim_ant)}`, `${n0(n.media_ant)} MWavg, from ${d(n.inicio_ant)} to ${d(n.fim_ant)}`, idioma);
  if (n.variacao_pct === null) {
    return tx(
      `${base}. A janela de comparação (${ant}) está em outro regime metodológico do ONS, e por isso a diferença não é publicada como variação.`,
      `${base}. The comparison window (${ant}) is in another ONS methodological regime, so the difference is not published as a change.`,
      idioma,
    );
  }
  const ref =
    tipo === "equivalente"
      ? tx("a dos mesmos dias da semana 52 semanas antes", "that of the same days of the week 52 weeks earlier", idioma)
      : tx("a das mesmas datas do ano anterior", "that of the same dates of the previous year", idioma);
  // duas casas, a precisão publicada na gold: arredondar de novo para uma casa um valor já arredondado
  // para duas pode divergir do valor completo (11,4498 vira 11,45 e depois 11,5, quando o certo é 11,4)
  return tx(
    `${base}, variação de ${sinal(n.variacao_pct, 2, "", idioma)}% sobre ${ref} (${ant}). ${textoCalendarioJanela(j, tipo, idioma)}`,
    `${base}, a change of ${sinal(n.variacao_pct, 2, "", idioma)}% over ${ref} (${ant}). ${textoCalendarioJanela(j, tipo, idioma)}`,
    idioma,
  );
}

/**
 * Veredito do P025 em palavras simples: a média da janela escolhida, a variação sobre a comparação e se as duas janelas têm a
 * mesma composição de calendário. Os dois períodos, a média da comparação e a composição de dias ficam em respostaNivel.
 */
export function vereditoNivel(p: Pick<P025, "comparacoes">, sm: Regiao, janela: JanelaId, tipo: TipoComparacao, idioma: Idioma = idiomaEnergia()): string {
  const j = p.comparacoes.janelas.find((x) => x.id === janela);
  const quem = doRegiao(sm, idioma);
  if (!j) return tx(`A gold desta publicação não traz a janela pedida para a carga ${quem}.`, `This release's gold file does not include the requested window for the load ${quem}.`, idioma);
  const rot = rotuloComDias(j, idioma);
  // o rótulo português decide se a janela já diz até quando vai ("mês corrente até o último dia")
  const jaDizFim = /até/.test(j.rotulo);
  const periodo = jaDizFim ? `${cap(rot)}` : tx(`${cap(rot)}, até ${dataBR(j.fim, "pt")}`, `${cap(rot)}, through ${dataBR(j.fim, "en")}`, idioma);
  const n = p.comparacoes.subsistemas.find((x) => x.sm === sm)?.janelas[janela]?.[tipo] ?? null;
  if (!n)
    return tx(
      `${periodo}, a carga ${quem} não tem comparação: falta dia aceito pela validação física numa das janelas.`,
      `${periodo}, the load ${quem} has no comparison: a day accepted by physical validation is missing in one of the windows.`,
      idioma,
    );
  const base = tx(`${periodo}, a carga ${quem} teve média de ${num(n.media, 0)} MWmed`, `${periodo}, the load ${quem} averaged ${num(n.media, 0, "en")} MWavg`, idioma);
  if (n.variacao_pct === null)
    return tx(
      `${base}. A comparação está em outro regime de medição do ONS, e por isso a diferença não é publicada como variação.`,
      `${base}. The comparison is in another ONS measurement regime, so the difference is not published as a change.`,
      idioma,
    );
  const ref =
    tipo === "equivalente"
      ? tx("dos mesmos dias da semana 52 semanas antes", "of the same days of the week 52 weeks earlier", idioma)
      : tx("das mesmas datas do ano anterior", "of the same dates of the previous year", idioma);
  const rumo =
    Number(n.variacao_pct.toFixed(2)) === 0
      ? tx("igual à média", "equal to the average", idioma)
      : tx(
          `${num(Math.abs(n.variacao_pct), 2)}% ${n.variacao_pct > 0 ? "acima" : "abaixo"} da média`,
          `${num(Math.abs(n.variacao_pct), 2, "en")}% ${n.variacao_pct > 0 ? "above" : "below"} the average`,
          idioma,
        );
  const cal = calendarioEquivalente(j, tipo)
    ? tx("As duas janelas têm a mesma composição de calendário.", "Both windows have the same calendar composition.", idioma)
    : tx("As duas janelas não têm a mesma composição de calendário.", "The two windows do not have the same calendar composition.", idioma);
  return `${base}, ${rumo} ${ref}. ${cal}`;
}

/**
 * Janelas do seletor que cobrem exatamente os mesmos dias (por exemplo, os últimos 28 dias e o mês corrente quando o mês tem
 * 28 dias): a frase diz que são a mesma janela e por isso têm a mesma média. Vazia quando todas as janelas são distintas.
 */
export function textoJanelasIguais(janelas: readonly JanelaComparacao[], idioma: Idioma = idiomaEnergia()): string {
  const grupos = new Map<string, JanelaComparacao[]>();
  for (const j of janelas) grupos.set(`${j.inicio}|${j.fim}`, [...(grupos.get(`${j.inicio}|${j.fim}`) ?? []), j]);
  const iguais = Array.from(grupos.values()).filter((g) => g.length > 1);
  if (!iguais.length) return "";
  return iguais
    .map((g) => {
      const nomes = listaTexto(
        g.map((j) => `“${rotuloJanela(j.rotulo, idioma)}”`),
        idioma,
      );
      return tx(
        `${nomes} cobrem os mesmos dias (${dataBR(g[0].inicio)} a ${dataBR(g[0].fim)}): são a mesma janela e têm a mesma média.`,
        `${nomes} cover the same days (${dataBR(g[0].inicio, "en")} to ${dataBR(g[0].fim, "en")}): they are the same window and have the same average.`,
        idioma,
      );
    })
    .join(" ");
}

/** Resposta do acumulado do ano, com a composição de calendário das duas janelas. */
export function respostaAcumulado(a: AcumuladoAno, sm: Regiao, idioma: Idioma = idiomaEnergia()): string {
  const s = a.sm[sm];
  const quem = doRegiao(sm, idioma);
  const d = (x: string) => dataBR(x, idioma);
  if (!s)
    return tx(
      `Sem acumulado do ano para a carga ${quem}: falta dia aceito pela validação física de ${d(a.inicio)} a ${d(a.fim)} ou na janela de comparação.`,
      `No year-to-date figure for the load ${quem}: a day accepted by physical validation is missing from ${d(a.inicio)} to ${d(a.fim)} or in the comparison window.`,
      idioma,
    );
  const base = tx(
    `No acumulado de ${d(a.inicio)} a ${d(a.fim)}, a carga ${quem} teve média de ${num(s.media, 0)} MWmed`,
    `Year to date, from ${d(a.inicio)} to ${d(a.fim)}, the load ${quem} averaged ${num(s.media, 0, "en")} MWavg`,
    idioma,
  );
  const ant = tx(
    `${num(s.media_ant, 0)} MWmed de ${d(a.inicio_ant)} a ${d(a.fim_ant)}, mesmos dias da semana`,
    `${num(s.media_ant, 0, "en")} MWavg from ${d(a.inicio_ant)} to ${d(a.fim_ant)}, same days of the week`,
    idioma,
  );
  if (s.variacao_pct === null)
    return tx(
      `${base}; a janela de comparação (${ant}) está em outro regime do ONS, sem variação publicada.`,
      `${base}; the comparison window (${ant}) is in another ONS regime, with no published change.`,
      idioma,
    );
  const v = sinal(s.variacao_pct, 2, "", idioma);
  if (a.calendario_equivalente)
    return tx(
      `${base}, variação de ${v}% sobre ${ant}, com a mesma composição de calendário (${textoClasses(a.classes, "pt")}).`,
      `${base}, a change of ${v}% over ${ant}, with the same calendar composition (${textoClasses(a.classes, "en")}).`,
      idioma,
    );
  const feriados = (xs: string[]) => (xs.length ? listaTexto(xs.map((x) => d(x)), idioma) : tx("nenhum", "none", idioma));
  return tx(
    `${base}, variação de ${v}% sobre ${ant}, mas o calendário não é equivalente: ` +
      `${plural(a.classes.util, "dia útil", "dias úteis")} contra ${a.classes_ant.util}; feriados em dia útil: ${feriados(a.feriados_dia_util)} nesta janela e ${feriados(a.feriados_dia_util_ant)} na de comparação.`,
    `${base}, a change of ${v}% over ${ant}, but the calendar is not equivalent: ` +
      `${plural(a.classes.util, "working day", "working days", "en")} against ${a.classes_ant.util}; holidays on working days: ${feriados(a.feriados_dia_util)} in this window and ${feriados(a.feriados_dia_util_ant)} in the comparison window.`,
    idioma,
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

export function linhasAcumulado(a: AcumuladoAno, idioma: Idioma = idiomaEnergia()): LinhaAcumulado[] {
  return REGIOES.map((sm) => {
    const s = a.sm[sm];
    return { id: sm, regiao: nomeRegiao(sm, idioma), media: s?.media ?? null, media_ant: s?.media_ant ?? null, variacao_pct: s?.variacao_pct ?? null, mesmo_regime: s ? s.mesmo_regime : null };
  });
}

/**
 * O que a série mensal faz com o mês corrente: a gold publica só meses completos, então o mês
 * em curso fica de fora e aparece na janela "mês corrente"; se um dia a gold trouxer o mês
 * parcial, o texto diz que ele compara os mesmos dias.
 */
export function textoMesCorrente(mensal: readonly { m: string }[], janelas: readonly JanelaComparacao[], idioma: Idioma = idiomaEnergia()): string {
  const ult = mensal[mensal.length - 1]?.m;
  if (!ult) return tx("Sem série mensal nesta publicação.", "No monthly series in this release.", idioma);
  const mc = janelas.find((j) => j.id === "mes_corrente");
  const ma = (m: string) => mesAno(m, idioma);
  const d = (x: string) => dataBR(x, idioma);
  if (mc && mc.inicio.slice(0, 7) === ult)
    return tx(
      `O último mês (${ma(ult)}) é parcial, até ${d(mc.fim)}, e compara os mesmos dias do mês do ano anterior.`,
      `The last month (${ma(ult)}) is partial, through ${d(mc.fim)}, and compares the same days of the month in the previous year.`,
      idioma,
    );
  if (mc && mc.inicio.slice(0, 7) > ult) {
    return tx(
      `A série mensal termina no último mês completo (${ma(ult)}); o mês corrente, parcial (${d(mc.inicio)} a ${d(mc.fim)}), está na janela “${mc.rotulo}” do seletor acima.`,
      `The monthly series ends in the last complete month (${ma(ult)}); the current month, partial (${d(mc.inicio)} to ${d(mc.fim)}), is in the “${rotuloJanela(mc.rotulo, "en")}” window of the selector above.`,
      idioma,
    );
  }
  return tx(`A série mensal termina em ${ma(ult)}.`, `The monthly series ends in ${ma(ult)}.`, idioma);
}

/** Linhas mensais (36 meses): as mesmas do gráfico de variação e da tabela. */
export type LinhaMensal = CargaMensal & { id: string; mes: string };
export function linhasMensal(p: Pick<P025, "mensal">, idioma: Idioma = idiomaEnergia()): LinhaMensal[] {
  return p.mensal.map((m) => ({ ...m, id: m.m, mes: mesAno(m.m, idioma) }));
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
export function linhasAnual(p: Pick<P025, "anual">, idioma: Idioma = idiomaEnergia()): LinhaAnual[] {
  return p.anual.map((a) => {
    const linha = {
      id: String(a.ano),
      ano: String(a.ano),
      rotulo: a.completo ? String(a.ano) : tx(`${a.ano} (${a.dias} dias)`, `${a.ano} (${a.dias} days)`, idioma),
      dias: a.dias,
      completo: a.completo,
      regimes: a.regimes.join(tx(" e ", " and ", idioma)),
    } as LinhaAnual;
    for (const sm of REGIOES) {
      linha[sm] = a[sm];
      linha[`var_${sm}`] = a.variacao_pct?.[sm] ?? null;
    }
    return linha;
  });
}

/**
 * Ponto da série diária de uma região com as duas referências, cada uma procurada pela data (nunca pela posição):
 * `ref364` é o mesmo dia da semana 364 dias antes; `refDatas` é a mesma data do ano anterior (null em 29 de fevereiro,
 * que não tem par).
 */
export type PontoReferencia = { d: string; atual: number | null; ref364: number | null; refDatas: number | null };

export function deslocaDias(iso: string, dias: number): string {
  const t = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Mesma data do ano anterior ("2026-09-22" vira "2025-09-22"); null para 29 de fevereiro, que não existe no ano anterior. */
export function mesmaDataAnoAnterior(iso: string): string | null {
  const md = iso.slice(5, 10);
  if (md === "02-29") return null;
  return `${Number(iso.slice(0, 4)) - 1}-${md}`;
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

/**
 * Série da região com os dois valores de referência, procurados pela data (nunca pela posição): o mesmo dia da semana 364 dias antes
 * (`ref364`, base "mesmos dias da semana") e a mesma data do ano anterior (`refDatas`, base "mesmas datas"). O gráfico mostra a
 * referência da base que o leitor escolheu.
 */
export function serieComReferencia(serie: SerieColunar, sm: Regiao): PontoReferencia[] {
  const valores = serie[sm] ?? [];
  const porDia = new Map(serie.d.map((d, i) => [d, valores[i] ?? null]));
  return serie.d.map((d, i) => {
    const datas = mesmaDataAnoAnterior(d);
    return { d, atual: valores[i] ?? null, ref364: porDia.get(deslocaDias(d, -364)) ?? null, refDatas: datas ? (porDia.get(datas) ?? null) : null };
  });
}

/** Mudanças de regime dentro do período mostrado, como marcos do gráfico. */
export function marcosRegimes(
  regimes: (Regime & { observado_nos_dados?: string })[],
  inicio: string,
  fim: string,
  formato: "dia" | "mes" = "dia", // i18n: dado
  idioma: Idioma = idiomaEnergia(),
): { x: string; rotulo: string }[] {
  const out: { x: string; rotulo: string }[] = [];
  for (const r of regimes.slice(1)) {
    const x = formato === "mes" ? r.inicio.slice(0, 7) : r.inicio;
    if (x < inicio.slice(0, x.length) || x > fim.slice(0, x.length)) continue;
    out.push({ x, rotulo: tx(`${dataBR(r.inicio, "pt")}: mudança de regime do ONS`, `${dataBR(r.inicio, "en")}: ONS regime change`, idioma) });
    if (r.observado_nos_dados && r.observado_nos_dados !== r.inicio) {
      const xo = formato === "mes" ? r.observado_nos_dados.slice(0, 7) : r.observado_nos_dados;
      if (xo !== x) out.push({ x: xo, rotulo: tx(`${dataBR(r.observado_nos_dados, "pt")}: observado nos dados`, `${dataBR(r.observado_nos_dados, "en")}: observed in the data`, idioma) });
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
export function datasRegime(r: RegimeGold, idioma: Idioma = idiomaEnergia()): string {
  return r.observado_nos_dados && r.observado_nos_dados !== r.inicio
    ? tx(
        `declarada para ${dataBR(r.inicio, "pt")}, observada nos dados em ${dataBR(r.observado_nos_dados, "pt")}`,
        `declared for ${dataBR(r.inicio, "en")}, observed in the data on ${dataBR(r.observado_nos_dados, "en")}`,
        idioma,
      )
    : tx(`a partir de ${dataBR(r.inicio, "pt")}`, `from ${dataBR(r.inicio, "en")}`, idioma);
}

/** Inclusão da MMGD na carga, entre parênteses, com as datas da gold ("" se a gold não traz o regime). */
export function parentesesMmgd(regimes: readonly RegimeGold[], idioma: Idioma = idiomaEnergia()): string {
  const r = regimeCom(regimes, /MMGD/);
  return r ? ` (${datasRegime(r, idioma)})` : "";
}

/** Aviso do histórico mensal: o que a série deixa de incluir antes de cada mudança de regime publicada. */
export function textoAvisoRegimes(regimes: readonly RegimeGold[], idioma: Idioma = idiomaEnergia()): string {
  const desp = regimeCom(regimes, /não despachadas/);
  const mmgd = regimeCom(regimes, /MMGD/);
  const partes: string[] = [];
  if (desp)
    partes.push(
      tx(`antes de ${dataBR(desp.inicio, "pt")} a série não inclui a previsão de usinas não despachadas`, `before ${dataBR(desp.inicio, "en")} the series does not include the forecast of non-dispatched plants`, idioma),
    );
  if (mmgd)
    partes.push(
      tx(`antes da inclusão da MMGD (${datasRegime(mmgd, "pt")}) não inclui a MMGD estimada`, `before MMGD was included (${datasRegime(mmgd, "en")}) it does not include the estimated MMGD`, idioma),
    );
  if (!partes.length)
    return tx(
      "A série muda de conteúdo em cada mudança de regime do ONS: o salto depois de cada marca não é, por si, aumento de consumo.",
      "The series changes content at each ONS regime change: the jump after each mark is not, in itself, an increase in consumption.",
      idioma,
    );
  return tx(
    `${cap(listaTexto(partes, "pt"))}: o salto depois de cada marca não é, por si, aumento de consumo.`,
    `${cap(listaTexto(partes, "en"))}: the jump after each mark is not, in itself, an increase in consumption.`,
    idioma,
  );
}

/** O que o ONS passou a incluir na carga e desde quando, lido dos regimes da gold (para o texto de abertura da página). */
export function textoRegimesCarga(regimes: readonly RegimeGold[], idioma: Idioma = idiomaEnergia()): string {
  const desp = regimeCom(regimes, /não despachadas/);
  const mmgd = regimeCom(regimes, /MMGD/);
  const partes: string[] = [];
  if (desp) partes.push(tx(`a previsão de usinas não despachadas, desde ${dataBR(desp.inicio, "pt")}`, `the forecast of non-dispatched plants, since ${dataBR(desp.inicio, "en")}`, idioma));
  if (mmgd) partes.push(tx(`a estimativa de MMGD, ${datasRegime(mmgd, "pt")}`, `the MMGD estimate, ${datasRegime(mmgd, "en")}`, idioma));
  if (!partes.length) return tx("o que o ONS inclui na carga mudou ao longo da série", "what ONS includes in the load changed over the series", idioma);
  return tx(`o ONS passou a incluir na carga ${partes.join("; ")}`, `ONS started to include in the load ${partes.join("; ")}`, idioma);
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
function acrescimoRegime(r: RegimeGold, idioma: Idioma): string {
  const pt = r.descricao.split(". ")[0].replace(/\.$/, "").replace(/^Inclui (também )?/, ""); // i18n: dado (texto da gold)
  return rotuloDaGold(ACRESCIMO_REGIME_EN, pt, idioma);
}

/**
 * Aviso de comparação de perfis da curva entre meses de regimes diferentes do ONS (a curva mudou de
 * conteúdo em cada regime), com o que entrou e quando, lidos da gold. null quando todos os meses
 * estão no mesmo regime.
 */
export function textoQuebraCurva(regimes: readonly RegimeGold[], meses: readonly string[], idioma: Idioma = idiomaEnergia()): string | null {
  if (meses.length < 2) return null;
  const idx = meses.map((m) => regimeDoMes(regimes, m));
  if (idx.every((i) => i !== null && i === idx[0])) return null;
  const a = meses.reduce((x, y) => (y < x ? y : x));
  const b = meses.reduce((x, y) => (y > x ? y : x));
  const mudancas = regimes
    .slice(1)
    .filter((r) => r.inicio.slice(0, 7) > a && r.inicio.slice(0, 7) <= b)
    .map((r) => `${acrescimoRegime(r, idioma)} (${datasRegime(r, idioma)})`);
  return tx(
    `A curva de carga mudou de conteúdo entre os meses escolhidos${mudancas.length ? `: passou a incluir ${listaTexto(mudancas, "pt")}` : ""}. ` +
      "A diferença entre as curvas mistura mudança de medida e de consumo. Na carga verificada a definição é a mesma em todos os anos.",
    `The load curve changed content between the chosen months${mudancas.length ? `: it started to include ${listaTexto(mudancas, "en")}` : ""}. ` +
      "The difference between the curves mixes a change of measurement and of consumption. In the verified load the definition is the same in every year.",
    idioma,
  );
}

/* ---------- diferença entre a carga global da API e a curva, por hora ---------- */

export type DiferencaHora = { hora: number; horas: number; diferenca_mwmed: number | null; diferenca_pct: number | null };

/**
 * Onde a carga global da API fica mais longe da curva, nas mesmas horas: a menor e a maior
 * diferença por hora do dia, lidas da gold (nada de "mais à noite" escrito à mão).
 */
export function textoDiferencaHoraria(porHora: readonly DiferencaHora[], idioma: Idioma = idiomaEnergia()): string | null {
  const v = porHora.filter((x): x is DiferencaHora & { diferenca_pct: number } => x.diferenca_pct !== null && x.horas > 0);
  if (!v.length) return null;
  const max = v.reduce((a, b) => (b.diferenca_pct > a.diferenca_pct ? b : a));
  const min = v.reduce((a, b) => (b.diferenca_pct < a.diferenca_pct ? b : a));
  const dias = Math.max(...v.map((x) => x.horas));
  const quadro = v.every((x) => x.diferenca_pct > 0)
    ? tx("a carga global ficou acima da curva em todas as horas do dia", "the global load was above the curve in every hour of the day", idioma)
    : v.every((x) => x.diferenca_pct < 0)
      ? tx("a carga global ficou abaixo da curva em todas as horas do dia", "the global load was below the curve in every hour of the day", idioma)
      : tx("a diferença entre a carga global e a curva muda de sinal ao longo do dia", "the difference between the global load and the curve changes sign over the day", idioma);
  return tx(
    `${dias === 1 ? "no último dia" : `nos últimos ${num(dias, 0)} dias`} do SIN, ${quadro}, de ${sinal(min.diferenca_pct, 2)}% na hora das ${rotuloHora(min.hora, "pt")} ` +
      `a ${sinal(max.diferenca_pct, 2)}% na hora das ${rotuloHora(max.hora, "pt")}`,
    `${dias === 1 ? "on the last day" : `over the last ${num(dias, 0, "en")} days`} of the SIN, ${quadro}, from ${sinal(min.diferenca_pct, 2, "", "en")}% in the hour starting at ${rotuloHora(min.hora, "en")} ` +
      `to ${sinal(max.diferenca_pct, 2, "", "en")}% in the hour starting at ${rotuloHora(max.hora, "en")}`,
    idioma,
  );
}

/** Resumo das revisões entre capturas, com a magnitude (seção 11.6: magnitude e alcance, não só contagem). */
export function textoRevisoes(r: P025["revisoes"], idioma: Idioma = idiomaEnergia()): string {
  if (!r.total)
    return tx(
      `Nenhum valor revisado entre as ${plural(r.capturas_diaria.length, "captura", "capturas")} da carga diária guardadas.`,
      `No value revised between the ${plural(r.capturas_diaria.length, "stored capture", "stored captures", "en")} of the daily load.`,
      idioma,
    );
  const mag =
    r.mediana_abs_pct === null || r.max_abs_pct === null
      ? tx("sem valor anterior positivo para medir a magnitude", "with no positive previous value to measure the magnitude", idioma)
      : tx(
          `nas ${plural(r.revisoes_com_percentual, "revisão", "revisões")} com valor anterior positivo, mediana de ${num(r.mediana_abs_pct, 4)}% e máximo de ${num(r.max_abs_pct, 2)}% em módulo`,
          `in the ${plural(r.revisoes_com_percentual, "revision", "revisions", "en")} with a positive previous value, a median of ${num(r.mediana_abs_pct, 4, "en")}% and a maximum of ${num(r.max_abs_pct, 2, "en")}% in absolute value`,
          idioma,
        );
  const corr = r.linhas.filter((l) => l.situacao === "correcao_de_valor_fora_do_dominio").length;
  return tx(
    `Entre ${plural(r.capturas_diaria.length, "captura", "capturas")} da carga diária, ${plural(r.total, "valor foi revisado", "valores foram revisados")} em ${plural(r.dias_revisados, "dia", "dias")}: ${mag}` +
      (corr ? `; ${plural(corr, "correção", "correções")} de valor fora do domínio (não positivo) fica à parte.` : "."),
    `Across ${plural(r.capturas_diaria.length, "capture", "captures", "en")} of the daily load, ${plural(r.total, "value was revised", "values were revised", "en")} on ${plural(r.dias_revisados, "day", "days", "en")}: ${mag}` +
      (corr ? `; ${plural(corr, "correction", "corrections", "en")} of an out-of-domain value (not positive) ${corr === 1 ? "is" : "are"} kept apart.` : "."),
    idioma,
  );
}

/** Situação de atualidade: a fonte publica todo dia; mais de `folgaDias` entre o dado e o processamento é defasagem. */
export function situacaoAtualidade(diaReferencia: string, geradoEm: string, folgaDias = 3, idioma: Idioma = idiomaEnergia()): { defasada: boolean; dias: number; texto: string } {
  const proc = diaBrasilia(geradoEm) ?? geradoEm.slice(0, 10);
  const dias = Math.round((Date.parse(`${proc}T00:00:00Z`) - Date.parse(`${diaReferencia}T00:00:00Z`)) / 86_400_000);
  const d = (x: string) => dataBR(x, idioma);
  const nDias = plural(dias, tx("dia", "day", idioma), tx("dias", "days", idioma), idioma);
  if (dias > folgaDias) {
    return {
      defasada: true,
      dias,
      texto: tx(
        `Fonte defasada: o dia mais recente é ${d(diaReferencia)}, ${nDias} antes do processamento (${d(proc)}), mais que a atualização diária declarada pelo ONS. Os números são os da última publicação válida.`,
        `Source behind schedule: the latest day is ${d(diaReferencia)}, ${nDias} before processing (${d(proc)}), more than the daily update declared by ONS. The figures are those of the last valid release.`,
        idioma,
      ),
    };
  }
  return {
    defasada: false,
    dias,
    texto: tx(
      `Dado até ${d(diaReferencia)}, processado em ${d(proc)} (${nDias} depois; o ONS publica a carga do dia anterior).`,
      `Data through ${d(diaReferencia)}, processed on ${d(proc)} (${nDias} later; ONS publishes the previous day's load).`,
      idioma,
    ),
  };
}

/* ---------- P026: MMGD e perfil horário ---------- */

/** Mês mais recente com todos os dias na API, para a região. */
export function ultimoMesCompletoMmgd(p: Pick<P026, "mmgd_mensal">, sm: Regiao) {
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

/**
 * Hora em que o pico do dia caiu mais vezes no último ano publicado: na curva de carga da região e, só para o SIN, na carga líquida de
 * MMGD da carga verificada. São as mesmas contagens do mapa de calor e da resposta do painel; a hora é a de início (empate: a primeira).
 */
export function picoModalDoAno(
  p: Pick<P026, "hora_pico_por_ano" | "hora_pico_api_sin_por_ano">,
  sm: Regiao,
): { ano: number; dias: number; curva: { hora: number; dias: number }; liquida: { hora: number; dias: number } | null } | null {
  const anos = p.hora_pico_por_ano[sm] ?? [];
  const ult = anos.length ? anos[anos.length - 1] : null;
  const moda = ult ? horaModal(ult.contagem) : null;
  if (!ult || !moda) return null;
  const api = sm === "SIN" ? p.hora_pico_api_sin_por_ano.find((x) => x.ano === ult.ano) : undefined;
  const ml = api ? horaModal(api.contagem_liquida) : null;
  return { ano: ult.ano, dias: ult.dias, curva: moda, liquida: ml };
}

/** "1 dia", "5 dias" ("1 day", "5 days"). */
const nDias = (n: number, idioma: Idioma) => plural(n, tx("dia", "day", idioma), tx("dias", "days", idioma), idioma);

/** "região do Sul" sem a contração: "Sul" ("the South"). */
const semDo = (sm: Regiao, idioma: Idioma) => (idioma === "en" ? `the ${nomeRegiao(sm, "en")}` : DO_REGIAO[sm].replace(/^do /, ""));

/** Resposta curta do P026 para a região escolhida. */
export function respostaPerfil(p: P026, sm: Regiao, idioma: Idioma = idiomaEnergia()): string {
  const quem = doRegiao(sm, idioma);
  const partes: string[] = [];
  const m = ultimoMesCompletoMmgd(p, sm);
  const n0 = (v: number | null | undefined) => num(v, 0, idioma);
  partes.push(
    m
      ? tx(
          `Em ${mesAno(m.m)}, a MMGD estimada pelo ONS foi ${num(m.mmgd_pct, 2)}% da carga global ${quem} na carga verificada (${num(m.mmgd, 0)} de ${num(m.global, 0)} MWmed, média do mês).`,
          `In ${mesAno(m.m, "en")}, the MMGD estimated by ONS was ${num(m.mmgd_pct, 2, "en")}% of the global load ${quem} in the verified load (${n0(m.mmgd)} of ${n0(m.global)} MWavg, monthly average).`,
          idioma,
        )
      : tx(`A carga verificada não tem mês completo com MMGD para a região ${semDo(sm, "pt")}.`, `The verified load has no complete month with MMGD for ${semDo(sm, "en")}.`, idioma),
  );
  const anos = p.hora_pico_por_ano[sm] ?? [];
  const ult = anos.length ? anos[anos.length - 1] : null;
  const moda = ult ? horaModal(ult.contagem) : null;
  if (ult && moda) {
    const parcial =
      ult.dias < diasNoAno(ult.ano)
        ? tx(`, ${nDias(ult.dias, "pt")} até ${dataBR(p.ultimo_dia_curva, "pt")}`, `, ${nDias(ult.dias, "en")} through ${dataBR(p.ultimo_dia_curva, "en")}`, idioma)
        : "";
    let pico = tx(
      `Em ${ult.ano}${parcial}, o pico diário da curva de carga ${quem} caiu mais vezes na hora que começa às ${rotuloHora(moda.hora, "pt")} (${nDias(moda.dias, "pt")})`,
      `In ${ult.ano}${parcial}, the daily peak of the load curve ${quem} fell most often in the hour starting at ${rotuloHora(moda.hora, "en")} (${nDias(moda.dias, "en")})`,
      idioma,
    );
    if (sm === "SIN") {
      const api = p.hora_pico_api_sin_por_ano.find((x) => x.ano === ult.ano);
      const ml = api ? horaModal(api.contagem_liquida) : null;
      if (ml)
        pico += tx(
          `; o da carga líquida de MMGD, às ${rotuloHora(ml.hora, "pt")} (${nDias(ml.dias, "pt")})`,
          `; that of the load net of MMGD, at ${rotuloHora(ml.hora, "en")} (${nDias(ml.dias, "en")})`,
          idioma,
        );
    }
    partes.push(`${pico}.`);
  }
  const rec = p.recordes_anuais.filter((r) => r.sm === sm).reduce<P026["recordes_anuais"][number] | null>((a, b) => (!a || b.ano > a.ano ? b : a), null);
  if (rec)
    partes.push(
      tx(
        `O maior valor horário de ${rec.ano} foi ${num(rec.pico, 0)} MWmed, em ${dataBR(rec.dia)} às ${rotuloHora(rec.hora, "pt")}.`,
        `The highest hourly value of ${rec.ano} was ${n0(rec.pico)} MWavg, on ${dataBR(rec.dia, "en")} at ${rotuloHora(rec.hora, "en")}.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

/** "entre 18h e 19h": a hora cheia de início e a seguinte, para a hora do pico (a fonte diz a hora de início). */
export function entreHoras(h: number, idioma: Idioma = idiomaEnergia()): string {
  return tx(`entre ${rotuloHora(h, "pt")} e ${rotuloHora((h + 1) % 24, "pt")}`, `between ${rotuloHora(h, "en")} and ${rotuloHora((h + 1) % 24, "en")}`, idioma);
}

/**
 * Veredito do P026 em palavras simples: que parcela da carga global a MMGD estimada representa no último mês completo e em
 * que hora o pico do dia caiu mais vezes no ano. Os dias de cada hora, a carga em MWmed e o maior valor horário ficam em
 * respostaPerfil.
 */
export function vereditoPerfil(p: P026, sm: Regiao, idioma: Idioma = idiomaEnergia()): string {
  const quem = doRegiao(sm, idioma);
  const partes: string[] = [];
  const m = ultimoMesCompletoMmgd(p, sm);
  partes.push(
    m
      ? tx(
          `Em ${mesAno(m.m)}, a MMGD, estimada pelo ONS e não medida, foi ${num(m.mmgd_pct, 2)}% da carga global ${quem}.`,
          `In ${mesAno(m.m, "en")}, the MMGD, estimated by ONS and not measured, was ${num(m.mmgd_pct, 2, "en")}% of the global load ${quem}.`,
          idioma,
        )
      : tx(`A carga verificada não tem mês completo com MMGD para a região ${semDo(sm, "pt")}.`, `The verified load has no complete month with MMGD for ${semDo(sm, "en")}.`, idioma),
  );
  const anos = p.hora_pico_por_ano[sm] ?? [];
  const ult = anos.length ? anos[anos.length - 1] : null;
  const moda = ult ? horaModal(ult.contagem) : null;
  if (ult && moda) {
    const base = tx(`Em ${ult.ano}, o pico do dia caiu mais vezes ${entreHoras(moda.hora, "pt")}`, `In ${ult.ano}, the daily peak fell most often ${entreHoras(moda.hora, "en")}`, idioma);
    const api = sm === "SIN" && ult ? p.hora_pico_api_sin_por_ano.find((x) => x.ano === ult.ano) : undefined;
    const ml = api ? horaModal(api.contagem_liquida) : null;
    if (!ml) partes.push(tx(`${base} na curva de carga ${quem}.`, `${base} in the load curve ${quem}.`, idioma));
    else if (ml.hora === moda.hora) partes.push(tx(`${base}, na curva de carga e na carga líquida de MMGD.`, `${base}, in the load curve and in the load net of MMGD.`, idioma));
    else
      partes.push(
        tx(
          `${base} na curva de carga e ${entreHoras(ml.hora, "pt")} na carga líquida de MMGD.`,
          `${base} in the load curve and ${entreHoras(ml.hora, "en")} in the load net of MMGD.`,
          idioma,
        ),
      );
  }
  return partes.join(" ");
}

/** Situação das duas fontes horárias: a curva e a API podem terminar em dias diferentes. */
export function textoAtualidadeHoraria(p: P026, idioma: Idioma = idiomaEnergia()): string {
  const d = (x: string) => dataBR(x, idioma);
  if (p.ultimo_dia_curva === p.ultimo_dia_api)
    return tx(`A curva de carga e a carga verificada vão até ${d(p.ultimo_dia_curva)}.`, `The load curve and the verified load run through ${d(p.ultimo_dia_curva)}.`, idioma);
  return tx(
    `A curva de carga vai até ${d(p.ultimo_dia_curva)} e a carga verificada até ${d(p.ultimo_dia_api)}: cada gráfico mostra a própria fonte até o seu último dia, sem completar a outra.`,
    `The load curve runs through ${d(p.ultimo_dia_curva)} and the verified load through ${d(p.ultimo_dia_api)}: each chart shows its own source up to its last day, without filling in the other.`,
    idioma,
  );
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

export function linhasPerfil(perfil: PerfilTipico, idioma: Idioma = idiomaEnergia()): LinhaPerfil[] {
  return Array.from({ length: 24 }, (_, h) => ({
    id: String(h),
    hora: rotuloHora(h, idioma),
    carga: perfil.carga[h] ?? null,
    global: perfil.global[h] ?? null,
    mmgd: perfil.mmgd[h] ?? null,
    liquida: perfil.liquida[h] ?? null,
  }));
}

/** Frase do perfil escolhido: maior e menor hora da carga líquida e o pico da MMGD (só API). */
export function respostaPerfilTipico(perfil: PerfilTipico, idioma: Idioma = idiomaEnergia()): string {
  const ls = linhasPerfil(perfil, idioma);
  const quem = doRegiao(perfil.sm, idioma);
  const ext = (k: "liquida" | "mmgd" | "carga", maior: boolean) =>
    ls.reduce<LinhaPerfil | null>((a, b) => (b[k] === null ? a : !a || (maior ? b[k]! > a[k]! : b[k]! < a[k]!) ? b : a), null);
  const ma = mesAno(perfil.mes, idioma);
  const n0 = (v: number | null | undefined) => num(v, 0, idioma);
  const dias = tx(`${nDias(perfil.dias_api, "pt")} de ${rotuloClasse(perfil.classe, "pt")} em ${ma}`, `${nDias(perfil.dias_api, "en")} of ${rotuloClasse(perfil.classe, "en")} in ${ma}`, idioma);
  const lMax = ext("liquida", true);
  const lMin = ext("liquida", false);
  const mMax = ext("mmgd", true);
  if (!lMax || !lMin || !mMax) {
    const cMax = ext("carga", true);
    return cMax
      ? tx(
          `Na curva de carga ${quem} (${nDias(perfil.dias_curva, "pt")} de ${rotuloClasse(perfil.classe, "pt")} em ${ma}), a hora de maior carga média começa às ${cMax.hora} (${n0(cMax.carga)} MWmed). A carga verificada não tem dia completo neste recorte.`,
          `In the load curve ${quem} (${nDias(perfil.dias_curva, "en")} of ${rotuloClasse(perfil.classe, "en")} in ${ma}), the hour with the highest average load starts at ${cMax.hora} (${n0(cMax.carga)} MWavg). The verified load has no complete day in this selection.`,
          idioma,
        )
      : tx(`Sem perfil publicado para a carga ${quem} neste recorte.`, `No profile published for the load ${quem} in this selection.`, idioma);
  }
  return tx(
    `Na média de ${dias}, a carga líquida de MMGD ${quem} vai de ${n0(lMin.liquida)} MWmed (hora das ${lMin.hora}) a ${n0(lMax.liquida)} MWmed (hora das ${lMax.hora}); a MMGD estimada chega a ${n0(mMax.mmgd)} MWmed na hora das ${mMax.hora}.`,
    `On average over ${dias}, the load net of MMGD ${quem} ranges from ${n0(lMin.liquida)} MWavg (hour starting at ${lMin.hora}) to ${n0(lMax.liquida)} MWavg (hour starting at ${lMax.hora}); the estimated MMGD reaches ${n0(mMax.mmgd)} MWavg in the hour starting at ${mMax.hora}.`,
    idioma,
  );
}

/**
 * Veredito do dia típico escolhido: em que hora a MMGD estimada chega ao máximo e em que horas a carga líquida de MMGD tem o
 * menor e o maior valor. Os valores em MWmed ficam em respostaPerfilTipico.
 */
export function vereditoPerfilTipico(perfil: PerfilTipico, idioma: Idioma = idiomaEnergia()): string {
  const ls = linhasPerfil(perfil, idioma);
  const quem = doRegiao(perfil.sm, idioma);
  const ext = (k: "liquida" | "mmgd" | "carga", maior: boolean) =>
    ls.reduce<LinhaPerfil | null>((a, b) => (b[k] === null ? a : !a || (maior ? b[k]! > a[k]! : b[k]! < a[k]!) ? b : a), null);
  const dia = tx(`${rotuloClasse(perfil.classe, "pt")} médio de ${mesAno(perfil.mes, "pt")}`, `an average ${rotuloClasse(perfil.classe, "en")} of ${mesAno(perfil.mes, "en")}`, idioma);
  const lMax = ext("liquida", true);
  const lMin = ext("liquida", false);
  const mMax = ext("mmgd", true);
  const eh = (h: number) => entreHoras(h, idioma);
  if (!lMax || !lMin || !mMax) {
    const cMax = ext("carga", true);
    return cMax
      ? tx(
          `Num ${dia}, a curva de carga ${quem} é maior ${eh(Number(cMax.id))}. A carga verificada não tem dia completo neste recorte.`,
          `On ${dia}, the load curve ${quem} is highest ${eh(Number(cMax.id))}. The verified load has no complete day in this selection.`,
          idioma,
        )
      : tx(`Sem perfil publicado para a carga ${quem} neste recorte.`, `No profile published for the load ${quem} in this selection.`, idioma);
  }
  return tx(
    `Num ${dia}, a carga líquida de MMGD ${quem} é menor ${eh(Number(lMin.id))} e maior ${eh(Number(lMax.id))}; a MMGD estimada chega ao máximo ${eh(Number(mMax.id))}.`,
    `On ${dia}, the load net of MMGD ${quem} is lowest ${eh(Number(lMin.id))} and highest ${eh(Number(lMax.id))}; the estimated MMGD peaks ${eh(Number(mMax.id))}.`,
    idioma,
  );
}

/**
 * Texto da fonte sem os parênteses que classificam a geração em tipos (I, IIA, IIB, IIC, III): o leitor lê a parcela, e as
 * classes da fonte ficam à parte, para o modo Analisar.
 */
export function semTiposDeGeracao(texto: string): { texto: string; tipos: string[] } {
  const tipos = Array.from(texto.matchAll(/\s*\((geração tipo[^)]*)\)/g)).map((m) => m[1]);
  return { texto: texto.replace(/\s*\(geração tipo[^)]*\)/g, ""), tipos };
}

/** "MMGD (val_cargammgd)": o nome da série para o leitor e o campo da fonte, separados. */
export function separaCampoDaSerie(rotulo: string): { nome: string; campo: string | null } {
  const m = /^(.*?)\s*\(([a-z]+_[a-z_]+)\)$/.exec(rotulo);
  return m ? { nome: m[1], campo: m[2] } : { nome: rotulo, campo: null };
}

/**
 * A média do mês da carga global (carga verificada) ao lado da média do mesmo mês da Carga de Energia Diária, o produto que a
 * página Carga usa: são produtos diferentes do ONS, e os valores não coincidem. Só para o SIN; vazio sem o mês nos dois.
 */
export function textoGlobalContraDiaria(p: Pick<P026, "mmgd_mensal">, diaria: readonly { m: string; SIN?: number | null }[], idioma: Idioma = idiomaEnergia()): string {
  const m = ultimoMesCompletoMmgd(p, "SIN");
  const d = m ? diaria.find((x) => x.m === m.m) : undefined;
  if (!m || !d || d.SIN === null || d.SIN === undefined) return "";
  return tx(
    `Em ${mesAno(m.m)}, a carga global (carga verificada) teve média de ${num(m.global, 0)} MWmed e a Carga de Energia Diária, usada na página Carga, de ${num(d.SIN, 0)} MWmed. São produtos diferentes do ONS, com definições diferentes, e por isso os dois valores não coincidem.`,
    `In ${mesAno(m.m, "en")}, the global load (verified load) averaged ${num(m.global, 0, "en")} MWavg and the Carga de Energia Diária (daily energy load), used on the Load page, ${num(d.SIN, 0, "en")} MWavg. They are different ONS products, with different definitions, which is why the two values do not match.`,
    idioma,
  );
}

/** Desde quando existe a série mensal da MMGD de cada tipo de recorte (SIN e subsistemas), lido dos próprios meses publicados. */
export function textoInicioSeriesMmgd(p: Pick<P026, "mmgd_mensal">, idioma: Idioma = idiomaEnergia()): string {
  const primeiro = (f: (sm: Regiao) => boolean) => p.mmgd_mensal.filter((x) => f(x.sm)).map((x) => x.m).sort()[0];
  const sin = primeiro((sm) => sm === "SIN");
  const sub = primeiro((sm) => sm !== "SIN");
  if (!sin || !sub || sin === sub) return "";
  return tx(
    `A série mensal do SIN começa em ${mesAno(sin)}; a de cada subsistema publicada aqui, em ${mesAno(sub)}.`,
    `The monthly series of the SIN starts in ${mesAno(sin, "en")}; that of each subsystem published here, in ${mesAno(sub, "en")}.`,
    idioma,
  );
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
  idioma: Idioma = idiomaEnergia(),
): { anos: { id: string; rotulo: string; dias: number; regimes: number[] }[]; valores: number[][] } {
  const anos = (p.hora_pico_por_ano[sm] ?? []).filter((a) => desde === undefined || a.ano >= desde);
  return {
    anos: anos.map((a) => ({
      id: String(a.ano),
      rotulo: a.dias < diasNoAno(a.ano) ? tx(`${a.ano} (${a.dias} dias)`, `${a.ano} (${a.dias} days)`, idioma) : String(a.ano),
      dias: a.dias,
      regimes: a.regimes,
    })),
    valores: anos.map((a) => a.contagem.slice(0, 24)),
  };
}

export type LinhaHoraPicoApi = { id: string; hora: string; liquida: number | null; global: number | null };

/** Dias com pico em cada hora no ano, carga líquida e carga global da API (SIN); hora sem contagem publicada é ausência, não zero. */
export function linhasHoraPicoApi(p: P026, ano: number, idioma: Idioma = idiomaEnergia()): LinhaHoraPicoApi[] {
  const a = p.hora_pico_api_sin_por_ano.find((x) => x.ano === ano);
  if (!a) return [];
  return Array.from({ length: 24 }, (_, h) => ({ id: String(h), hora: rotuloHora(h, idioma), liquida: a.contagem_liquida[h] ?? null, global: a.contagem_global[h] ?? null }));
}

export type MedidaPerfil = "liquida" | "global" | "mmgd" | "carga";
export const MEDIDAS_PERFIL: readonly MedidaPerfil[] = ["liquida", "global", "mmgd", "carga"];
export function rotuloMedida(m: MedidaPerfil, idioma: Idioma = idiomaEnergia()): string {
  return {
    liquida: tx("Carga líquida de MMGD (carga verificada)", "Load net of MMGD (verified load)", idioma),
    global: tx("Carga global (carga verificada)", "Global load (verified load)", idioma),
    mmgd: tx("MMGD estimada (carga verificada)", "Estimated MMGD (verified load)", idioma),
    carga: tx("Carga da curva horária", "Hourly curve load", idioma),
  }[m];
}
export const ROTULO_MEDIDA: Record<MedidaPerfil, string> = {
  liquida: rotuloMedida("liquida", "pt"),
  global: rotuloMedida("global", "pt"),
  mmgd: rotuloMedida("mmgd", "pt"),
  carga: rotuloMedida("carga", "pt"),
};

/** "agosto" para "2026-08" ("August" em inglês). */
export function nomeMes(mes: string, idioma: Idioma = idiomaEnergia()): string {
  return nomeDoMes(Number(mes.slice(5, 7)), idioma, true) ?? mes;
}

/** Mês e tipo de dia do perfil comparado entre anos, lidos da gold ("dia útil", "agosto"); null sem perfil. */
export function recorteEvolucao(p: Pick<P026, "perfil_evolucao">, idioma: Idioma = idiomaEnergia()): { mes: string; classe: string; desde: string } | null {
  const pf = p.perfil_evolucao[0];
  return pf ? { mes: nomeMes(pf.mes, idioma), classe: rotuloClasse(pf.classe, idioma), desde: pf.mes.slice(0, 4) } : null;
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
export function linhasEvolucao(p: P026, anos: readonly string[], medida: MedidaPerfil, idioma: Idioma = idiomaEnergia()): ({ id: string; hora: string } & Record<string, number | null | string>)[] {
  const perfis = anos.map((a) => p.perfil_evolucao.find((x) => x.mes.startsWith(a))).filter((x): x is PerfilTipico => !!x);
  return Array.from({ length: 24 }, (_, h) => {
    const l: { id: string; hora: string } & Record<string, number | null | string> = { id: String(h), hora: rotuloHora(h, idioma) };
    for (const pf of perfis) l[pf.mes.slice(0, 4)] = pf[medida][h] ?? null;
    return l;
  });
}

export type LinhaA11 = { id: string; d: string; carga_menos_global: number | null; meio_dia_curva_menos_global: number | null; mmgd_meio_dia: number | null; solar_balanco: number | null };

/* ---------- P027: decomposição estatística ---------- */

type P027Pronto = NonNullable<P027>;

/** Resposta curta do P027 para a região escolhida, com a cobertura dos intervalos diante da nominal. */
export function respostaClima(p: Pick<P027Pronto, "metricas" | "periodo_avaliacao">, sm: Regiao, idioma: Idioma = idiomaEnergia()): string {
  const m: MetricasModelo | undefined = p.metricas[sm];
  const de = doRegiao(sm, idioma);
  if (!m) return tx(`Sem métricas fora da amostra para a carga ${de} nesta publicação.`, `No out-of-sample metrics for the load ${de} in this release.`, idioma);
  const per = p.periodo_avaliacao;
  const ref =
    m.mape_referencia_364d_pct === null
      ? ""
      : tx(
          `; a referência ingênua (o mesmo dia da semana 364 dias antes) errou ${num(m.mape_referencia_364d_pct, 2)}%`,
          `; the naive reference (the same day of the week 364 days earlier) had an error of ${num(m.mape_referencia_364d_pct, 2, "en")}%`,
          idioma,
        );
  return tx(
    `Fora da amostra (${plural(m.dias, "dia", "dias")} de ${dataBR(per.inicio)} a ${dataBR(per.fim)}, ${plural(m.origens, "origem mensal", "origens mensais")}), ` +
      `a decomposição por calendário, temperatura, sazonalidade e tendência errou em média ${num(m.mape_pct, 2)}% a carga diária ${de}${ref}. ` +
      `${textoCoberturaIntervalos(p, sm, "pt")}`,
    `Out of sample (${plural(m.dias, "day", "days", "en")} from ${dataBR(per.inicio, "en")} to ${dataBR(per.fim, "en")}, ${plural(m.origens, "monthly origin", "monthly origins", "en")}), ` +
      `the breakdown by calendar, temperature, seasonality and trend had an average error of ${num(m.mape_pct, 2, "en")}% in the daily load ${de}${ref}. ` +
      `${textoCoberturaIntervalos(p, sm, "en")}`,
    idioma,
  );
}

/**
 * Cobertura dos intervalos fora da amostra diante da nominal, em uma frase: os intervalos de 80% e de 95% só valem o que dizem se cobrem
 * 80% e 95% dos dias. Abaixo disso, são mais estreitos que a incerteza observada. Vai junto de toda figura que desenha o intervalo,
 * também em Entender. Vazia sem métricas fora da amostra para a região.
 */
export function textoCoberturaIntervalos(p: Pick<P027Pronto, "metricas">, sm: Regiao, idioma: Idioma = idiomaEnergia()): string {
  const m: MetricasModelo | undefined = p.metricas[sm];
  if (!m) return "";
  const abaixo = m.cobertura_80_pct < 80 || m.cobertura_95_pct < 95;
  const cobertura = abaixo
    ? tx(": abaixo do nominal, os intervalos são mais estreitos que a incerteza real", ": below nominal, the intervals are narrower than the real uncertainty", idioma)
    : tx(", no nível nominal ou acima", ", at the nominal level or above", idioma);
  return tx(
    `O intervalo de 80% cobriu ${num(m.cobertura_80_pct, 1)}% dos dias e o de 95%, ${num(m.cobertura_95_pct, 1)}%${cobertura}.`,
    `The 80% interval covered ${num(m.cobertura_80_pct, 1, "en")}% of the days and the 95% interval, ${num(m.cobertura_95_pct, 1, "en")}%${cobertura}.`,
    idioma,
  );
}

/** Defasagem da temperatura: a avaliação termina antes do último dia de carga quando a NASA POWER ainda não publicou. */
export function textoDefasagemTemperatura(p: Pick<P027Pronto, "periodo_avaliacao">, diaReferencia: string, idioma: Idioma = idiomaEnergia()): string {
  const fim = p.periodo_avaliacao.fim;
  const d = (x: string) => dataBR(x, idioma);
  if (fim >= diaReferencia) return tx(`A decomposição cobre até ${d(fim)}, o último dia de carga publicado.`, `The breakdown covers through ${d(fim)}, the last published day of load.`, idioma);
  const dias = Math.round((Date.parse(`${diaReferencia}T00:00:00Z`) - Date.parse(`${fim}T00:00:00Z`)) / 86_400_000);
  return tx(
    `A decomposição vai até ${d(fim)}, ${plural(dias, "dia", "dias")} antes do último dia de carga (${d(diaReferencia)}): a temperatura da NASA POWER chega com defasagem, e dia sem temperatura não é previsto.`,
    `The breakdown runs through ${d(fim)}, ${plural(dias, "day", "days", "en")} before the last day of load (${d(diaReferencia)}): NASA POWER temperature arrives with a lag, and a day without temperature is not predicted.`,
    idioma,
  );
}

export function decomposicaoEscolhida(a07: Pick<A07, "decomposicao">, sm: Regiao, variante: VarianteModelo, comparacao: TipoComparacao): DecomposicaoA07 | null {
  return a07.decomposicao.find((d) => d.sm === sm && d.variante === variante && d.comparacao === comparacao) ?? null;
}

export type BarraDecomposicao = { id: GrupoModelo | "residuo"; rotulo: string; valor: number };

/** Barras de contribuição (log × 100) e o resíduo: somadas, dão a diferença real entre as janelas. */
export function barrasDecomposicao(d: DecomposicaoA07, idioma: Idioma = idiomaEnergia()): BarraDecomposicao[] {
  return [
    ...GRUPOS_MODELO.map((g) => ({ id: g, rotulo: rotuloGrupo(g, idioma), valor: d.contribuicoes_log100[g] })),
    { id: "residuo" as const, rotulo: tx("Resíduo", "Residual", idioma), valor: d.residuo_log100 },
  ];
}

export type PartesDaDiferenca = {
  /** Diferença real entre as janelas, em log × 100. */
  diferenca: number;
  /** Calendário, temperatura e sazonalidade somados. */
  clima: number;
  nivelTendencia: number;
  residuo: number;
  /** Parte da diferença que clima e calendário acompanham, e parte que o modelo não reproduz (null quando a diferença é nula). */
  proporcaoClima: number | null;
  proporcaoResto: number | null;
  /** Parte que o modelo atribui a nível e tendência (as três proporções fecham a diferença, até o arredondamento das contribuições). */
  proporcaoNivel: number | null;
};

/** As partes da diferença que o veredito e a faixa de métricas leem: uma só conta, sobre as contribuições publicadas. */
export function partesDaDiferenca(d: DecomposicaoA07): PartesDaDiferenca {
  const c = d.contribuicoes_log100;
  const clima = c.calendario + c.temperatura + c.sazonalidade;
  return {
    diferenca: d.real_log100,
    clima,
    nivelTendencia: c.nivel_tendencia,
    residuo: d.residuo_log100,
    proporcaoClima: d.real_log100 === 0 ? null : clima / d.real_log100,
    proporcaoResto: d.real_log100 === 0 ? null : d.residuo_log100 / d.real_log100,
    proporcaoNivel: d.real_log100 === 0 ? null : c.nivel_tendencia / d.real_log100,
  };
}

/**
 * O idioma pedido, ou o da página quando o segundo argumento não é um idioma: respostaDecomposicao é passada direto a `.map(f)`, que
 * entrega o índice no lugar do idioma.
 */
function idiomaDe(x: Idioma | number | undefined): Idioma {
  return x === "en" || x === "pt" ? x : idiomaEnergia();
}

/** Texto da decomposição escolhida, só com os números da linha (associação, não causa). */
export function respostaDecomposicao(d: DecomposicaoA07, idiomaOuIndice?: Idioma | number): string {
  const idioma = idiomaDe(idiomaOuIndice);
  // duas casas, a precisão da gold (com uma casa, 2,65 viraria 2,7 aqui e 2,6 no texto do pipeline)
  const partes = barrasDecomposicao(d, idioma).map((b) => `${b.rotulo.toLowerCase()} ${num(b.valor, 2, idioma)}`);
  const tipo = d.comparacao === "equivalente" ? tx("mesmos dias da semana", "same days of the week", idioma) : tx("mesmas datas", "same dates", idioma);
  const dt = (x: string) => dataBR(x, idioma);
  return tx(
    `De ${dt(d.inicio)} a ${dt(d.fim)} contra ${dt(d.inicio_ant)} a ${dt(d.fim_ant)} (${tipo}, ${plural(d.dias, "dia", "dias")}), ` +
      `a variação da carga diária ${DO_REGIAO[d.sm]}, calculada sobre a média dos logaritmos de cada janela, foi de ${sinal(d.variacao_real_pct, 2)}%. Em log × 100, a diferença de ${num(d.real_log100, 2)} se divide em ${listaTexto(partes, "pt")} ` +
      `(modelo estimado até ${dt(d.ultimo_dia_treino)}). É associação estatística, não causa: o resíduo é o que o modelo não reproduz.`,
    `From ${dt(d.inicio)} to ${dt(d.fim)} against ${dt(d.inicio_ant)} to ${dt(d.fim_ant)} (${tipo}, ${plural(d.dias, "day", "days", "en")}), ` +
      `the change in the daily load ${doRegiao(d.sm, "en")}, calculated on the average of the logarithms of each window, was ${sinal(d.variacao_real_pct, 2, "", "en")}%. In log × 100, the difference of ${num(d.real_log100, 2, "en")} splits into ${listaTexto(partes, "en")} ` +
      `(model estimated through ${dt(d.ultimo_dia_treino)}). It is a statistical association, not a cause: the residual is what the model does not reproduce.`,
    idioma,
  );
}

/**
 * Veredito do P027 em palavras simples, a resposta à pergunta do painel: quanto da diferença de carga entre as duas janelas
 * acompanha calendário, temperatura e estação do ano, e quanto o modelo não reproduz. A diferença vem em pontos (log × 100,
 * aproximadamente pontos percentuais, a escala das contribuições publicadas) e não em % para não ser lida como a variação da
 * média simples da página Carga; as proporções saem das contribuições sobre essa diferença, e "nível e tendência" fica de fora
 * das duas frases. É associação estatística, não causa. Sem a combinação publicada, só o erro do modelo fora da amostra.
 */
export function vereditoClima(d: DecomposicaoA07 | null, p: Pick<P027Pronto, "metricas">, sm: Regiao, idioma: Idioma = idiomaEnergia()): string {
  if (!d) {
    const m = p.metricas[sm];
    return m
      ? tx(
          `Esta combinação de região, variante e comparação não tem decomposição publicada. Fora da amostra, o modelo errou em média ${num(m.mape_pct, 2)}% a carga diária ${DO_REGIAO[sm]}.`,
          `This combination of region, variant and comparison has no published breakdown. Out of sample, the model had an average error of ${num(m.mape_pct, 2, "en")}% in the daily load ${doRegiao(sm, "en")}.`,
          idioma,
        )
      : tx(`Sem decomposição publicada para a carga ${DO_REGIAO[sm]} nesta publicação.`, `No breakdown published for the load ${doRegiao(sm, "en")} in this release.`, idioma);
  }
  const ref =
    d.comparacao === "equivalente"
      ? tx("dos mesmos dias da semana 52 semanas antes", "of the same days of the week 52 weeks earlier", idioma)
      : tx("das mesmas datas do ano anterior", "of the same dates of the previous year", idioma);
  const v = Number(d.real_log100.toFixed(2));
  const quanto =
    v === 0
      ? tx("ficou igual à", "was equal to the", idioma)
      : tx(
          `ficou ${num(Math.abs(d.real_log100), 2)} pontos ${v > 0 ? "acima" : "abaixo"} da`,
          `was ${num(Math.abs(d.real_log100), 2, "en")} points ${v > 0 ? "above" : "below"} the`,
          idioma,
        );
  const abertura = tx(
    `Nos ${plural(d.dias, "dia", "dias")} até ${dataBR(d.fim)}, a carga ${DO_REGIAO[d.sm]} ${quanto} carga ${ref}.`,
    `In the ${plural(d.dias, "day", "days", "en")} through ${dataBR(d.fim, "en")}, the load ${doRegiao(d.sm, "en")} ${quanto} load ${ref}.`,
    idioma,
  );
  if (d.real_log100 === 0)
    return tx(`${abertura} Com diferença nula, a divisão entre as partes do modelo não se aplica.`, `${abertura} With a zero difference, the split between the parts of the model does not apply.`, idioma);
  const partes = partesDaDiferenca(d);
  const clima = partes.proporcaoClima as number;
  const resto = partes.proporcaoResto as number;
  const parteClima =
    clima < 0
      ? tx("Calendário, temperatura e estação do ano puxam no sentido oposto à diferença", "Calendar, temperature and season pull in the direction opposite to the difference", idioma)
      : tx(
          `Calendário, temperatura e estação do ano acompanham ${num(Math.round(clima * 100), 0)}% dessa diferença`,
          `Calendar, temperature and season follow ${num(Math.round(clima * 100), 0, "en")}% of that difference`,
          idioma,
        );
  const parteResto =
    resto < 0
      ? tx("o modelo previa uma diferença maior que a observada", "the model predicted a larger difference than the observed one", idioma)
      : tx(`o modelo não reproduz ${num(Math.round(resto * 100), 0)}%`, `the model does not reproduce ${num(Math.round(resto * 100), 0, "en")}%`, idioma);
  return `${abertura} ${parteClima}; ${parteResto}.`;
}

/**
 * Por que esta decomposição tem menos dias que a janela de 7 dias da página Carga, com as duas variações lado a lado (recortes
 * diferentes do mesmo achado, não divergência).
 * Vazia quando a decomposição cobre a janela inteira ou quando falta a variação de 7 dias para o mesmo recorte.
 */
export function textoJanelaCurta(
  d: DecomposicaoA07 | null,
  achado: { fim: string; dias_janela: number },
  comparacoes: Pick<A07, "comparacoes">["comparacoes"],
  idioma: Idioma = idiomaEnergia(),
): string {
  if (!d || d.fim >= achado.fim) return "";
  const c = comparacoes.find((x) => x.sm === d.sm)?.[d.comparacao];
  if (!c || c.variacao_pct === null) return "";
  return tx(
    `Nesta decomposição a janela tem ${plural(d.dias, "dia", "dias")}, e a variação é calculada sobre o logaritmo da carga diária: ${sinal(d.variacao_real_pct, 2)}%. A página Carga usa a média simples de ${achado.dias_janela} dias: ${sinal(c.variacao_pct, 2)}%.`,
    `In this breakdown the window has ${plural(d.dias, "day", "days", "en")}, and the change is calculated on the logarithm of the daily load: ${sinal(d.variacao_real_pct, 2, "", "en")}%. The Load page uses the simple average of ${achado.dias_janela} days: ${sinal(c.variacao_pct, 2, "", "en")}%.`,
    idioma,
  );
}

export type LinhaSensibilidade = MetricasModelo & { id: VarianteModelo; rotulo: string; mape_principal: number | null };

/** Variantes do modelo para a região, com o MAPE do principal como referência (pontos pareados e tabela). */
export function linhasSensibilidade(p: Pick<P027Pronto, "sensibilidade">, sm: Regiao): LinhaSensibilidade[] {
  const ls = p.sensibilidade.filter((x) => x.sm === sm);
  const principal = ls.find((x) => x.variante === "principal")?.mape_pct ?? null;
  return VARIANTES.map((v) => ls.find((x) => x.variante === v))
    .filter((x): x is (typeof ls)[number] => !!x)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- o submercado sai da linha
    .map(({ sm: _sm, variante, ...resto }) => ({ ...resto, id: variante, mape_principal: principal }));
}

/** Resposta da carga à temperatura por região, em linhas por grau (união das faixas observadas). */
export function linhasRespostaTemperatura(p: Pick<P027Pronto, "resposta_temperatura">, idioma: Idioma = idiomaEnergia()): ({ id: string; t: string } & Partial<Record<Regiao, number | null>>)[] {
  const porT = new Map<number, { id: string; t: string } & Partial<Record<Regiao, number | null>>>();
  for (const sm of REGIOES) {
    for (const [t, ef] of p.resposta_temperatura[sm]?.pontos ?? []) {
      let l = porT.get(t);
      if (!l) porT.set(t, (l = { id: String(t), t: `${num(t, 0, idioma)} °C` }));
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
export function respostaUltimoDia(p: Pick<P027Pronto, "recente_sin">, idioma: Idioma = idiomaEnergia()): string {
  const u = p.recente_sin[p.recente_sin.length - 1];
  if (!u) return tx("Sem dia previsto fora da amostra nesta publicação.", "No out-of-sample predicted day in this release.", idioma);
  const pos =
    u.real > u.p90
      ? tx("acima do intervalo de 80%", "above the 80% interval", idioma)
      : u.real < u.p10
        ? tx("abaixo do intervalo de 80%", "below the 80% interval", idioma)
        : tx("dentro do intervalo de 80%", "within the 80% interval", idioma);
  const n0 = (v: number | null | undefined) => num(v, 0, idioma);
  return tx(
    `Em ${dataBR(u.d)}, a carga do SIN foi ${num(u.real, 0)} MWmed contra ${num(u.previsto, 0)} MWmed previstos pelo modelo estimado com os dias anteriores a ${dataBR(u.origem)} (${sinal(u.residuo_pct, 1)}%), ${pos} (${num(u.p10, 0)} a ${num(u.p90, 0)} MWmed).`,
    `On ${dataBR(u.d, "en")}, the SIN load was ${n0(u.real)} MWavg against ${n0(u.previsto)} MWavg predicted by the model estimated with the days before ${dataBR(u.origem, "en")} (${sinal(u.residuo_pct, 1, "", "en")}%), ${pos} (${n0(u.p10)} to ${n0(u.p90)} MWavg).`,
    idioma,
  );
}

/* ---------- tabelas equivalentes ---------- */

/**
 * Linhas planas para a TabelaInterativa e a exportação: verdadeiro e falso viram
 * "sim" e "não", listas viram texto; números e nulos passam iguais (o arquivo
 * guarda o valor completo, e a ausência continua célula vazia).
 */
export function paraTabela<T extends object>(linhas: readonly T[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return linhas.map((l) =>
    Object.fromEntries(
      Object.entries(l)
        .filter(([, v]) => v === null || typeof v !== "object" || Array.isArray(v))
        .map(([k, v]) => [k, typeof v === "boolean" ? (v ? tx("sim", "yes", idioma) : tx("não", "no", idioma)) : Array.isArray(v) ? v.join(", ") : (v as ValorCelula)]),
    ),
  );
}

export function colunasComparacao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "rotulo", rotulo: tx("Janela", "Window", idioma), tipo: "texto" },
    { id: "inicio", rotulo: tx("Início", "Start", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Fim", "End", idioma), tipo: "data" },
    { id: "media", rotulo: tx("Média da janela", "Window average", idioma), tipo: "numero", unidade: mw, casas: 0 },
    { id: "inicio_ant", rotulo: tx("Início da comparação", "Comparison start", idioma), tipo: "data" },
    { id: "fim_ant", rotulo: tx("Fim da comparação", "Comparison end", idioma), tipo: "data" },
    { id: "media_ant", rotulo: tx("Média da comparação", "Comparison average", idioma), tipo: "numero", unidade: mw, casas: 0 },
    { id: "variacao_pct", rotulo: tx("Variação", "Change", idioma), tipo: "percentual", casas: 2 },
    { id: "dias_uteis", rotulo: tx("Dias úteis", "Working days", idioma), tipo: "numero", casas: 0 },
    { id: "dias_uteis_ant", rotulo: tx("Dias úteis na comparação", "Working days in the comparison", idioma), tipo: "numero", casas: 0 },
    { id: "calendario_equivalente", rotulo: tx("Calendário equivalente", "Equivalent calendar", idioma), tipo: "texto", categorica: true },
    { id: "mesmo_regime", rotulo: tx("Mesmo regime do ONS", "Same ONS regime", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_COMPARACAO: ColunaTabela[] = colunasComparacao("pt");

/** Tabela completa (todas as regiões e tipos), igual a carga_comparacoes.csv. */
export function colunasComparacoesTodas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "regiao", rotulo: tx("Região", "Region", idioma), tipo: "texto", categorica: true },
    { id: "comparacao", rotulo: tx("Comparação", "Comparison", idioma), tipo: "texto", categorica: true },
    ...colunasComparacao(idioma),
  ];
}
export const COLUNAS_COMPARACOES_TODAS: ColunaTabela[] = colunasComparacoesTodas("pt");

const colunasPorRegiao = (idioma: Idioma): ColunaTabela[] =>
  REGIOES.flatMap((sm): ColunaTabela[] => [
    { id: sm, rotulo: tx(`${CURTO_REGIAO[sm]}, média`, `${curtoRegiao(sm, "en")}, average`, idioma), tipo: "numero", unidade: tx("MWmed", "MWavg", idioma), casas: 0 },
    { id: `var_${sm}`, rotulo: tx(`${CURTO_REGIAO[sm]}, variação`, `${curtoRegiao(sm, "en")}, change`, idioma), tipo: "percentual", casas: 2 },
  ]);

export function colunasMensal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "texto" },
    { id: "dias_uteis", rotulo: tx("Dias úteis", "Working days", idioma), tipo: "numero", casas: 0 },
    { id: "dias_uteis_ant", rotulo: tx("Dias úteis no mesmo mês do ano anterior", "Working days in the same month of the previous year", idioma), tipo: "numero", casas: 0 },
    ...colunasPorRegiao(idioma),
  ];
}
export const COLUNAS_MENSAL: ColunaTabela[] = colunasMensal("pt");

export function colunasAnual(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto" }, // i18n: dado
    { id: "dias", rotulo: tx("Dias com valor", "Days with a value", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "completo", rotulo: tx("Ano completo", "Complete year", idioma), tipo: "texto", categorica: true },
    { id: "regimes", rotulo: tx("Regimes do ONS no ano", "ONS regimes in the year", idioma), tipo: "texto", categorica: true },
    ...colunasPorRegiao(idioma),
  ];
}
export const COLUNAS_ANUAL: ColunaTabela[] = colunasAnual("pt");

export function colunasAcumulado(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mw = tx("MWmed", "MWavg", idioma);
  return [
    { id: "regiao", rotulo: tx("Região", "Region", idioma), tipo: "texto" },
    { id: "media", rotulo: tx("Média no ano", "Average in the year", idioma), tipo: "numero", unidade: mw, casas: 0 },
    { id: "media_ant", rotulo: tx("Média na comparação", "Average in the comparison", idioma), tipo: "numero", unidade: mw, casas: 0 },
    { id: "variacao_pct", rotulo: tx("Variação", "Change", idioma), tipo: "percentual", casas: 2 },
    { id: "mesmo_regime", rotulo: tx("Mesmo regime do ONS", "Same ONS regime", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_ACUMULADO: ColunaTabela[] = colunasAcumulado("pt");

/** Rótulos legíveis dos identificadores que a gold publica (a tabela mostra o rótulo; o CSV da fonte guarda o identificador). */
export function rotuloJanelaA07(id: string, idioma: Idioma = idiomaEnergia()): string {
  const m = /^(\d{4})(?:_(mesmas_datas|equivalente))?$/.exec(id);
  if (!m) return id;
  if (!m[2]) return m[1];
  return m[2] === "mesmas_datas" ? tx(`${m[1]}, mesmas datas`, `${m[1]}, same dates`, idioma) : tx(`${m[1]}, mesmos dias da semana`, `${m[1]}, same days of the week`, idioma);
}
export const ROTULO_JANELA_A07: Record<string, string> = {
  "2026": "2026",
  "2025_mesmas_datas": rotuloJanelaA07("2025_mesmas_datas", "pt"),
  "2025_equivalente": rotuloJanelaA07("2025_equivalente", "pt"),
};
export function rotuloSituacaoRevisao(s: string, idioma: Idioma = idiomaEnergia()): string {
  return (
    {
      revisao: tx("revisão", "revision", idioma),
      correcao_de_valor_fora_do_dominio: tx("correção de valor fora do domínio", "correction of an out-of-domain value", idioma),
    }[s] ?? s
  );
}
export const ROTULO_SITUACAO_REVISAO: Record<string, string> = {
  revisao: rotuloSituacaoRevisao("revisao", "pt"),
  correcao_de_valor_fora_do_dominio: rotuloSituacaoRevisao("correcao_de_valor_fora_do_dominio", "pt"),
};
