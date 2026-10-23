import type { CorSerie, EixoY, SerieGrafico } from "@/lib/painel/tipos";

/**
 * Contrato único dos gráficos do kit (Iniciativa 1 do parecer de UX de 23/10/2026, seção 4.9 do prompt): séries com `{ x, y }`,
 * `y: null` é lacuna (nunca zero nem interpolação), eixo com unidade, cores só de tokens de série em ordem fixa. Os gráficos do Setor
 * Elétrico nasceram com dados em forma larga (uma linha por x, uma coluna por série); estas funções levam o contrato para essa forma,
 * para que a mesma implementação desenhe as duas entradas até a última migração (PR 5), quando a forma larga sai.
 */

/** Cor da série i quando a série não declara a sua: --serie-1 a --serie-6, nessa ordem. */
export function corDaSerie(i: number, cor?: CorSerie): string {
  return cor ?? `var(--serie-${(i % 6) + 1})`;
}

export type LinhaLarga = Record<string, string | number | null>;

/** Uma linha por x, na ordem da primeira aparição; cada série vira uma coluna com o próprio id. Ponto ausente fica null (lacuna). */
export function paraFormaLarga(series: readonly SerieGrafico[]): LinhaLarga[] {
  const ordem: (string | number)[] = [];
  // `rotulo` é a coluna do nome exibido de cada x (categoria das barras)
  const porX = new Map<string | number, LinhaLarga>();
  for (const s of series) {
    for (const p of s.pontos) {
      let linha = porX.get(p.x);
      if (!linha) {
        linha = { x: p.x, rotulo: p.rotulo ?? String(p.x) };
        porX.set(p.x, linha);
        ordem.push(p.x);
      }
      linha[s.id] = p.y;
    }
  }
  return ordem.map((x) => {
    const linha = porX.get(x)!;
    for (const s of series) if (!(s.id in linha)) linha[s.id] = null;
    return linha;
  });
}

/** Contrato de entrada comum: título (a pergunta da figura), séries e eixo. */
export type ContratoGrafico = {
  titulo: string;
  series: readonly SerieGrafico[];
  eixoY: EixoY;
};

/** Barras sempre começam em zero: o tipo do eixo não deixa escolher. */
export type EixoBarras = EixoY & { zero: true };

/** Discrimina a entrada do contrato da forma larga antiga (que traz `dados`). */
export function ehContrato<T extends object>(p: T | (ContratoGrafico & object)): p is ContratoGrafico & T {
  return "eixoY" in p && !("dados" in p);
}
