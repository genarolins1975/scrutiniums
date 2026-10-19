import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerQueimadasMunicipios, municipiosDeFocos, NOME_UF, type GoldQueimadasMunicipios, type PeriodoMunicipal } from "./queimadas";

/**
 * Ficha de focos de calor de um município, montada no servidor a partir da gold
 * municipal (public/territorio/gold/queimadas_municipios.json). É a consulta
 * "Teve fogo perto de mim?" (leva 2, src/lib/rotasPublicas.ts): o caso de quem
 * pergunta, sem série nem ranking, que ficam no painel de queimadas. A gold
 * inteira não vai ao navegador.
 *
 * Estados do número, nunca trocados entre si:
 * - período ausente da publicação: indisponível (null);
 * - município instalado depois do Censo 2022, fora da malha da fonte: indisponível;
 * - município fora da gold num período publicado: zero calculado, pela regra da
 *   própria gold (nenhum foco detectado pelo satélite de referência).
 */

export const PERIODOS: readonly PeriodoMunicipal[] = ["ultimoAnoCompleto", "acumuladoAnoCorrente", "mesmoPeriodoAnoAnterior"];

export type PeriodoPublicado = { inicio: string; fim: string; origem: string } | null;

export type FichaFocos = {
  id: string;
  nome: string;
  uf: string;
  nomeUf: string;
  /** Município fora da malha da fonte (instalado depois do Censo 2022): tudo indisponível, com o motivo. */
  semCobertura: string | null;
  /** O município está na gold (teve foco em algum período publicado). */
  naPublicacao: boolean;
  areaKm2: number | null;
  periodos: Record<PeriodoMunicipal, PeriodoPublicado>;
  focos: Record<PeriodoMunicipal, number | null>;
  /** Focos do último ano completo por 1.000 km² (área do Censo 2022). */
  porMilKm2: number | null;
  /** Posição entre os municípios com foco no último ano completo (empates dividem a posição). */
  posicaoBrasil: number | null;
  comFocoBrasil: number;
  posicaoUf: number | null;
  comFocoUf: number;
  /** Soma dos focos dos municípios da UF em cada período, pela mesma gold. */
  focosUf: Record<PeriodoMunicipal, number | null>;
  fonte: { nome: string; portal: string | null; satelite: string; capturadoEm: string; dataReferencia: string; area: string; ressalvas: string[] };
};

type ItemIndice = [string, string, string];

let indice: Map<string, { nome: string; uf: string }> | null = null;

/** Índice de municípios do IBGE (código, nome, UF), o mesmo que a busca baixa no navegador. */
export function municipiosIbge(): Map<string, { nome: string; uf: string }> {
  if (!indice) {
    try {
      const lista = JSON.parse(readFileSync(join(process.cwd(), "public", "saneamento", "gold", "indice.json"), "utf-8")) as ItemIndice[];
      indice = new Map(lista.map(([id, nome, uf]) => [id, { nome, uf }]));
    } catch {
      indice = new Map();
    }
  }
  return indice;
}

/** Posições com empate dividido, do maior para o menor. */
function posicoes(itens: { id: string; v: number }[]): Map<string, number> {
  const ordem = [...itens].sort((a, b) => b.v - a.v);
  const pos = new Map<string, number>();
  ordem.forEach((m, i) => {
    const anterior = ordem[i - 1];
    pos.set(m.id, anterior && anterior.v === m.v ? pos.get(anterior.id)! : i + 1);
  });
  return pos;
}

function anoDe(g: GoldQueimadasMunicipios): number | null {
  const p = g.periodos.ultimoAnoCompleto;
  return p ? Number(p.periodo.inicio.slice(0, 4)) : null;
}

/** Ano do último ano completo publicado na gold municipal; null sem a gold. */
export function anoCompletoFocos(): number | null {
  const g = lerQueimadasMunicipios();
  return g ? anoDe(g) : null;
}

/** Ficha do município pelo código IBGE; null quando o código não é de município do índice ou a gold não existe. */
export function fichaFocos(id: string): FichaFocos | null {
  if (!/^\d{7}$/.test(id)) return null;
  const ibge = municipiosIbge().get(id);
  const g = lerQueimadasMunicipios();
  if (!ibge || !g) return null;
  const lista = municipiosDeFocos(g);
  const m = lista.find((x) => x.id === id);
  const semCobertura = !m && g.semCoberturaNaFonte.ids.includes(id) ? g.semCoberturaNaFonte.motivo : null;

  const periodos = Object.fromEntries(
    PERIODOS.map((p) => [p, g.periodos[p] ? { inicio: g.periodos[p]!.periodo.inicio, fim: g.periodos[p]!.periodo.fim, origem: g.periodos[p]!.origem } : null]),
  ) as Record<PeriodoMunicipal, PeriodoPublicado>;

  const focos = Object.fromEntries(
    PERIODOS.map((p) => {
      if (!periodos[p] || semCobertura) return [p, null];
      // fora da gold num período publicado: nenhum foco detectado (regra da gold), zero calculado
      return [p, m ? m.focos[p] : 0];
    }),
  ) as Record<PeriodoMunicipal, number | null>;

  const daUf = lista.filter((x) => x.uf === ibge.uf);
  const focosUf = Object.fromEntries(
    PERIODOS.map((p) => [p, periodos[p] ? daUf.reduce((s, x) => s + (x.focos[p] ?? 0), 0) : null]),
  ) as Record<PeriodoMunicipal, number | null>;

  const comFoco = lista.filter((x) => (x.focos.ultimoAnoCompleto ?? 0) > 0).map((x) => ({ id: x.id, v: x.focos.ultimoAnoCompleto as number }));
  const comFocoUf = comFoco.filter((x) => daUf.some((u) => u.id === x.id));
  const temFoco = (focos.ultimoAnoCompleto ?? 0) > 0;

  return {
    id,
    nome: ibge.nome,
    uf: ibge.uf,
    nomeUf: NOME_UF[ibge.uf] ?? ibge.uf,
    semCobertura,
    naPublicacao: !!m,
    areaKm2: m && m.areaKm2 > 0 ? m.areaKm2 : null,
    periodos,
    focos,
    porMilKm2: focos.ultimoAnoCompleto === 0 ? 0 : m?.porMilKm2 ?? null,
    posicaoBrasil: temFoco ? posicoes(comFoco).get(id) ?? null : null,
    comFocoBrasil: comFoco.length,
    posicaoUf: temFoco ? posicoes(comFocoUf).get(id) ?? null : null,
    comFocoUf: comFocoUf.length,
    focosUf,
    fonte: {
      nome: g.fonte?.nome ?? "INPE, Programa Queimadas",
      portal: g.fonte?.portal ?? null,
      satelite: g.sateliteReferencia,
      capturadoEm: g.capturadoEm,
      dataReferencia: g.dataReferencia,
      area: g.fonteArea.fonte,
      ressalvas: g.ressalvas,
    },
  };
}
