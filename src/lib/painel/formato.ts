/**
 * Formatação do domínio Energia. Ausência (null/undefined) vira "–" e nunca 0.
 * Datas de referência chegam como texto local ("AAAA-MM-DD" ou
 * "AAAA-MM-DDTHH:MM", horário de Brasília) e são formatadas sem conversão de
 * fuso; carimbos de captura chegam em UTC ("...Z") e são exibidos em Brasília.
 */
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "./idioma";

/**
 * Idioma: todo formatador recebe o idioma por último. Sem ele, vale o idioma da página no servidor
 * (idiomaEnergia(), português fora de render); componente de cliente passa o de useIdioma() ou usa
 * formatos(idioma). Inglês segue en-US (vírgula de milhar, ponto decimal), datas como "Oct 17, 2026",
 * meses como "Oct 2026", hora em 24 h; o valor, a precisão e o fuso são os mesmos do português.
 */
const LOCALE: Record<Idioma, string> = { pt: "pt-BR", en: "en-US" };
export const AUSENTE = "–";

/**
 * Convenção documentada do domínio: horário que chega sem fuso é horário de Brasília (ver o
 * cabeçalho deste arquivo e `dataHora` em SobreEsteDado). Só o domínio Energia usa; texto-datas
 * não assume fuso sem que o chamador o informe.
 */
export const FUSO_SEM_OFFSET_ENERGIA = "Brasília"; // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)

