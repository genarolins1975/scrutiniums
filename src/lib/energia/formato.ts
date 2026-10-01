/**
 * Formatação do domínio Energia. Ausência (null/undefined) vira "–" e nunca 0.
 * Datas de referência chegam como texto local ("AAAA-MM-DD" ou
 * "AAAA-MM-DDTHH:MM", horário de Brasília) e são formatadas sem conversão de
 * fuso; carimbos de captura chegam em UTC ("...Z") e são exibidos em Brasília.
 */
const L = "pt-BR";
export const AUSENTE = "–";

export function num(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  // sinal de menos tipográfico (U+2212), o mesmo de sinal(), em vez do hífen
  return v.toLocaleString(L, { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "\u2212");
}

export function reais(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return `R$\u00a0${num(v, casas)}`; // espaço não separável: "R$" nunca fica sozinho no fim da linha
}

export function pct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return `${num(v, casas)}%`;
}

/** Fração 0..1 como percentual. */
export function fracPct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return pct(v * 100, casas);
}

export function sinal(v: number | null | undefined, casas = 1, sufixo = ""): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${num(Math.abs(v), casas)}${sufixo}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return AUSENTE;
  const [a, m, d] = iso.slice(0, 10).split("-");
  // período mensal (AAAA-MM) vira mm/aaaa; nunca "undefined"
  if (d === undefined) return m === undefined ? a : `${m}/${a}`;
  return `${d}/${m}/${a}`;
}

export function dataExtenso(iso: string | null | undefined): string {
  if (!iso) return AUSENTE;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)} de ${MESES_LONGOS[Number(m) - 1]} de ${a}`;
}

export function dataCurta(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

export function mesAno(anomes: string): string {
  return `${MESES[Number(anomes.slice(5, 7)) - 1]}/${anomes.slice(0, 4)}`;
}

/** "AAAA-MM-DDTHH:MM" local → "27/09/2026 às 16h". */
export function horaLocal(ref: string): string {
  return `${dataBR(ref)} às ${ref.slice(11, 13)}h`;
}

/** Carimbo UTC ("...Z") exibido no horário de Brasília. */
export function carimbo(iso: string | null | undefined): string {
  if (!iso) return AUSENTE;
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(L, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " (Brasília)";
}

/**
 * Unidades de contagem que concordam com o número: "1 dia", "2 dias". Usada pelos
 * componentes que escrevem "valor unidade" (barras, mapa de calor, histograma), para
 * não sair "1 dias". Unidade que não é contagem (MWmed, R$/MWh, %) passa inalterada.
 */
const SINGULAR: Record<string, string> = {
  dias: "dia", horas: "hora", meses: "mês", semanas: "semana", anos: "ano", usinas: "usina",
  distribuidoras: "distribuidora", conjuntos: "conjunto", "municípios": "município", consultas: "consulta",
  atos: "ato", eventos: "evento", unidades: "unidade", "famílias": "família", empresas: "empresa",
  "interrupções": "interrupção", "reclamações": "reclamação", agentes: "agente", projetos: "projeto",
};

export function unidadeConcordante(v: number, unidade: string): string {
  return Math.abs(v) === 1 && SINGULAR[unidade] ? SINGULAR[unidade] : unidade;
}

export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString(L)} ${n === 1 ? um : varios}`;
}

export const NOME_SM: Record<string, string> = {
  SE: "Sudeste/Centro-Oeste",
  S: "Sul",
  NE: "Nordeste",
  N: "Norte",
  SIN: "Sistema Interligado Nacional",
};

export const CURTO_SM: Record<string, string> = { SE: "SE/CO", S: "Sul", NE: "Nordeste", N: "Norte", SIN: "SIN" };

/** Rótulo legível das chaves de regra e definição publicadas na gold. */
const ROTULOS_REGRA: Record<string, string> = {
  calibracao: "Calibração",
  carga_sin: "Carga do SIN",
  comparacao_anual: "Comparação anual",
  desvio_principal: "Desvio principal",
  dia_referencia: "Dia de referência",
  diaria: "Média diária",
  diferenca_preco: "Diferença de preço",
  diferenca_submercados: "Diferença entre submercados",
  ear_sin: "EAR do SIN",
  ena_30d: "ENA de 30 dias",
  estados: "Estados do modelo",
  extremo_12m: "Extremo em 12 meses",
  faixa_usual: "Faixa usual",
  fluxo: "Fluxo",
  hes: "Hidráulica, eólica e solar",
  imutabilidade: "Imutabilidade",
  limites: "Limites",
  liquido: "Saldo líquido",
  look_ahead: "Sem uso de dado futuro",
  media_diaria: "Média diária",
  menor_valor_ano: "Menor valor observado no ano",
  padrao_historico: "Padrão histórico",
  participacao: "Participação",
  permanencia: "Permanência",
  posicao_historica: "Posição histórica",
  termica_contexto: "Contexto térmico",
  volatilidade: "Volatilidade",
  alvo: "Alvo",
  entregas: "Entregas",
  cenario_de_elegibilidade: "Cenário de elegibilidade",
  corte_operacional: "Corte operacional",
  quantis: "Quantis",
};

export function rotuloRegra(chave: string): string {
  const r = ROTULOS_REGRA[chave];
  if (r) return r;
  const t = chave.replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
