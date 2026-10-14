/**
 * Núcleo do índice de resultados v4 SEM dados. Pode ser importado por componentes
 * cliente: o snapshot chega por prop, lido no servidor (ver indice-v4.ts). Os
 * arquivos de /_next/static são públicos; a página que recebe os dados exige login.
 *
 * As classes de estabilidade de cada par são recalculadas aqui e conferidas,
 * nos testes, contra o cálculo exato do pipeline Python.
 */
export type IndiceFamily = 'pesos' | 'habitacao' | 'definicoes' | 'retirada';
export type IndiceStatus = 'mantida' | 'pode_empatar' | 'pode_inverter' | 'empate';
/** Resultado de uma família para o par. Os três últimos valem só para par empatado na edição. */
export type IndiceFamilyOutcome = 'inverte' | 'empata' | 'mantida' | 'desfaz_ambos' | 'desfaz_a' | 'desfaz_b' | 'empate_mantido';
export type IndiceIndicator = {id: string; label: string; unit: string; direction: 'higher' | 'lower'; period: string;
  source: string; source_url: string; note: string; precision: string};
export type IndiceRow = {id: string; name: string; score: number; band: [number, number];
  raw_values: Record<string, number>; percentiles: Record<string, number>; contributions: Record<string, number>;
  sensitivity: Record<IndiceFamily, [number, number]>; scenario_scores: Record<string, number>};
export type IndiceSnapshot = {
  edition: string; reference_year: number; title: string; normalization: string;
  weights: Record<string, string>; indicators: IndiceIndicator[]; families: Record<IndiceFamily, string>;
  scenarios: Record<string, {family: Exclude<IndiceFamily, 'pesos'>; changes: string; label: string}>;
  rows: IndiceRow[];
  summary: {cities: number; pairs: number; pair_status: Record<IndiceStatus, number>; pairs_with_dominance: number;
    pairs_reversing_with_weights_50pct: number};
  comparison_v3: {v3_scenario: string; pairs_reversed: number; max_absolute_change: number; mean_absolute_change: number};
  packet_sha256: string | null;
};

export const FAMILIES: IndiceFamily[] = ['pesos', 'habitacao', 'definicoes', 'retirada'];
export const FAMILY_NAMES: Record<IndiceFamily, string> = {
  pesos: 'Mudança de pesos', habitacao: 'Definição de habitação', definicoes: 'Definições alternativas', retirada: 'Retirada de um indicador'};
export const STATUS_LABELS: Record<IndiceStatus, string> = {
  mantida: 'Ordem mantida em cada teste, avaliado separadamente', pode_empatar: 'Pode empatar em algum teste',
  pode_inverter: 'A ordem pode inverter', empate: 'Empate na edição'};
/** Família de pesos declarada na edição: cada peso entre 75% e 125% de 1/7. */
export const WEIGHT_BOX: [number, number] = [0.75, 1.25];
/** Ressalva que acompanha nota e faixa na página e em cada linha do CSV (sem vírgulas, para leitura simples). */
export const RESSALVA_FAIXA = 'Faixa metodológica e não intervalo de confiança; precisão municipal não quantificada; nota experimental sobre cobertura selecionada de 2022';
const EPS = 1e-9;

export const indiceNumber = (n: number | null, digits = 1) =>
  n === null || !Number.isFinite(n) ? 'Indisponível' : n.toLocaleString('pt-BR', {minimumFractionDigits: digits, maximumFractionDigits: digits});
export const indiceSign = (v: number) => (Math.abs(v) <= EPS ? 0 : Math.sign(v));

/** Mínimo e máximo de Σ w·x com w_i em [lo/7, hi/7] e Σ w = 1 (problema linear, solução gulosa). */
export function boxExtremes(values: number[], box: [number, number] = WEIGHT_BOX) {
  const n = values.length, base = 1 / n, [lo, hi] = box;
  if (!n || values.some(v => !Number.isFinite(v)) || lo <= 0 || lo > 1 || hi < 1) throw new Error('Família de pesos inválida');
  const solve = (order: number[]) => {
    let budget = 1 - n * base * lo, total = 0;
    for (const i of order) {
      const step = Math.min(budget, base * (hi - lo));
      total += values[i] * (base * lo + step);
      budget -= step;
    }
    return total;
  };
  const ranked = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  return [solve(ranked), solve([...ranked].reverse())] as [number, number];
}

