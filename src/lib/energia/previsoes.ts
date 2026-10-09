/**
 * Lógica pura das páginas de Previsões e modelos do PLD (painéis P013 a P016):
 * navegação entre os painéis, linhas das tabelas e dos gráficos, e os textos
 * automáticos derivados da gold (seção 7.4: regras determinísticas e testadas).
 *
 * Nada aqui recalcula previsão ou métrica: as funções só reorganizam o que o
 * pipeline publicou (public/energia/gold/previsoes_desempenho.json e o CSV do
 * arquivo de emissões) e escrevem frases a partir desses números. Ausência fica
 * null e é dita como ausência, nunca como zero. Sem acesso a arquivo: este
 * módulo também é importado por componentes cliente (a leitura do CSV no build
 * fica em previsoes-arquivos.ts).
 */
import { semCaminhosDeArquivo } from "./bastidor";
import { diaBrasilia } from "./evidencia";
import { CURTO_SM, NOME_SM, dataBR, num, plural, reais } from "./formato";
import type { ColunaTabela, LinhaTabela } from "./tabela";
import type { ModelosGold, Submercado } from "./tipos";
import type {
  Apuracao,
  CelulaAtual,
  CodigoModelo,
  EstadoModelo,
  Ficha,
  Frequencia,
  Horizonte,
  LinhaMetrica,
  PrevisoesDesempenhoGold,
  PublicadoNoCorte,
  Rodada,
} from "./tipos-previsoes";

/* ---------------------------------------------------------------- painéis e rotas */

export const ROTA_PREVISOES = "/setor-eletrico/pld/previsoes";
export const ROTA_MODELOS = "/setor-eletrico/pld/modelos";
export const GOLD_PREVISOES = "previsoes_desempenho.json";

export type IdPainelPrevisoes = "p013" | "p014" | "p015" | "p016";
export type PainelPrevisoes = { id: IdPainelPrevisoes; codigo: string; rotulo: string; rota: string; pergunta: string };

/**
 * Dois painéis por página: a previsão atual e o arquivo de emissões em /previsoes
 * (o que se prevê na rodada mais recente e o que foi registrado antes do resultado), o registro de
 * modelos e o desempenho em /modelos (como cada número é calculado e se ele supera
 * as referências simples). A ordem da lista é a da navegação.
 */
export const PAINEIS_PREVISOES: PainelPrevisoes[] = [
  { id: "p013", codigo: "P013", rotulo: "Rodada mais recente", rota: ROTA_PREVISOES, pergunta: "Quais os preços possíveis nos próximos períodos?" },
  { id: "p015", codigo: "P015", rotulo: "Arquivo de emissões", rota: ROTA_PREVISOES, pergunta: "O que foi previsto antes do resultado?" },
  { id: "p014", codigo: "P014", rotulo: "Registro de modelos", rota: ROTA_MODELOS, pergunta: "Como cada previsão foi calculada?" },
  { id: "p016", codigo: "P016", rotulo: "Desempenho e calibração", rota: ROTA_MODELOS, pergunta: "O modelo supera referências simples?" },
];

export function painelPrevisoes(id: IdPainelPrevisoes): PainelPrevisoes {
  return PAINEIS_PREVISOES.find((p) => p.id === id) as PainelPrevisoes;
}
export const perguntaPainel = (id: IdPainelPrevisoes) => painelPrevisoes(id).pergunta;
/** Endereço do painel com a âncora (o link compartilhável acrescenta o recorte da URL). */
export const enderecoPainel = (id: IdPainelPrevisoes) => `${painelPrevisoes(id).rota}#${id}`;

/** Próxima pergunta (seção 7.2, item 10): o que se prevê → como foi calculado → se supera as referências → o que já foi previsto → o que se prevê. */
const PROXIMO: Record<IdPainelPrevisoes, IdPainelPrevisoes> = { p013: "p014", p014: "p016", p016: "p015", p015: "p013" };
export function proximoPainel(id: IdPainelPrevisoes): PainelPrevisoes {
  return painelPrevisoes(PROXIMO[id]);
}

/** Rota da ficha de um modelo ("C2-P" → /setor-eletrico/pld/modelos/c2-p). */
export const slugModelo = (codigo: string) => codigo.toLowerCase();
export const rotaModelo = (codigo: string) => `${ROTA_MODELOS}/${slugModelo(codigo)}`;

/* ---------------------------------------------------------------- vocabulário */

export const SUBMERCADOS: Submercado[] = ["SE", "S", "NE", "N"];
export const HORIZONTES: Horizonte[] = ["W1", "W2", "W3", "W4", "M1", "M2", "M3"];
export const COR_SM: Record<Submercado, string> = {
  SE: "var(--serie-sm-se)",
  S: "var(--serie-sm-s)",
  NE: "var(--serie-sm-ne)",
  N: "var(--serie-sm-n)",
};

const ORDINAL = ["primeira", "segunda", "terceira", "quarta"];
const ORDINAL_M = ["primeiro", "segundo", "terceiro"];
/** "W2" → "segunda semana completa depois da origem"; "M1" → "primeiro mês civil depois da origem". */
export function descreverHorizonte(h: Horizonte): string {
  const n = Number(h.slice(1)) - 1;
  return h.startsWith("W") ? `${ORDINAL[n]} semana completa depois da origem` : `${ORDINAL_M[n]} mês civil depois da origem`;
}

const ESTADOS_CALIBRACAO: Record<string, string> = {
  CALIBRADO: "calibrado",
  DESCALIBRADO: "descalibrado",
  AMOSTRA_INSUFICIENTE: "amostra insuficiente",
  SEM_AVALIACAO: "sem avaliação",
  NAO_CALIBRADO_NO_PILOTO: "não calibrado no piloto",
};
export const rotuloCalibracao = (s: string | null | undefined) => (s ? ESTADOS_CALIBRACAO[s] ?? s : "sem estado registrado");

/**
 * Frases escritas pelo registro às vezes trazem o código do estado de calibração em maiúsculas ("está CALIBRADO"). No texto de leitura
 * entra o rótulo em palavras ("está calibrado"); o resto da frase fica como foi escrito.
 */
export function semCodigoDeEstado(texto: string): string {
  return texto.replace(/\b(NAO_CALIBRADO_NO_PILOTO|AMOSTRA_INSUFICIENTE|DESCALIBRADO|CALIBRADO|SEM_AVALIACAO)\b/g, (c) => ESTADOS_CALIBRACAO[c] ?? c);
}

const ESTADOS_MODELO: Record<string, string> = { PESQUISA: "pesquisa", VALIDACAO: "validação", PRODUCAO: "produção", APOSENTADO: "aposentado" };
export const rotuloEstadoModelo = (s: string) => ESTADOS_MODELO[s] ?? s;

const TIPOS: Record<string, string> = {
  PUBLICACAO: "publicação",
  RODADA_INTERNA: "rodada interna",
  REFERENCIA_EXPERIMENTAL: "referência experimental",
};
export const rotuloTipo = (s: string) => TIPOS[s] ?? s;

/** Motivos de célula sem número gravados pela rodada de previsão (emissao.py, no módulo de previsões). */
export const MOTIVOS: Record<string, string> = {
  SEM_PLD_CAPTURADO_ATE_O_CORTE: "nenhum PLD do período exigido havia sido capturado até o corte",
  SEM_PERIODO_ELEGIVEL_CAPTURADO_ATE_O_CORTE: "nenhum período elegível do PLD estava capturado até o corte",
  PERIODO_ELEGIVEL_INCOMPLETO_NO_CORTE: "o período elegível estava incompleto no corte",
  FALHA_NA_EXECUCAO: "a execução da rodada falhou",
  CONFERENCIA_B0_DIVERGENTE: "o recálculo independente do B0 divergiu do valor emitido",
  ENTREGA_PARCIALMENTE_PUBLICADA_SEM_DIAS_INTEIROS: "a entrega já tinha horas publicadas sem dias inteiros",
  TREINO_INSUFICIENTE: "o treino tinha menos entregas que o mínimo",
};
export const textoMotivo = (m: string | null | undefined) => (m ? MOTIVOS[m] ?? `motivo registrado ${m}` : "");

export const ALERTAS: Record<string, string> = {
  ATRASADO_APOS_08H: "emitida depois do prazo das 08h00",
  EXECUCAO_MANUAL: "rodada manual, fora do horário agendado",
  CODIGO_NAO_COMMITADO: "emitida com uma versão do código ainda não registrada",
  LIMITE_PROVISORIO: "faixa de preço provisória (sem ato do ano da entrega)",
  AJUSTADA_AO_LIMITE: "previsão ajustada ao limite de preço",
  ENTREGA_COM_HORAS_JA_PUBLICADAS: "entrega com horas já publicadas no corte",
};
export const textoAlertas = (as: readonly string[]) => as.map((a) => ALERTAS[a] ?? a).join("; ");

/* ---------------------------------------------------------------- datas */

