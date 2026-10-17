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
import { dataBR, dataCurta, nomeSubmercado, num, plural, reais } from "./formato";
import { idiomaEnergia, tx, tx as txIdioma } from "./idioma";
import { textoRegistroModelos as reg } from "./i18n/mercado-preco";
import type { Idioma } from "@/lib/idioma";
import type { ColunaTabela, LinhaTabela } from "./tabela";
import type { ModelosGold, Proveniencia, Submercado } from "./tipos";
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
/** Rótulo e pergunta de cada painel no idioma da página. */
export function textosPainelPrevisoes(id: IdPainelPrevisoes, idioma: Idioma = idiomaEnergia()): { rotulo: string; pergunta: string } {
  switch (id) {
    case "p013":
      return { rotulo: tx("Rodada mais recente", "Latest run", idioma), pergunta: tx("Quais os preços possíveis nos próximos períodos?", "What are the possible prices in the coming periods?", idioma) };
    case "p015":
      return { rotulo: tx("Arquivo de emissões", "Forecast archive", idioma), pergunta: tx("O que foi previsto antes do resultado?", "What was forecast before the outcome?", idioma) };
    case "p014":
      return { rotulo: tx("Registro de modelos", "Model registry", idioma), pergunta: tx("Como cada previsão foi calculada?", "How was each forecast calculated?", idioma) };
    case "p016":
      return { rotulo: tx("Desempenho e calibração", "Performance and calibration", idioma), pergunta: tx("O modelo supera referências simples?", "Does the model beat simple benchmarks?", idioma) };
  }
}

function painelComTextos(id: IdPainelPrevisoes, codigo: string, rota: string): PainelPrevisoes {
  return {
    id,
    codigo,
    rota,
    get rotulo() {
      return textosPainelPrevisoes(id).rotulo;
    },
    get pergunta() {
      return textosPainelPrevisoes(id).pergunta;
    },
  };
}

export const PAINEIS_PREVISOES: PainelPrevisoes[] = [
  painelComTextos("p013", "P013", ROTA_PREVISOES),
  painelComTextos("p015", "P015", ROTA_PREVISOES),
  painelComTextos("p014", "P014", ROTA_MODELOS),
  painelComTextos("p016", "P016", ROTA_MODELOS),
];

export function painelPrevisoes(id: IdPainelPrevisoes): PainelPrevisoes {
  return PAINEIS_PREVISOES.find((p) => p.id === id) as PainelPrevisoes;
}
export const perguntaPainel = (id: IdPainelPrevisoes, idioma: Idioma = idiomaEnergia()) => textosPainelPrevisoes(id, idioma).pergunta;
/** Endereço do painel com a âncora (o link compartilhável acrescenta o recorte da URL). */
export const enderecoPainel = (id: IdPainelPrevisoes) => `${painelPrevisoes(id).rota}#${id}`;

/** Próxima pergunta (seção 7.2, item 10): o que se prevê → como foi calculado → se supera as referências → o que já foi previsto → o que se prevê. */
const PROXIMO: Record<IdPainelPrevisoes, IdPainelPrevisoes> = { p013: "p014", p014: "p016", p016: "p015", p015: "p013" };
export function proximoPainel(id: IdPainelPrevisoes, idioma: Idioma = idiomaEnergia()): PainelPrevisoes {
  const p = painelPrevisoes(PROXIMO[id]);
  // objeto simples (sem getters), seguro para passar a componente de cliente
  return { id: p.id, codigo: p.codigo, rota: p.rota, ...textosPainelPrevisoes(p.id, idioma) };
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
const ORDINAL_EN = ["first", "second", "third", "fourth"];
/** "W2" → "segunda semana completa depois da origem"; "M1" → "primeiro mês civil depois da origem". */
export function descreverHorizonte(h: Horizonte, idioma: Idioma = idiomaEnergia()): string {
  const n = Number(h.slice(1)) - 1;
  if (h.startsWith("W")) return tx(`${ORDINAL[n]} semana completa depois da origem`, `${ORDINAL_EN[n]} full week after the origin`, idioma);
  return tx(`${ORDINAL_M[n]} mês civil depois da origem`, `${ORDINAL_EN[n]} calendar month after the origin`, idioma);
}

const ESTADOS_CALIBRACAO: Record<string, string> = {
  CALIBRADO: "calibrado",
  DESCALIBRADO: "descalibrado",
  AMOSTRA_INSUFICIENTE: "amostra insuficiente",
  SEM_AVALIACAO: "sem avaliação", // i18n: dado
  NAO_CALIBRADO_NO_PILOTO: "não calibrado no piloto", // i18n: dado
};
const ESTADOS_CALIBRACAO_EN: Record<string, string> = {
  CALIBRADO: "calibrated",
  DESCALIBRADO: "miscalibrated",
  AMOSTRA_INSUFICIENTE: "insufficient sample",
  SEM_AVALIACAO: "not evaluated",
  NAO_CALIBRADO_NO_PILOTO: "not calibrated in the pilot",
};
export const rotuloCalibracao = (s: string | null | undefined, idioma: Idioma = idiomaEnergia()) =>
  s ? ((idioma === "en" ? ESTADOS_CALIBRACAO_EN : ESTADOS_CALIBRACAO)[s] ?? s) : tx("sem estado registrado", "no state recorded", idioma);

/**
 * Frases escritas pelo registro às vezes trazem o código do estado de calibração em maiúsculas ("está CALIBRADO"). No texto de leitura
 * entra o rótulo em palavras ("está calibrado"); o resto da frase fica como foi escrito.
 */
export function semCodigoDeEstado(texto: string): string {
  return texto.replace(/\b(NAO_CALIBRADO_NO_PILOTO|AMOSTRA_INSUFICIENTE|DESCALIBRADO|CALIBRADO|SEM_AVALIACAO)\b/g, (c) => ESTADOS_CALIBRACAO[c] ?? c);
}

const ESTADOS_MODELO: Record<string, string> = { PESQUISA: "pesquisa", VALIDACAO: "validação", PRODUCAO: "produção", APOSENTADO: "aposentado" }; // i18n: dado
const ESTADOS_MODELO_EN: Record<string, string> = { PESQUISA: "research", VALIDACAO: "validation", PRODUCAO: "production", APOSENTADO: "retired" };
export const rotuloEstadoModelo = (s: string, idioma: Idioma = idiomaEnergia()) => (idioma === "en" ? ESTADOS_MODELO_EN : ESTADOS_MODELO)[s] ?? s;

const TIPOS: Record<string, string> = {
  PUBLICACAO: "publicação", // i18n: dado
  RODADA_INTERNA: "rodada interna",
  REFERENCIA_EXPERIMENTAL: "referência experimental", // i18n: dado
};
const TIPOS_EN: Record<string, string> = {
  PUBLICACAO: "publication",
  RODADA_INTERNA: "internal run",
  REFERENCIA_EXPERIMENTAL: "experimental benchmark",
};
export const rotuloTipo = (s: string, idioma: Idioma = idiomaEnergia()) => (idioma === "en" ? TIPOS_EN : TIPOS)[s] ?? s;

/** Motivos de célula sem número gravados pela rodada de previsão (emissao.py, no módulo de previsões). */
export const MOTIVOS: Record<string, string> = {
  SEM_PLD_CAPTURADO_ATE_O_CORTE: "nenhum PLD do período exigido havia sido capturado até o corte", // i18n: dado
  SEM_PERIODO_ELEGIVEL_CAPTURADO_ATE_O_CORTE: "nenhum período elegível do PLD estava capturado até o corte", // i18n: dado
  PERIODO_ELEGIVEL_INCOMPLETO_NO_CORTE: "o período elegível estava incompleto no corte", // i18n: dado
  FALHA_NA_EXECUCAO: "a execução da rodada falhou", // i18n: dado
  CONFERENCIA_B0_DIVERGENTE: "o recálculo independente do B0 divergiu do valor emitido", // i18n: dado
  ENTREGA_PARCIALMENTE_PUBLICADA_SEM_DIAS_INTEIROS: "a entrega já tinha horas publicadas sem dias inteiros", // i18n: dado
  TREINO_INSUFICIENTE: "o treino tinha menos entregas que o mínimo", // i18n: dado
};
const MOTIVOS_EN: Record<string, string> = {
  SEM_PLD_CAPTURADO_ATE_O_CORTE: "no PLD for the required period had been captured by the cutoff",
  SEM_PERIODO_ELEGIVEL_CAPTURADO_ATE_O_CORTE: "no eligible PLD period had been captured by the cutoff",
  PERIODO_ELEGIVEL_INCOMPLETO_NO_CORTE: "the eligible period was incomplete at the cutoff",
  FALHA_NA_EXECUCAO: "the run failed",
  CONFERENCIA_B0_DIVERGENTE: "the independent recalculation of B0 diverged from the issued value",
  ENTREGA_PARCIALMENTE_PUBLICADA_SEM_DIAS_INTEIROS: "the delivery already had hours published without whole days",
  TREINO_INSUFICIENTE: "training had fewer deliveries than the minimum",
};
export const textoMotivo = (m: string | null | undefined, idioma: Idioma = idiomaEnergia()) =>
  m ? ((idioma === "en" ? MOTIVOS_EN : MOTIVOS)[m] ?? tx(`motivo registrado ${m}`, `recorded reason ${m}`, idioma)) : "";

export const ALERTAS: Record<string, string> = {
  ATRASADO_APOS_08H: "emitida depois do prazo das 08h00", // i18n: dado
  EXECUCAO_MANUAL: "rodada manual, fora do horário agendado", // i18n: dado
  CODIGO_NAO_COMMITADO: "emitida com uma versão do código ainda não registrada", // i18n: dado
  LIMITE_PROVISORIO: "faixa de preço provisória (sem ato do ano da entrega)", // i18n: dado
  AJUSTADA_AO_LIMITE: "previsão ajustada ao limite de preço", // i18n: dado
  ENTREGA_COM_HORAS_JA_PUBLICADAS: "entrega com horas já publicadas no corte", // i18n: dado
};
const ALERTAS_EN: Record<string, string> = {
  ATRASADO_APOS_08H: "issued after the 08:00 deadline",
  EXECUCAO_MANUAL: "manual run, outside the scheduled time",
  CODIGO_NAO_COMMITADO: "issued with a code version not yet recorded",
  LIMITE_PROVISORIO: "provisional price range (no act for the delivery year)",
  AJUSTADA_AO_LIMITE: "forecast adjusted to the price limit",
  ENTREGA_COM_HORAS_JA_PUBLICADAS: "delivery with hours already published at the cutoff",
};
export const textoAlertas = (as: readonly string[], idioma: Idioma = idiomaEnergia()) => as.map((a) => (idioma === "en" ? ALERTAS_EN : ALERTAS)[a] ?? a).join("; ");

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

/** Instante UTC → "30/09/2026 às 20h31" (Brasília); em inglês, "Sep 30, 2026 at 20:31". */
export function instanteBR(iso: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!iso) return tx("sem registro", "no record", idioma);
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const p = Object.fromEntries(HORA_BR.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return tx(`${p.day}/${p.month}/${p.year} às ${p.hour}h${p.minute}`, `${dataBR(`${p.year}-${p.month}-${p.day}`, "en")} at ${p.hour}:${p.minute}`, idioma);
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
export const reaisMWh = (v: number | null | undefined, casas = 2, idioma: Idioma = idiomaEnergia()) =>
  v === null || v === undefined || !Number.isFinite(v) ? tx("sem número", "no number", idioma) : `${reais(v, casas, idioma)}/MWh`;

/** Sigla curta do submercado no idioma (SE/CO, S, NE, N; em inglês, SE/CW, South...). */
const curto = (sm: string, idioma: Idioma) => nomeSubmercado(sm, idioma, true);
const nome = (sm: string, idioma: Idioma) => nomeSubmercado(sm, idioma);

/* ---------------------------------------------------------------- rodada e defasagem */

type AtualComRodada = Extract<PrevisoesDesempenhoGold["previsao_atual"], { rotulo: string }>;
export function temRodada(at: PrevisoesDesempenhoGold["previsao_atual"]): at is AtualComRodada {
  return "rotulo" in at && Array.isArray((at as AtualComRodada).celulas);
}

/** Emissão da rodada em uma frase: modo, instante em Brasília e atraso sobre o prazo das 08h00. */
function modoEmissao(modo: string, idioma: Idioma): string {
  if (modo === "agendada") return tx("pelo agendamento", "by the schedule", idioma);
  if (modo === "manual") return tx("manualmente", "manually", idioma);
  return `(${modo})`;
}

export function textoEmissao(r: { emitido_em: string; atraso_min: number | null; modo: string; prazo: string | null }, idioma: Idioma = idiomaEnergia()): string {
  const modo = modoEmissao(r.modo, idioma);
  const base = tx(`emitida ${modo} em ${instanteBR(r.emitido_em, idioma)}`, `issued ${modo} on ${instanteBR(r.emitido_em, idioma)}`, idioma);
  if (r.prazo === null || r.atraso_min === null) return tx(`${base}, sem prazo registrado`, `${base}, no deadline recorded`, idioma);
  if (r.atraso_min <= 0) return tx(`${base}, dentro do prazo das 08h00`, `${base}, within the 08:00 deadline`, idioma);
  return tx(`${base}, ${num(r.atraso_min, 0)} minutos depois do prazo das 08h00`, `${base}, ${num(r.atraso_min, 0, idioma)} minutes after the 08:00 deadline`, idioma);
}

/** Emissão da rodada em palavras de leitor: o modo e se foi depois do prazo das 08h00, sem os minutos de atraso (que ficam em Analisar). */
export function textoEmissaoLeitor(r: { atraso_min: number | null; modo: string; prazo: string | null }, idioma: Idioma = idiomaEnergia()): string {
  const modo = modoEmissao(r.modo, idioma);
  if (r.prazo === null || r.atraso_min === null) return tx(`emitida ${modo}, sem prazo registrado`, `issued ${modo}, no deadline recorded`, idioma);
  return r.atraso_min <= 0
    ? tx(`emitida ${modo}, dentro do prazo das 08h00`, `issued ${modo}, within the 08:00 deadline`, idioma)
    : tx(`emitida ${modo}, depois do prazo das 08h00`, `issued ${modo}, after the 08:00 deadline`, idioma);
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
export function linhasGrade(
  celulas: readonly CelulaAtual[],
  apuracoes: readonly Pick<Apuracao, "forecast_id" | "realizado" | "erro">[] = [],
  idioma: Idioma = idiomaEnergia(),
): LinhaGrade[] {
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
        sm: curto(c.submercado, idioma),
        horizonte: c.horizonte,
        entrega: c.entrega.id,
        inicio: d.inicio,
        fim: d.ultimo,
        previsao: c.previsao,
        p10: c.quantis?.p10 ?? null,
        p90: c.quantis?.p90 ?? null,
        calibracao: rotuloCalibracao(c.calibracao_recalculada ?? c.calibracao, idioma),
        piso: c.limites?.piso_medio ?? null,
        teto: c.limites?.teto_estrutural_medio ?? null,
        limites:
          c.limites === null
            ? tx("sem limites registrados", "no limits recorded", idioma)
            : c.limites.provisoria
              ? tx("provisórios", "provisional", idioma)
              : tx("dos atos publicados", "from the published acts", idioma),
        ajustada: c.ajustada_ao_limite === null ? tx("não se aplica", "not applicable", idioma) : c.ajustada_ao_limite ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
        periodo_inicio: c.periodo_usado?.inicio ?? null,
        periodo_fim: c.periodo_usado ? diaAnterior(c.periodo_usado.fim) : null,
        capturado_em: c.periodo_usado?.capturado_em ?? null,
        fracao_conhecida: c.fracao_conhecida === null ? null : c.fracao_conhecida * 100,
        motivo:
          c.previsao === null
            ? textoMotivo(c.motivo, idioma) || tx("motivo não registrado", "reason not recorded", idioma)
            : tx("não se aplica (célula com número)", "not applicable (cell with a number)", idioma),
        forecast_id: c.forecast_id,
        evidencia: c.evidencia,
      };
    });
}

