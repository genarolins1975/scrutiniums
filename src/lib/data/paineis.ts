import type { PanelMeta } from "@/components/analytics/PanelShell";
import { fmtDate } from "@/lib/format";
import { getGlossaryEntry } from "./glossario";

/**
 * Dados de exemplo determinísticos dos painéis analíticos.
 * Nenhum uso de Math.random: as séries são geradas por funções puras
 * (tendência + sazonalidade + ruído pseudoaleatório baseado em seno),
 * portanto idênticas em toda renderização, no servidor e no cliente.
 * Período coberto: janeiro de 2022 a junho de 2026.
 */

export const SETORES = ["Indústria", "Comércio", "Serviços", "Agronegócio", "Construção"] as const;
export type Setor = (typeof SETORES)[number];

export const TEMAS = ["Crédito", "Mercado de capitais", "Seguros"] as const;
export type Tema = (typeof TEMAS)[number];

export type PontoAtividade = { competencia: string } & Record<Setor, number>;
export type PontoInadimplencia = { trimestre: string } & Record<Setor, number>;
export type PontoSentimento = { competencia: string } & Record<Tema, number>;
export type PontoHhi = { ano: string } & Record<Setor, number>;

/* ------------------------------------------------------------------ */
/* Geração determinística                                              */
/* ------------------------------------------------------------------ */

/** Ruído pseudoaleatório determinístico em [-1, 1] a partir de seed e índice. */
function ruido(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453123;
  return (x - Math.floor(x)) * 2 - 1;
}

