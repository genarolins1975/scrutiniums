/**
 * Snapshot da edição v4 do índice de resultados, SOMENTE para servidor e testes.
 * Componentes cliente importam `indice-v4-nucleo` e recebem o snapshot por prop:
 * importar o JSON num módulo cliente o colocaria nos arquivos públicos de /_next/static.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import edicao from '../../../docs/obee/resultados/v4/indice-resultados-v4.json';
import {createIndice, type IndiceSnapshot} from './indice-v4-nucleo';

export * from './indice-v4-nucleo';

const pacote = join(process.cwd(), 'docs/obee/resultados/v4/pacote-v4.json');

/** Apenas os campos exibidos; pares e cenários completos seguem no JSON auditável. */
export const indiceSnapshot: IndiceSnapshot = {
  edition: edicao.edition, reference_year: edicao.reference_year, title: edicao.title, normalization: edicao.normalization,
  weights: edicao.weights, indicators: edicao.indicators as IndiceSnapshot['indicators'],
  families: edicao.families, scenarios: edicao.scenarios as IndiceSnapshot['scenarios'],
  rows: edicao.rows.map(r => ({id: r.id, name: r.name, score: r.score, band: r.band as [number, number],
    raw_values: r.raw_values, percentiles: r.percentiles, contributions: r.contributions,
    sensitivity: r.sensitivity as IndiceSnapshot['rows'][number]['sensitivity'], scenario_scores: r.scenario_scores})),
  summary: edicao.summary,
  comparison_v3: {v3_scenario: edicao.comparison_v3.v3_scenario, pairs_reversed: edicao.comparison_v3.pairs_reversed,
    max_absolute_change: edicao.comparison_v3.max_absolute_change, mean_absolute_change: edicao.comparison_v3.mean_absolute_change},
  packet_sha256: existsSync(pacote) ? (JSON.parse(readFileSync(pacote, 'utf8')) as {packet_sha256: string}).packet_sha256 : null,
};

export const indice = createIndice(indiceSnapshot);