/** O identificador técnico de cada célula (forecast_id) fica no CSV do arquivo de emissões e no detalhe em Auditar, não na tabela de Entender. */
export function colunasGrade(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "sm", rotulo: tx("Submercado", "Submarket"), tipo: "texto", categorica: true },
    { id: "horizonte", rotulo: tx("Horizonte", "Horizon"), tipo: "texto", categorica: true },
    { id: "entrega", rotulo: tx("Entrega", "Delivery"), tipo: "texto" },
    { id: "inicio", rotulo: tx("Primeiro dia", "First day"), tipo: "data" },
    { id: "fim", rotulo: tx("Último dia", "Last day"), tipo: "data" },
    { id: "previsao", rotulo: tx("Referência B0", "B0 benchmark"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p10", rotulo: "P10", tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p90", rotulo: "P90", tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "calibracao", rotulo: tx("Calibração da faixa", "Band calibration"), tipo: "texto", categorica: true },
    { id: "piso", rotulo: tx("Piso médio da entrega", "Average floor of the delivery"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "teto", rotulo: tx("Teto estrutural médio", "Average structural cap"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "limites", rotulo: tx("Limites", "Limits"), tipo: "texto", categorica: true },
    { id: "ajustada", rotulo: tx("Ajustada ao limite", "Adjusted to the limit"), tipo: "texto", categorica: true },
    { id: "periodo_inicio", rotulo: tx("Período usado: início", "Period used: start"), tipo: "data" },
    { id: "periodo_fim", rotulo: tx("Período usado: fim", "Period used: end"), tipo: "data" },
    { id: "fracao_conhecida", rotulo: tx("Fração já publicada no corte", "Share already published at the cutoff"), tipo: "percentual", casas: 0 },
    { id: "motivo", rotulo: tx("Motivo sem número", "Reason for no number"), tipo: "texto" },
    { id: "realizado", rotulo: tx("Realizado", "Actual"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "erro", rotulo: tx("Erro (previsão menos realizado)", "Error (forecast minus actual)"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "termina", rotulo: tx("Entrega termina em", "Delivery ends on"), tipo: "data", nivel: "analisar" },
  ];
}
export const COLUNAS_GRADE: ColunaTabela[] = colunasGrade("pt");

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

function faixaDeValores(e: NonNullable<ReturnType<typeof extremos>>, idioma: Idioma): string {
  const R = (v: number) => reaisMWh(v, 2, idioma);
  if (Math.abs(e.max.valor - e.min.valor) < 0.005) return tx(`${R(e.min.valor)} em todos os submercados`, `${R(e.min.valor)} in all submarkets`, idioma);
  return tx(
    `de ${R(e.min.valor)} (${curto(e.min.sm, idioma)}) a ${R(e.max.valor)} (${curto(e.max.sm, idioma)}), conforme o submercado`,
    `from ${R(e.min.valor)} (${curto(e.min.sm, idioma)}) to ${R(e.max.valor)} (${curto(e.max.sm, idioma)}), depending on the submarket`,
    idioma,
  );
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]; // i18n: dado
const MESES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const nomeMes = (dia: string, idioma: Idioma) =>
  tx(`${MESES[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}`, `${MESES_EN[Number(dia.slice(5, 7)) - 1]} ${dia.slice(0, 4)}`, idioma);
/** "outubro a dezembro de 2026"; anos diferentes: "novembro de 2026 a janeiro de 2027". */
function intervaloMeses(a: string, b: string, idioma: Idioma): string {
  if (a.slice(0, 7) === b.slice(0, 7)) return nomeMes(a, idioma);
  if (idioma === "en")
    return a.slice(0, 4) === b.slice(0, 4) ? `${MESES_EN[Number(a.slice(5, 7)) - 1]} to ${nomeMes(b, idioma)}` : `${nomeMes(a, idioma)} to ${nomeMes(b, idioma)}`;
  return a.slice(0, 4) === b.slice(0, 4) ? `${MESES[Number(a.slice(5, 7)) - 1]} a ${nomeMes(b, idioma)}` : `${nomeMes(a, idioma)} a ${nomeMes(b, idioma)}`;
}
/** "03/10 a 30/10/2026"; anos diferentes: datas completas. */
function intervaloDias(a: string, b: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return a.slice(0, 4) === b.slice(0, 4) ? `${dataCurta(a, idioma)} to ${dataBR(b, idioma)}` : `${dataBR(a, idioma)} to ${dataBR(b, idioma)}`;
  return a.slice(0, 4) === b.slice(0, 4) ? `${dataBR(a, "pt").slice(0, 5)} a ${dataBR(b, "pt")}` : `${dataBR(a, "pt")} a ${dataBR(b, "pt")}`;
}

/**
 * Resposta curta do P013. Diz primeiro se há previsão oficial (modelo em produção),
 * depois o intervalo dos números publicados por frequência e a situação da faixa.
 */
export function respostaP013(g: Pick<PrevisoesDesempenhoGold, "previsao_atual" | "modelos">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const D = (d: string) => dataBR(d, idioma);
  const at = g.previsao_atual;
  const producao = g.modelos.filter((m) => m.estado === "PRODUCAO").map((m) => m.codigo);
  const oficial = producao.length
    ? tx(`Modelo em produção: ${producao.join(", ")}.`, `Model in production: ${producao.join(", ")}.`)
    : tx("Não há previsão oficial do PLD: nenhum modelo está aprovado para produção.", "There is no official PLD forecast: no model is approved for production.");
  if (!temRodada(at)) return tx(`${oficial} Nenhuma rodada com números está publicada: ${at.motivo}`, `${oficial} No run with numbers is published: ${at.motivo}`);
  const linhas = linhasGrade(at.celulas, [], idioma);
  const com = linhas.filter((l) => l.previsao !== null).length;
  if (com === 0) {
    const motivos = Array.from(new Set(linhas.map((l) => l.motivo).filter(Boolean)));
    return tx(
      `${oficial} A rodada de ${D(at.origem)} não tem número em nenhuma das ${linhas.length} células${motivos.length ? `: ${motivos.join("; ")}` : ""}.`,
      `${oficial} The run of ${D(at.origem)} has no number in any of the ${linhas.length} cells${motivos.length ? `: ${motivos.join("; ")}` : ""}.`,
    );
  }
  const w = extremos(linhas, "W");
  const m = extremos(linhas, "M");
  const partes: string[] = [];
  const hs = (e: NonNullable<typeof w>) => (e.horizontes.length > 1 ? tx(`${e.horizontes[0]} a ${e.horizontes[e.horizontes.length - 1]}`, `${e.horizontes[0]} to ${e.horizontes[e.horizontes.length - 1]}`) : e.horizontes[0]);
  if (w) partes.push(tx(`para cada semana de ${intervaloDias(w.inicio, w.fim, idioma)} (${hs(w)}), ${faixaDeValores(w, idioma)}`, `for each week from ${intervaloDias(w.inicio, w.fim, idioma)} (${hs(w)}), ${faixaDeValores(w, idioma)}`));
  if (m) partes.push(tx(`para cada mês de ${intervaloMeses(m.inicio, m.fim, idioma)} (${hs(m)}), ${faixaDeValores(m, idioma)}`, `for each month from ${intervaloMeses(m.inicio, m.fim, idioma)} (${hs(m)}), ${faixaDeValores(m, idioma)}`));
  const ref = /refer[eê]ncia experimental/i.test(at.rotulo)
    ? tx(
        `A referência experimental B0 (persistência) da rodada de ${D(at.origem)} repete o PLD médio do último período completo: `,
        `The experimental benchmark B0 (persistence) of the run of ${D(at.origem)} repeats the average PLD of the latest complete period: `,
      )
    : tx(`A rodada de ${D(at.origem)} publica `, `The run of ${D(at.origem)} publishes `);
  const semNumero = linhas.length - com;
  const lacuna = semNumero
    ? tx(` ${plural(semNumero, "célula fica", "células ficam", idioma)} sem número, com o motivo.`, ` ${plural(semNumero, "cell is", "cells are", idioma)} left without a number, with the reason.`)
    : "";
  const comFaixa = linhas.filter((l) => l.p10 !== null && l.p90 !== null).length;
  const faixa = comFaixa
    ? tx(` Faixa P10 a P90 publicada em ${comFaixa} de ${linhas.length} células.`, ` P10 to P90 band published in ${comFaixa} of ${linhas.length} cells.`)
    : tx(" Sem faixa de incerteza: nenhum segmento está calibrado.", " No uncertainty band: no segment is calibrated.");
  return `${oficial} ${ref}${partes.join("; ")}.${lacuna}${faixa}`;
}

/** KPI do PLD já publicado no corte, por submercado (dado observado, não previsão). */
export function textoPublicadoNoCorte(pub: Pick<PublicadoNoCorte, "origem" | "submercados"> | null, sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const R = (v: number | null | undefined) => reaisMWh(v, 2, idioma);
  if (!pub) return tx("A rodada não registrou o PLD já publicado no corte.", "The run did not record the PLD already published at the cutoff.");
  const x = pub.submercados[sm];
  const c = curto(sm, idioma);
  if (!x || !x.horas || x.media === null)
    return tx(`Nenhuma hora de ${dataBR(pub.origem)} depois do corte estava capturada para o ${c}.`, `No hour of ${dataBR(pub.origem, idioma)} after the cutoff had been captured for ${c}.`);
  return tx(
    `Para o resto de ${dataBR(pub.origem)} (${plural(x.horas, "hora", "horas")}, das ${x.primeira?.slice(11, 13)}h às ${x.ultima?.slice(11, 13)}h), o PLD do ${c} ` +
      `já estava publicado no corte: média de ${R(x.media)}, de ${R(x.minimo)} a ${R(x.maximo)}. É dado observado, e nenhuma entrega prevista inclui essas horas.`,
    `For the rest of ${dataBR(pub.origem, idioma)} (${plural(x.horas, "hour", "hours", idioma)}, from ${x.primeira?.slice(11, 13)}h to ${x.ultima?.slice(11, 13)}h), the PLD of ${c} ` +
      `was already published at the cutoff: average of ${R(x.media)}, from ${R(x.minimo)} to ${R(x.maximo)}. This is observed data, and no forecast delivery includes these hours.`,
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
export function oQueMudouRodada(g: Pick<PrevisoesDesempenhoGold, "prospectivo">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const rs = [...g.prospectivo.rodadas].sort((a, b) => (a.origem === b.origem ? a.emitido_em.localeCompare(b.emitido_em) : a.origem.localeCompare(b.origem)));
  if (!rs.length) return tx("Nenhuma rodada registrada.", "No run recorded.");
  const ult = rs[rs.length - 1];
  const ant = rs.length > 1 ? rs[rs.length - 2] : null;
  const atual = tx(`Rodada de ${dataBR(ult.origem)}: ${ult.com_numero} de ${ult.celulas} células com número.`, `Run of ${dataBR(ult.origem, idioma)}: ${ult.com_numero} of ${ult.celulas} cells with a number.`);
  const motivos = ant && ant.motivos.length ? ` (${ant.motivos.map((m) => textoMotivo(m, idioma)).join("; ")})` : "";
  const anterior = ant
    ? tx(
        ` A anterior, de ${dataBR(ant.origem)}, ${ant.com_numero === 0 ? "não tinha nenhuma" : `tinha ${ant.com_numero}`}${motivos}.`,
        ` The previous one, of ${dataBR(ant.origem, idioma)}, ${ant.com_numero === 0 ? "had none" : `had ${ant.com_numero}`}${motivos}.`,
      )
    : tx(" É a primeira rodada registrada.", " It is the first run recorded.");
  const revistas = g.prospectivo.revisoes_entre_rodadas.filter((r) => r.sequencia.length > 1);
  const revisao = revistas.length
    ? tx(
        ` ${plural(revistas.length, "entrega teve", "entregas tiveram")} previsão revista entre rodadas (detalhe no arquivo de emissões).`,
        ` ${plural(revistas.length, "delivery had", "deliveries had", idioma)} a forecast revised between runs (detail in the forecast archive).`,
      )
    : tx(
        " Nenhuma entrega tem duas previsões com número: ainda não há revisão entre rodadas a comparar.",
        " No delivery has two forecasts with a number: there is no revision between runs to compare yet.",
      );
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
export function linhasArquivo(brutas: readonly Record<string, string>[], estados: Record<string, string> = {}, idioma: Idioma = idiomaEnergia()): LinhaArquivo[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return brutas.map((r) => {
    const emitidoDia = diaBrasilia(r.emitido_em) ?? r.emitido_em.slice(0, 10);
    const reg = r.registrado_no_portal_em ?? "";
    const gravada = numeroCsv(r.previsao);
    const retido = gravada !== null && numeroRetido(r.tipo, estados[r.modelo]);
    const previsao = retido ? null : gravada;
    return {
      id: r.forecast_id,
      linha: tx(
        `${r.modelo} ${r.horizonte} ${curto(r.submercado, "pt")}, rodada de ${dataBR(r.origem, "pt")}`,
        `${r.modelo} ${r.horizonte} ${curto(r.submercado, idioma)}, run of ${dataBR(r.origem, idioma)}`,
      ),
      forecast_id: r.forecast_id,
      run_id: r.run_id,
      tipo: rotuloTipo(r.tipo, idioma),
      modelo: r.modelo,
      versao_modelo: r.versao_modelo ?? "",
      origem: r.origem,
      cutoff: r.cutoff,
      prazo: r.prazo || null,
      emitido_em: r.emitido_em,
      emitido: instanteBR(r.emitido_em, idioma),
      atraso_min: numeroCsv(r.atraso_min),
      atraso_origem: r.atraso_origem ?? "",
      modo: r.modo ?? "",
      horizonte: r.horizonte,
      entrega: r.entrega,
      submercado: r.submercado,
      sm: curto(r.submercado, idioma),
      status: r.status,
      com_numero: retido ? tx("número retido (rodada interna)", "number withheld (internal run)") : previsao === null ? tx("sem número", "no number") : tx("com número", "with a number"),
      previsao,
      p10: retido ? null : numeroCsv(r.p10),
      p90: retido ? null : numeroCsv(r.p90),
      mudanca: retido ? null : numeroCsv(r.mudanca),
      motivo: retido ? tx("número de rodada interna retido: modelo fora de produção", "internal run number withheld: model not in production") : textoMotivo(r.motivo, idioma),
      realizado: numeroCsv(r.realizado),
      erro: retido ? null : numeroCsv(r.erro),
      sha256: r.sha256,
      versao_codigo: r.versao_codigo ?? "",
      registrado_no_portal_em: reg,
      transcrito: reg && reg > emitidoDia ? tx("sim, incluído depois da emissão", "yes, included after issue") : tx("não", "no"),
      alertas: textoAlertas((r.alertas ?? "").split(",").filter(Boolean), idioma),
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
export function colunasArquivo(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "origem", rotulo: tx("Origem", "Origin"), tipo: "data" },
    { id: "tipo", rotulo: tx("Tipo", "Type"), tipo: "texto", categorica: true },
    { id: "modelo", rotulo: tx("Modelo", "Model"), tipo: "texto", categorica: true },
    { id: "horizonte", rotulo: tx("Horizonte", "Horizon"), tipo: "texto", categorica: true },
    { id: "entrega", rotulo: tx("Entrega", "Delivery"), tipo: "texto" },
    { id: "sm", rotulo: tx("Submercado", "Submarket"), tipo: "texto", categorica: true },
    { id: "com_numero", rotulo: tx("Número", "Number"), tipo: "texto", categorica: true },
    { id: "previsao", rotulo: tx("Previsão arquivada", "Archived forecast"), tipo: "numero", unidade: "R$/MWh", casas: 4 },
    { id: "p10", rotulo: "P10", tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "p90", rotulo: "P90", tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "mudanca", rotulo: tx("Mudança sobre a rodada anterior", "Change from the previous run"), tipo: "numero", unidade: "R$/MWh", casas: 4 },
    { id: "motivo", rotulo: tx("Motivo sem número", "Reason for no number"), tipo: "texto" },
    { id: "realizado", rotulo: tx("Realizado", "Actual"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "erro", rotulo: tx("Erro (previsão menos realizado)", "Error (forecast minus actual)"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "emitido", rotulo: tx("Emitida em (Brasília)", "Issued on (Brasília time)"), tipo: "texto" },
    { id: "atraso_min", rotulo: tx("Atraso sobre o prazo", "Delay over the deadline"), tipo: "numero", unidade: "min", casas: 1 }, // i18n: dado
    { id: "modo", rotulo: tx("Modo", "Mode"), tipo: "texto", categorica: true },
    { id: "registrado_no_portal_em", rotulo: tx("Incluída no arquivo em", "Included in the archive on"), tipo: "data" },
    { id: "transcrito", rotulo: tx("Transcrita depois da emissão", "Transcribed after issue"), tipo: "texto", categorica: true },
    { id: "versao_codigo", rotulo: tx("Versão do código", "Code version"), tipo: "texto" },
    { id: "sha256", rotulo: tx("sha256 do registro", "Record sha256"), tipo: "texto" },
    { id: "forecast_id", rotulo: tx("Identificador", "Identifier"), tipo: "texto" },
  ];
}
export const COLUNAS_ARQUIVO: ColunaTabela[] = colunasArquivo("pt");

/**
 * Colunas da tabela do arquivo: o nome legível do registro à frente, sem a versão do código; o sha256 e o identificador técnico ficam
 * no fim da tabela e só aparecem em Auditar (conferência contra o CSV), além do detalhe do registro em Analisar e Auditar e do CSV
 * completo do download.
 */
export function colunasArquivoTabela(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const cols = colunasArquivo(idioma);
  return [
    { id: "linha", rotulo: tx("Registro", "Record", idioma), tipo: "texto" },
    ...cols.filter((c) => !["forecast_id", "sha256", "versao_codigo"].includes(c.id)),
    // a conferência registro a registro contra o CSV precisa do hash e do identificador: só em Auditar
    ...cols.filter((c) => ["sha256", "forecast_id"].includes(c.id)).map((c) => ({ ...c, nivel: "auditar" as const })),
  ];
}
export const COLUNAS_ARQUIVO_TABELA: ColunaTabela[] = colunasArquivoTabela("pt");

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
export function resumoRodadas(linhas: readonly LinhaArquivo[], idioma: Idioma = idiomaEnergia()): ResumoRodada[] {
  const grupos = new Map<string, LinhaArquivo[]>();
  for (const l of linhas) grupos.set(l.run_id, [...(grupos.get(l.run_id) ?? []), l]);
  return Array.from(grupos.entries())
    .map(([run, ls]) => {
      const com = ls.filter((l) => l.previsao !== null).length;
      const l0 = ls[0];
      return {
        id: run,
        rotulo: tx(`Rodada de ${dataBR(l0.origem)}`, `Run of ${dataBR(l0.origem, idioma)}`, idioma),
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
        // "não" no português e "no" no inglês (linhasArquivo escreve no idioma da página)
        transcrito: ls.some((l) => l.transcrito !== "não" && l.transcrito !== "no"),
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
  const rs = resumoRodadas(linhas, "pt");
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

function fraseRodada(r: ResumoRodada, idioma: Idioma): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const atraso =
    r.atraso_min !== null && r.atraso_min > 0
      ? tx(`, emitida ${num(r.atraso_min, 0)} minutos depois do prazo,`, `, issued ${num(r.atraso_min, 0, idioma)} minutes after the deadline,`)
      : r.atraso_min === 0
        ? tx(", emitida no prazo,", ", issued on time,")
        : "";
  const quem = tx(`A rodada de ${dataBR(r.origem)} (${r.modelo}, ${r.tipo})${atraso}`, `The run of ${dataBR(r.origem, idioma)} (${r.modelo}, ${r.tipo})${atraso}`);
  const numero =
    r.com_numero === 0
      ? tx(`não tem número${r.motivos.length ? `: ${r.motivos.join("; ")}` : ""}`, `has no number${r.motivos.length ? `: ${r.motivos.join("; ")}` : ""}`)
      : r.sem_numero === 0
        ? tx(`tem ${plural(r.com_numero, "número", "números")}`, `has ${plural(r.com_numero, "number", "numbers", idioma)}`)
        : tx(`tem ${r.com_numero} de ${r.celulas} células com número`, `has ${r.com_numero} of ${r.celulas} cells with a number`);
  const transc = r.transcrito
    ? tx(`; foi transcrita para o arquivo em ${dataBR(r.registrado)}, depois da emissão`, `; it was transcribed into the archive on ${dataBR(r.registrado, idioma)}, after issue`)
    : "";
  return `${quem} ${numero}${transc}.`;
}

/** Resposta curta do P015 sobre o recorte exibido (o mesmo da tabela e do gráfico). */
export function respostaP015(linhas: readonly LinhaArquivo[], dia: string, total: number, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const D = (d: string) => dataBR(d, idioma);
  if (!linhas.length)
    return dia
      ? tx(`Nenhum registro estava no arquivo ao fim de ${dataBR(dia)}.`, `No record was in the archive at the end of ${D(dia)}.`)
      : tx("O arquivo de emissões não tem registro publicado.", "The forecast archive has no published record.");
  const rs = resumoRodadas(linhas, idioma);
  const quando = dia ? tx(`Ao fim de ${dataBR(dia)}, o arquivo tinha`, `At the end of ${D(dia)}, the archive had`) : tx("O arquivo tem", "The archive has");
  const parcial = dia && linhas.length < total ? tx(` (de ${total.toLocaleString("pt-BR")} no arquivo completo)`, ` (of ${num(total, 0, idioma)} in the full archive)`) : "";
  const abertura = tx(
    `${quando} ${plural(linhas.length, "registro", "registros")}${parcial} de ${plural(rs.length, "rodada", "rodadas")}.`,
    `${quando} ${plural(linhas.length, "record", "records", idioma)}${parcial} from ${plural(rs.length, "run", "runs", idioma)}.`,
  );
  const apurados = linhas.filter((l) => l.realizado !== null).length;
  const prox = primeiraEntregaAMaturar(linhas);
  const comNumero = linhas.filter((l) => l.previsao !== null).length;
  const realizado =
    comNumero === 0
      ? ""
      : apurados === 0
        ? tx(
            ` Nenhuma entrega prevista terminou: ainda não há realizado${prox ? `; a primeira, ${prox.entrega}, termina em ${dataBR(prox.termina)}` : ""}.`,
            ` No forecast delivery has ended: there is no actual value yet${prox ? `; the first, ${prox.entrega}, ends on ${D(prox.termina)}` : ""}.`,
          )
        : tx(
            ` ${apurados} de ${comNumero} previsões com número já têm realizado${prox ? `; a próxima entrega a terminar, ${prox.entrega}, termina em ${dataBR(prox.termina)}` : ""}.`,
            ` ${apurados} of ${comNumero} forecasts with a number already have an actual value${prox ? `; the next delivery to end, ${prox.entrega}, ends on ${D(prox.termina)}` : ""}.`,
          );
  return `${abertura} ${rs.map((r) => fraseRodada(r, idioma)).join(" ")}${realizado}`;
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
export function textoTolerancia(t: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!t) return tx("sem tolerância registrada", "no tolerance recorded", idioma);
  const m = /^(\d+(?:\.\d+)?)\s*R\$\/MWh/.exec(t.trim());
  if (!m) return t;
  const casas = (m[1].split(".")[1] ?? "").length;
  return `R$ ${num(Number(m[1]), casas, idioma)}/MWh`;
}

/** Estado da reexecução das previsões arquivadas de um modelo, em palavras. */
export function textoReexecucao(f: Ficha, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const r = f.reproducao?.reexecucao_do_arquivo;
  if (!f.implementado_no_repositorio)
    return tx(
      "sem reexecução: o modelo não pode ser refeito; a configuração da pesquisa não foi publicada",
      "no rerun: the model cannot be redone; the research configuration was not published",
    );
  if (!r) return tx("sem previsão arquivada com número para refazer", "no archived forecast with a number to redo");
  const div = r.divergentes.length;
  return tx(
    `${r.conferidas} ${r.conferidas === 1 ? "previsão arquivada refeita" : "previsões arquivadas refeitas"} com o dado do corte, ${div === 0 ? "sem divergência" : `${div} com divergência`} (tolerância ${textoTolerancia(r.tolerancia, "pt")})`,
    `${r.conferidas} ${r.conferidas === 1 ? "archived forecast redone" : "archived forecasts redone"} with the data as of the cutoff, ${div === 0 ? "with no divergence" : `${div} with divergence`} (tolerance ${textoTolerancia(r.tolerancia, idioma)})`,
  );
}

/**
 * Fórmula para o leitor de Entender. A de B0 e S0 já é uma frase e fica como está; a dos candidatos C2 (soma ponderada com símbolos e nomes de
 * campo) vira a descrição do que ela faz, lida da própria fórmula do registro: parte do B0, soma uma correção por variável (a variável
 * multiplicada pelo coeficiente) e, com penalização zero, todos os coeficientes são zero e o resultado é o B0. A fórmula exata fica em Analisar.
 */
export function formulaEmPalavras(f: Pick<Ficha, "formula">, idioma: Idioma = idiomaEnergia()): string | null {
  if (!f.formula) return null;
  if (!/[Σλ⇒]|_j\b|beta/.test(f.formula)) return f.formula;
  return tx(
    "B0 mais uma correção para cada variável de entrada: cada variável é multiplicada pelo seu coeficiente e as correções são somadas ao B0. Com a penalização em zero, todos os coeficientes são zero e o resultado é igual ao B0.",
    "B0 plus a correction for each input variable: each variable is multiplied by its coefficient and the corrections are added to B0. With the penalty at zero, all coefficients are zero and the result equals B0.",
    idioma,
  );
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
/** O que o modelo emite, como código: a frase vem de emissaoDoModelo no idioma da página. */
export type EmissaoModelo = "principal" | "experimental" | "sem_implementacao" | "retido" | "nenhum";
export function codigoEmissaoDoModelo(f: Ficha, g: Pick<PrevisoesDesempenhoGold, "previsao_atual">): EmissaoModelo {
  if (f.aprovacao.estado === "PRODUCAO") return "principal";
  if (f.aprovacao.referencia_experimental) return "experimental";
  if (!f.implementado_no_repositorio) return "sem_implementacao";
  const at = g.previsao_atual;
  if ((f.codigo === "C2-P" || f.codigo === "C2-H") && temRodada(at) && !at.candidatos.emitidos) return "retido";
  return "nenhum"; // i18n: dado
}

export function emissaoDoModelo(f: Ficha, g: Pick<PrevisoesDesempenhoGold, "previsao_atual">, idioma: Idioma = idiomaEnergia()): string {
  switch (codigoEmissaoDoModelo(f, g)) {
    case "principal":
      return tx("previsão principal", "main forecast", idioma);
    case "experimental":
      return tx("referência experimental publicada", "published experimental benchmark", idioma);
    case "sem_implementacao":
      return tx("não emite: sem implementação", "issues nothing: no implementation", idioma);
    case "retido":
      return tx("não emite: número retido pela governança", "issues nothing: number withheld by governance", idioma);
    case "nenhum":
      return tx("não emite número", "issues no number", idioma);
  }
}

export function linhasModelos(g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual">, idioma: Idioma = idiomaEnergia()): LinhaModelo[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return fichasOrdenadas(g.fichas).map((f) => ({
    id: slugModelo(f.codigo),
    codigo: f.codigo,
    nome: reg(f.nome, idioma),
    versao: f.versao,
    estado: rotuloEstadoModelo(f.estado, idioma),
    papel: f.papel ? reg(semCodigosInternos(f.papel), idioma) : tx("sem papel registrado", "no role recorded"),
    implementado: f.implementado_no_repositorio ? tx("sim", "yes") : tx("não", "no"),
    emite: emissaoDoModelo(f, g, idioma),
    entradas: f.entradas ? f.entradas.map((e) => reg(e, idioma)).join("; ") : tx("não publicadas", "not published"),
    n_entradas: f.entradas ? f.entradas.length : null,
    formula: (() => {
      const fp = formulaEmPalavras(f, idioma);
      return fp ? reg(fp, idioma) : tx("não publicada", "not published");
    })(),
    faixa: tx("sem faixa publicada", "no band published"),
    reexecucao: textoReexecucao(f, idioma),
    limitacoes: f.limitacoes ? f.limitacoes.length : null,
    falhas: f.falhas_conhecidas ? f.falhas_conhecidas.length : null,
    aprovacao: reg(semCodigosInternos(f.aprovacao.leitura.trim()), idioma),
  }));
}

export function colunasModelos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "codigo", rotulo: tx("Modelo", "Model"), tipo: "texto" },
    { id: "nome", rotulo: tx("Nome", "Name"), tipo: "texto" },
    { id: "versao", rotulo: tx("Versão", "Version"), tipo: "texto" },
    { id: "estado", rotulo: tx("Estado", "State"), tipo: "texto", categorica: true },
    { id: "papel", rotulo: tx("Papel", "Role"), tipo: "texto" },
    { id: "implementado", rotulo: tx("Implementado pelo observatório", "Implemented by the observatory"), tipo: "texto", categorica: true },
    { id: "emite", rotulo: tx("Número no arquivo", "Number in the archive"), tipo: "texto", categorica: true },
    { id: "n_entradas", rotulo: tx("Entradas", "Inputs"), tipo: "numero", unidade: tx("variáveis", "variables"), casas: 0 },
    { id: "entradas", rotulo: tx("Quais entradas", "Which inputs"), tipo: "texto" },
    { id: "formula", rotulo: tx("Fórmula", "Formula"), tipo: "texto" },
    { id: "faixa", rotulo: tx("Faixa de incerteza", "Uncertainty band"), tipo: "texto", categorica: true },
    { id: "reexecucao", rotulo: tx("Reexecução do arquivo", "Archive rerun"), tipo: "texto" },
    { id: "limitacoes", rotulo: tx("Limitações registradas", "Recorded limitations"), tipo: "numero", casas: 0 },
    { id: "falhas", rotulo: tx("Falhas conhecidas", "Known failures"), tipo: "numero", casas: 0 },
    { id: "aprovacao", rotulo: tx("Aprovação", "Approval"), tipo: "texto" },
  ];
}
export const COLUNAS_MODELOS: ColunaTabela[] = colunasModelos("pt");

/** Resposta curta do P014: estado de todos os modelos, papel de cada um e a reexecução do arquivo. */
export function respostaP014(g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const E = (e: string) => rotuloEstadoModelo(e, idioma);
  const fs = fichasOrdenadas(g.fichas);
  if (!fs.length) return tx("Nenhum modelo está registrado nesta publicação.", "No model is registered in this publication.");
  const porEstado = new Map<string, string[]>();
  for (const f of fs) porEstado.set(f.estado, [...(porEstado.get(f.estado) ?? []), f.codigo]);
  const estados =
    porEstado.size === 1
      ? tx(
          `${fs.length === 1 ? "O único modelo registrado está" : `Os ${fs.length} modelos registrados estão todos`} em ${E(fs[0].estado)}`,
          `${fs.length === 1 ? "The only registered model is" : `All ${fs.length} registered models are`} in ${E(fs[0].estado)}`,
        )
      : tx(
          `Dos ${fs.length} modelos registrados, ${Array.from(porEstado.entries())
            .map(([e, cs]) => `${cs.join(", ")} em ${E(e)}`) // i18n: dado
            .join("; ")}`,
          `Of the ${fs.length} registered models, ${Array.from(porEstado.entries())
            .map(([e, cs]) => `${cs.join(", ")} in ${E(e)}`)
            .join("; ")}`,
        );
  const producao = porEstado.get("PRODUCAO") ?? [];
  const oficial = producao.length
    ? tx(`: ${producao.join(", ")} alimenta a previsão principal.`, `: ${producao.join(", ")} feeds the main forecast.`)
    : tx(": nenhum alimenta previsão oficial.", ": none feeds an official forecast.");
  const ref = fs.filter((f) => f.aprovacao.referencia_experimental).map((f) => f.codigo);
  const semImpl = fs.filter((f) => !f.implementado_no_repositorio).map((f) => f.codigo);
  const retidos = fs.filter((f) => codigoEmissaoDoModelo(f, g) === "retido").map((f) => f.codigo);
  const partes: string[] = [];
  if (ref.length) partes.push(tx(`${ref.join(", ")} é publicado só como referência experimental`, `${ref.join(", ")} is published only as an experimental benchmark`));
  if (retidos.length) partes.push(tx(`${retidos.join(" e ")}, reimplementados no observatório, não têm número emitido`, `${retidos.join(" and ")}, reimplemented by the observatory, have no number issued`));
  if (semImpl.length)
    partes.push(
      tx(
        `${semImpl.join(", ")} não pode ser reimplementado; a configuração da pesquisa não está no repositório`,
        `${semImpl.join(", ")} cannot be reimplemented; the research configuration is not in the repository`,
      ),
    );
  const reex = fs.find((f) => f.reproducao?.reexecucao_do_arquivo);
  const reexecucao = reex ? tx(` Reexecução do ${reex.codigo}: ${textoReexecucao(reex, "pt")}.`, ` Rerun of ${reex.codigo}: ${textoReexecucao(reex, idioma)}.`) : "";
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
export function linhasReexecucao(g: Pick<PrevisoesDesempenhoGold, "evidencias">, idioma: Idioma = idiomaEnergia()): LinhaReexecucao[] {
  const out: LinhaReexecucao[] = [];
  for (const freq of ["semanal", "mensal"] as const)
    for (const sm of SUBMERCADOS) {
      const id = `b0_${freq}_${sm}`;
      const e = g.evidencias[id];
      if (!e) continue;
      const t = e.testes.find((x) => /^Reexecu/i.test(x.nome));
      out.push({
        id,
        sm: curto(sm, idioma),
        frequencia: freq === "semanal" ? tx("semanal (W1 a W4)", "weekly (W1 to W4)", idioma) : tx("mensal (M1 a M3)", "monthly (M1 to M3)", idioma),
        valor: e.valor_calculo,
        resultado: t ? t.resultado : tx("sem teste de reexecução", "no rerun test", idioma),
        detalhe: t ? t.detalhe : "",
      });
    }
  return out;
}

/** Resposta curta da ficha de um modelo: estado, o que emite, entradas, fórmula e reexecução. */
export function respostaFicha(f: Ficha, g: Pick<PrevisoesDesempenhoGold, "previsao_atual">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const estado = tx(
    `${f.codigo} (${f.nome}, versão ${f.versao}) está em ${rotuloEstadoModelo(f.estado, "pt")}`,
    `${f.codigo} (${reg(f.nome, idioma)}, version ${f.versao}) is in ${rotuloEstadoModelo(f.estado, idioma)}`,
  );
  const emite = emissaoDoModelo(f, g, idioma);
  if (!f.implementado_no_repositorio)
    return tx(
      `${estado} e não emite número: ${minusculaInicial(semCaminhosDeArquivo(f.motivo_sem_implementacao ?? "a implementação não está no repositório"))}`.replace(/\.?$/, "."),
      `${estado} and issues no number: ${minusculaInicial(reg(semCaminhosDeArquivo(f.motivo_sem_implementacao ?? "a implementação não está no repositório"), idioma))}`.replace(/\.?$/, "."),
    );
  const entradas = f.entradas?.length
    ? tx(` Usa ${plural(f.entradas.length, "entrada", "entradas")}: ${f.entradas.join("; ")}.`, ` It uses ${plural(f.entradas.length, "input", "inputs", idioma)}: ${f.entradas.map((e) => reg(e, idioma)).join("; ")}.`)
    : "";
  return tx(`${estado}; ${emite}.${entradas} Reexecução: ${textoReexecucao(f, "pt")}.`, `${estado}; ${emite}.${entradas} Rerun: ${textoReexecucao(f, idioma)}.`);
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
 * Frase do registro que explica a falta com "porque" ("28 células sem número, porque nenhum PLD ... havia sido capturado"): no texto de
 * leitura o motivo vem como motivo gravado, sem afirmar causa. O texto original continua em Auditar.
 */
export function motivoGravado(texto: string): string {
  return texto.replace(/,\s+porque\s+/g, "; motivo gravado: ");
}

/**
 * Proveniência do painel para a leitura: o indicador vem do registro e chama a rodada de "atual" ("Referência experimental B0 da rodada
 * atual"); o dado tem a própria data, e o rótulo da página é "rodada mais recente". O resto da proveniência fica como está.
 */
export function provenienciaParaLeitor<T extends Pick<Proveniencia, "indicador">>(p: T): T {
  return typeof p.indicador === "string" && /\bda rodada atual\b/.test(p.indicador) ? { ...p, indicador: p.indicador.replace(/\bda rodada atual\b/, "da rodada mais recente") } : p;
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
export function liberacaoEmPalavras(paraLiberar: string, idioma: Idioma = idiomaEnergia()): string {
  const campos = /decidido_por/.test(paraLiberar) && /decidido_em/.test(paraLiberar) && /LIBERADA/.test(paraLiberar);
  if (!campos) return partirInterno(paraLiberar).leitor || paraLiberar;
  const proxima = /A próxima execução publica os números\./.test(paraLiberar) ? tx(" A próxima execução publica os números.", " The next run publishes the numbers.", idioma) : "";
  return tx(
    `O responsável pela plataforma registra a decisão de liberar, com o seu nome, a data e o escopo decidido, e marca a publicação como liberada.${proxima}`,
    `The platform owner records the decision to release, with their name, the date and the scope decided, and marks the publication as released.${proxima}`,
    idioma,
  );
}

/** Corte e origem em palavras do próprio registro: texto de definicoes.corte_operacional sem o fuso e sem "vintages". */
export function explicacaoCorteOrigem(def: Pick<PrevisoesDesempenhoGold["definicoes"], "corte_operacional">, idioma: Idioma = idiomaEnergia()): string {
  const base = def.corte_operacional.replace(/\s*\([^)]*\)/g, (m) => (/vintages/.test(m) ? ` (${m.replace(/vintages/g, "versões").replace(/[()]/g, "").trim()})` : ""));
  const pt = `${base.trim()} O dia de origem é o dia da rodada.`; // i18n: dado
  if (idioma !== "en") return pt;
  // forma inglesa só para o texto publicado conhecido; outro texto da fonte segue em português
  return pt ===
    "Corte às 07h00 de Brasília do dia de origem; prazo de emissão às 08h00. A emissão usa o dado como estava no corte (versões capturadas até ali); coleta posterior ao corte não entra. O dia de origem é o dia da rodada."
    ? "Cutoff at 07:00 Brasília time on the origin day; issue deadline at 08:00. The issue uses the data as it was at the cutoff (versions captured up to then); data collected after the cutoff is not included. The origin day is the day of the run." // i18n: dado
    : pt;
}

/**
 * Termos da página (corte, origem, rodada, faixa P10 a P90) com o texto do próprio registro de modelos: definicoes.corte_operacional,
 * definicoes.entregas e definicoes.quantis. Cada item só sai quando a definição publicada contém a frase de que ele depende.
 */
export function termosPrevisoes(
  def: Pick<PrevisoesDesempenhoGold["definicoes"], "corte_operacional" | "entregas" | "quantis">,
  idioma: Idioma = idiomaEnergia(),
): { termo: string; texto: string }[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const itens: { termo: string; texto: string }[] = [];
  if (def.corte_operacional?.trim()) itens.push({ termo: tx("Corte e origem", "Cutoff and origin"), texto: explicacaoCorteOrigem(def, idioma) });
  if (/W1 é a primeira semana que começa depois do dia de origem/.test(def.entregas ?? "") && /M1 é o primeiro mês que começa depois do dia de origem/.test(def.entregas ?? ""))
    itens.push({
      termo: tx("W1 a W4 e M1 a M3", "W1 to W4 and M1 to M3"),
      texto: tx(
        "W1 a W4 são as quatro semanas que começam depois do dia de origem, cada uma de um sábado, 0h, até o sábado seguinte, 0h; M1 a M3 são os três meses civis que começam depois dele.",
        "W1 to W4 are the four weeks that start after the origin day, each from a Saturday, 0h, to the following Saturday, 0h; M1 to M3 are the three calendar months that start after it.",
      ),
    });
  const celulas = /(\d+) células por modelo e rodada/.exec(def.entregas ?? "")?.[1];
  if (celulas)
    itens.push({
      termo: tx("Rodada", "Run"),
      texto: tx(
        `cada emissão de previsões de um dia de origem; tem ${celulas} células por modelo, uma por horizonte e submercado.`,
        `each issue of forecasts for an origin day; it has ${celulas} cells per model, one per horizon and submarket.`,
      ),
    });
  const p10 = /o quantil de 10% \(P10\) é o valor que o preço tem 10% de chance de não superar/.test(def.quantis ?? "");
  const faixa = /A faixa entre P10 e P90[^.]*\./.exec(def.quantis ?? "")?.[0];
  if (p10 && faixa) {
    const faixaLimpa = faixa.replace(/\s*\(cobertura nominal\)/, "");
    const faixaEn = faixaLimpa === "A faixa entre P10 e P90 pretende conter o preço em 80% dos casos;" || faixaLimpa === "A faixa entre P10 e P90 pretende conter o preço em 80% dos casos."
      ? "The band between P10 and P90 is meant to contain the price in 80% of cases."
      : faixaLimpa;
    itens.push({
      termo: tx("P10 e P90", "P10 and P90"),
      texto: tx(`P10 é o valor que o preço tem 10% de chance de não superar. ${faixaLimpa}`, `P10 is the value that the price has a 10% chance of not exceeding. ${faixaEn}`),
    });
  }
  return itens;
}

/**
 * Exemplo concreto de uma ficha, na primeira semana da rodada atual no Sudeste/Centro-Oeste. Do B0, lê a célula publicada (período
 * repetido e número); do S0, que não emite número, só diz que período do ano anterior ele usaria, pela regra do registro de modelos (a semana que
 * começa 364 dias antes da entrega). Outros modelos não têm exemplo.
 */
export function exemploDoModelo(
  f: Pick<Ficha, "codigo">,
  g: Pick<PrevisoesDesempenhoGold, "previsao_atual">,
  metodologia?: string | null,
  idioma: Idioma = idiomaEnergia(),
): string | null {
  const at = g.previsao_atual;
  if (!temRodada(at)) return null;
  const l = linhasGrade(at.celulas, [], idioma).find((x) => x.horizonte === "W1" && x.submercado === "SE");
  if (!l) return null;
  const D = (d: string) => dataBR(d, idioma);
  const semana = tx(`${dataBR(l.inicio)} a ${dataBR(l.fim)}`, `${D(l.inicio)} to ${D(l.fim)}`, idioma);
  if (f.codigo === "B0" && l.previsao !== null && l.periodo_inicio && l.periodo_fim)
    return tx(
      `Exemplo da rodada de ${dataBR(at.origem)}: para a semana de ${semana}, no ${l.sm}, o B0 repete a média de ${dataBR(l.periodo_inicio)} a ${dataBR(l.periodo_fim)}, ${reaisMWh(l.previsao)}.`,
      `Example from the run of ${D(at.origem)}: for the week from ${semana}, in ${l.sm}, B0 repeats the average from ${D(l.periodo_inicio)} to ${D(l.periodo_fim)}, ${reaisMWh(l.previsao, 2, idioma)}.`,
      idioma,
    );
  if (f.codigo === "S0" && metodologia && /364 dias antes da entrega/.test(metodologia))
    return tx(
      `Exemplo da rodada de ${dataBR(at.origem)}: para a semana de ${semana}, no ${l.sm}, o S0 usaria a média do PLD de ${dataBR(somaDias(l.inicio, -364))} a ${dataBR(somaDias(l.fim, -364))}, a semana que começa 364 dias antes. O observatório não publica número do S0.`,
      `Example from the run of ${D(at.origem)}: for the week from ${semana}, in ${l.sm}, S0 would use the average PLD from ${D(somaDias(l.inicio, -364))} to ${D(somaDias(l.fim, -364))}, the week that starts 364 days earlier. The observatory does not publish an S0 number.`,
      idioma,
    );
  return null;
}

/** Explicação curta das entradas dos candidatos C2, lida dos próprios rótulos das entradas e do verbete da MLT (100% é o valor da média de longo termo). */
export function notaEntradas(f: Pick<Ficha, "entradas">, idioma: Idioma = idiomaEnergia()): string | null {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const e = f.entradas ?? [];
  const partes: string[] = [];
  if (e.some((x) => /− B0$/.test(x))) partes.push(tx("Em “X − B0”, o modelo usa a diferença entre X e o B0.", "In “X − B0”, the model uses the difference between X and B0."));
  if (e.some((x) => /\(% da MLT\) − 100$/.test(x)))
    partes.push(
      tx(
        "Na ENA em % da MLT, 100 é o valor da média de longo termo: “− 100” é quanto a ENA média dos 7 últimos dias fica acima ou abaixo dessa média.",
        "In ENA as % of MLT, 100 is the value of the long-term average: “− 100” is how far the average ENA of the last 7 days sits above or below that average.",
      ),
    );
  if (e.some((x) => /\(p\.p\.\)/.test(x))) partes.push(tx("p.p. quer dizer ponto percentual.", "pp means percentage point."));
  return partes.length ? partes.join(" ") : null;
}

/** Quando a rodada tem referência experimental, e não publicação de modelo em produção. */
const ehReferenciaExperimental = (rotulo: string) => /refer[eê]ncia experimental/i.test(rotulo);

/**
 * Veredito do P013 em palavras simples: se há previsão oficial, o que a página mostra no lugar (a referência simples que repete o
 * PLD médio do último período completo), a faixa de valores publicada e se há faixa de incerteza. Lê as mesmas células que a
 * resposta completa (respostaP013).
 */
export function vereditoP013(g: Pick<PrevisoesDesempenhoGold, "previsao_atual" | "modelos">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const at = g.previsao_atual;
  const producao = g.modelos.filter((m) => m.estado === "PRODUCAO").map((m) => m.codigo);
  const oficial = producao.length ? tx(`Modelo em produção: ${producao.join(", ")}.`, `Model in production: ${producao.join(", ")}.`) : tx("Nenhum modelo está aprovado.", "No model is approved.");
  if (!temRodada(at)) return tx(`${oficial} Nenhuma rodada com números está publicada.`, `${oficial} No run with numbers is published.`);
  const linhas = linhasGrade(at.celulas, [], idioma);
  const valores = linhas.map((l) => l.previsao).filter((v): v is number => v !== null);
  if (!valores.length)
    return tx(`${oficial} A rodada de ${dataBR(at.origem)} não tem número em nenhuma das ${linhas.length} células.`, `${oficial} The run of ${dataBR(at.origem, idioma)} has no number in any of the ${linhas.length} cells.`);
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const intervalo = menor === maior ? reaisMWh(menor, 2, idioma) : tx(`de ${reais(menor)} a ${reaisMWh(maior)}`, `from ${reais(menor, 2, idioma)} to ${reaisMWh(maior, 2, idioma)}`);
  const comFaixa = linhas.filter((l) => l.p10 !== null && l.p90 !== null).length;
  const faixa = comFaixa ? tx(`Há faixa de incerteza em ${comFaixa} de ${linhas.length} células.`, `There is an uncertainty band in ${comFaixa} of ${linhas.length} cells.`) : tx("Sem faixa de incerteza.", "No uncertainty band.");
  const o_que = ehReferenciaExperimental(at.rotulo)
    ? tx(`A referência simples B0 repete o PLD médio do último período completo, ${intervalo}.`, `The simple benchmark B0 repeats the average PLD of the latest complete period, ${intervalo}.`)
    : tx(`A rodada de ${dataBR(at.origem)} publica ${intervalo} conforme submercado e prazo.`, `The run of ${dataBR(at.origem, idioma)} publishes ${intervalo} depending on submarket and horizon.`);
  return `${oficial} ${o_que} ${faixa}`;
}

/**
 * Veredito do P014 em palavras simples: estado dos modelos, quais publicam número e por que os outros não. Lê as mesmas fichas
 * que a resposta completa (respostaP014), sem "repositório" nem "reimplementado".
 */
export function vereditoP014(g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const E = (e: string) => rotuloEstadoModelo(e, idioma);
  const fs = fichasOrdenadas(g.fichas);
  if (!fs.length) return tx("Nenhum modelo está registrado nesta publicação.", "No model is registered in this publication.");
  const porEstado = new Map<string, string[]>();
  for (const f of fs) porEstado.set(f.estado, [...(porEstado.get(f.estado) ?? []), f.codigo]);
  const estados =
    porEstado.size === 1
      ? tx(
          `${fs.length === 1 ? "O único modelo está" : `Os ${fs.length} modelos estão todos`} em ${E(fs[0].estado)}`,
          `${fs.length === 1 ? "The only model is" : `All ${fs.length} models are`} in ${E(fs[0].estado)}`,
        )
      : tx(
          `Dos ${fs.length} modelos, ${Array.from(porEstado.entries())
            .map(([e, cs]) => `${cs.join(", ")} em ${E(e)}`) // i18n: dado
            .join("; ")}`,
          `Of the ${fs.length} models, ${Array.from(porEstado.entries())
            .map(([e, cs]) => `${cs.join(", ")} in ${E(e)}`)
            .join("; ")}`,
        );
  const producao = porEstado.get("PRODUCAO") ?? [];
  const oficial = producao.length
    ? tx(`: ${producao.join(", ")} alimenta a previsão principal.`, `: ${producao.join(", ")} feeds the main forecast.`)
    : tx(": nenhum alimenta previsão oficial.", ": none feeds an official forecast.");
  const ref = fs.filter((f) => f.aprovacao.referencia_experimental).map((f) => f.codigo);
  const semImpl = fs.filter((f) => !f.implementado_no_repositorio).map((f) => f.codigo);
  const retidos = fs.filter((f) => codigoEmissaoDoModelo(f, g) === "retido").map((f) => f.codigo);
  const partes: string[] = [];
  if (ref.length)
    partes.push(
      tx(
        `${ref.join(" e ")} ${ref.length > 1 ? "publicam número" : "publica número"} só como referência experimental`,
        `${ref.join(" and ")} ${ref.length > 1 ? "publish a number" : "publishes a number"} only as an experimental benchmark`,
      ),
    );
  if (retidos.length)
    partes.push(
      tx(
        `${retidos.join(" e ")} ${retidos.length > 1 ? "têm" : "tem"} número retido até a liberação formal`,
        `${retidos.join(" and ")} ${retidos.length > 1 ? "have their number" : "has its number"} withheld until formal release`,
      ),
    );
  if (semImpl.length) partes.push(tx(`${semImpl.join(", ")} não pode ser refeito: a configuração da pesquisa não foi publicada`, `${semImpl.join(", ")} cannot be redone: the research configuration was not published`));
  return `${estados}${oficial}${partes.length ? ` ${maiuscula(partes.join("; "))}.` : ""}`.replace(/^./, (c) => c.toUpperCase());
}

/**
 * Veredito do P015 em palavras simples, sobre o mesmo recorte da tabela: quantos registros e rodadas, quais rodadas têm número e se
 * alguma entrega prevista já terminou. Lê as mesmas linhas que a resposta completa (respostaP015).
 */
export function vereditoP015(linhas: readonly LinhaArquivo[], dia: string, total: number, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const D = (d: string) => dataBR(d, idioma);
  if (!linhas.length)
    return dia
      ? tx(`Nenhum registro estava no arquivo ao fim de ${dataBR(dia)}.`, `No record was in the archive at the end of ${D(dia)}.`)
      : tx("O arquivo de emissões não tem registro publicado.", "The forecast archive has no published record.");
  const rs = resumoRodadas(linhas, idioma);
  const quando = dia ? tx(`Ao fim de ${dataBR(dia)}, o arquivo tinha`, `At the end of ${D(dia)}, the archive had`) : tx("O arquivo tem", "The archive has");
  const parcial = dia && linhas.length < total ? tx(` (de ${total.toLocaleString("pt-BR")} no arquivo completo)`, ` (of ${num(total, 0, idioma)} in the full archive)`) : "";
  const comNumero = rs.filter((r) => r.com_numero > 0);
  const quais =
    comNumero.length === 0
      ? tx("nenhuma tem número", "none has a number")
      : comNumero.length === rs.length
        ? tx("todas têm número", "all have a number")
        : comNumero.length === 1
          ? tx(`só a de ${dataBR(comNumero[0].origem)} tem número`, `only the one of ${D(comNumero[0].origem)} has a number`)
          : tx(`${comNumero.length} têm número`, `${comNumero.length} have a number`);
  const prevComNumero = linhas.filter((l) => l.previsao !== null).length;
  const apurados = linhas.filter((l) => l.realizado !== null).length;
  const resultado =
    prevComNumero === 0
      ? ""
      : apurados === 0
        ? tx(" Nenhuma entrega prevista terminou: ainda não há resultado para comparar.", " No forecast delivery has ended: there is no outcome to compare yet.")
        : tx(` ${apurados} de ${prevComNumero} previsões com número já têm resultado.`, ` ${apurados} of ${prevComNumero} forecasts with a number already have an outcome.`);
  return tx(
    `${quando} ${plural(linhas.length, "registro", "registros")}${parcial} de ${plural(rs.length, "rodada", "rodadas")}; ${quais}.${resultado}`,
    `${quando} ${plural(linhas.length, "record", "records", idioma)}${parcial} from ${plural(rs.length, "run", "runs", idioma)}; ${quais}.${resultado}`,
  );
}

/**
 * Veredito do P016 em palavras simples: se já dá para dizer que algum modelo supera as referências simples, por que os números
 * do teste não aparecem e o que o acompanhamento depois da emissão já mostra. Lê os mesmos campos que a resposta completa (respostaP016).
 */
export function vereditoP016(g: Pick<PrevisoesDesempenhoGold, "desempenho" | "publicacao_desempenho" | "prospectivo">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const ap = g.prospectivo.apuracoes;
  const apuradas = ap.filter((a) => a.realizado !== null).length;
  const acompanhamento =
    ap.length === 0
      ? tx("O acompanhamento depois da emissão ainda não tem previsão com número.", "The follow-up after issue does not yet have a forecast with a number.")
      : apuradas === 0
        ? tx(`Nenhuma das ${ap.length} previsões em acompanhamento tem resultado.`, `None of the ${ap.length} forecasts being followed has an outcome.`)
        : tx(`${apuradas} de ${ap.length} previsões em acompanhamento já têm resultado.`, `${apuradas} of ${ap.length} forecasts being followed already have an outcome.`);
  if (!g.desempenho.publicado)
    return tx(
      `Ainda não dá para dizer se algum modelo supera as referências simples: os números do teste com dados do passado estão calculados, mas ficam retidos até a liberação formal. ${acompanhamento}`,
      `It is not yet possible to say whether any model beats the simple benchmarks: the numbers from the test with past data are calculated but withheld until formal release. ${acompanhamento}`,
    );
  const ganhos = linhasDesempenho(g.desempenho.por_horizonte).filter((l) => l.periodo === "teste" && l.modelo !== "B0" && l.ganho_vs_b0 !== null);
  const positivos = ganhos.filter((l) => l.ic_inf !== null && l.ic_inf > 0);
  const teste = ganhos.length
    ? tx(
        `No teste final, ${positivos.length} de ${ganhos.length} combinações de candidato e horizonte têm ganho sobre o B0 com intervalo de 90% inteiro acima de zero.`,
        `In the final test, ${positivos.length} of ${ganhos.length} combinations of candidate and horizon have a gain over B0 with the whole 90% interval above zero.`,
      )
    : tx("O teste final não tem comparação pareada com o B0 publicada.", "The final test has no published paired comparison with B0.");
  return `${teste} ${acompanhamento}`;
}

/**
 * Veredito da ficha de um modelo: a primeira frase do resumo do registro de modelos (escrita em palavras simples) e o estado, o que o
 * modelo emite e, quando não pode ser refeito, o motivo. Sem resumo, só o nome do modelo.
 */
export function vereditoFicha(f: Ficha, resumo: string | null | undefined, g: Pick<PrevisoesDesempenhoGold, "previsao_atual">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const inicio = resumo?.trim() ? primeiraFrase(resumo) : tx(`${f.codigo} é o modelo ${f.nome}.`, `${f.codigo} is the ${reg(f.nome, idioma)} model.`);
  const estado = rotuloEstadoModelo(f.estado, idioma);
  const emite = codigoEmissaoDoModelo(f, g);
  const fim = !f.implementado_no_repositorio
    ? tx(
        `Está em ${estado} e não emite número: a configuração da pesquisa não foi publicada; o modelo não pode ser refeito.`,
        `It is in ${estado} and issues no number: the research configuration was not published; the model cannot be redone.`,
      )
    : f.aprovacao.referencia_experimental
      ? tx(`Está em ${estado}; é publicado só como referência experimental.`, `It is in ${estado}; it is published only as an experimental benchmark.`)
      : emite === "retido"
        ? tx(`Está em ${estado}; o número fica retido até a liberação formal.`, `It is in ${estado}; the number is withheld until formal release.`)
        : tx(`Está em ${estado} e não emite número.`, `It is in ${estado} and issues no number.`);
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
export function variaveisCoeficientes(fichas: readonly Ficha[], idioma: Idioma = idiomaEnergia()): { id: string; rotulo: string }[] {
  const out: { id: string; rotulo: string }[] = [];
  for (const f of fichasOrdenadas(fichas)) for (const v of f.coeficientes_ultimo_ajuste?.variaveis ?? []) if (!out.some((x) => x.id === v.id)) out.push({ id: v.id, rotulo: reg(v.rotulo, idioma) });
  return out;
}

export const segmentoId = (h: string, sm: string) => `${h}-${sm}`;

/** Segmentos (horizonte × submercado) presentes no último ajuste, na ordem W1 a M3 e SE, S, NE, N. */
export function segmentosCoeficientes(fichas: readonly Ficha[], idioma: Idioma = idiomaEnergia()): { id: string; rotulo: string }[] {
  const ids = new Set<string>();
  for (const f of fichas) for (const s of f.coeficientes_ultimo_ajuste?.segmentos ?? []) ids.add(segmentoId(s.horizonte, s.submercado));
  const out: { id: string; rotulo: string }[] = [];
  for (const h of HORIZONTES) for (const sm of SUBMERCADOS) if (ids.has(segmentoId(h, sm))) out.push({ id: segmentoId(h, sm), rotulo: `${h}, ${nome(sm, idioma)}` });
  return out;
}

const lambdaTexto = (l: string | number | null, idioma: Idioma = idiomaEnergia()) =>
  l === null
    ? tx("sem ajuste", "no fit", idioma)
    : typeof l === "number"
      ? l.toLocaleString(idioma === "en" ? "en-US" : "pt-BR", { maximumFractionDigits: 3 })
      : l === "ZERO"
        ? tx("zero (correção desligada)", "zero (correction switched off)", idioma)
        : l;

/** Primeira letra minúscula, para citar um texto da gold depois de dois-pontos. */
export const minusculaInicial = (s: string) => (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ](?:[a-záéíóúâêôãõç]| )/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** Tabela de coeficientes: uma linha por modelo e segmento, uma coluna por variável. */
export function linhasCoeficientes(fichas: readonly Ficha[], idioma: Idioma = idiomaEnergia()): LinhaCoeficiente[] {
  const vars = variaveisCoeficientes(fichas, idioma);
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
        sm: curto(s.submercado, idioma),
        origem_ajuste: s.origem_ajuste,
        ajustado: s.ok ? tx("sim", "yes", idioma) : tx(`não: ${textoMotivo(s.motivo, "pt")}`, `no: ${textoMotivo(s.motivo, idioma)}`, idioma),
        lambda: lambdaTexto(s.lambda, idioma),
        entregas_treino: s.entregas_treino,
      };
      // variável que o modelo não usa fica null (não se aplica) e não zero
      for (const v of vars) l[v.id] = s.coeficientes?.[v.id] ?? null;
      out.push(l);
    }
  }
  return out;
}

export function colunasCoeficientes(fichas: readonly Ficha[], idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "modelo", rotulo: tx("Modelo", "Model"), tipo: "texto", categorica: true },
    { id: "horizonte", rotulo: tx("Horizonte", "Horizon"), tipo: "texto", categorica: true },
    { id: "sm", rotulo: tx("Submercado", "Submarket"), tipo: "texto", categorica: true },
    ...variaveisCoeficientes(fichas, idioma).map((v): ColunaTabela => ({ id: v.id, rotulo: v.rotulo, tipo: "numero", casas: 4 })),
    { id: "lambda", rotulo: tx("Penalização λ", "Penalty λ"), tipo: "texto", categorica: true },
    { id: "entregas_treino", rotulo: tx("Entregas de treino", "Training deliveries"), tipo: "numero", casas: 0 },
    { id: "origem_ajuste", rotulo: tx("Ajuste de", "Fit of"), tipo: "data" },
    { id: "ajustado", rotulo: tx("Ajustado", "Fitted"), tipo: "texto", categorica: true },
  ];
}

/** Barras do segmento escolhido: uma categoria por variável, uma série por candidato. */
export function coeficientesDoSegmento(fichas: readonly Ficha[], seg: string, idioma: Idioma = idiomaEnergia()): Record<string, string | number | null>[] {
  const linhas = linhasCoeficientes(fichas, idioma).filter((l) => l.segmento === seg);
  return variaveisCoeficientes(fichas, idioma).map((v) => {
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
export function textoCoeficientes(fichas: readonly Ficha[], seg: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const linhas = linhasCoeficientes(fichas, idioma).filter((l) => l.segmento === seg);
  if (!linhas.length) return tx("Nenhum candidato tem ajuste registrado neste segmento.", "No candidate has a fit recorded in this segment.");
  const vars = variaveisCoeficientes(fichas, idioma);
  const [h, sm] = seg.split("-");
  const frases = linhas.map((l) => {
    let maior: { rotulo: string; valor: number } | null = null;
    for (const v of vars) {
      const x = l[v.id];
      if (typeof x === "number" && (!maior || Math.abs(x) > Math.abs(maior.valor))) maior = { rotulo: v.rotulo.replace(/\s*\([^)]*\)$/, ""), valor: x };
    }
    const peso = maior
      ? tx(`o maior peso é o da variável "${maior.rotulo}" (${num(maior.valor, 2)})`, `the largest weight is that of the variable "${maior.rotulo}" (${num(maior.valor, 2, idioma)})`)
      : tx("nenhum coeficiente registrado", "no coefficient recorded");
    return tx(
      `no ${l.modelo}, ${peso}, com λ ${l.lambda} e ${l.entregas_treino === null ? "treino sem contagem" : plural(l.entregas_treino, "entrega", "entregas")} de treino`,
      `in ${l.modelo}, ${peso}, with λ ${l.lambda} and ${l.entregas_treino === null ? "training without a count" : plural(l.entregas_treino, "training delivery", "training deliveries", idioma)}`,
    );
  });
  const acima = d7AcimaDe1(fichas).filter((x) => x.segmento === seg);
  const g23 = acima.length
    ? tx(
        ` Coeficiente da média dos 7 dias menos B0 acima de 1 (${acima.map((x) => `${x.modelo}: ${num(x.valor, 2)}`).join("; ")}): a correção amplia o desvio recente em vez de reduzi-lo.`,
        ` Coefficient of the 7-day average minus B0 above 1 (${acima.map((x) => `${x.modelo}: ${num(x.valor, 2, idioma)}`).join("; ")}): the correction widens the recent deviation instead of reducing it.`,
      )
    : tx(" Nenhum coeficiente da média dos 7 dias menos B0 passa de 1 neste segmento.", " No coefficient of the 7-day average minus B0 exceeds 1 in this segment.");
  return tx(
    `No ajuste de ${dataBR(linhas[0].origem_ajuste)} para ${h}, ${nome(sm, "pt") ?? sm}: ${frases.join("; ")}.${g23}`,
    `In the fit of ${dataBR(linhas[0].origem_ajuste, idioma)} for ${h}, ${nome(sm, idioma)}: ${frases.join("; ")}.${g23}`,
  );
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
export function linhasAmostra(g: Pick<PrevisoesDesempenhoGold, "prospectivo" | "definicoes">, idioma: Idioma = idiomaEnergia()): LinhaAmostra[] {
  const min = minimoCalibracao(g.definicoes.calibracao);
  const regs = g.prospectivo.calibracao_regra_antiga.por_registro;
  return HORIZONTES.filter((h) => regs.some((r) => r.horizonte === h)).map((h) => {
    const rs = regs.filter((r) => r.horizonte === h);
    const ns = rs.map((r) => r.entregas).filter((n): n is number => typeof n === "number");
    const n = ns.length ? Math.min(...ns) : null;
    const estados = Array.from(new Set(rs.map((r) => rotuloCalibracao(r.status_recalculado, idioma))));
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

export function colunasAmostra(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "horizonte", rotulo: tx("Horizonte", "Horizon"), tipo: "texto" },
    { id: "entregas", rotulo: tx("Entregas distintas no teste", "Distinct deliveries in the test"), tipo: "numero", casas: 0 },
    { id: "minimo", rotulo: tx("Mínimo para calibrar", "Minimum to calibrate"), tipo: "numero", casas: 0 },
    { id: "faltam", rotulo: tx("Faltam", "Missing"), tipo: "numero", casas: 0 },
    { id: "estado", rotulo: tx("Estado da calibração", "Calibration state"), tipo: "texto", categorica: true },
    { id: "registros", rotulo: tx("Células da rodada", "Cells in the run"), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_AMOSTRA: ColunaTabela[] = colunasAmostra("pt");

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

export function colunasProspectivo(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "horizonte", rotulo: tx("Horizonte", "Horizon"), tipo: "texto" },
    { id: "registradas", rotulo: tx("Previsões com número", "Forecasts with a number"), tipo: "numero", casas: 0 },
    { id: "apuradas", rotulo: tx("Com realizado", "With actual"), tipo: "numero", casas: 0 },
    { id: "aguardando", rotulo: tx("Aguardando o fim da entrega", "Waiting for the delivery to end"), tipo: "numero", casas: 0 },
    { id: "proxima_entrega", rotulo: tx("Próxima entrega a terminar", "Next delivery to end"), tipo: "texto" },
    { id: "termina", rotulo: tx("Termina em", "Ends on"), tipo: "data" },
  ];
}
export const COLUNAS_PROSPECTIVO: ColunaTabela[] = colunasProspectivo("pt");

/** Controles e decisões vêm do registro em português: as células de texto saem marcadas como trecho em português. */
export function colunasValidacoes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "nome", rotulo: tx("Controle", "Check"), tipo: "texto", idiomaTexto: "portugues" },
    { id: "resultado", rotulo: tx("Resultado", "Result"), tipo: "texto", categorica: true },
    { id: "detalhe", rotulo: tx("Detalhe", "Detail"), tipo: "texto", idiomaTexto: "portugues" },
  ];
}
export const COLUNAS_VALIDACOES: ColunaTabela[] = colunasValidacoes("pt");

export function colunasDecisoes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "item", rotulo: tx("Item", "Item"), tipo: "texto", idiomaTexto: "portugues" },
    { id: "estado", rotulo: tx("Estado", "State"), tipo: "texto", categorica: true, idiomaTexto: "portugues" },
    { id: "responsavel", rotulo: tx("Quem decide ou comprova", "Who decides or proves"), tipo: "texto", categorica: true, idiomaTexto: "portugues" },
    { id: "evidencia", rotulo: tx("Evidência", "Evidence"), tipo: "texto", idiomaTexto: "portugues" },
  ];
}
export const COLUNAS_DECISOES: ColunaTabela[] = colunasDecisoes("pt");

/**
 * Resposta curta do P016. Com os números retidos, diz o que está calculado e
 * validado, por que não aparece, o que o prospectivo já permite dizer e a amostra
 * de calibração; com a publicação liberada, resume o ganho sobre o B0 no teste.
 */
export function respostaP016(
  g: Pick<PrevisoesDesempenhoGold, "desempenho" | "publicacao_desempenho" | "validacoes" | "dados" | "prospectivo" | "definicoes">,
  idioma: Idioma = idiomaEnergia(),
): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const D = (d: string) => dataBR(d, idioma);
  const aprovados = g.validacoes.filter((v) => v.resultado === "aprovado").length;
  const controles = tx(`${aprovados} de ${g.validacoes.length} controles aprovados`, `${aprovados} of ${g.validacoes.length} checks passed`);
  const origens = tx(
    `${g.dados.origens.n.toLocaleString("pt-BR")} origens diárias de ${dataBR(g.dados.origens.inicio)} a ${dataBR(g.dados.origens.fim)}`,
    `${num(g.dados.origens.n, 0, idioma)} daily origins from ${D(g.dados.origens.inicio)} to ${D(g.dados.origens.fim)}`,
  );
  const ap = g.prospectivo.apuracoes;
  const apuradas = ap.filter((a) => a.realizado !== null).length;
  const prox = primeiraEntregaAMaturar(ap);
  const prospectivo =
    ap.length === 0
      ? tx(" O acompanhamento prospectivo ainda não tem previsão com número.", " The prospective follow-up does not yet have a forecast with a number.")
      : apuradas === 0
        ? tx(
            ` No acompanhamento prospectivo, nenhuma das ${ap.length} previsões com número tem realizado${prox ? `: a primeira entrega termina em ${dataBR(prox.termina)}` : ""}.`,
            ` In the prospective follow-up, none of the ${ap.length} forecasts with a number has an actual value${prox ? `: the first delivery ends on ${D(prox.termina)}` : ""}.`,
          )
        : tx(
            ` No acompanhamento prospectivo, ${apuradas} de ${ap.length} previsões com número já têm realizado.`,
            ` In the prospective follow-up, ${apuradas} of ${ap.length} forecasts with a number already have an actual value.`,
          );
  const amostra = linhasAmostra(g, idioma);
  const semanal = amostra.find((a) => a.horizonte.startsWith("W"))?.entregas ?? null;
  const mensal = amostra.find((a) => a.horizonte.startsWith("M"))?.entregas ?? null;
  const min = minimoCalibracao(g.definicoes.calibracao);
  const calib =
    semanal !== null && mensal !== null && min !== null && Math.max(semanal, mensal) < min
      ? tx(
          ` Nenhum segmento tem amostra para calibrar faixas: o teste tem ${semanal} entregas semanais e ${mensal} mensais distintas, abaixo do mínimo de ${min}.`,
          ` No segment has a sample to calibrate bands: the test has ${semanal} distinct weekly and ${mensal} distinct monthly deliveries, below the minimum of ${min}.`,
        )
      : "";
  if (!g.desempenho.publicado) {
    const pendente = g.publicacao_desempenho.decisao?.estado === "PENDENTE" || !g.publicacao_desempenho.decisao;
    return tx(
      `Ainda não é possível responder no portal. O teste retrospectivo fora da amostra está calculado (${origens}; ${controles}), ` +
        `mas os números de desempenho ficam retidos até a liberação formal pelo responsável pela plataforma${pendente ? ", ainda não registrada" : ""}.${prospectivo}${calib}`,
      `It is not yet possible to answer on the portal. The out-of-sample retrospective test is calculated (${origens}; ${controles}), ` +
        `but the performance numbers are withheld until formal release by the platform owner${pendente ? ", not yet recorded" : ""}.${prospectivo}${calib}`,
    );
  }
  const ganhos = linhasDesempenho(g.desempenho.por_horizonte).filter((l) => l.periodo === "teste" && l.modelo !== "B0" && l.ganho_vs_b0 !== null);
  const positivos = ganhos.filter((l) => l.ic_inf !== null && l.ic_inf > 0);
  const resumo = ganhos.length
    ? tx(
        ` No teste final, ${positivos.length} de ${ganhos.length} combinações de candidato e horizonte têm ganho sobre o B0 com intervalo de 90% inteiro acima de zero.`,
        ` In the final test, ${positivos.length} of ${ganhos.length} combinations of candidate and horizon have a gain over B0 with the whole 90% interval above zero.`,
      )
    : tx(" O teste final não tem comparação pareada com o B0 publicada.", " The final test has no published paired comparison with B0.");
  return tx(
    `Teste retrospectivo fora da amostra (${origens}; ${controles}).${resumo}${prospectivo}${calib}`,
    `Out-of-sample retrospective test (${origens}; ${controles}).${resumo}${prospectivo}${calib}`,
  );
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

export function colunasDesempenho(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "modelo", rotulo: tx("Modelo", "Model"), tipo: "texto", categorica: true },
    { id: "horizonte", rotulo: tx("Horizonte", "Horizon"), tipo: "texto", categorica: true },
    { id: "periodo", rotulo: tx("Período", "Period"), tipo: "texto", categorica: true },
    { id: "entregas", rotulo: tx("Entregas distintas", "Distinct deliveries"), tipo: "numero", casas: 0 },
    { id: "mae", rotulo: "MAE", tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "mae_b0", rotulo: tx("MAE do B0 nas mesmas células", "B0 MAE in the same cells"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "vies", rotulo: tx("Viés", "Bias"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "ganho_vs_b0", rotulo: tx("Ganho sobre o B0", "Gain over B0"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "ic_inf", rotulo: tx("IC 90%: limite inferior", "90% CI: lower bound"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "ic_sup", rotulo: tx("IC 90%: limite superior", "90% CI: upper bound"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "perda_quantilica", rotulo: tx("Perda quantílica", "Quantile loss"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "cobertura", rotulo: tx("Cobertura P10 a P90", "P10 to P90 coverage"), tipo: "percentual", casas: 1 },
    { id: "largura", rotulo: tx("Largura P10 a P90", "P10 to P90 width"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}
export const COLUNAS_DESEMPENHO: ColunaTabela[] = colunasDesempenho("pt");

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
export function linhasRevisoes(g: Pick<PrevisoesDesempenhoGold, "prospectivo">, idioma: Idioma = idiomaEnergia()): LinhaRevisao[] {
  return g.prospectivo.revisoes_entre_rodadas.map((r) => ({
    id: `${r.modelo}:${r.entrega}:${r.submercado}`,
    entrega: r.entrega,
    sm: curto(r.submercado, idioma),
    modelo: r.modelo,
    rodadas: r.rodadas,
    previsoes: r.sequencia.map((s) => `${dataBR(s.origem, idioma)} (${s.horizonte}): ${num(s.previsao, 4, idioma)}`).join("; "),
    ultima_mudanca: r.sequencia.length > 1 ? r.sequencia[r.sequencia.length - 1].mudanca : null,
  }));
}

export function colunasRevisoes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return [
    { id: "entrega", rotulo: tx("Entrega", "Delivery"), tipo: "texto" },
    { id: "sm", rotulo: tx("Submercado", "Submarket"), tipo: "texto", categorica: true },
    { id: "modelo", rotulo: tx("Modelo", "Model"), tipo: "texto", categorica: true },
    { id: "rodadas", rotulo: tx("Rodadas com número", "Runs with a number"), tipo: "numero", casas: 0 },
    { id: "previsoes", rotulo: tx("Previsões por origem (R$/MWh)", "Forecasts by origin (R$/MWh)"), tipo: "texto" },
    { id: "ultima_mudanca", rotulo: tx("Última mudança", "Latest change"), tipo: "numero", unidade: "R$/MWh", casas: 4 },
  ];
}
export const COLUNAS_REVISOES: ColunaTabela[] = colunasRevisoes("pt");

/** Rodada da gold correspondente a um run_id (para o detalhe da linha do arquivo). */
export const rodadaDe = (rodadas: readonly Rodada[], run: string) => rodadas.find((r) => r.run_id === run) ?? null;

/* ---------------------------------------------------------------- redesenho: situação, papel, protocolo e avisos da rodada */

/** "A, B e C": lista em português com "e" antes do último item. */
export const listaE = (itens: readonly string[], idioma: Idioma = idiomaEnergia()) =>
  itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;

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
export function situacaoDoModelo(f: Pick<Ficha, "estado" | "aprovacao">, idioma: Idioma = idiomaEnergia()): SituacaoModelo {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  switch (f.estado as EstadoModelo) {
    case "PRODUCAO":
      return { id: "producao", rotulo: tx("Produção", "Production"), definicao: tx("Aprovado; alimenta a previsão principal.", "Approved; feeds the main forecast.") };
    case "APOSENTADO":
      return { id: "aposentado", rotulo: tx("Aposentado", "Retired"), definicao: tx("Fora de uso; as previsões antigas ficam no arquivo.", "No longer in use; past forecasts remain in the archive.") };
    case "VALIDACAO":
      return { id: "validacao", rotulo: tx("Validação", "Validation"), definicao: tx("Avaliado em área técnica; não alimenta a previsão principal.", "Evaluated in a technical area; does not feed the main forecast.") };
    default:
      return f.aprovacao.referencia_experimental
        ? {
            id: "experimental",
            rotulo: tx("Referência experimental", "Experimental benchmark"),
            definicao: tx("Em pesquisa, com número publicado e identificado como experimental, sem aprovação.", "In research, with a published number identified as experimental, without approval."),
          }
        : { id: "pesquisa", rotulo: tx("Pesquisa", "Research"), definicao: tx("Em estudo; não alimenta a previsão.", "Under study; does not feed the forecast.") };
  }
}

/** Papel do modelo em poucas palavras ("Referência simples", "Referência sazonal", "Candidato"), sem o comentário entre parênteses do registro. */
export function papelCurto(papel: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  const sem = tx("sem papel registrado", "no role recorded", idioma);
  if (!papel) return sem;
  const curtoPapel = semCodigosInternos(papel).split(/\s*[(;]/)[0].trim();
  return curtoPapel ? reg(curtoPapel, idioma) : sem;
}

/** Com o que o modelo é comparado: as referências registradas para ele, ou a indicação de que ele próprio é uma referência. */
function comparadoCom(f: Pick<Ficha, "codigo" | "papel">, registro: Pick<ModelosGold, "modelos"> | null | undefined, idioma: Idioma): string {
  const m = registro?.modelos.find((x) => x.codigo === f.codigo);
  if (!m) return tx("não registrado", "not recorded", idioma);
  if (m.benchmarks.length) return listaE(m.benchmarks, idioma);
  return /^Refer[eê]ncia/.test(f.papel ?? "") ? tx("é uma referência de comparação", "is a comparison benchmark", idioma) : tx("não registrado", "not recorded", idioma);
}

/** Protocolo do teste fora da amostra para o modelo: avaliado ou não, e se os números foram liberados. */
function protocoloDoModelo(f: Pick<Ficha, "codigo" | "implementado_no_repositorio">, g: Pick<PrevisoesDesempenhoGold, "modelos" | "desempenho">, idioma: Idioma): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const m = g.modelos.find((x) => x.codigo === f.codigo);
  if (!m?.avaliado)
    return f.implementado_no_repositorio
      ? tx("sem teste fora da amostra", "no out-of-sample test")
      : tx("sem teste fora da amostra: o modelo não pode ser refeito", "no out-of-sample test: the model cannot be redone");
  return g.desempenho.publicado
    ? tx("teste fora da amostra publicado", "out-of-sample test published")
    : tx("teste fora da amostra calculado, com os números retidos", "out-of-sample test calculated, with the numbers withheld");
}

/** Reexecução do arquivo em poucas palavras, para a matriz de modelos. */
export function reexecucaoCurta(f: Pick<Ficha, "implementado_no_repositorio" | "reproducao">, idioma: Idioma = idiomaEnergia()): string {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const r = f.reproducao?.reexecucao_do_arquivo;
  if (!f.implementado_no_repositorio) return tx("não pode ser refeito", "cannot be redone");
  if (!r) return tx("nenhuma previsão arquivada com número para refazer", "no archived forecast with a number to redo");
  const div = r.divergentes.length;
  return tx(
    `${plural(r.conferidas, "previsão arquivada refeita", "previsões arquivadas refeitas")}, ${div === 0 ? "sem divergência" : `${div} com divergência`}`,
    `${plural(r.conferidas, "archived forecast redone", "archived forecasts redone", idioma)}, ${div === 0 ? "with no divergence" : `${div} with divergence`}`,
  );
}

/** Resultado de uma conferência de cálculo em palavras que não sugerem aprovação do método: o observatório refaz a conta, não a valida por fora. */
export const ROTULO_CONFERENCIA: Record<string, string> = { aprovado: "confere", ressalva: "confere com ressalva", reprovado: "não confere" }; // i18n: dado
const ROTULO_CONFERENCIA_EN: Record<string, string> = { aprovado: "matches", ressalva: "matches with a caveat", reprovado: "does not match" };
/** Resultado da conferência no idioma da página; código desconhecido volta como veio. */
export const rotuloConferencia = (r: string, idioma: Idioma = idiomaEnergia()) => (idioma === "en" ? ROTULO_CONFERENCIA_EN : ROTULO_CONFERENCIA)[r] ?? r;

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
  idioma: Idioma = idiomaEnergia(),
): LinhaMatrizModelo[] {
  return fichasOrdenadas(g.fichas).map((f) => ({
    id: slugModelo(f.codigo),
    codigo: f.codigo,
    nome: reg(f.nome, idioma),
    versao: f.versao,
    papel: papelCurto(f.papel, idioma),
    situacao: situacaoDoModelo(f, idioma),
    comparado: comparadoCom(f, registro, idioma),
    emissao: emissaoDoModelo(f, g, idioma),
    protocolo: protocoloDoModelo(f, g, idioma),
    reexecucao: reexecucaoCurta(f, idioma),
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

export function cartoesModelos(
  g: Pick<PrevisoesDesempenhoGold, "fichas" | "previsao_atual">,
  registro: Pick<ModelosGold, "modelos"> | null | undefined,
  idioma: Idioma = idiomaEnergia(),
): CartaoModelo[] {
  return fichasOrdenadas(g.fichas).map((f) => ({
    id: slugModelo(f.codigo),
    codigo: f.codigo,
    nome: reg(f.nome, idioma),
    versao: f.versao,
    estado: f.estado,
    papel: f.papel ? reg(semCodigosInternos(f.papel), idioma) : tx("sem papel registrado", "no role recorded", idioma),
    emite: emissaoDoModelo(f, g, idioma),
    entradas: f.entradas ? f.entradas.map((e) => reg(e, idioma)) : f.entradas,
    formula: (() => {
      const fp = formulaEmPalavras(f, idioma);
      return fp ? reg(fp, idioma) : fp;
    })(),
    formulaRegistro: f.formula ? reg(f.formula, idioma) : f.formula,
    reexecucao: textoReexecucao(f, idioma),
    limitacao:
      registro?.modelos.find((x) => x.codigo === f.codigo)?.limitacao_principal ??
      paraLeitorPrevisoes(f.limitacoes?.[0] ?? (f.motivo_sem_implementacao ? semCaminhosDeArquivo(f.motivo_sem_implementacao) : (f.motivo_sem_implementacao ?? ""))) ??
      null,
    href: rotaModelo(f.codigo),
  }));
}

/** O que cada modelo recebe e como calcula: entradas, fórmula em palavras e pesos do último ajuste. */
export type LinhaEntradas = { id: string; codigo: string; nome: string; entradas: string[] | null; formula: string; pesos: string; href: string };

export function linhasEntradasFormula(fichas: readonly Ficha[], idioma: Idioma = idiomaEnergia()): LinhaEntradas[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return fichasOrdenadas(fichas).map((f) => {
    const segs = f.coeficientes_ultimo_ajuste?.segmentos ?? [];
    const origem = segs.reduce((a, s) => (s.origem_ajuste > a ? s.origem_ajuste : a), "");
    const pesos = segs.length
      ? tx(
          `${plural(segs.length, "segmento ajustado", "segmentos ajustados")}; último ajuste em ${dataBR(origem)}`,
          `${plural(segs.length, "fitted segment", "fitted segments", idioma)}; latest fit on ${dataBR(origem, idioma)}`,
        )
      : !f.implementado_no_repositorio
        ? tx("não publicados: a configuração da pesquisa não foi publicada", "not published: the research configuration was not published")
        : tx("sem pesos: não tem parâmetros ajustados", "no weights: it has no fitted parameters");
    const fp = formulaEmPalavras(f, idioma);
    return {
      id: slugModelo(f.codigo),
      codigo: f.codigo,
      nome: reg(f.nome, idioma),
      entradas: f.entradas ? f.entradas.map((e) => reg(e, idioma)) : f.entradas,
      formula: fp ? reg(fp, idioma) : tx("não publicada: a configuração da pesquisa não foi publicada", "not published: the research configuration was not published"),
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
  const comNumero = fs.filter((f) => ["principal", "experimental"].includes(codigoEmissaoDoModelo(f, g)));
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
export function decisoesPendentes(g: Pick<PrevisoesDesempenhoGold, "governanca">, idioma: Idioma = idiomaEnergia()): { item: string; responsavel: string }[] {
  return g.governanca.decisao_revisavel
    .filter((d) => /decis[aã]o pendente/i.test(d.estado ?? ""))
    .map((d) => ({ item: d.item, responsavel: d.responsavel ?? tx("não indicado", "not stated", idioma) }));
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
  idioma: Idioma = idiomaEnergia(),
): AvisoRodada[] {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const out: AvisoRodada[] = [];
  const manual = r.modo.startsWith("manual");
  const tardia = r.alertas.includes("ATRASADO_APOS_08H") || (r.atraso_min ?? 0) > 0;
  const emitidoDia = diaBrasilia(r.emitido_em) ?? r.emitido_em.slice(0, 10);
  const transcrita = !!r.registrado_no_portal_em && r.registrado_no_portal_em > emitidoDia;
  if (manual || tardia) {
    out.push({
      id: "emissao",
      rotulo: tx("Emissão", "Issue"),
      texto: tx(
        `Emitida ${manual ? "manualmente" : "pelo agendamento"} em ${instanteBR(r.emitido_em, "pt")}${tardia ? ", depois do prazo das 08h00" : ""}.`,
        `Issued ${manual ? "manually" : "by the schedule"} on ${instanteBR(r.emitido_em, idioma)}${tardia ? ", after the 08:00 deadline" : ""}.`,
      ),
    });
  }
  if (r.alertas.includes("CODIGO_NAO_COMMITADO")) {
    out.push({
      id: "codigo",
      rotulo: tx("Reprodutibilidade", "Reproducibility"),
      texto: tx(
        "O código executado tinha alterações ainda não registradas em versão (sufixo +alterado).",
        "The code that ran had changes not yet recorded in a version (suffix +alterado).",
      ),
    });
  } else if (!r.versao_codigo) {
    out.push({ id: "codigo", rotulo: tx("Reprodutibilidade", "Reproducibility"), texto: tx("O registro não traz a versão do código que emitiu a rodada.", "The record does not carry the code version that issued the run.") });
  }
  if (transcrita) {
    out.push({
      id: "transcricao",
      rotulo: tx("Registro", "Record"),
      texto: tx(
        `Transcrito de outra fonte e incluído no arquivo em ${dataBR(r.registrado_no_portal_em)}, depois da emissão: não é emissão original do observatório.`,
        `Transcribed from another source and included in the archive on ${dataBR(r.registrado_no_portal_em, idioma)}, after issue: it is not an original issue by the observatory.`,
      ),
    });
  }
  if (r.com_numero === 0) {
    const motivos = r.motivos.length ? `: ${r.motivos.map((m) => textoMotivo(m, idioma)).join("; ")}` : "";
    out.push({
      id: "sem-numero",
      rotulo: tx("Números", "Numbers"),
      texto: tx(`Nenhuma das ${r.celulas} células tem número${motivos}.`, `None of the ${r.celulas} cells has a number${motivos}.`),
    });
  }
  const outros = r.alertas.filter((a) => !ALERTAS_DA_RODADA.includes(a));
  if (outros.length) out.push({ id: "alertas", rotulo: tx("Alertas", "Alerts"), texto: tx(`Alertas registrados: ${textoAlertas(outros, "pt")}.`, `Recorded alerts: ${textoAlertas(outros, idioma)}.`) });
  return out;
}

/** Governança da rotina de emissão: aviso enquanto a rotina diária não estiver comprovada pelo critério publicado. */
export function avisoDaRotina(r: Pick<PrevisoesDesempenhoGold["rotina"], "comprovada" | "execucoes_agendadas" | "no_prazo">, idioma: Idioma = idiomaEnergia()): AvisoRodada | null {
  if (r.comprovada) return null;
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  return {
    id: "rotina",
    rotulo: tx("Governança", "Governance"),
    texto:
      r.execucoes_agendadas === 0
        ? tx("A rotina diária de emissão não foi comprovada: nenhuma execução agendada está registrada.", "The daily issue routine has not been demonstrated: no scheduled run is recorded.")
        : tx(
            `A rotina diária de emissão não foi comprovada: ${r.no_prazo} de ${r.execucoes_agendadas} execuções agendadas saíram no prazo, abaixo do critério publicado.`,
            `The daily issue routine has not been demonstrated: ${r.no_prazo} of ${r.execucoes_agendadas} scheduled runs came out on time, below the published criterion.`,
          ),
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
export function avaliacaoPorFrequencia(g: Pick<PrevisoesDesempenhoGold, "prospectivo" | "definicoes">, idioma: Idioma = idiomaEnergia()): AvaliacaoFrequencia[] {
  const amostra = linhasAmostra(g, idioma);
  return (["W", "M"] as const).map((freq) => {
    const ap = g.prospectivo.apuracoes.filter((a) => a.horizonte.startsWith(freq));
    const apuradas = ap.filter((a) => a.realizado !== null).length;
    const da = amostra.filter((a) => a.horizonte.startsWith(freq));
    const ns = da.map((a) => a.entregas).filter((n): n is number => typeof n === "number");
    return {
      frequencia: freq,
      rotulo: freq === "W" ? tx("Semanas", "Weeks", idioma) : tx("Meses", "Months", idioma),
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
export function resumoB0(linhas: readonly LinhaGrade[], sm: Submercado, freq: Frequencia, idioma: Idioma = idiomaEnergia()) {
  const tx = (pt: string, en: string, _i?: Idioma) => txIdioma(pt, en, _i ?? idioma);
  const D = (d: string) => dataBR(d, idioma);
  const doSm = linhas.filter((l) => l.submercado === sm && l.horizonte.startsWith(freq));
  const com = doSm.find((l) => l.evidencia);
  return {
    valor: com?.previsao ?? null,
    evidencia: com?.evidencia ?? null,
    horizontes: doSm.map((l) => l.horizonte),
    periodo: doSm.length
      ? tx(
          `${doSm[0].horizonte} a ${doSm[doSm.length - 1].horizonte}: ${dataBR(doSm[0].inicio)} a ${dataBR(doSm[doSm.length - 1].fim)}`,
          `${doSm[0].horizonte} to ${doSm[doSm.length - 1].horizonte}: ${D(doSm[0].inicio)} to ${D(doSm[doSm.length - 1].fim)}`,
        )
      : "",
    usado:
      com?.periodo_inicio && com.periodo_fim
        ? tx(
            `Repete a média de ${dataBR(com.periodo_inicio)} a ${dataBR(com.periodo_fim)}, o último período completo elegível no corte.`,
            `It repeats the average from ${D(com.periodo_inicio)} to ${D(com.periodo_fim)}, the latest complete period eligible at the cutoff.`,
          )
        : undefined,
    /** O mesmo aviso em uma linha, para a faixa de métricas da abertura. */
    usadoCurto:
      com?.periodo_inicio && com.periodo_fim
        ? tx(`Repete a média de ${intervaloDias(com.periodo_inicio, com.periodo_fim, "pt")}.`, `It repeats the average from ${intervaloDias(com.periodo_inicio, com.periodo_fim, idioma)}.`)
        : undefined,
  };
}