export function createIndice(snapshot: IndiceSnapshot) {
  const ids = snapshot.indicators.map(i => i.id);
  const row = (id: string) => snapshot.rows.find(r => r.id === id);

  /** Diferença A − B por indicador: peso × diferença de posições. Contabilidade, não causa. */
  function gap(place: string, reference: string) {
    const a = row(place), b = row(reference);
    if (!a || !b) return null;
    const components = snapshot.indicators.map(i => ({id: i.id, name: i.label, points: (a.percentiles[i.id] - b.percentiles[i.id]) / ids.length}));
    return {components, total: a.score - b.score};
  }

  /** Limites de A − B em cada família, com as duas capitais sob a mesma hipótese. */
  function stability(place: string, reference: string) {
    const a = row(place), b = row(reference);
    if (!a || !b) return null;
    const baseline = a.score - b.score, s = indiceSign(baseline);
    const scenarios = Object.entries(snapshot.scenarios).map(([key, meta]) => ({
      key, ...meta, difference: a.scenario_scores[key] - b.scenario_scores[key]}));
    const ranges = {} as Record<IndiceFamily, [number, number]>;
    ranges.pesos = boxExtremes(ids.map(d => a.percentiles[d] - b.percentiles[d]));
    for (const family of FAMILIES.slice(1) as Exclude<IndiceFamily, 'pesos'>[]) {
      const values = [baseline, ...scenarios.filter(x => x.family === family).map(x => x.difference)];
      ranges[family] = [Math.min(...values), Math.max(...values)];
    }
    const reversing = FAMILIES.filter(f => s !== 0 && (indiceSign(ranges[f][0]) === -s || indiceSign(ranges[f][1]) === -s));
    const tying = FAMILIES.filter(f => s !== 0 && !reversing.includes(f) && (indiceSign(ranges[f][0]) === 0 || indiceSign(ranges[f][1]) === 0));
    const status: IndiceStatus = s === 0 ? 'empate' : reversing.length ? 'pode_inverter' : tying.length ? 'pode_empatar' : 'mantida';
    // Par empatado na edição: a família pode desfazer o empate para um lado, para os dois ou para nenhum.
    const outcomes = Object.fromEntries(FAMILIES.map(f => {
      const [lo, hi] = ranges[f].map(indiceSign);
      const outcome: IndiceFamilyOutcome = s !== 0
        ? (reversing.includes(f) ? 'inverte' : tying.includes(f) ? 'empata' : 'mantida')
        : lo < 0 && hi > 0 ? 'desfaz_ambos' : hi > 0 ? 'desfaz_a' : lo < 0 ? 'desfaz_b' : 'empate_mantido';
      return [f, outcome];
    })) as Record<IndiceFamily, IndiceFamilyOutcome>;
    const diffs = ids.map(d => a.percentiles[d] - b.percentiles[d]);
    const dominance = (diffs.every(v => v >= 0) && diffs.some(v => v > 0)) || (diffs.every(v => v <= 0) && diffs.some(v => v < 0));
    return {baseline, ranges, status, reversing, tying, outcomes, dominance, scenarios};
  }

  function csv() {
    const header = ['edition', 'reference_year', 'id', 'name', 'score', 'band_min', 'band_max',
      ...ids.flatMap(d => [`${d}_raw`, `${d}_unit`, `${d}_percentile`, `${d}_weight`, `${d}_contribution`]), 'ressalva'];
    const units = Object.fromEntries(snapshot.indicators.map(i => [i.id, i.unit]));
    const lines = snapshot.rows.map(r => [snapshot.edition, snapshot.reference_year, r.id, r.name, r.score, ...r.band,
      ...ids.flatMap(d => [r.raw_values[d], units[d], r.percentiles[d], snapshot.weights[d], r.contributions[d]]), RESSALVA_FAIXA]);
    return [header, ...lines].map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
  }

  return {row, gap, stability, csv};
}