const HORA_BR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Instante UTC → "30/09/2026 às 20h31" (Brasília). */
export function instanteBR(iso: string | null | undefined): string {
  if (!iso) return "sem registro";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const p = Object.fromEntries(HORA_BR.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} às ${p.hour}h${p.minute}`;
}

/** Dia anterior (AAAA-MM-DD), para escrever o último dia de um período com fim excluído. */
export function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function somaDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dias inteiros de a até b (AAAA-MM-DD). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** Primeiro e último dia (Brasília) de uma entrega com fim excluído em UTC. */
export function diasDaEntrega(e: { inicio: string; fim: string }): { inicio: string; ultimo: string } {
  const ini = diaBrasilia(e.inicio) ?? e.inicio.slice(0, 10);
  const fim = diaBrasilia(e.fim) ?? e.fim.slice(0, 10);
  return { inicio: ini, ultimo: diaAnterior(fim) };
}

/**
 * Dia (Brasília) em que a entrega termina, a partir do identificador, pela definição
 * das entregas (semana de sábado 00h a sábado 00h; mês civil): "W2026-10-03" →
 * "2026-10-10"; "M2026-10" → "2026-11-01". É o primeiro dia fora da entrega: o
 * realizado só existe depois dele.
 */
export function fimDaEntrega(id: string): string | null {
  const w = /^W(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (w) return somaDias(w[1], 7);
  const m = /^M(\d{4})-(\d{2})$/.exec(id);
  if (m) {
    const a = Number(m[1]);
    const mes = Number(m[2]);
    return mes === 12 ? `${a + 1}-01-01` : `${a}-${String(mes + 1).padStart(2, "0")}-01`;
  }
  return null;
}

/** "R$ 124,09/MWh"; ausência é "sem número". */
export const reaisMWh = (v: number | null | undefined, casas = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "sem número" : `${reais(v, casas)}/MWh`);

/* ---------------------------------------------------------------- rodada e defasagem */

type AtualComRodada = Extract<PrevisoesDesempenhoGold["previsao_atual"], { rotulo: string }>;
export function temRodada(at: PrevisoesDesempenhoGold["previsao_atual"]): at is AtualComRodada {
  return "rotulo" in at && Array.isArray((at as AtualComRodada).celulas);
}

/** Emissão da rodada em uma frase: modo, instante em Brasília e atraso sobre o prazo das 08h00. */
export function textoEmissao(r: { emitido_em: string; atraso_min: number | null; modo: string; prazo: string | null }): string {
  const modo = r.modo === "agendada" ? "pelo agendamento" : r.modo === "manual" ? "manualmente" : `(${r.modo})`;
  const base = `emitida ${modo} em ${instanteBR(r.emitido_em)}`;
  if (r.prazo === null || r.atraso_min === null) return `${base}, sem prazo registrado`;
  if (r.atraso_min <= 0) return `${base}, dentro do prazo das 08h00`;
  return `${base}, ${num(r.atraso_min, 0)} minutos depois do prazo das 08h00`;
}

/** Emissão da rodada em palavras de leitor: o modo e se foi depois do prazo das 08h00, sem os minutos de atraso (que ficam em Analisar). */
export function textoEmissaoLeitor(r: { atraso_min: number | null; modo: string; prazo: string | null }): string {
  const modo = r.modo === "agendada" ? "pelo agendamento" : r.modo === "manual" ? "manualmente" : `(${r.modo})`;
  if (r.prazo === null || r.atraso_min === null) return `emitida ${modo}, sem prazo registrado`;
  return r.atraso_min <= 0 ? `emitida ${modo}, dentro do prazo das 08h00` : `emitida ${modo}, depois do prazo das 08h00`;
}

/**
 * Defasagem da rodada mais recente em relação ao último dia cujo prazo já passou
 * na verificação da gold (rotina.dias_vencidos_ate): 0 quando a rodada é desse dia.
 * Usa só datas da gold, nunca o relógio do build.
 */
export function diasSemRodada(origem: string | null, diasVencidosAte: string): number | null {
  if (!origem) return null;
  return Math.max(0, diasEntre(origem, diasVencidosAte));
}

/* ---------------------------------------------------------------- P013: previsão atual */

export type LinhaGrade = {
  id: string;
  submercado: Submercado;
  sm: string;
  horizonte: Horizonte;
  entrega: string;
  inicio: string;
  fim: string;
  previsao: number | null;
  p10: number | null;
  p90: number | null;
  calibracao: string;
  piso: number | null;
  teto: number | null;
  limites: string;
  ajustada: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  capturado_em: string | null;
  fracao_conhecida: number | null;
  motivo: string;
  forecast_id: string;
  evidencia: string | null;
  /** Primeiro dia fora da entrega (AAAA-MM-DD): o realizado só existe a partir dele. */
  termina: string | null;
  /** Média do PLD da entrega, quando ela já terminou e as horas estão publicadas; null enquanto a entrega não termina. */
  realizado: number | null;
  /** Previsão menos realizado (R$/MWh); null sem realizado. */
  erro: number | null;
};

/**
 * Uma linha por célula da grade 4 × 7, na ordem submercado (SE, S, NE, N) e horizonte (W1 a M3). Com as apurações do
 * acompanhamento (`prospectivo.apuracoes`), cada linha leva também o realizado e o erro da própria célula, ligados pelo
 * identificador; sem elas, os dois ficam null (a entrega ainda não terminou).
 */
export function linhasGrade(celulas: readonly CelulaAtual[], apuracoes: readonly Pick<Apuracao, "forecast_id" | "realizado" | "erro">[] = []): LinhaGrade[] {
  const ordem = (c: CelulaAtual) => SUBMERCADOS.indexOf(c.submercado) * 10 + HORIZONTES.indexOf(c.horizonte);
  const apurada = new Map(apuracoes.map((a) => [a.forecast_id, a]));
  return [...celulas]
    .sort((a, b) => ordem(a) - ordem(b))
    .map((c) => {
      const d = diasDaEntrega(c.entrega);
      return {
        termina: fimDaEntrega(c.entrega.id),
        realizado: apurada.get(c.forecast_id)?.realizado ?? null,
        erro: apurada.get(c.forecast_id)?.erro ?? null,
        id: `${c.horizonte}:${c.submercado}`,
        submercado: c.submercado,
        sm: CURTO_SM[c.submercado] ?? c.submercado,
        horizonte: c.horizonte,
        entrega: c.entrega.id,
        inicio: d.inicio,
        fim: d.ultimo,
        previsao: c.previsao,
        p10: c.quantis?.p10 ?? null,
        p90: c.quantis?.p90 ?? null,
        calibracao: rotuloCalibracao(c.calibracao_recalculada ?? c.calibracao),
        piso: c.limites?.piso_medio ?? null,
        teto: c.limites?.teto_estrutural_medio ?? null,
        limites: c.limites === null ? "sem limites registrados" : c.limites.provisoria ? "provisórios" : "dos atos publicados",
        ajustada: c.ajustada_ao_limite === null ? "não se aplica" : c.ajustada_ao_limite ? "sim" : "não",
        periodo_inicio: c.periodo_usado?.inicio ?? null,
        periodo_fim: c.periodo_usado ? diaAnterior(c.periodo_usado.fim) : null,
        capturado_em: c.periodo_usado?.capturado_em ?? null,
        fracao_conhecida: c.fracao_conhecida === null ? null : c.fracao_conhecida * 100,
        motivo: c.previsao === null ? textoMotivo(c.motivo) || "motivo não registrado" : "não se aplica (célula com número)",
        forecast_id: c.forecast_id,
        evidencia: c.evidencia,
      };
    });
}

/** O identificador técnico de cada célula (forecast_id) fica no CSV do arquivo de emissões e no detalhe em Auditar, não na tabela de Entender. */
export const COLUNAS_GRADE: ColunaTabela[] = [
  { id: "sm", rotulo: "Submercado", tipo: "texto", categorica: true },
  { id: "horizonte", rotulo: "Horizonte", tipo: "texto", categorica: true },
  { id: "entrega", rotulo: "Entrega", tipo: "texto" },
  { id: "inicio", rotulo: "Primeiro dia", tipo: "data" },
  { id: "fim", rotulo: "Último dia", tipo: "data" },
  { id: "previsao", rotulo: "Referência B0", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "p10", rotulo: "P10", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "p90", rotulo: "P90", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "calibracao", rotulo: "Calibração da faixa", tipo: "texto", categorica: true },
  { id: "piso", rotulo: "Piso médio da entrega", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "teto", rotulo: "Teto estrutural médio", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "limites", rotulo: "Limites", tipo: "texto", categorica: true },
  { id: "ajustada", rotulo: "Ajustada ao limite", tipo: "texto", categorica: true },
  { id: "periodo_inicio", rotulo: "Período usado: início", tipo: "data" },
  { id: "periodo_fim", rotulo: "Período usado: fim", tipo: "data" },
  { id: "fracao_conhecida", rotulo: "Fração já publicada no corte", tipo: "percentual", casas: 0 },
  { id: "motivo", rotulo: "Motivo sem número", tipo: "texto" },
  { id: "realizado", rotulo: "Realizado", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "erro", rotulo: "Erro (previsão menos realizado)", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "termina", rotulo: "Entrega termina em", tipo: "data", nivel: "analisar" },
];

/** Grade compacta 4 × 7 (submercado × horizonte) com os mesmos números da tabela longa. */
export function matrizGrade(linhas: readonly LinhaGrade[]): { submercado: Submercado; valores: (number | null)[] }[] {
  return SUBMERCADOS.filter((sm) => linhas.some((l) => l.submercado === sm)).map((sm) => ({
    submercado: sm,
    valores: HORIZONTES.map((h) => linhas.find((l) => l.submercado === sm && l.horizonte === h)?.previsao ?? null),
  }));
}

type Extremo = { valor: number; sm: Submercado };
function extremos(linhas: readonly LinhaGrade[], freq: "W" | "M"): { min: Extremo; max: Extremo; horizontes: Horizonte[]; inicio: string; fim: string } | null {
  const ls = linhas.filter((l) => l.horizonte.startsWith(freq) && l.previsao !== null);
  if (!ls.length) return null;
  let min: Extremo = { valor: ls[0].previsao as number, sm: ls[0].submercado };
  let max = min;
  for (const l of ls) {
    const v = l.previsao as number;
    if (v < min.valor) min = { valor: v, sm: l.submercado };
    if (v > max.valor) max = { valor: v, sm: l.submercado };
  }
  const hs = HORIZONTES.filter((h) => h.startsWith(freq) && ls.some((l) => l.horizonte === h));
  const inicio = ls.reduce((a, l) => (l.inicio < a ? l.inicio : a), ls[0].inicio);
  const fim = ls.reduce((a, l) => (l.fim > a ? l.fim : a), ls[0].fim);
  return { min, max, horizontes: hs, inicio, fim };
}

function faixaDeValores(e: NonNullable<ReturnType<typeof extremos>>): string {
  if (Math.abs(e.max.valor - e.min.valor) < 0.005) return `${reaisMWh(e.min.valor)} em todos os submercados`;
  return `de ${reaisMWh(e.min.valor)} (${CURTO_SM[e.min.sm]}) a ${reaisMWh(e.max.valor)} (${CURTO_SM[e.max.sm]}), conforme o submercado`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (dia: string) => `${MESES[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}`;
/** "outubro a dezembro de 2026"; anos diferentes: "novembro de 2026 a janeiro de 2027". */
function intervaloMeses(a: string, b: string): string {
  if (a.slice(0, 7) === b.slice(0, 7)) return nomeMes(a);
  return a.slice(0, 4) === b.slice(0, 4) ? `${MESES[Number(a.slice(5, 7)) - 1]} a ${nomeMes(b)}` : `${nomeMes(a)} a ${nomeMes(b)}`;
}
/** "03/10 a 30/10/2026"; anos diferentes: datas completas. */
function intervaloDias(a: string, b: string): string {
  return a.slice(0, 4) === b.slice(0, 4) ? `${dataBR(a).slice(0, 5)} a ${dataBR(b)}` : `${dataBR(a)} a ${dataBR(b)}`;
}

/**
 * Resposta curta do P013. Diz primeiro se há previsão oficial (modelo em produção),
 * depois o intervalo dos números publicados por frequência e a situação da faixa.
 */
export function respostaP013(g: Pick<PrevisoesDesempenhoGold, "previsao_atual" | "modelos">): string {
  const at = g.previsao_atual;
  const producao = g.modelos.filter((m) => m.estado === "PRODUCAO").map((m) => m.codigo);
  const oficial = producao.length
    ? `Modelo em produção: ${producao.join(", ")}.`
    : "Não há previsão oficial do PLD: nenhum modelo está aprovado para produção.";
  if (!temRodada(at)) return `${oficial} Nenhuma rodada com números está publicada: ${at.motivo}`;
  const linhas = linhasGrade(at.celulas);
  const com = linhas.filter((l) => l.previsao !== null).length;
  if (com === 0) {
    const motivos = Array.from(new Set(linhas.map((l) => l.motivo).filter(Boolean)));
    return `${oficial} A rodada de ${dataBR(at.origem)} não tem número em nenhuma das ${linhas.length} células${motivos.length ? `: ${motivos.join("; ")}` : ""}.`;
  }
  const w = extremos(linhas, "W");
  const m = extremos(linhas, "M");
  const partes: string[] = [];
  const hs = (e: NonNullable<typeof w>) => (e.horizontes.length > 1 ? `${e.horizontes[0]} a ${e.horizontes[e.horizontes.length - 1]}` : e.horizontes[0]);
  if (w) partes.push(`para cada semana de ${intervaloDias(w.inicio, w.fim)} (${hs(w)}), ${faixaDeValores(w)}`);
  if (m) partes.push(`para cada mês de ${intervaloMeses(m.inicio, m.fim)} (${hs(m)}), ${faixaDeValores(m)}`);
  const ref = /refer[eê]ncia experimental/i.test(at.rotulo)
    ? `A referência experimental B0 (persistência) da rodada de ${dataBR(at.origem)} repete o PLD médio do último período completo: `
    : `A rodada de ${dataBR(at.origem)} publica `;
  const semNumero = linhas.length - com;
  const lacuna = semNumero ? ` ${plural(semNumero, "célula fica", "células ficam")} sem número, com o motivo.` : "";
  const comFaixa = linhas.filter((l) => l.p10 !== null && l.p90 !== null).length;
  const faixa = comFaixa
    ? ` Faixa P10 a P90 publicada em ${comFaixa} de ${linhas.length} células.`
    : " Sem faixa de incerteza: nenhum segmento está calibrado.";
  return `${oficial} ${ref}${partes.join("; ")}.${lacuna}${faixa}`;
}

/** KPI do PLD já publicado no corte, por submercado (dado observado, não previsão). */
export function textoPublicadoNoCorte(pub: Pick<PublicadoNoCorte, "origem" | "submercados"> | null, sm: Submercado): string {
  if (!pub) return "A rodada não registrou o PLD já publicado no corte.";
  const x = pub.submercados[sm];
  if (!x || !x.horas || x.media === null) return `Nenhuma hora de ${dataBR(pub.origem)} depois do corte estava capturada para o ${CURTO_SM[sm]}.`;
  return (
    `Para o resto de ${dataBR(pub.origem)} (${plural(x.horas, "hora", "horas")}, das ${x.primeira?.slice(11, 13)}h às ${x.ultima?.slice(11, 13)}h), o PLD do ${CURTO_SM[sm]} ` +
    `já estava publicado no corte: média de ${reaisMWh(x.media)}, de ${reaisMWh(x.minimo)} a ${reaisMWh(x.maximo)}. É dado observado, e nenhuma entrega prevista inclui essas horas.`
  );
}

/** Linhas do gráfico do PLD já publicado no corte: uma por hora, uma coluna por submercado. */
export function linhasPublicadoNoCorte(pub: Pick<PublicadoNoCorte, "submercados"> | null): Record<string, string | number | null>[] {
  if (!pub) return [];
  const horas = Array.from(new Set(SUBMERCADOS.flatMap((sm) => (pub.submercados[sm]?.valores ?? []).map(([h]) => h)))).sort();
  return horas.map((h) => {
    const l: Record<string, string | number | null> = { h };
    for (const sm of SUBMERCADOS) l[sm] = pub.submercados[sm]?.valores.find(([x]) => x === h)?.[1] ?? null;
    return l;
  });
}

/**
 * "O que mudou" no P013: a rodada mais recente comparada com a anterior (números
 * emitidos) e a revisão entre rodadas para as mesmas entregas.
 */
export function oQueMudouRodada(g: Pick<PrevisoesDesempenhoGold, "prospectivo">): string {
  const rs = [...g.prospectivo.rodadas].sort((a, b) => (a.origem === b.origem ? a.emitido_em.localeCompare(b.emitido_em) : a.origem.localeCompare(b.origem)));
  if (!rs.length) return "Nenhuma rodada registrada.";
  const ult = rs[rs.length - 1];
  const ant = rs.length > 1 ? rs[rs.length - 2] : null;
  const atual = `Rodada de ${dataBR(ult.origem)}: ${ult.com_numero} de ${ult.celulas} células com número.`;
  const anterior = ant
    ? ` A anterior, de ${dataBR(ant.origem)}, ${ant.com_numero === 0 ? "não tinha nenhuma" : `tinha ${ant.com_numero}`}${ant.motivos.length ? ` (${ant.motivos.map(textoMotivo).join("; ")})` : ""}.`
    : " É a primeira rodada registrada.";
  const revistas = g.prospectivo.revisoes_entre_rodadas.filter((r) => r.sequencia.length > 1);
  const revisao = revistas.length
    ? ` ${plural(revistas.length, "entrega teve", "entregas tiveram")} previsão revista entre rodadas (detalhe no arquivo de emissões).`
    : " Nenhuma entrega tem duas previsões com número, então ainda não há revisão entre rodadas a comparar.";
  return `${atual}${anterior}${revisao}`;
}

/* ---------------------------------------------------------------- P015: arquivo de emissões */

/** Uma linha do CSV publicado do arquivo (public/energia/series/previsoes_emissoes.csv), já tipada. */
export type LinhaArquivo = {
  id: string;
  /** Nome legível do registro (modelo, horizonte, submercado e rodada), no lugar do identificador técnico. */
  linha: string;
  forecast_id: string;
  run_id: string;
  tipo: string;
  modelo: string;
  versao_modelo: string;
  origem: string;
  cutoff: string;
  prazo: string | null;
  emitido_em: string;
  emitido: string;
  atraso_min: number | null;
  atraso_origem: string;
  modo: string;
  horizonte: string;
  entrega: string;
  submercado: string;
  sm: string;
  status: string;
  com_numero: string;
  previsao: number | null;
  p10: number | null;
  p90: number | null;
  mudanca: number | null;
  motivo: string;
  realizado: number | null;
  erro: number | null;
  sha256: string;
  versao_codigo: string;
  registrado_no_portal_em: string;
  transcrito: string;
  alertas: string;
  substitui: string;
  anterior: string;
};

const numeroCsv = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

/**
 * Número de rodada interna de modelo fora de produção nunca aparece como previsão na
 * interface (regra da governança: só PRODUÇÃO alimenta previsão, e a retenção alcança
 * o número de rodada interna dos candidatos). A referência experimental B0 é a exceção
 * autorizada (especificação, seção 12.4) e tem tipo próprio.
 */
export function numeroRetido(tipo: string, estadoModelo: string | null | undefined): boolean {
  return tipo === "RODADA_INTERNA" && estadoModelo !== "PRODUCAO";
}

/**
 * Converte as linhas cruas do CSV (texto) para a tabela: números com ponto decimal,
 * vazio como ausência, códigos traduzidos ao lado do valor gravado. O registro é
 * "transcrito" quando entrou no arquivo do observatório em dia posterior ao da
 * emissão (Brasília): não é emissão original do observatório. `estados` traz o
 * estado de cada modelo (gold.modelos) para aplicar numeroRetido.
 */
export function linhasArquivo(brutas: readonly Record<string, string>[], estados: Record<string, string> = {}): LinhaArquivo[] {
  return brutas.map((r) => {
    const emitidoDia = diaBrasilia(r.emitido_em) ?? r.emitido_em.slice(0, 10);
    const reg = r.registrado_no_portal_em ?? "";
    const gravada = numeroCsv(r.previsao);
    const retido = gravada !== null && numeroRetido(r.tipo, estados[r.modelo]);
    const previsao = retido ? null : gravada;
    return {
      id: r.forecast_id,
      linha: `${r.modelo} ${r.horizonte} ${CURTO_SM[r.submercado] ?? r.submercado}, rodada de ${dataBR(r.origem)}`,
      forecast_id: r.forecast_id,
      run_id: r.run_id,
      tipo: rotuloTipo(r.tipo),
      modelo: r.modelo,
      versao_modelo: r.versao_modelo ?? "",
      origem: r.origem,
      cutoff: r.cutoff,
      prazo: r.prazo || null,
      emitido_em: r.emitido_em,
      emitido: instanteBR(r.emitido_em),
      atraso_min: numeroCsv(r.atraso_min),
      atraso_origem: r.atraso_origem ?? "",
      modo: r.modo ?? "",
      horizonte: r.horizonte,
      entrega: r.entrega,
      submercado: r.submercado,
      sm: CURTO_SM[r.submercado] ?? r.submercado,
      status: r.status,
      com_numero: retido ? "número retido (rodada interna)" : previsao === null ? "sem número" : "com número",
      previsao,
      p10: retido ? null : numeroCsv(r.p10),
      p90: retido ? null : numeroCsv(r.p90),
      mudanca: retido ? null : numeroCsv(r.mudanca),
      motivo: retido ? "número de rodada interna retido: modelo fora de produção" : textoMotivo(r.motivo),
      realizado: numeroCsv(r.realizado),
      erro: retido ? null : numeroCsv(r.erro),
      sha256: r.sha256,
      versao_codigo: r.versao_codigo ?? "",
      registrado_no_portal_em: reg,
      transcrito: reg && reg > emitidoDia ? "sim, incluído depois da emissão" : "não",
      alertas: textoAlertas((r.alertas ?? "").split(",").filter(Boolean)),
      substitui: r.substitui ?? "",
      anterior: r.anterior ?? "",
    };
  });
}

/**
 * Colunas da tabela do arquivo. Versão do modelo, origem do atraso, alertas, correção e
 * encadeamento ficam no detalhe do registro escolhido e no CSV completo (download), para
 * a página não levar 27 colunas por linha (contrato, seção 5.1).
 */
export const COLUNAS_ARQUIVO: ColunaTabela[] = [
  { id: "origem", rotulo: "Origem", tipo: "data" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "modelo", rotulo: "Modelo", tipo: "texto", categorica: true },
  { id: "horizonte", rotulo: "Horizonte", tipo: "texto", categorica: true },
  { id: "entrega", rotulo: "Entrega", tipo: "texto" },
  { id: "sm", rotulo: "Submercado", tipo: "texto", categorica: true },
  { id: "com_numero", rotulo: "Número", tipo: "texto", categorica: true },
  { id: "previsao", rotulo: "Previsão arquivada", tipo: "numero", unidade: "R$/MWh", casas: 4 },
  { id: "p10", rotulo: "P10", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "p90", rotulo: "P90", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "mudanca", rotulo: "Mudança sobre a rodada anterior", tipo: "numero", unidade: "R$/MWh", casas: 4 },
  { id: "motivo", rotulo: "Motivo sem número", tipo: "texto" },
  { id: "realizado", rotulo: "Realizado", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "erro", rotulo: "Erro (previsão menos realizado)", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "emitido", rotulo: "Emitida em (Brasília)", tipo: "texto" },
  { id: "atraso_min", rotulo: "Atraso sobre o prazo", tipo: "numero", unidade: "min", casas: 1 },
  { id: "modo", rotulo: "Modo", tipo: "texto", categorica: true },
  { id: "registrado_no_portal_em", rotulo: "Incluída no arquivo em", tipo: "data" },
  { id: "transcrito", rotulo: "Transcrita depois da emissão", tipo: "texto", categorica: true },
  { id: "versao_codigo", rotulo: "Versão do código", tipo: "texto" },
  { id: "sha256", rotulo: "sha256 do registro", tipo: "texto" },
  { id: "forecast_id", rotulo: "Identificador", tipo: "texto" },
];

/**
 * Colunas da tabela do arquivo: o nome legível do registro à frente, sem a versão do código; o sha256 e o identificador técnico ficam
 * no fim da tabela e só aparecem em Auditar (conferência contra o CSV), além do detalhe do registro em Analisar e Auditar e do CSV
 * completo do download.
 */
export const COLUNAS_ARQUIVO_TABELA: ColunaTabela[] = [
  { id: "linha", rotulo: "Registro", tipo: "texto" },
  ...COLUNAS_ARQUIVO.filter((c) => !["forecast_id", "sha256", "versao_codigo"].includes(c.id)),
  // a conferência registro a registro contra o CSV precisa do hash e do identificador: só em Auditar
  ...COLUNAS_ARQUIVO.filter((c) => ["sha256", "forecast_id"].includes(c.id)).map((c) => ({ ...c, nivel: "auditar" as const })),
];

/** Dias (Brasília) em que registros entraram no arquivo, em ordem. */
export function datasInclusao(linhas: readonly LinhaArquivo[]): string[] {
  return Array.from(new Set(linhas.map((l) => l.registrado_no_portal_em).filter(Boolean))).sort();
}

/** O arquivo como estava ao fim de um dia: só registros incluídos até ele (sem data = todos). */
export function arquivoAte(linhas: readonly LinhaArquivo[], dia: string): LinhaArquivo[] {
  return dia ? linhas.filter((l) => l.registrado_no_portal_em !== "" && l.registrado_no_portal_em <= dia) : [...linhas];
}

export type ResumoRodada = {
  id: string;
  rotulo: string;
  run_id: string;
  origem: string;
  emitido_em: string;
  registrado: string;
  tipo: string;
  modelo: string;
  celulas: number;
  com_numero: number;
  sem_numero: number;
  atraso_min: number | null;
  atraso_origem: string;
  modo: string;
  transcrito: boolean;
  motivos: string[];
};

/** Uma linha por rodada, contada a partir das MESMAS linhas da tabela (gráfico e tabela não divergem). */
export function resumoRodadas(linhas: readonly LinhaArquivo[]): ResumoRodada[] {
  const grupos = new Map<string, LinhaArquivo[]>();
  for (const l of linhas) grupos.set(l.run_id, [...(grupos.get(l.run_id) ?? []), l]);
  return Array.from(grupos.entries())
    .map(([run, ls]) => {
      const com = ls.filter((l) => l.previsao !== null).length;
      const l0 = ls[0];
      return {
        id: run,
        rotulo: `Rodada de ${dataBR(l0.origem)}`,
        run_id: run,
        origem: l0.origem,
        emitido_em: l0.emitido_em,
        registrado: l0.registrado_no_portal_em,
        tipo: Array.from(new Set(ls.map((l) => l.tipo))).join(", "),
        modelo: Array.from(new Set(ls.map((l) => l.modelo))).join(", "),
        celulas: ls.length,
        com_numero: com,
        sem_numero: ls.length - com,
        atraso_min: l0.atraso_min,
        atraso_origem: l0.atraso_origem,
        modo: l0.modo,
        transcrito: ls.some((l) => l.transcrito !== "não"),
        motivos: Array.from(new Set(ls.map((l) => l.motivo).filter(Boolean))),
      };
    })
    .sort((a, b) => (a.origem === b.origem ? a.emitido_em.localeCompare(b.emitido_em) : a.origem.localeCompare(b.origem)));
}

/**
 * Recorte publicado na página: as `max` rodadas mais recentes (o CSV completo é o
 * download). Evita levar o arquivo inteiro ao HTML quando ele crescer com as rodadas
 * diárias (contrato, seção 5.1).
 */
export function rodadasRecentes(linhas: readonly LinhaArquivo[], max: number): { linhas: LinhaArquivo[]; omitidas: number } {
  const rs = resumoRodadas(linhas);
  if (rs.length <= max) return { linhas: [...linhas], omitidas: 0 };
  const manter = new Set(rs.slice(-max).map((r) => r.run_id));
  return { linhas: linhas.filter((l) => manter.has(l.run_id)), omitidas: rs.length - max };
}

/** Primeira entrega com número ainda sem realizado e o dia em que termina. */
export function primeiraEntregaAMaturar(linhas: readonly { entrega: string; previsao: number | null; realizado: number | null }[]): { entrega: string; termina: string } | null {
  let melhor: { entrega: string; termina: string } | null = null;
  for (const l of linhas) {
    if (l.previsao === null || l.realizado !== null) continue;
    const t = fimDaEntrega(l.entrega);
    if (t && (!melhor || t < melhor.termina)) melhor = { entrega: l.entrega, termina: t };
  }
  return melhor;
}

function fraseRodada(r: ResumoRodada): string {
  const atraso = r.atraso_min !== null && r.atraso_min > 0 ? `, emitida ${num(r.atraso_min, 0)} minutos depois do prazo,` : r.atraso_min === 0 ? ", emitida no prazo," : "";
  const quem = `A rodada de ${dataBR(r.origem)} (${r.modelo}, ${r.tipo})${atraso}`;
  const numero =
    r.com_numero === 0
      ? `não tem número${r.motivos.length ? `: ${r.motivos.join("; ")}` : ""}`
      : r.sem_numero === 0
        ? `tem ${plural(r.com_numero, "número", "números")}`
        : `tem ${r.com_numero} de ${r.celulas} células com número`;
  const transc = r.transcrito ? `; foi transcrita para o arquivo em ${dataBR(r.registrado)}, depois da emissão` : "";
  return `${quem} ${numero}${transc}.`;
}

/** Resposta curta do P015 sobre o recorte exibido (o mesmo da tabela e do gráfico). */
export function respostaP015(linhas: readonly LinhaArquivo[], dia: string, total: number): string {
  if (!linhas.length) return dia ? `Nenhum registro estava no arquivo ao fim de ${dataBR(dia)}.` : "O arquivo de emissões não tem registro publicado.";
  const rs = resumoRodadas(linhas);
  const quando = dia ? `Ao fim de ${dataBR(dia)}, o arquivo tinha` : "O arquivo tem";
  const parcial = dia && linhas.length < total ? ` (de ${total.toLocaleString("pt-BR")} no arquivo completo)` : "";
  const abertura = `${quando} ${plural(linhas.length, "registro", "registros")}${parcial} de ${plural(rs.length, "rodada", "rodadas")}.`;
  const apurados = linhas.filter((l) => l.realizado !== null).length;
  const prox = primeiraEntregaAMaturar(linhas);
  const comNumero = linhas.filter((l) => l.previsao !== null).length;
  const realizado =
    comNumero === 0
      ? ""
      : apurados === 0
        ? ` Nenhuma entrega prevista terminou: ainda não há realizado${prox ? `; a primeira, ${prox.entrega}, termina em ${dataBR(prox.termina)}` : ""}.`
        : ` ${apurados} de ${comNumero} previsões com número já têm realizado${prox ? `; a próxima entrega a terminar, ${prox.entrega}, termina em ${dataBR(prox.termina)}` : ""}.`;
  return `${abertura} ${rs.map(fraseRodada).join(" ")}${realizado}`;
}

/** Linhas do gráfico de rodadas: células com e sem número, e atraso (minutos). */
export function linhasGraficoRodadas(rs: readonly ResumoRodada[]): Record<string, string | number | null>[] {
  return rs.map((r) => ({ id: r.id, rotulo: r.rotulo, com_numero: r.com_numero, sem_numero: r.sem_numero, atraso_min: r.atraso_min }));
}

/* ---------------------------------------------------------------- P014: registro de modelos */

const ORDEM_MODELOS: CodigoModelo[] = ["B0", "S0", "C1", "C2-P", "C2-H"];
export function fichasOrdenadas(fichas: readonly Ficha[]): Ficha[] {
  return [...fichas].sort((a, b) => ORDEM_MODELOS.indexOf(a.codigo) - ORDEM_MODELOS.indexOf(b.codigo));
}

/** "0.005 R$/MWh (previsão ...)" → "R$ 0,005/MWh"; texto sem número fica como veio. */
export function textoTolerancia(t: string | null | undefined): string {
  if (!t) return "sem tolerância registrada";
  const m = /^(\d+(?:\.\d+)?)\s*R\$\/MWh/.exec(t.trim());
  if (!m) return t;
  const casas = (m[1].split(".")[1] ?? "").length;
  return `R$ ${num(Number(m[1]), casas)}/MWh`;
}

/** Estado da reexecução das previsões arquivadas de um modelo, em palavras. */
export function textoReexecucao(f: Ficha): string {
  const r = f.reproducao?.reexecucao_do_arquivo;
  if (!f.implementado_no_repositorio) return "sem reexecução: o modelo não pode ser refeito; a configuração da pesquisa não foi publicada";
  if (!r) return "sem previsão arquivada com número para refazer";
  const div = r.divergentes.length;
  return `${r.conferidas} ${r.conferidas === 1 ? "previsão arquivada refeita" : "previsões arquivadas refeitas"} com o dado do corte, ${div === 0 ? "sem divergência" : `${div} com divergência`} (tolerância ${textoTolerancia(r.tolerancia)})`;
}

/**
 * Fórmula para o leitor de Entender. A de B0 e S0 já é uma frase e fica como está; a dos candidatos C2 (soma ponderada com símbolos e nomes de
 * campo) vira a descrição do que ela faz, lida da própria fórmula do registro: parte do B0, soma uma correção por variável (a variável
 * multiplicada pelo coeficiente) e, com penalização zero, todos os coeficientes são zero e o resultado é o B0. A fórmula exata fica em Analisar.
 */
export function formulaEmPalavras(f: Pick<Ficha, "formula">): string | null {
  if (!f.formula) return null;
  if (!/[Σλ⇒]|_j\b|beta/.test(f.formula)) return f.formula;
  return "B0 mais uma correção para cada variável de entrada: cada variável é multiplicada pelo seu coeficiente e as correções são somadas ao B0. Com a penalização em zero, todos os coeficientes são zero e o resultado é igual ao B0.";
}

export type LinhaModelo = {
  id: string;
  codigo: string;
  nome: string;
  versao: string;
  estado: string;
  papel: string;
  implementado: string;
  emite: string;
  entradas: string;
  n_entradas: number | null;
  formula: string;
  faixa: string;
  reexecucao: string;
  limitacoes: number | null;
  falhas: number | null;
  aprovacao: string;
};

/** Número que o modelo emite no arquivo, na rodada mais recente: referência experimental, só registro, ou nenhum. */
export function emissaoDoModelo(f: Ficha, g: Pick<PrevisoesDesempenhoGold, "previsao_atual">): string {
  if (f.aprovacao.estado === "PRODUCAO") return "previsão principal";
  if (f.aprovacao.referencia_experimental) return "referência experimental publicada";
  if (!f.implementado_no_repositorio) return "não emite: sem implementação";
  const at = g.previsao_atual;
  if ((f.codigo === "C2-P" || f.codigo === "C2-H") && temRodada(at) && !at.candidatos.emitidos) return "não emite: número retido pela governança";
  return "não emite número";
}

export function linhasModelos(g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual">): LinhaModelo[] {
  return fichasOrdenadas(g.fichas).map((f) => ({
    id: slugModelo(f.codigo),
    codigo: f.codigo,
    nome: f.nome,
    versao: f.versao,
    estado: rotuloEstadoModelo(f.estado),
    papel: semCodigosInternos(f.papel ?? "sem papel registrado"),
    implementado: f.implementado_no_repositorio ? "sim" : "não",
    emite: emissaoDoModelo(f, g),
    entradas: f.entradas ? f.entradas.join("; ") : "não publicadas",
    n_entradas: f.entradas ? f.entradas.length : null,
    formula: formulaEmPalavras(f) ?? "não publicada",
    faixa: "sem faixa publicada",
    reexecucao: textoReexecucao(f),
    limitacoes: f.limitacoes ? f.limitacoes.length : null,
    falhas: f.falhas_conhecidas ? f.falhas_conhecidas.length : null,
    aprovacao: semCodigosInternos(f.aprovacao.leitura.trim()),
  }));
}

export const COLUNAS_MODELOS: ColunaTabela[] = [
  { id: "codigo", rotulo: "Modelo", tipo: "texto" },
  { id: "nome", rotulo: "Nome", tipo: "texto" },
  { id: "versao", rotulo: "Versão", tipo: "texto" },
  { id: "estado", rotulo: "Estado", tipo: "texto", categorica: true },
  { id: "papel", rotulo: "Papel", tipo: "texto" },
  { id: "implementado", rotulo: "Implementado pelo observatório", tipo: "texto", categorica: true },
  { id: "emite", rotulo: "Número no arquivo", tipo: "texto", categorica: true },
  { id: "n_entradas", rotulo: "Entradas", tipo: "numero", unidade: "variáveis", casas: 0 },
  { id: "entradas", rotulo: "Quais entradas", tipo: "texto" },
  { id: "formula", rotulo: "Fórmula", tipo: "texto" },
  { id: "faixa", rotulo: "Faixa de incerteza", tipo: "texto", categorica: true },
  { id: "reexecucao", rotulo: "Reexecução do arquivo", tipo: "texto" },
  { id: "limitacoes", rotulo: "Limitações registradas", tipo: "numero", casas: 0 },
  { id: "falhas", rotulo: "Falhas conhecidas", tipo: "numero", casas: 0 },
  { id: "aprovacao", rotulo: "Aprovação", tipo: "texto" },
];

/** Resposta curta do P014: estado de todos os modelos, papel de cada um e a reexecução do arquivo. */
export function respostaP014(g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual">): string {
  const fs = fichasOrdenadas(g.fichas);
  if (!fs.length) return "Nenhum modelo está registrado nesta publicação.";
  const porEstado = new Map<string, string[]>();
  for (const f of fs) porEstado.set(f.estado, [...(porEstado.get(f.estado) ?? []), f.codigo]);
  const estados =
    porEstado.size === 1
      ? `${fs.length === 1 ? "O único modelo registrado está" : `Os ${fs.length} modelos registrados estão todos`} em ${rotuloEstadoModelo(fs[0].estado)}`
      : `Dos ${fs.length} modelos registrados, ${Array.from(porEstado.entries())
          .map(([e, cs]) => `${cs.join(", ")} em ${rotuloEstadoModelo(e)}`)
          .join("; ")}`;
  const producao = porEstado.get("PRODUCAO") ?? [];
  const oficial = producao.length ? `: ${producao.join(", ")} alimenta a previsão principal.` : ": nenhum alimenta previsão oficial.";
  const ref = fs.filter((f) => f.aprovacao.referencia_experimental).map((f) => f.codigo);
  const semImpl = fs.filter((f) => !f.implementado_no_repositorio).map((f) => f.codigo);
  const retidos = fs.filter((f) => emissaoDoModelo(f, g) === "não emite: número retido pela governança").map((f) => f.codigo);
  const partes: string[] = [];
  if (ref.length) partes.push(`${ref.join(", ")} é publicado só como referência experimental`);
  if (retidos.length) partes.push(`${retidos.join(" e ")}, reimplementados no observatório, não têm número emitido`);
  if (semImpl.length) partes.push(`${semImpl.join(", ")} não pode ser reimplementado; a configuração da pesquisa não está no repositório`);
  const reex = fs.find((f) => f.reproducao?.reexecucao_do_arquivo);
  const reexecucao = reex ? ` Reexecução do ${reex.codigo}: ${textoReexecucao(reex)}.` : "";
  return `${estados}${oficial}${partes.length ? ` ${partes.join("; ")}.` : ""}${reexecucao}`.replace(/^./, (c) => c.toUpperCase());
}

export type LinhaReexecucao = {
  id: string;
  sm: string;
  frequencia: string;
  valor: number | null;
  resultado: string;
  detalhe: string;
};

/**
 * Previsões arquivadas do B0 refeitas com o dado como estava no corte: uma linha por
 * evidência publicada (frequência × submercado), com o resultado do teste de
 * reexecução gravado na própria evidência. A chave (`id`) abre a prova do número.
 */
export function linhasReexecucao(g: Pick<PrevisoesDesempenhoGold, "evidencias">): LinhaReexecucao[] {
  const out: LinhaReexecucao[] = [];
  for (const freq of ["semanal", "mensal"] as const)
    for (const sm of SUBMERCADOS) {
      const id = `b0_${freq}_${sm}`;
      const e = g.evidencias[id];
      if (!e) continue;
      const t = e.testes.find((x) => /^Reexecu/i.test(x.nome));
      out.push({
        id,
        sm: CURTO_SM[sm],
        frequencia: freq === "semanal" ? "semanal (W1 a W4)" : "mensal (M1 a M3)",
        valor: e.valor_calculo,
        resultado: t ? t.resultado : "sem teste de reexecução",
        detalhe: t ? t.detalhe : "",
      });
    }
  return out;
}

/** Resposta curta da ficha de um modelo: estado, o que emite, entradas, fórmula e reexecução. */
export function respostaFicha(f: Ficha, g: Pick<PrevisoesDesempenhoGold, "previsao_atual">): string {
  const estado = `${f.codigo} (${f.nome}, versão ${f.versao}) está em ${rotuloEstadoModelo(f.estado)}`;
  const emite = emissaoDoModelo(f, g);
  if (!f.implementado_no_repositorio)
    return `${estado} e não emite número: ${minusculaInicial(semCaminhosDeArquivo(f.motivo_sem_implementacao ?? "a implementação não está no repositório"))}`.replace(/\.?$/, ".");
  const entradas = f.entradas?.length ? ` Usa ${plural(f.entradas.length, "entrada", "entradas")}: ${f.entradas.join("; ")}.` : "";
  return `${estado}; ${emite}.${entradas} Reexecução: ${textoReexecucao(f)}.`;
}

/* ---------- vereditos (resposta curta, r8): palavras simples, derivados dos mesmos campos das respostas completas */

const primeiraFrase = (t: string) => t.trim().split(/(?<=[.!?])\s+/)[0] ?? t.trim();
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Códigos internos que o texto escrito para a gold carrega e que o leitor de Entender não tem como consultar: a regra de defasagem
 * LAT1D (o registro a define como "um dado só entra se o período terminou até 1 dia antes do corte"), o código do achado ("achado A09") e o
 * código do motivo entre parênteses. O texto original continua em Analisar e Auditar.
 */
export function semCodigosInternos(texto: string): string {
  return texto
    .replace(/;\s*períodos elegíveis sob LAT1D/g, "")
    .replace(/\bLAT1D:\s*dado elegível/g, "Dado elegível")
    .replace(/\b([Rr])egra de defasagem LAT1D\b/g, "$1egra de defasagem de 1 dia")
    .replace(/\bhipótese LAT1D\b/g, "hipótese de defasagem de 1 dia")
    .replace(/\bLAT1D\b/g, "defasagem de 1 dia")
    .replace(/\s*\(achado [A-Z]\d+\)/g, "")
    .replace(/\s*\(seção \d+(?:\.\d+)*\)/g, "")
    .replace(/\s*exigido pela seção \d+(?:\.\d+)*/g, "")
    .replace(/\s*\(([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\)/g, "")
    .replace(/\s*\(G23-R1\)/g, "")
    .replace(/\bBacktest em pseudo tempo real\b/g, "Teste com dados do passado")
    .replace(/\bum único snapshot, capturado em\b/g, "uma única captura dos dados, feita em")
    .replace(/\s*\((?:quantis|perda de quantis)\)/g, "")
    .replace(/\bo risco de look-ahead por revisão\b/g, "o risco de o teste usar valores que só foram revisados depois")
    .replace(/\brisco de look-ahead por revisão\b/g, "risco de o teste usar valores que só foram revisados depois");
}

/**
 * Linguagem de engenharia que o registro usa sobre si mesmo ("repositório", "reimplementar") trocada pelo que o leitor entende: o que
 * está dito é o mesmo, sem apontar para o código do observatório.
 */
export function paraLeitorPrevisoes(texto: string): string {
  return semCodigosInternos(texto)
    .replace(/\bque não está no repositório nem foi publicado\b/g, "que não foi publicado")
    .replace(/\bnão há como reimplementar nem auditar\b/g, "não há como refazer nem auditar")
    .replace(/\breimplementar\b/g, "refazer")
    .replace(/\bno repositório\b/g, "no observatório");
}

/**
 * Separa as frases de um texto escrito para o registro entre as que o leitor lê e as que citam o bastidor da decisão ("implementador",
 * "validacao_observatorio.decisao_publicacao", "decidido_por"). As do bastidor ficam em Analisar e Auditar, na mesma ordem.
 */
export function partirInterno(texto: string): { leitor: string; interno: string } {
  const frases = texto.split(/(?<=[.;])\s+(?=[A-ZÀ-Ú0-9"“(])/);
  const interno = /implementador|validacao_observatorio|decisao_publicacao|decidido_(?:por|em)|\btroca publicar\b|\bpublicar = true\b|\b[a-z]+(?:_[a-z0-9]+){1,}\b/;
  const leitor: string[] = [];
  const bastidor: string[] = [];
  for (const f of frases) (interno.test(f) ? bastidor : leitor).push(f);
  return { leitor: leitor.join(" ").trim(), interno: bastidor.join(" ").trim() };
}

/**
 * O que libera a publicação dos números de desempenho, em palavras: a decisão do responsável pela plataforma, com nome, data e escopo, e a
 * publicação marcada como liberada. É a tradução dos campos que o registro cita (estado, decidido_por, decidido_em, escopo decidido e publicar);
 * o texto original fica em Analisar.
 */
export function liberacaoEmPalavras(paraLiberar: string): string {
  const campos = /decidido_por/.test(paraLiberar) && /decidido_em/.test(paraLiberar) && /LIBERADA/.test(paraLiberar);
  if (!campos) return partirInterno(paraLiberar).leitor || paraLiberar;
  const proxima = /A próxima execução publica os números\./.test(paraLiberar) ? " A próxima execução publica os números." : "";
  return `O responsável pela plataforma registra a decisão de liberar, com o seu nome, a data e o escopo decidido, e marca a publicação como liberada.${proxima}`;
}

/** Corte e origem em palavras do próprio registro: texto de definicoes.corte_operacional sem o fuso e sem "vintages". */
export function explicacaoCorteOrigem(def: Pick<PrevisoesDesempenhoGold["definicoes"], "corte_operacional">): string {
  const base = def.corte_operacional.replace(/\s*\([^)]*\)/g, (m) => (/vintages/.test(m) ? ` (${m.replace(/vintages/g, "versões").replace(/[()]/g, "").trim()})` : ""));
  return `${base.trim()} O dia de origem é o dia da rodada.`;
}

/**
 * Termos da página (corte, origem, rodada, faixa P10 a P90) com o texto do próprio registro de modelos: definicoes.corte_operacional,
 * definicoes.entregas e definicoes.quantis. Cada item só sai quando a definição publicada contém a frase de que ele depende.
 */
export function termosPrevisoes(def: Pick<PrevisoesDesempenhoGold["definicoes"], "corte_operacional" | "entregas" | "quantis">): { termo: string; texto: string }[] {
  const itens: { termo: string; texto: string }[] = [];
  if (def.corte_operacional?.trim()) itens.push({ termo: "Corte e origem", texto: explicacaoCorteOrigem(def) });
  if (/W1 é a primeira semana que começa depois do dia de origem/.test(def.entregas ?? "") && /M1 é o primeiro mês que começa depois do dia de origem/.test(def.entregas ?? ""))
    itens.push({ termo: "W1 a W4 e M1 a M3", texto: "W1 a W4 são as quatro semanas que começam depois do dia de origem, cada uma de um sábado, 0h, até o sábado seguinte, 0h; M1 a M3 são os três meses civis que começam depois dele." });
  const celulas = /(\d+) células por modelo e rodada/.exec(def.entregas ?? "")?.[1];
  if (celulas) itens.push({ termo: "Rodada", texto: `cada emissão de previsões de um dia de origem; tem ${celulas} células por modelo, uma por horizonte e submercado.` });
  const p10 = /o quantil de 10% \(P10\) é o valor que o preço tem 10% de chance de não superar/.test(def.quantis ?? "");
  const faixa = /A faixa entre P10 e P90[^.]*\./.exec(def.quantis ?? "")?.[0];
  if (p10 && faixa) itens.push({ termo: "P10 e P90", texto: `P10 é o valor que o preço tem 10% de chance de não superar. ${faixa.replace(/\s*\(cobertura nominal\)/, "")}` });
  return itens;
}

/**
 * Exemplo concreto de uma ficha, na primeira semana da rodada atual no Sudeste/Centro-Oeste. Do B0, lê a célula publicada (período
 * repetido e número); do S0, que não emite número, só diz que período do ano anterior ele usaria, pela regra do registro de modelos (a semana que
 * começa 364 dias antes da entrega). Outros modelos não têm exemplo.
 */
export function exemploDoModelo(f: Pick<Ficha, "codigo">, g: Pick<PrevisoesDesempenhoGold, "previsao_atual">, metodologia?: string | null): string | null {
  const at = g.previsao_atual;
  if (!temRodada(at)) return null;
  const l = linhasGrade(at.celulas).find((x) => x.horizonte === "W1" && x.submercado === "SE");
  if (!l) return null;
  const semana = `${dataBR(l.inicio)} a ${dataBR(l.fim)}`;
  if (f.codigo === "B0" && l.previsao !== null && l.periodo_inicio && l.periodo_fim)
    return `Exemplo da rodada de ${dataBR(at.origem)}: para a semana de ${semana}, no ${l.sm}, o B0 repete a média de ${dataBR(l.periodo_inicio)} a ${dataBR(l.periodo_fim)}, ${reaisMWh(l.previsao)}.`;
  if (f.codigo === "S0" && metodologia && /364 dias antes da entrega/.test(metodologia))
    return `Exemplo da rodada de ${dataBR(at.origem)}: para a semana de ${semana}, no ${l.sm}, o S0 usaria a média do PLD de ${dataBR(somaDias(l.inicio, -364))} a ${dataBR(somaDias(l.fim, -364))}, a semana que começa 364 dias antes. O observatório não publica número do S0.`;
  return null;
}

/** Explicação curta das entradas dos candidatos C2, lida dos próprios rótulos das entradas e do verbete da MLT (100% é o valor da média de longo termo). */
export function notaEntradas(f: Pick<Ficha, "entradas">): string | null {
  const e = f.entradas ?? [];
  const partes: string[] = [];
  if (e.some((x) => /− B0$/.test(x))) partes.push("Em “X − B0”, o modelo usa a diferença entre X e o B0.");
  if (e.some((x) => /\(% da MLT\) − 100$/.test(x)))
    partes.push("Na ENA em % da MLT, 100 é o valor da média de longo termo: “− 100” é quanto a ENA média dos 7 últimos dias fica acima ou abaixo dessa média.");
  if (e.some((x) => /\(p\.p\.\)/.test(x))) partes.push("p.p. quer dizer ponto percentual.");
  return partes.length ? partes.join(" ") : null;
}

/** Quando a rodada tem referência experimental, e não publicação de modelo em produção. */
const ehReferenciaExperimental = (rotulo: string) => /refer[eê]ncia experimental/i.test(rotulo);

/**
 * Veredito do P013 em palavras simples: se há previsão oficial, o que a página mostra no lugar (a referência simples que repete o
 * PLD médio do último período completo), a faixa de valores publicada e se há faixa de incerteza. Lê as mesmas células que a
 * resposta completa (respostaP013).
 */
export function vereditoP013(g: Pick<PrevisoesDesempenhoGold, "previsao_atual" | "modelos">): string {
  const at = g.previsao_atual;
  const producao = g.modelos.filter((m) => m.estado === "PRODUCAO").map((m) => m.codigo);
  const oficial = producao.length ? `Modelo em produção: ${producao.join(", ")}.` : "Nenhum modelo está aprovado.";
  if (!temRodada(at)) return `${oficial} Nenhuma rodada com números está publicada.`;
  const linhas = linhasGrade(at.celulas);
  const valores = linhas.map((l) => l.previsao).filter((v): v is number => v !== null);
  if (!valores.length) return `${oficial} A rodada de ${dataBR(at.origem)} não tem número em nenhuma das ${linhas.length} células.`;
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const intervalo = menor === maior ? reaisMWh(menor) : `de ${reais(menor)} a ${reaisMWh(maior)}`;
  const comFaixa = linhas.filter((l) => l.p10 !== null && l.p90 !== null).length;
  const faixa = comFaixa ? `Há faixa de incerteza em ${comFaixa} de ${linhas.length} células.` : "Sem faixa de incerteza.";
  const o_que = ehReferenciaExperimental(at.rotulo)
    ? `A referência simples B0 repete o PLD médio do último período completo, ${intervalo}.`
    : `A rodada de ${dataBR(at.origem)} publica ${intervalo} conforme submercado e prazo.`;
  return `${oficial} ${o_que} ${faixa}`;
}

/**
 * Veredito do P014 em palavras simples: estado dos modelos, quais publicam número e por que os outros não. Lê as mesmas fichas
 * que a resposta completa (respostaP014), sem "repositório" nem "reimplementado".
 */
export function vereditoP014(g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual">): string {
  const fs = fichasOrdenadas(g.fichas);
  if (!fs.length) return "Nenhum modelo está registrado nesta publicação.";
  const porEstado = new Map<string, string[]>();
  for (const f of fs) porEstado.set(f.estado, [...(porEstado.get(f.estado) ?? []), f.codigo]);
  const estados =
    porEstado.size === 1
      ? `${fs.length === 1 ? "O único modelo está" : `Os ${fs.length} modelos estão todos`} em ${rotuloEstadoModelo(fs[0].estado)}`
      : `Dos ${fs.length} modelos, ${Array.from(porEstado.entries())
          .map(([e, cs]) => `${cs.join(", ")} em ${rotuloEstadoModelo(e)}`)
          .join("; ")}`;
  const producao = porEstado.get("PRODUCAO") ?? [];
  const oficial = producao.length ? `: ${producao.join(", ")} alimenta a previsão principal.` : ": nenhum alimenta previsão oficial.";
  const ref = fs.filter((f) => f.aprovacao.referencia_experimental).map((f) => f.codigo);
  const semImpl = fs.filter((f) => !f.implementado_no_repositorio).map((f) => f.codigo);
  const retidos = fs.filter((f) => emissaoDoModelo(f, g) === "não emite: número retido pela governança").map((f) => f.codigo);
  const partes: string[] = [];
  if (ref.length) partes.push(`${ref.join(" e ")} ${ref.length > 1 ? "publicam número" : "publica número"} só como referência experimental`);
  if (retidos.length) partes.push(`${retidos.join(" e ")} ${retidos.length > 1 ? "têm" : "tem"} número retido até a liberação formal`);
  if (semImpl.length) partes.push(`${semImpl.join(", ")} não pode ser refeito: a configuração da pesquisa não foi publicada`);
  return `${estados}${oficial}${partes.length ? ` ${maiuscula(partes.join("; "))}.` : ""}`.replace(/^./, (c) => c.toUpperCase());
}

/**
 * Veredito do P015 em palavras simples, sobre o mesmo recorte da tabela: quantos registros e rodadas, quais rodadas têm número e se
 * alguma entrega prevista já terminou. Lê as mesmas linhas que a resposta completa (respostaP015).
 */
export function vereditoP015(linhas: readonly LinhaArquivo[], dia: string, total: number): string {
  if (!linhas.length) return dia ? `Nenhum registro estava no arquivo ao fim de ${dataBR(dia)}.` : "O arquivo de emissões não tem registro publicado.";
  const rs = resumoRodadas(linhas);
  const quando = dia ? `Ao fim de ${dataBR(dia)}, o arquivo tinha` : "O arquivo tem";
  const parcial = dia && linhas.length < total ? ` (de ${total.toLocaleString("pt-BR")} no arquivo completo)` : "";
  const comNumero = rs.filter((r) => r.com_numero > 0);
  const quais =
    comNumero.length === 0
      ? "nenhuma tem número"
      : comNumero.length === rs.length
        ? "todas têm número"
        : comNumero.length === 1
          ? `só a de ${dataBR(comNumero[0].origem)} tem número`
          : `${comNumero.length} têm número`;
  const prevComNumero = linhas.filter((l) => l.previsao !== null).length;
  const apurados = linhas.filter((l) => l.realizado !== null).length;
  const resultado =
    prevComNumero === 0
      ? ""
      : apurados === 0
        ? " Nenhuma entrega prevista terminou, então ainda não há resultado para comparar."
        : ` ${apurados} de ${prevComNumero} previsões com número já têm resultado.`;
  return `${quando} ${plural(linhas.length, "registro", "registros")}${parcial} de ${plural(rs.length, "rodada", "rodadas")}; ${quais}.${resultado}`;
}

/**
 * Veredito do P016 em palavras simples: se já dá para dizer que algum modelo supera as referências simples, por que os números
 * do teste não aparecem e o que o acompanhamento depois da emissão já mostra. Lê os mesmos campos que a resposta completa (respostaP016).
 */
export function vereditoP016(g: Pick<PrevisoesDesempenhoGold, "desempenho" | "publicacao_desempenho" | "prospectivo">): string {
  const ap = g.prospectivo.apuracoes;
  const apuradas = ap.filter((a) => a.realizado !== null).length;
  const acompanhamento =
    ap.length === 0
      ? "O acompanhamento depois da emissão ainda não tem previsão com número."
      : apuradas === 0
        ? `Nenhuma das ${ap.length} previsões em acompanhamento tem resultado.`
        : `${apuradas} de ${ap.length} previsões em acompanhamento já têm resultado.`;
  if (!g.desempenho.publicado)
    return `Ainda não dá para dizer se algum modelo supera as referências simples: os números do teste com dados do passado estão calculados, mas ficam retidos até a liberação formal. ${acompanhamento}`;
  const ganhos = linhasDesempenho(g.desempenho.por_horizonte).filter((l) => l.periodo === "teste" && l.modelo !== "B0" && l.ganho_vs_b0 !== null);
  const positivos = ganhos.filter((l) => l.ic_inf !== null && l.ic_inf > 0);
  const teste = ganhos.length
    ? `No teste final, ${positivos.length} de ${ganhos.length} combinações de candidato e horizonte têm ganho sobre o B0 com intervalo de 90% inteiro acima de zero.`
    : "O teste final não tem comparação pareada com o B0 publicada.";
  return `${teste} ${acompanhamento}`;
}

/**
 * Veredito da ficha de um modelo: a primeira frase do resumo do registro de modelos (escrita em palavras simples) e o estado, o que o
 * modelo emite e, quando não pode ser refeito, o motivo. Sem resumo, só o nome do modelo.
 */
export function vereditoFicha(f: Ficha, resumo: string | null | undefined, g: Pick<PrevisoesDesempenhoGold, "previsao_atual">): string {
  const inicio = resumo?.trim() ? primeiraFrase(resumo) : `${f.codigo} é o modelo ${f.nome}.`;
  const estado = rotuloEstadoModelo(f.estado);
  const emite = emissaoDoModelo(f, g);
  const fim = !f.implementado_no_repositorio
    ? `Está em ${estado} e não emite número: a configuração da pesquisa não foi publicada, então o modelo não pode ser refeito.`
    : f.aprovacao.referencia_experimental
      ? `Está em ${estado}; é publicado só como referência experimental.`
      : emite === "não emite: número retido pela governança"
        ? `Está em ${estado}; o número fica retido até a liberação formal.`
        : `Está em ${estado} e não emite número.`;
  return `${inicio} ${fim}`;
}

/* ---------- coeficientes do último ajuste (C2-P e C2-H) */

export type LinhaCoeficiente = LinhaTabela & {
  id: string;
  modelo: string;
  segmento: string;
  horizonte: string;
  sm: string;
  origem_ajuste: string;
  ajustado: string;
  lambda: string;
  entregas_treino: number | null;
};

/** Variáveis dos candidatos, na ordem do C2-H (o C2-P usa as três primeiras). */
export function variaveisCoeficientes(fichas: readonly Ficha[]): { id: string; rotulo: string }[] {
  const out: { id: string; rotulo: string }[] = [];
  for (const f of fichasOrdenadas(fichas)) for (const v of f.coeficientes_ultimo_ajuste?.variaveis ?? []) if (!out.some((x) => x.id === v.id)) out.push(v);
  return out;
}

export const segmentoId = (h: string, sm: string) => `${h}-${sm}`;

/** Segmentos (horizonte × submercado) presentes no último ajuste, na ordem W1 a M3 e SE, S, NE, N. */
export function segmentosCoeficientes(fichas: readonly Ficha[]): { id: string; rotulo: string }[] {
  const ids = new Set<string>();
  for (const f of fichas) for (const s of f.coeficientes_ultimo_ajuste?.segmentos ?? []) ids.add(segmentoId(s.horizonte, s.submercado));
  const out: { id: string; rotulo: string }[] = [];
  for (const h of HORIZONTES) for (const sm of SUBMERCADOS) if (ids.has(segmentoId(h, sm))) out.push({ id: segmentoId(h, sm), rotulo: `${h}, ${NOME_SM[sm]}` });
  return out;
}

const lambdaTexto = (l: string | number | null) =>
  l === null ? "sem ajuste" : typeof l === "number" ? l.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : l === "ZERO" ? "zero (correção desligada)" : l;

/** Primeira letra minúscula, para citar um texto da gold depois de dois-pontos. */
export const minusculaInicial = (s: string) => (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ](?:[a-záéíóúâêôãõç]| )/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** Tabela de coeficientes: uma linha por modelo e segmento, uma coluna por variável. */
export function linhasCoeficientes(fichas: readonly Ficha[]): LinhaCoeficiente[] {
  const vars = variaveisCoeficientes(fichas);
  const out: LinhaCoeficiente[] = [];
  for (const f of fichasOrdenadas(fichas)) {
    const c = f.coeficientes_ultimo_ajuste;
    if (!c) continue;
    const segs = [...c.segmentos].sort(
      (a, b) => HORIZONTES.indexOf(a.horizonte) * 10 + SUBMERCADOS.indexOf(a.submercado) - (HORIZONTES.indexOf(b.horizonte) * 10 + SUBMERCADOS.indexOf(b.submercado)),
    );
    for (const s of segs) {
      const l: LinhaCoeficiente = {
        id: `${f.codigo}:${segmentoId(s.horizonte, s.submercado)}`,
        modelo: f.codigo,
        segmento: segmentoId(s.horizonte, s.submercado),
        horizonte: s.horizonte,
        sm: CURTO_SM[s.submercado] ?? s.submercado,
        origem_ajuste: s.origem_ajuste,
        ajustado: s.ok ? "sim" : `não: ${textoMotivo(s.motivo)}`,
        lambda: lambdaTexto(s.lambda),
        entregas_treino: s.entregas_treino,
      };
      // variável que o modelo não usa fica null (não se aplica) e não zero
      for (const v of vars) l[v.id] = s.coeficientes?.[v.id] ?? null;
      out.push(l);
    }
  }
  return out;
}

export function colunasCoeficientes(fichas: readonly Ficha[]): ColunaTabela[] {
  return [
    { id: "modelo", rotulo: "Modelo", tipo: "texto", categorica: true },
    { id: "horizonte", rotulo: "Horizonte", tipo: "texto", categorica: true },
    { id: "sm", rotulo: "Submercado", tipo: "texto", categorica: true },
    ...variaveisCoeficientes(fichas).map((v): ColunaTabela => ({ id: v.id, rotulo: v.rotulo, tipo: "numero", casas: 4 })),
    { id: "lambda", rotulo: "Penalização λ", tipo: "texto", categorica: true },
    { id: "entregas_treino", rotulo: "Entregas de treino", tipo: "numero", casas: 0 },
    { id: "origem_ajuste", rotulo: "Ajuste de", tipo: "data" },
    { id: "ajustado", rotulo: "Ajustado", tipo: "texto", categorica: true },
  ];
}

/** Barras do segmento escolhido: uma categoria por variável, uma série por candidato. */
export function coeficientesDoSegmento(fichas: readonly Ficha[], seg: string): Record<string, string | number | null>[] {
  const linhas = linhasCoeficientes(fichas).filter((l) => l.segmento === seg);
  return variaveisCoeficientes(fichas).map((v) => {
    const out: Record<string, string | number | null> = { id: v.id, rotulo: v.rotulo };
    for (const l of linhas) out[l.modelo] = (l[v.id] as number | null) ?? null;
    return out;
  });
}

export const VARIAVEL_D7 = "d7_menos_b0";

/** Segmentos do último ajuste em que o coeficiente da média dos 7 dias − B0 passou de 1 (achado G23-R1). */
export function d7AcimaDe1(fichas: readonly Ficha[]): { modelo: string; segmento: string; valor: number }[] {
  return linhasCoeficientes(fichas)
    .filter((l) => typeof l[VARIAVEL_D7] === "number" && (l[VARIAVEL_D7] as number) > 1)
    .map((l) => ({ modelo: l.modelo, segmento: l.segmento, valor: l[VARIAVEL_D7] as number }));
}

/** Leitura do segmento escolhido: maior peso de cada candidato, λ, treino e o achado G23-R1. */
export function textoCoeficientes(fichas: readonly Ficha[], seg: string): string {
  const linhas = linhasCoeficientes(fichas).filter((l) => l.segmento === seg);
  if (!linhas.length) return "Nenhum candidato tem ajuste registrado neste segmento.";
  const vars = variaveisCoeficientes(fichas);
  const [h, sm] = seg.split("-");
  const frases = linhas.map((l) => {
    let maior: { rotulo: string; valor: number } | null = null;
    for (const v of vars) {
      const x = l[v.id];
      if (typeof x === "number" && (!maior || Math.abs(x) > Math.abs(maior.valor))) maior = { rotulo: v.rotulo.replace(/\s*\([^)]*\)$/, ""), valor: x };
    }
    const peso = maior ? `o maior peso é o da variável "${maior.rotulo}" (${num(maior.valor, 2)})` : "nenhum coeficiente registrado";
    return `no ${l.modelo}, ${peso}, com λ ${l.lambda} e ${l.entregas_treino === null ? "treino sem contagem" : plural(l.entregas_treino, "entrega", "entregas")} de treino`;
  });
  const acima = d7AcimaDe1(fichas).filter((x) => x.segmento === seg);
  const g23 = acima.length
    ? ` Coeficiente da média dos 7 dias menos B0 acima de 1 (${acima.map((x) => `${x.modelo}: ${num(x.valor, 2)}`).join("; ")}): a correção amplia o desvio recente em vez de reduzi-lo.`
    : " Nenhum coeficiente da média dos 7 dias menos B0 passa de 1 neste segmento.";
  return `No ajuste de ${dataBR(linhas[0].origem_ajuste)} para ${h}, ${NOME_SM[sm] ?? sm}: ${frases.join("; ")}.${g23}`;
}

/* ---------------------------------------------------------------- P016: desempenho e calibração */

/**
 * Mínimo de entregas distintas para calibrar uma faixa, lido da definição publicada
 * pelo pipeline ("com pelo menos 100 entregas distintas"). Sem o número no texto,
 * devolve null e o gráfico sai sem a referência (nunca um mínimo presumido).
 */
export function minimoCalibracao(definicao: string): number | null {
  const m = /pelo menos (\d+) entregas/.exec(definicao);
  return m ? Number(m[1]) : null;
}

export type LinhaAmostra = {
  id: string;
  horizonte: string;
  entregas: number | null;
  minimo: number | null;
  faltam: number | null;
  estado: string;
  registros: number;
};

/**
 * Tamanho da amostra de calibração por horizonte: entregas distintas do teste
 * retrospectivo gravadas em cada célula da rodada atual (iguais nos quatro
 * submercados; se diferirem, vale a menor, dita na tabela). É contagem, não
 * desempenho: não está retida.
 */
export function linhasAmostra(g: Pick<PrevisoesDesempenhoGold, "prospectivo" | "definicoes">): LinhaAmostra[] {
  const min = minimoCalibracao(g.definicoes.calibracao);
  const regs = g.prospectivo.calibracao_regra_antiga.por_registro;
  return HORIZONTES.filter((h) => regs.some((r) => r.horizonte === h)).map((h) => {
    const rs = regs.filter((r) => r.horizonte === h);
    const ns = rs.map((r) => r.entregas).filter((n): n is number => typeof n === "number");
    const n = ns.length ? Math.min(...ns) : null;
    const estados = Array.from(new Set(rs.map((r) => rotuloCalibracao(r.status_recalculado))));
    return {
      id: h,
      horizonte: h,
      entregas: n,
      minimo: min,
      faltam: n !== null && min !== null ? Math.max(0, min - n) : null,
      estado: estados.join(", "),
      registros: rs.length,
    };
  });
}

export const COLUNAS_AMOSTRA: ColunaTabela[] = [
  { id: "horizonte", rotulo: "Horizonte", tipo: "texto" },
  { id: "entregas", rotulo: "Entregas distintas no teste", tipo: "numero", casas: 0 },
  { id: "minimo", rotulo: "Mínimo para calibrar", tipo: "numero", casas: 0 },
  { id: "faltam", rotulo: "Faltam", tipo: "numero", casas: 0 },
  { id: "estado", rotulo: "Estado da calibração", tipo: "texto", categorica: true },
  { id: "registros", rotulo: "Células da rodada", tipo: "numero", casas: 0 },
];

export type LinhaProspectivo = {
  id: string;
  horizonte: string;
  registradas: number;
  apuradas: number;
  aguardando: number;
  proxima_entrega: string | null;
  termina: string | null;
};

/** Prospectivo por horizonte: previsões com número registradas, apuradas e a primeira entrega a terminar. */
export function linhasProspectivo(g: Pick<PrevisoesDesempenhoGold, "prospectivo">): LinhaProspectivo[] {
  const ap = g.prospectivo.apuracoes;
  return HORIZONTES.filter((h) => ap.some((a) => a.horizonte === h)).map((h) => {
    const as = ap.filter((a) => a.horizonte === h);
    const prox = primeiraEntregaAMaturar(as);
    const apuradas = as.filter((a) => a.realizado !== null).length;
    return { id: h, horizonte: h, registradas: as.length, apuradas, aguardando: as.length - apuradas, proxima_entrega: prox?.entrega ?? null, termina: prox?.termina ?? null };
  });
}

export const COLUNAS_PROSPECTIVO: ColunaTabela[] = [
  { id: "horizonte", rotulo: "Horizonte", tipo: "texto" },
  { id: "registradas", rotulo: "Previsões com número", tipo: "numero", casas: 0 },
  { id: "apuradas", rotulo: "Com realizado", tipo: "numero", casas: 0 },
  { id: "aguardando", rotulo: "Aguardando o fim da entrega", tipo: "numero", casas: 0 },
  { id: "proxima_entrega", rotulo: "Próxima entrega a terminar", tipo: "texto" },
  { id: "termina", rotulo: "Termina em", tipo: "data" },
];

export const COLUNAS_VALIDACOES: ColunaTabela[] = [
  { id: "nome", rotulo: "Controle", tipo: "texto" },
  { id: "resultado", rotulo: "Resultado", tipo: "texto", categorica: true },
  { id: "detalhe", rotulo: "Detalhe", tipo: "texto" },
];

export const COLUNAS_DECISOES: ColunaTabela[] = [
  { id: "item", rotulo: "Item", tipo: "texto" },
  { id: "estado", rotulo: "Estado", tipo: "texto", categorica: true },
  { id: "responsavel", rotulo: "Quem decide ou comprova", tipo: "texto", categorica: true },
  { id: "evidencia", rotulo: "Evidência", tipo: "texto" },
];

/**
 * Resposta curta do P016. Com os números retidos, diz o que está calculado e
 * validado, por que não aparece, o que o prospectivo já permite dizer e a amostra
 * de calibração; com a publicação liberada, resume o ganho sobre o B0 no teste.
 */
export function respostaP016(g: Pick<PrevisoesDesempenhoGold, "desempenho" | "publicacao_desempenho" | "validacoes" | "dados" | "prospectivo" | "definicoes">): string {
  const aprovados = g.validacoes.filter((v) => v.resultado === "aprovado").length;
  const controles = `${aprovados} de ${g.validacoes.length} controles aprovados`;
  const origens = `${g.dados.origens.n.toLocaleString("pt-BR")} origens diárias de ${dataBR(g.dados.origens.inicio)} a ${dataBR(g.dados.origens.fim)}`;
  const ap = g.prospectivo.apuracoes;
  const apuradas = ap.filter((a) => a.realizado !== null).length;
  const prox = primeiraEntregaAMaturar(ap);
  const prospectivo =
    ap.length === 0
      ? " O acompanhamento prospectivo ainda não tem previsão com número."
      : apuradas === 0
        ? ` No acompanhamento prospectivo, nenhuma das ${ap.length} previsões com número tem realizado${prox ? `: a primeira entrega termina em ${dataBR(prox.termina)}` : ""}.`
        : ` No acompanhamento prospectivo, ${apuradas} de ${ap.length} previsões com número já têm realizado.`;
  const amostra = linhasAmostra(g);
  const semanal = amostra.find((a) => a.horizonte.startsWith("W"))?.entregas ?? null;
  const mensal = amostra.find((a) => a.horizonte.startsWith("M"))?.entregas ?? null;
  const min = minimoCalibracao(g.definicoes.calibracao);
  const calib =
    semanal !== null && mensal !== null && min !== null && Math.max(semanal, mensal) < min
      ? ` Nenhum segmento tem amostra para calibrar faixas: o teste tem ${semanal} entregas semanais e ${mensal} mensais distintas, abaixo do mínimo de ${min}.`
      : "";
  if (!g.desempenho.publicado) {
    const decisao = g.publicacao_desempenho.decisao?.estado === "PENDENTE" || !g.publicacao_desempenho.decisao ? ", ainda não registrada" : "";
    return (
      `Ainda não é possível responder no portal. O teste retrospectivo fora da amostra está calculado (${origens}; ${controles}), ` +
      `mas os números de desempenho ficam retidos até a liberação formal pelo responsável pela plataforma${decisao}.${prospectivo}${calib}`
    );
  }
  const ganhos = linhasDesempenho(g.desempenho.por_horizonte).filter((l) => l.periodo === "teste" && l.modelo !== "B0" && l.ganho_vs_b0 !== null);
  const positivos = ganhos.filter((l) => l.ic_inf !== null && l.ic_inf > 0);
  const resumo = ganhos.length
    ? ` No teste final, ${positivos.length} de ${ganhos.length} combinações de candidato e horizonte têm ganho sobre o B0 com intervalo de 90% inteiro acima de zero.`
    : " O teste final não tem comparação pareada com o B0 publicada.";
  return `Teste retrospectivo fora da amostra (${origens}; ${controles}).${resumo}${prospectivo}${calib}`;
}

export type LinhaDesempenho = {
  id: string;
  modelo: string;
  horizonte: string;
  periodo: string;
  entregas: number;
  mae: number | null;
  mae_b0: number | null;
  vies: number | null;
  ganho_vs_b0: number | null;
  ic_inf: number | null;
  ic_sup: number | null;
  perda_quantilica: number | null;
  cobertura: number | null;
  largura: number | null;
};

/** Métricas publicadas (só com a liberação): uma linha por modelo, horizonte e período; cobertura em %. */
export function linhasDesempenho(ls: readonly LinhaMetrica[]): LinhaDesempenho[] {
  return ls.map((l) => ({
    id: `${l.modelo}:${l.horizonte}:${l.periodo}`,
    modelo: l.modelo,
    horizonte: l.horizonte,
    periodo: l.periodo,
    entregas: l.entregas,
    mae: l.mae,
    mae_b0: l.mae_b0_pareado,
    vies: l.vies,
    ganho_vs_b0: l.ganho_vs_b0,
    ic_inf: l.ganho_ic90?.[0] ?? null,
    ic_sup: l.ganho_ic90?.[1] ?? null,
    perda_quantilica: l.perda_quantilica,
    cobertura: l.cobertura_p10_p90 === null ? null : l.cobertura_p10_p90 * 100,
    largura: l.largura_p10_p90,
  }));
}

export const COLUNAS_DESEMPENHO: ColunaTabela[] = [
  { id: "modelo", rotulo: "Modelo", tipo: "texto", categorica: true },
  { id: "horizonte", rotulo: "Horizonte", tipo: "texto", categorica: true },
  { id: "periodo", rotulo: "Período", tipo: "texto", categorica: true },
  { id: "entregas", rotulo: "Entregas distintas", tipo: "numero", casas: 0 },
  { id: "mae", rotulo: "MAE", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "mae_b0", rotulo: "MAE do B0 nas mesmas células", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "vies", rotulo: "Viés", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "ganho_vs_b0", rotulo: "Ganho sobre o B0", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "ic_inf", rotulo: "IC 90%: limite inferior", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "ic_sup", rotulo: "IC 90%: limite superior", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "perda_quantilica", rotulo: "Perda quantílica", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "cobertura", rotulo: "Cobertura P10 a P90", tipo: "percentual", casas: 1 },
  { id: "largura", rotulo: "Largura P10 a P90", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

/* ---------------------------------------------------------------- downloads */

/** Downloads do painel, a partir da lista publicada pelo pipeline (nenhum endereço escrito à mão). */
export function downloadsDoPainel(g: Pick<PrevisoesDesempenhoGold, "downloads">, id: IdPainelPrevisoes): { rotulo: string; url: string }[] {
  const re: Record<IdPainelPrevisoes, RegExp> = {
    p013: /previsoes_emissoes/,
    p015: /previsoes_emissoes/,
    p014: /previsoes_ajustes_c2|previsoes_emissoes/,
    p016: /previsoes_emissoes/,
  };
  return g.downloads.filter((d) => re[id].test(d.url));
}

/** Partições mensais do arquivo citadas nas provas dos números (endereços publicados pelo pipeline, sem montar à mão). */
export function particoesCitadas(g: Pick<PrevisoesDesempenhoGold, "evidencias">): { rotulo: string; url: string }[] {
  const out = new Map<string, string>();
  for (const e of Object.values(g.evidencias)) for (const d of e.download ?? []) if (/previsoes_emissoes_\d{4}-\d{2}\.json$/.test(d.url)) out.set(d.url, d.rotulo);
  return Array.from(out.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([url, rotulo]) => ({ url, rotulo }));
}

export type LinhaRevisao = { id: string; entrega: string; sm: string; modelo: string; rodadas: number; previsoes: string; ultima_mudanca: number | null };

/** Revisão entre rodadas para a mesma entrega (P015): sequência de previsões com número. */
export function linhasRevisoes(g: Pick<PrevisoesDesempenhoGold, "prospectivo">): LinhaRevisao[] {
  return g.prospectivo.revisoes_entre_rodadas.map((r) => ({
    id: `${r.modelo}:${r.entrega}:${r.submercado}`,
    entrega: r.entrega,
    sm: CURTO_SM[r.submercado] ?? r.submercado,
    modelo: r.modelo,
    rodadas: r.rodadas,
    previsoes: r.sequencia.map((s) => `${dataBR(s.origem)} (${s.horizonte}): ${num(s.previsao, 4)}`).join("; "),
    ultima_mudanca: r.sequencia.length > 1 ? r.sequencia[r.sequencia.length - 1].mudanca : null,
  }));
}

export const COLUNAS_REVISOES: ColunaTabela[] = [
  { id: "entrega", rotulo: "Entrega", tipo: "texto" },
  { id: "sm", rotulo: "Submercado", tipo: "texto", categorica: true },
  { id: "modelo", rotulo: "Modelo", tipo: "texto", categorica: true },
  { id: "rodadas", rotulo: "Rodadas com número", tipo: "numero", casas: 0 },
  { id: "previsoes", rotulo: "Previsões por origem (R$/MWh)", tipo: "texto" },
  { id: "ultima_mudanca", rotulo: "Última mudança", tipo: "numero", unidade: "R$/MWh", casas: 4 },
];

/** Rodada da gold correspondente a um run_id (para o detalhe da linha do arquivo). */
export const rodadaDe = (rodadas: readonly Rodada[], run: string) => rodadas.find((r) => r.run_id === run) ?? null;

/* ---------------------------------------------------------------- redesenho: situação, papel, protocolo e avisos da rodada */

/** "A, B e C": lista em português com "e" antes do último item. */
export const listaE = (itens: readonly string[]) => (itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`);

export type SituacaoModelo = {
  id: "pesquisa" | "experimental" | "validacao" | "producao" | "aposentado";
  rotulo: string;
  definicao: string;
};

/**
 * Pesquisa, referência experimental e produção são situações diferentes. O estado do registro diz se o modelo alimenta a previsão
 * principal (só PRODUÇÃO); a referência experimental é um modelo em pesquisa cujo número é publicado, identificado como tal e sem
 * aprovação. Os textos usam as palavras do próprio registro de modelos.
 */
export function situacaoDoModelo(f: Pick<Ficha, "estado" | "aprovacao">): SituacaoModelo {
  switch (f.estado as EstadoModelo) {
    case "PRODUCAO":
      return { id: "producao", rotulo: "Produção", definicao: "Aprovado: alimenta a previsão principal." };
    case "APOSENTADO":
      return { id: "aposentado", rotulo: "Aposentado", definicao: "Fora de uso; as previsões antigas ficam no arquivo." };
    case "VALIDACAO":
      return { id: "validacao", rotulo: "Validação", definicao: "Avaliado em área técnica; não alimenta a previsão principal." };
    default:
      return f.aprovacao.referencia_experimental
        ? { id: "experimental", rotulo: "Referência experimental", definicao: "Em pesquisa, com número publicado e identificado como experimental, sem aprovação." }
        : { id: "pesquisa", rotulo: "Pesquisa", definicao: "Em estudo: não alimenta previsão." };
  }
}

/** Papel do modelo em poucas palavras ("Referência simples", "Referência sazonal", "Candidato"), sem o comentário entre parênteses do registro. */
export function papelCurto(papel: string | null | undefined): string {
  if (!papel) return "sem papel registrado";
  return semCodigosInternos(papel).split(/\s*[(;]/)[0].trim() || "sem papel registrado";
}

/** Com o que o modelo é comparado: as referências registradas para ele, ou a indicação de que ele próprio é uma referência. */
function comparadoCom(f: Pick<Ficha, "codigo" | "papel">, registro: Pick<ModelosGold, "modelos"> | null | undefined): string {
  const m = registro?.modelos.find((x) => x.codigo === f.codigo);
  if (!m) return "não registrado";
  if (m.benchmarks.length) return listaE(m.benchmarks);
  return /^Refer[eê]ncia/.test(f.papel ?? "") ? "é uma referência de comparação" : "não registrado";
}

/** Protocolo do teste fora da amostra para o modelo: avaliado ou não, e se os números foram liberados. */
function protocoloDoModelo(f: Pick<Ficha, "codigo" | "implementado_no_repositorio">, g: Pick<PrevisoesDesempenhoGold, "modelos" | "desempenho">): string {
  const m = g.modelos.find((x) => x.codigo === f.codigo);
  if (!m?.avaliado) return f.implementado_no_repositorio ? "sem teste fora da amostra" : "sem teste fora da amostra: o modelo não pode ser refeito";
  return g.desempenho.publicado ? "teste fora da amostra publicado" : "teste fora da amostra calculado, com os números retidos";
}

/** Reexecução do arquivo em poucas palavras, para a matriz de modelos. */
export function reexecucaoCurta(f: Pick<Ficha, "implementado_no_repositorio" | "reproducao">): string {
  const r = f.reproducao?.reexecucao_do_arquivo;
  if (!f.implementado_no_repositorio) return "não pode ser refeito";
  if (!r) return "nenhuma previsão arquivada com número para refazer";
  const div = r.divergentes.length;
  return `${plural(r.conferidas, "previsão arquivada refeita", "previsões arquivadas refeitas")}, ${div === 0 ? "sem divergência" : `${div} com divergência`}`;
}

/** Resultado de uma conferência de cálculo em palavras que não sugerem aprovação do método: o observatório refaz a conta, não a valida por fora. */
export const ROTULO_CONFERENCIA: Record<string, string> = { aprovado: "confere", ressalva: "confere com ressalva", reprovado: "não confere" };

/** Uma linha da matriz compacta de modelos (papel, situação, referência, emissão e protocolo). */
export type LinhaMatrizModelo = {
  id: string;
  codigo: string;
  nome: string;
  versao: string;
  papel: string;
  situacao: SituacaoModelo;
  comparado: string;
  emissao: string;
  protocolo: string;
  reexecucao: string;
  /** Revisão registrada para o modelo, nas palavras do registro de modelos (null sem registro). */
  revisao: string | null;
  href: string;
};

export function matrizModelos(
  g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual" | "modelos" | "desempenho">,
  registro: Pick<ModelosGold, "modelos"> | null | undefined,
): LinhaMatrizModelo[] {
  return fichasOrdenadas(g.fichas).map((f) => ({
    id: slugModelo(f.codigo),
    codigo: f.codigo,
    nome: f.nome,
    versao: f.versao,
    papel: papelCurto(f.papel),
    situacao: situacaoDoModelo(f),
    comparado: comparadoCom(f, registro),
    emissao: emissaoDoModelo(f, g),
    protocolo: protocoloDoModelo(f, g),
    reexecucao: reexecucaoCurta(f),
    revisao: registro?.modelos.find((x) => x.codigo === f.codigo)?.auditoria ?? null,
    href: rotaModelo(f.codigo),
  }));
}

/** Ficha resumida de um modelo para comparar lado a lado (a mesma informação que a tabela das fichas). */
export type CartaoModelo = {
  id: string;
  codigo: string;
  nome: string;
  versao: string;
  estado: EstadoModelo;
  papel: string;
  emite: string;
  entradas: string[] | null;
  /** Fórmula em palavras (formulaEmPalavras); a do registro, com os símbolos, fica em formulaRegistro e só aparece em Analisar. */
  formula: string | null;
  formulaRegistro: string | null;
  reexecucao: string;
  limitacao: string | null;
  href: string;
};

export function cartoesModelos(g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual">, registro: Pick<ModelosGold, "modelos"> | null | undefined): CartaoModelo[] {
  return fichasOrdenadas(g.fichas).map((f) => ({
    id: slugModelo(f.codigo),
    codigo: f.codigo,
    nome: f.nome,
    versao: f.versao,
    estado: f.estado,
    papel: semCodigosInternos(f.papel ?? "sem papel registrado"),
    emite: emissaoDoModelo(f, g),
    entradas: f.entradas,
    formula: formulaEmPalavras(f),
    formulaRegistro: f.formula,
    reexecucao: textoReexecucao(f),
    limitacao:
      registro?.modelos.find((x) => x.codigo === f.codigo)?.limitacao_principal ??
      paraLeitorPrevisoes(f.limitacoes?.[0] ?? (f.motivo_sem_implementacao ? semCaminhosDeArquivo(f.motivo_sem_implementacao) : (f.motivo_sem_implementacao ?? ""))) ??
      null,
    href: rotaModelo(f.codigo),
  }));
}

/** O que cada modelo recebe e como calcula: entradas, fórmula em palavras e pesos do último ajuste. */
export type LinhaEntradas = { id: string; codigo: string; nome: string; entradas: string[] | null; formula: string; pesos: string; href: string };

export function linhasEntradasFormula(fichas: readonly Ficha[]): LinhaEntradas[] {
  return fichasOrdenadas(fichas).map((f) => {
    const segs = f.coeficientes_ultimo_ajuste?.segmentos ?? [];
    const origem = segs.reduce((a, s) => (s.origem_ajuste > a ? s.origem_ajuste : a), "");
    const pesos = segs.length
      ? `${plural(segs.length, "segmento ajustado", "segmentos ajustados")}; último ajuste em ${dataBR(origem)}`
      : !f.implementado_no_repositorio
        ? "não publicados: a configuração da pesquisa não foi publicada"
        : "sem pesos: não tem parâmetros ajustados";
    return {
      id: slugModelo(f.codigo),
      codigo: f.codigo,
      nome: f.nome,
      entradas: f.entradas,
      formula: formulaEmPalavras(f) ?? "não publicada: a configuração da pesquisa não foi publicada",
      pesos,
      href: rotaModelo(f.codigo),
    };
  });
}

/**
 * Números de abertura de Modelos, todos contados do registro: quantos modelos, quantos em produção, quantos publicam número e quantos
 * têm desempenho fora da amostra publicado (de quantos foram avaliados). Nenhuma métrica de acerto entra aqui: MAE, ganho e cobertura
 * só aparecem com resultados publicados.
 */
export function metricasModelos(g: Pick<PrevisoesDesempenhoGold, "fichas" | "modelos" | "desempenho" | "previsao_atual">) {
  const fs = fichasOrdenadas(g.fichas);
  const comNumero = fs.filter((f) => ["previsão principal", "referência experimental publicada"].includes(emissaoDoModelo(f, g)));
  const avaliados = g.modelos.filter((m) => m.avaliado).map((m) => m.codigo);
  const publicados = g.desempenho.publicado ? Array.from(new Set(g.desempenho.por_horizonte.filter((l) => l.periodo === "teste").map((l) => l.modelo))) : [];
  return {
    registrados: fs.map((f) => f.codigo as string),
    emProducao: fs.filter((f) => f.estado === "PRODUCAO").map((f) => f.codigo as string),
    comNumero: comNumero.map((f) => f.codigo as string),
    comNumeroExperimental: comNumero.filter((f) => f.estado !== "PRODUCAO").map((f) => f.codigo as string),
    avaliados,
    desempenhoPublicado: publicados as string[],
    publicado: g.desempenho.publicado,
  };
}

/**
 * A passagem pela revisão independente: o registro de modelos lista as decisões revisáveis e quem as toma. Pendente quando alguma delas
 * cabe a um revisor independente e ainda está sem decisão. A reexecução e os controles do observatório não substituem essa revisão.
 */
export function revisaoIndependentePendente(g: Pick<PrevisoesDesempenhoGold, "governanca">): boolean {
  return g.governanca.decisao_revisavel.some((d) => /revisor independente/i.test(d.responsavel ?? "") && /pendente/i.test(d.estado ?? ""));
}

/** Decisões de governança ainda sem decisão (estado "decisão pendente"), contadas do próprio registro. */
export function decisoesPendentes(g: Pick<PrevisoesDesempenhoGold, "governanca">): { item: string; responsavel: string }[] {
  return g.governanca.decisao_revisavel.filter((d) => /decis[aã]o pendente/i.test(d.estado ?? "")).map((d) => ({ item: d.item, responsavel: d.responsavel ?? "não indicado" }));
}

/* ---------- avisos materiais da rodada, junto da emissão ---------- */

export type AvisoRodada = { id: string; rotulo: string; texto: string };

const ALERTAS_DA_RODADA = ["ATRASADO_APOS_08H", "EXECUCAO_MANUAL", "CODIGO_NAO_COMMITADO"];

/**
 * Avisos que mudam a leitura de uma rodada, em palavras de leitor: emissão manual ou depois do prazo, código sem versão registrada,
 * registro transcrito de outra fonte e rodada sem número. Leem os alertas e os campos da própria rodada; o texto técnico (minutos de
 * atraso, versão do código) fica em Analisar e Auditar.
 */
export function avisosDaRodada(
  r: Pick<Rodada, "modo" | "emitido_em" | "atraso_min" | "alertas" | "versao_codigo" | "celulas" | "com_numero" | "motivos" | "registrado_no_portal_em">,
): AvisoRodada[] {
  const out: AvisoRodada[] = [];
  const manual = r.modo.startsWith("manual");
  const tardia = r.alertas.includes("ATRASADO_APOS_08H") || (r.atraso_min ?? 0) > 0;
  const emitidoDia = diaBrasilia(r.emitido_em) ?? r.emitido_em.slice(0, 10);
  const transcrita = !!r.registrado_no_portal_em && r.registrado_no_portal_em > emitidoDia;
  if (manual || tardia) {
    out.push({
      id: "emissao",
      rotulo: "Emissão",
      texto: `Emitida ${manual ? "manualmente" : "pelo agendamento"} em ${instanteBR(r.emitido_em)}${tardia ? ", depois do prazo das 08h00" : ""}.`,
    });
  }
  if (r.alertas.includes("CODIGO_NAO_COMMITADO")) {
    out.push({
      id: "codigo",
      rotulo: "Reprodutibilidade",
      texto: "O código executado tinha alterações ainda não registradas em versão (sufixo +alterado).",
    });
  } else if (!r.versao_codigo) {
    out.push({ id: "codigo", rotulo: "Reprodutibilidade", texto: "O registro não traz a versão do código que emitiu a rodada." });
  }
  if (transcrita) {
    out.push({
      id: "transcricao",
      rotulo: "Registro",
      texto: `Transcrito de outra fonte e incluído no arquivo em ${dataBR(r.registrado_no_portal_em)}, depois da emissão: não é emissão original do observatório.`,
    });
  }
  if (r.com_numero === 0) {
    out.push({
      id: "sem-numero",
      rotulo: "Números",
      texto: `Nenhuma das ${r.celulas} células tem número${r.motivos.length ? `: ${r.motivos.map(textoMotivo).join("; ")}` : ""}.`,
    });
  }
  const outros = r.alertas.filter((a) => !ALERTAS_DA_RODADA.includes(a));
  if (outros.length) out.push({ id: "alertas", rotulo: "Alertas", texto: `Alertas registrados: ${textoAlertas(outros)}.` });
  return out;
}

/** Governança da rotina de emissão: aviso enquanto a rotina diária não estiver comprovada pelo critério publicado. */
export function avisoDaRotina(r: Pick<PrevisoesDesempenhoGold["rotina"], "comprovada" | "execucoes_agendadas" | "no_prazo">): AvisoRodada | null {
  if (r.comprovada) return null;
  return {
    id: "rotina",
    rotulo: "Governança",
    texto:
      r.execucoes_agendadas === 0
        ? "A rotina diária de emissão não foi comprovada: nenhuma execução agendada está registrada."
        : `A rotina diária de emissão não foi comprovada: ${r.no_prazo} de ${r.execucoes_agendadas} execuções agendadas saíram no prazo, abaixo do critério publicado.`,
  };
}

/* ---------- avaliação depois do resultado, semanas e meses separados ---------- */

export type AvaliacaoFrequencia = {
  frequencia: Frequencia;
  rotulo: string;
  horizontes: Horizonte[];
  registradas: number;
  apuradas: number;
  aguardando: number;
  proxima: { entrega: string; termina: string } | null;
  /** Entregas distintas do teste fora da amostra (iguais nos horizontes da frequência; vale a menor) e o mínimo para calibrar a faixa. */
  entregasTeste: number | null;
  minimo: number | null;
  estadoCalibracao: string;
};

/**
 * Semanas (W1 a W4) e meses (M1 a M3) têm avaliação própria: contagens de previsões registradas, apuradas e aguardando, a próxima
 * entrega a terminar e o tamanho da amostra do teste fora da amostra contra o mínimo para calibrar a faixa. Lê as apurações do
 * acompanhamento e a amostra de calibração, os mesmos números dos gráficos de desempenho.
 */
export function avaliacaoPorFrequencia(g: Pick<PrevisoesDesempenhoGold, "prospectivo" | "definicoes">): AvaliacaoFrequencia[] {
  const amostra = linhasAmostra(g);
  return (["W", "M"] as const).map((freq) => {
    const ap = g.prospectivo.apuracoes.filter((a) => a.horizonte.startsWith(freq));
    const apuradas = ap.filter((a) => a.realizado !== null).length;
    const da = amostra.filter((a) => a.horizonte.startsWith(freq));
    const ns = da.map((a) => a.entregas).filter((n): n is number => typeof n === "number");
    return {
      frequencia: freq,
      rotulo: freq === "W" ? "Semanas" : "Meses",
      horizontes: HORIZONTES.filter((h) => h.startsWith(freq)),
      registradas: ap.length,
      apuradas,
      aguardando: ap.length - apuradas,
      proxima: primeiraEntregaAMaturar(ap),
      entregasTeste: ns.length ? Math.min(...ns) : null,
      minimo: da[0]?.minimo ?? null,
      estadoCalibracao: Array.from(new Set(da.map((a) => a.estado))).join(", "),
    };
  });
}

/** Resumo do B0 de um submercado e uma frequência: o número da rodada, os horizontes e o período que ele repete. A faixa de métricas e o painel leem esta função. */
export function resumoB0(linhas: readonly LinhaGrade[], sm: Submercado, freq: Frequencia) {
  const doSm = linhas.filter((l) => l.submercado === sm && l.horizonte.startsWith(freq));
  const com = doSm.find((l) => l.evidencia);
  return {
    valor: com?.previsao ?? null,
    evidencia: com?.evidencia ?? null,
    horizontes: doSm.map((l) => l.horizonte),
    periodo: doSm.length ? `${doSm[0].horizonte} a ${doSm[doSm.length - 1].horizonte}: ${dataBR(doSm[0].inicio)} a ${dataBR(doSm[doSm.length - 1].fim)}` : "",
    usado:
      com?.periodo_inicio && com.periodo_fim
        ? `Repete a média de ${dataBR(com.periodo_inicio)} a ${dataBR(com.periodo_fim)}, o último período completo elegível no corte.`
        : undefined,
    /** O mesmo aviso em uma linha, para a faixa de métricas da abertura. */
    usadoCurto: com?.periodo_inicio && com.periodo_fim ? `Repete a média de ${intervaloDias(com.periodo_inicio, com.periodo_fim)}.` : undefined,
  };
}