export function num(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  // sinal de menos tipográfico (U+2212), o mesmo de sinal(), em vez do hífen
  return v.toLocaleString(LOCALE[idioma], { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "\u2212");
}

export function reais(v: number | null | undefined, casas = 2, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return `R$\u00a0${num(v, casas, idioma)}`; // espaço não separável: "R$" nunca fica sozinho no fim da linha
}

export function pct(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return `${num(v, casas, idioma)}%`;
}

/** Fração 0..1 como percentual. */
export function fracPct(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return pct(v * 100, casas, idioma);
}

export function sinal(v: number | null | undefined, casas = 1, sufixo = "", idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${num(Math.abs(v), casas, idioma)}${sufixo}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]; // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Nome do mês (1 a 12) no idioma: abreviado ("out", "Oct") ou por extenso ("outubro", "October"). */
export function nomeMes(m: number, idioma: Idioma = idiomaEnergia(), longo = false): string {
  return (idioma === "en" ? (longo ? MONTHS_LONG : MONTHS) : longo ? MESES_LONGOS : MESES)[m - 1];
}

export function dataBR(iso: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!iso) return AUSENTE;
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (idioma === "en") {
    if (d === undefined) return m === undefined ? a : `${MONTHS[Number(m) - 1]} ${a}`;
    return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${a}`;
  }
  // período mensal (AAAA-MM) vira mm/aaaa; nunca "undefined"
  if (d === undefined) return m === undefined ? a : `${m}/${a}`;
  return `${d}/${m}/${a}`;
}

export function dataExtenso(iso: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!iso) return AUSENTE;
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (idioma === "en") return `${MONTHS_LONG[Number(m) - 1]} ${Number(d)}, ${a}`;
  return `${Number(d)} de ${MESES_LONGOS[Number(m) - 1]} de ${a}`; // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
}

export function dataCurta(iso: string, idioma: Idioma = idiomaEnergia()): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  if (idioma === "en") return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
  return `${d}/${m}`;
}

export function mesAno(anomes: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return `${MONTHS[Number(anomes.slice(5, 7)) - 1]} ${anomes.slice(0, 4)}`;
  return `${MESES[Number(anomes.slice(5, 7)) - 1]}/${anomes.slice(0, 4)}`;
}

/** Mês curto para eixos com muitas categorias: "2023-05" → "mai/23" ("May ’23" em inglês). */
export function mesAnoCurto(anomes: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return `${MONTHS[Number(anomes.slice(5, 7)) - 1]} \u2019${anomes.slice(2, 4)}`;
  return `${MESES[Number(anomes.slice(5, 7)) - 1]}/${anomes.slice(2, 4)}`;
}

/** "AAAA-MM-DDTHH:MM" local → "27/09/2026 às 16h" ("Sep 27, 2026, 16:00" em inglês). */
export function horaLocal(ref: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return `${dataBR(ref, "en")}, ${ref.slice(11, 13)}:00`;
  return `${dataBR(ref, "pt")} às ${ref.slice(11, 13)}h`; // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
}

/** Carimbo UTC ("...Z") exibido no horário de Brasília. */
export function carimbo(iso: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!iso) return AUSENTE;
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  if (idioma === "en") {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(d).map((x) => [x.type, x.value]),
    );
    return `${p.month} ${p.day}, ${p.year}, ${p.hour}:${p.minute} (Brasília time)`; // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  }
  return d.toLocaleString(LOCALE.pt, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " (Brasília)"; // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
}

/**
 * Unidades de contagem que concordam com o número: "1 dia", "2 dias". Usada pelos
 * componentes que escrevem "valor unidade" (barras, mapa de calor, histograma), para
 * não sair "1 dias". Unidade que não é contagem (MWmed, R$/MWh, %) passa inalterada.
 */
const SINGULAR: Record<string, string> = {
  dias: "dia", horas: "hora", meses: "mês", semanas: "semana", anos: "ano", usinas: "usina", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  distribuidoras: "distribuidora", conjuntos: "conjunto", "municípios": "município", consultas: "consulta", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  atos: "ato", eventos: "evento", unidades: "unidade", "famílias": "família", empresas: "empresa", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  "interrupções": "interrupção", "reclamações": "reclamação", agentes: "agente", projetos: "projeto", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
};

const SINGULAR_EN: Record<string, string> = {
  days: "day", hours: "hour", months: "month", weeks: "week", years: "year", plants: "plant", "power plants": "power plant",
  utilities: "utility", "distribution utilities": "distribution utility", sets: "set", "consumer sets": "consumer set",
  municipalities: "municipality", consultations: "consultation", acts: "act", events: "event", units: "unit", families: "family",
  companies: "company", interruptions: "interruption", complaints: "complaint", agents: "agent", projects: "project",
};

export function unidadeConcordante(v: number, unidade: string): string {
  if (Math.abs(v) !== 1) return unidade;
  return SINGULAR[unidade] ?? SINGULAR_EN[unidade] ?? unidade;
}

export function plural(n: number, um: string, varios: string, idioma: Idioma = idiomaEnergia()): string {
  return `${n.toLocaleString(LOCALE[idioma])} ${n === 1 ? um : varios}`;
}

export const NOME_SM: Record<string, string> = {
  SE: "Sudeste/Centro-Oeste",
  S: "Sul",
  NE: "Nordeste",
  N: "Norte",
  SIN: "Sistema Interligado Nacional",
};

export const CURTO_SM: Record<string, string> = { SE: "SE/CO", S: "Sul", NE: "Nordeste", N: "Norte", SIN: "SIN" };

/** Submercados em inglês, como a CCEE os chama nas publicações em inglês; a sigla SIN fica. */
export const NOME_SM_EN: Record<string, string> = {
  SE: "Southeast/Center-West",
  S: "South",
  NE: "Northeast",
  N: "North",
  SIN: "National Interconnected System (SIN)",
};

export const CURTO_SM_EN: Record<string, string> = { SE: "SE/CW", S: "South", NE: "Northeast", N: "North", SIN: "SIN" };

/** Nome do submercado no idioma; código desconhecido volta como veio. */
export function nomeSubmercado(id: string, idioma: Idioma = idiomaEnergia(), curto = false): string {
  const mapa = idioma === "en" ? (curto ? CURTO_SM_EN : NOME_SM_EN) : curto ? CURTO_SM : NOME_SM;
  return mapa[id] ?? id;
}

/** Rótulo legível das chaves de regra e definição publicadas na gold. */
const ROTULOS_REGRA: Record<string, string> = {
  calibracao: "Calibração", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  carga_sin: "Carga do SIN",
  comparacao_anual: "Comparação anual", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  desvio_principal: "Desvio principal",
  dia_referencia: "Dia de referência", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  diaria: "Média diária", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  diferenca_preco: "Diferença de preço", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  diferenca_submercados: "Diferença entre submercados", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  ear_sin: "EAR do SIN",
  ena_30d: "ENA de 30 dias", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  estados: "Estados do modelo",
  extremo_12m: "Extremo em 12 meses", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  faixa_usual: "Faixa usual",
  fluxo: "Fluxo",
  hes: "Hidráulica, eólica e solar", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  imutabilidade: "Imutabilidade",
  limites: "Limites", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  liquido: "Saldo líquido", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  look_ahead: "Sem uso de dado futuro", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  media_diaria: "Média diária", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  menor_valor_ano: "Menor valor observado no ano", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  padrao_historico: "Padrão histórico", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  participacao: "Participação", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  permanencia: "Permanência", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  posicao_historica: "Posição histórica", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  termica_contexto: "Contexto térmico", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  volatilidade: "Volatilidade",
  alvo: "Alvo",
  entregas: "Entregas",
  cenario_de_elegibilidade: "Cenário de elegibilidade", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  corte_operacional: "Corte operacional",
  quantis: "Quantis",
};

const ROTULOS_REGRA_EN: Record<string, string> = {
  calibracao: "Calibration",
  carga_sin: "SIN load",
  comparacao_anual: "Year-on-year comparison",
  desvio_principal: "Main deviation",
  dia_referencia: "Reference day",
  diaria: "Daily average",
  diferenca_preco: "Price difference",
  diferenca_submercados: "Difference between submarkets",
  ear_sin: "SIN stored energy (EAR)",
  ena_30d: "30-day natural inflow energy (ENA)",
  estados: "Model states",
  extremo_12m: "12-month extreme",
  faixa_usual: "Usual range",
  fluxo: "Flow",
  hes: "Hydro, wind and solar",
  imutabilidade: "Immutability",
  limites: "Limits", // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
  liquido: "Net balance",
  look_ahead: "No use of future data",
  media_diaria: "Daily average",
  menor_valor_ano: "Lowest value observed in the year",
  padrao_historico: "Historical pattern",
  participacao: "Share",
  permanencia: "Persistence",
  posicao_historica: "Historical position",
  termica_contexto: "Thermal context",
  volatilidade: "Volatility",
  alvo: "Target",
  entregas: "Deliveries",
  cenario_de_elegibilidade: "Eligibility scenario",
  corte_operacional: "Operational cut",
  quantis: "Quantiles",
};

export function rotuloRegra(chave: string, idioma: Idioma = idiomaEnergia()): string {
  const r = (idioma === "en" ? ROTULOS_REGRA_EN : ROTULOS_REGRA)[chave];
  if (r) return r;
  const t = chave.replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Identificador de lei do Senado ("LEI-10607-2002-12-19") como o leitor escreve: "Lei 10.607, de 19/12/2002". */
export function normaLegivel(id: string, idioma: Idioma = idiomaEnergia()): string {
  const m = /^LEI-(\d+)-(\d{4})-(\d{2})-(\d{2})$/.exec(id);
  if (!m) return id;
  if (idioma === "en") return `Law ${Number(m[1]).toLocaleString(LOCALE.en)} of ${dataBR(`${m[2]}-${m[3]}-${m[4]}`, "en")}`;
  return `Lei ${Number(m[1]).toLocaleString(LOCALE.pt)}, de ${m[4]}/${m[3]}/${m[2]}`; // i18n: dado (ramo ou tabela portuguesa da infraestrutura bilíngue)
}

/**
 * Datas ISO soltas num texto do pipeline (AAAA-MM-DD, AAAA-MM ou AAAA-MM-DDTHH:MM com Z opcional) na
 * forma da página (dd/mm/aaaa, mês/ano ou dd/mm/aaaa hh:mm, com UTC quando o texto traz Z);
 * identificadores com "@" ou "_" coladas ficam como estão.
 */
export function datasLegiveis(texto: string, idioma: Idioma = idiomaEnergia()): string {
  // ano de quatro dígitos sem zero à esquerda, mês 01 a 12, dia 01 a 31: o "0001-86" de um CNPJ, "2024-99" ou "2025-13" não são datas
  const A = "[1-9]\\d{3}";
  const M = "(?:0[1-9]|1[0-2])";
  const D = "(?:0[1-9]|[12]\\d|3[01])";
  const FORA = "[^\\w@_/.-]";
  return texto
    // intervalo ISO de dias ("2013-01-01/2013-12-31"): vira "01/01/2013 a 31/12/2013"
    .replace(
      new RegExp(`(^|${FORA})(${A})-(${M})-(${D})/(${A})-(${M})-(${D})(?![\\w@_/-])`, "g"),
      (_, antes: string, a1: string, m1: string, d1: string, a2: string, m2: string, d2: string) =>
        idioma === "en"
          ? `${antes}${dataBR(`${a1}-${m1}-${d1}`, "en")} to ${dataBR(`${a2}-${m2}-${d2}`, "en")}`
          : `${antes}${d1}/${m1}/${a1} a ${d2}/${m2}/${a2}`,
    )
    .replace(
      new RegExp(`(^|${FORA})(${A})-(${M})-(${D})T([01]\\d|2[0-3]):([0-5]\\d)(?::[0-5]\\d(?:\\.\\d+)?)?(Z?)(?![\\w@_/-])`, "g"),
      (_, antes: string, a: string, m: string, d: string, h: string, mi: string, z: string) =>
        `${antes}${idioma === "en" ? `${dataBR(`${a}-${m}-${d}`, "en")},` : `${d}/${m}/${a}`} ${h}:${mi}${z ? " UTC" : ""}`,
    )
    .replace(
      new RegExp(`(^|${FORA})(${A})-(${M})(?:-(${D}))?(?![\\w@_/-]|\\d)`, "g"),
      (_, antes: string, a: string, m: string, d?: string) =>
        `${antes}${d ? (idioma === "en" ? dataBR(`${a}-${m}-${d}`, "en") : `${d}/${m}/${a}`) : mesAno(`${a}-${m}`, idioma)}`,
    );
}

/**
 * Valor já escrito pela gold em português (valor_exibido: "R$ 1,60 bilhão", "82.216 MWmed às 19h", "18,4%", "Amarela: R$ 0,01885/kWh")
 * na grafia inglesa: troca os separadores dentro de cada número (milhar com ponto ou decimal com vírgula), as palavras de grandeza, a
 * unidade MWmed, a hora e o nome da bandeira. O número é o mesmo; texto que não casa com nenhuma regra fica como veio. Regra
 * compartilhada por todos os painéis (o Aprenda e a Geração tinham versões locais).
 */
export function valorExibidoNoIdioma(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return texto;
  return texto
    .replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+/g, (m) => m.replace(/\./g, "\u0000").replace(/,/g, ".").replace(/\u0000/g, ","))
    .replace(/\bbilhões\b|\bbilhão\b/g, "billion") // i18n: dado (regra de tradução)
    .replace(/\bmilhões\b|\bmilhão\b/g, "million") // i18n: dado (regra de tradução)
    .replace(/(\d) mil\b/g, "$1 thousand")
    .replace(/(\d) de (\d)/g, "$1 of $2") // i18n: dado (regra de tradução)
    .replace(/\bMWmed\b/g, "MWavg")
    .replace(/ às (\d{1,2})h\b/g, " at $1:00") // i18n: dado (regra de tradução)
    .replace(/^Verde:/, "Green:")
    .replace(/^Amarela:/, "Yellow:")
    .replace(/^Vermelha patamar (\d):/, "Red level $1:")
    .replace(/^Vermelha:/, "Red:");
}

/**
 * Os formatadores presos a um idioma, para componente de cliente: `const f = formatos(useIdioma())`
 * e depois `f.num(v, 1)`, `f.dataBR(iso)`. Mesmas regras e assinaturas, sem o último argumento.
 */
export function formatos(idioma: Idioma) {
  return {
    idioma,
    num: (v: number | null | undefined, casas = 1) => num(v, casas, idioma),
    reais: (v: number | null | undefined, casas = 2) => reais(v, casas, idioma),
    pct: (v: number | null | undefined, casas = 1) => pct(v, casas, idioma),
    fracPct: (v: number | null | undefined, casas = 1) => fracPct(v, casas, idioma),
    sinal: (v: number | null | undefined, casas = 1, sufixo = "") => sinal(v, casas, sufixo, idioma),
    nomeMes: (m: number, longo = false) => nomeMes(m, idioma, longo),
    dataBR: (iso: string | null | undefined) => dataBR(iso, idioma),
    dataExtenso: (iso: string | null | undefined) => dataExtenso(iso, idioma),
    dataCurta: (iso: string) => dataCurta(iso, idioma),
    mesAno: (anomes: string) => mesAno(anomes, idioma),
    mesAnoCurto: (anomes: string) => mesAnoCurto(anomes, idioma),
    horaLocal: (ref: string) => horaLocal(ref, idioma),
    carimbo: (iso: string | null | undefined) => carimbo(iso, idioma),
    plural: (n: number, um: string, varios: string) => plural(n, um, varios, idioma),
    nomeSubmercado: (id: string, curto = false) => nomeSubmercado(id, idioma, curto),
    rotuloRegra: (chave: string) => rotuloRegra(chave, idioma),
    normaLegivel: (id: string) => normaLegivel(id, idioma),
    datasLegiveis: (texto: string) => datasLegiveis(texto, idioma),
  };
}

export type Formatos = ReturnType<typeof formatos>;

const MESES_EN: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

/**
 * Hora em UTC escrita num texto (identificador de captura, evidência de bloqueio) passada à hora de Brasília, no formato do carimbo da
 * página: "01/10/2026 06:40 UTC" vira "01/10/2026, 03:40 (Brasília)". O instante é o mesmo; muda só a forma, porque o molde de painel
 * não mostra hora em UTC (Iniciativa 1 do parecer de UX de 23/10/2026).
 */
export function semUtc(texto: string, idioma: Idioma = idiomaEnergia()): string {
  return texto
    .replace(/\b(\d{2})\/(\d{2})\/(\d{4}),? (\d{2}):(\d{2}) UTC\b/g, (_, d: string, m: string, a: string, h: string, mi: string) => carimbo(`${a}-${m}-${d}T${h}:${mi}:00Z`, idioma))
    .replace(/\b([A-Z][a-z]{2}) (\d{1,2}), (\d{4}),? (\d{2}):(\d{2}) UTC\b/g, (todo, mes: string, d: string, a: string, h: string, mi: string) =>
      MESES_EN[mes] ? carimbo(`${a}-${MESES_EN[mes]}-${d.padStart(2, "0")}T${h}:${mi}:00Z`, idioma) : todo,
    );
}