function arredondar(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Competências mensais em ISO (dia 15 para evitar deslocamento de fuso). */
function mesesEntre(inicio: string, fim: string): string[] {
  const [ai, mi] = inicio.split("-").map(Number);
  const [af, mf] = fim.split("-").map(Number);
  const meses: string[] = [];
  for (let ano = ai, mes = mi; ano < af || (ano === af && mes <= mf); ) {
    meses.push(`${ano}-${String(mes).padStart(2, "0")}-15`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return meses;
}

const MESES = mesesEntre("2022-01", "2026-06"); // 54 competências
const TRIMESTRES: string[] = [];
for (let ano = 2022; ano <= 2026; ano++) {
  for (let t = 1; t <= 4; t++) {
    if (ano === 2026 && t > 2) break;
    TRIMESTRES.push(`${t}º tri/${ano}`);
  }
}
const ANOS = ["2022", "2023", "2024", "2025"];

/* --- Índice de Atividade Setorial (mensal, base 100 = média de 2022) --- */

type ConfigAtividade = {
  seed: number;
  tendencia: number;
  sazonalidade: number;
  fase: number;
  ruidoAmp: number;
};

const CONFIG_ATIVIDADE: Record<Setor, ConfigAtividade> = {
  Indústria: { seed: 11, tendencia: 0.08, sazonalidade: 2.2, fase: 0.5, ruidoAmp: 1.1 },
  Comércio: { seed: 23, tendencia: 0.14, sazonalidade: 4.0, fase: 4.8, ruidoAmp: 1.4 },
  Serviços: { seed: 37, tendencia: 0.22, sazonalidade: 1.6, fase: 2.1, ruidoAmp: 0.9 },
  Agronegócio: { seed: 53, tendencia: 0.18, sazonalidade: 5.5, fase: 1.2, ruidoAmp: 1.8 },
  Construção: { seed: 71, tendencia: -0.05, sazonalidade: 2.8, fase: 3.4, ruidoAmp: 1.3 },
};

function serieAtividade(setor: Setor): number[] {
  const c = CONFIG_ATIVIDADE[setor];
  const bruta = MESES.map(
    (_, i) =>
      100 +
      c.tendencia * i +
      c.sazonalidade * Math.sin((2 * Math.PI * i) / 12 + c.fase) +
      c.ruidoAmp * ruido(c.seed, i),
  );
  // Reescalona para base 100 na média de 2022 (12 primeiras competências).
  const media2022 = bruta.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  return bruta.map((v) => arredondar((v / media2022) * 100, 1));
}

export const ATIVIDADE_MENSAL: PontoAtividade[] = (() => {
  const porSetor = Object.fromEntries(SETORES.map((s) => [s, serieAtividade(s)])) as Record<
    Setor,
    number[]
  >;
  return MESES.map((competencia, i) => {
    const ponto = { competencia } as PontoAtividade;
    for (const s of SETORES) ponto[s] = porSetor[s][i];
    return ponto;
  });
})();

/* --- Indicador de Risco de Crédito Setorial (trimestral, % > 90 dias) --- */

type ConfigInadimplencia = { seed: number; base: number; tendencia: number; ruidoAmp: number };

const CONFIG_INADIMPLENCIA: Record<Setor, ConfigInadimplencia> = {
  Indústria: { seed: 13, base: 2.6, tendencia: 0.03, ruidoAmp: 0.18 },
  Comércio: { seed: 29, base: 4.1, tendencia: 0.05, ruidoAmp: 0.26 },
  Serviços: { seed: 41, base: 3.4, tendencia: 0.02, ruidoAmp: 0.2 },
  Agronegócio: { seed: 59, base: 1.7, tendencia: 0.07, ruidoAmp: 0.22 },
  Construção: { seed: 83, base: 5.2, tendencia: 0.04, ruidoAmp: 0.3 },
};

export const INADIMPLENCIA_TRIMESTRAL: PontoInadimplencia[] = TRIMESTRES.map((trimestre, i) => {
  const ponto = { trimestre } as PontoInadimplencia;
  for (const s of SETORES) {
    const c = CONFIG_INADIMPLENCIA[s];
    const v = c.base + c.tendencia * i + 0.25 * Math.sin(i * 1.1 + c.seed) + c.ruidoAmp * ruido(c.seed, i);
    ponto[s] = arredondar(limitar(v, 0.4, 12), 2);
  }
  return ponto;
});

/* --- Score de Sentimento Regulatório (semanal, agregado em médias mensais) --- */

type ConfigSentimento = { seed: number; base: number; amplitude: number; periodo: number; fase: number };

const CONFIG_SENTIMENTO: Record<Tema, ConfigSentimento> = {
  Crédito: { seed: 7, base: 0.05, amplitude: 0.35, periodo: 20, fase: 0.8 },
  "Mercado de capitais": { seed: 17, base: 0.15, amplitude: 0.3, periodo: 26, fase: 2.4 },
  Seguros: { seed: 31, base: -0.05, amplitude: 0.25, periodo: 16, fase: 4.1 },
};

export const SENTIMENTO_MENSAL: PontoSentimento[] = MESES.map((competencia, i) => {
  const ponto = { competencia } as PontoSentimento;
  for (const t of TEMAS) {
    const c = CONFIG_SENTIMENTO[t];
    const v =
      c.base + c.amplitude * Math.sin((2 * Math.PI * i) / c.periodo + c.fase) + 0.1 * ruido(c.seed, i);
    ponto[t] = arredondar(limitar(v, -1, 1), 2);
  }
  return ponto;
});

/* --- Índice de Concentração de Mercado — HHI (anual, pontos) --- */

const HHI_POR_SETOR: Record<Setor, number[]> = {
  Indústria: [1850, 1912, 1978, 2045],
  Comércio: [1420, 1465, 1518, 1584],
  Serviços: [980, 1010, 1046, 1090],
  Agronegócio: [2310, 2385, 2440, 2512],
  Construção: [1180, 1150, 1205, 1240],
};

export const HHI_ANUAL: PontoHhi[] = ANOS.map((ano, i) => {
  const ponto = { ano } as PontoHhi;
  for (const s of SETORES) ponto[s] = HHI_POR_SETOR[s][i];
  return ponto;
});

/* ------------------------------------------------------------------ */
/* Metadados dos painéis (alinhados ao glossário)                      */
/* ------------------------------------------------------------------ */

const ATUALIZADO_EM = fmtDate("2026-07-15T12:00:00");

const gAtividade = getGlossaryEntry("atividade-setorial")!;
const gRisco = getGlossaryEntry("risco-de-credito-setorial")!;
const gRegulatorio = getGlossaryEntry("score-de-sentimento-regulatorio")!;
const gHhi = getGlossaryEntry("concentracao-de-mercado")!;

export const META_ATIVIDADE: PanelMeta = {
  titulo: gAtividade.nome,
  descricao: gAtividade.definicao,
  periodo: "janeiro de 2022 a junho de 2026 (mensal)",
  atualizadoEm: ATUALIZADO_EM,
  fontes: ["IBGE (PIM-PF, PMC, PMS)", "CAGED", "Dados próprios"],
  unidade: gAtividade.unidade,
  interpretacao: gAtividade.interpretacao,
  metodologia: gAtividade.formula,
  limitacoes: gAtividade.limitacoes,
  glossarioSlug: gAtividade.slug,
};

export const META_RISCO: PanelMeta = {
  titulo: gRisco.nome,
  descricao: gRisco.definicao,
  periodo: "1º trimestre de 2022 ao 2º trimestre de 2026",
  atualizadoEm: ATUALIZADO_EM,
  fontes: ["Banco Central do Brasil (SCR, dados agregados públicos)"],
  unidade: gRisco.unidade,
  interpretacao: gRisco.interpretacao,
  metodologia: gRisco.formula,
  limitacoes: gRisco.limitacoes,
  glossarioSlug: gRisco.slug,
};

export const META_REGULATORIO: PanelMeta = {
  titulo: gRegulatorio.nome,
  descricao: gRegulatorio.definicao,
  periodo: "janeiro de 2022 a junho de 2026 (semanal, agregado em médias mensais)",
  atualizadoEm: ATUALIZADO_EM,
  fontes: ["Diário Oficial da União", "Banco Central", "CVM", "SUSEP"],
  unidade: gRegulatorio.unidade,
  interpretacao: gRegulatorio.interpretacao,
  metodologia: gRegulatorio.formula,
  limitacoes: gRegulatorio.limitacoes,
  glossarioSlug: gRegulatorio.slug,
};

export const META_HHI: PanelMeta = {
  titulo: gHhi.nome,
  descricao: gHhi.definicao,
  periodo: "2022 a 2025 (anual)",
  atualizadoEm: ATUALIZADO_EM,
  fontes: ["CADE", "CVM", "Demonstrações financeiras públicas", "Registros setoriais"],
  unidade: gHhi.unidade,
  interpretacao: gHhi.interpretacao,
  metodologia: gHhi.formula,
  limitacoes: gHhi.limitacoes,
  glossarioSlug: gHhi.slug,
};
