import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {GET, dynamic, revalidate} from '../app/eficiencia-estatal/laboratorio-cesta/route';

vi.mock('node:fs/promises', () => ({readFile: vi.fn()}));
const artifact = readFileSync('docs/obee/resultados/revisao-interativa-v3.html', 'utf8');

describe('OBEE: laboratório restrito ao preview', () => {
  beforeEach(() => {vi.mocked(readFile).mockResolvedValue(artifact);});
  afterEach(() => {vi.unstubAllEnvs();vi.clearAllMocks();});

  it.each([
    ['production', 'production'], ['production', 'development'],
    ['development', 'production'], ['', 'production'], ['unknown', 'development'],
  ])('recusa ambiente %s / %s antes de ler o artefato', async (environment, node) => {
    vi.stubEnv('VERCEL_ENV', environment);vi.stubEnv('NODE_ENV', node);
    const response = await GET();
    expect(response.status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('scenarios');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it.each([['preview', 'production'], ['', 'development']])('serve revisão em %s / %s', async (environment, node) => {
    vi.stubEnv('VERCEL_ENV', environment);vi.stubEnv('NODE_ENV', node);
    const response = await GET();
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(html).toContain('id="backlink"');
    expect(html).toContain('Prévia experimental para revisão');
    expect(html).toContain('Precisão municipal não quantificada');
    const payload = JSON.parse(html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)![1]);
    expect(payload.scenarios).toHaveLength(18);
    expect(payload.scenarios.every((s: {rows: unknown[]}) => s.rows.length === 26)).toBe(true);
    const sensitivity = JSON.parse(readFileSync('docs/obee/resultados/sensibilidade-pares-v3.json', 'utf8'));
    expect(payload.sha256).toBe(sensitivity.source_sha256);
    expect(payload.sensitivity.summary).toEqual(sensitivity.summary);
    expect(payload.sensitivity.pairs).toEqual(sensitivity.pairs.map((p: Record<string, unknown>) =>
      Object.fromEntries(['a', 'b', 'state', 'min_gap', 'max_gap', 'definitions'].map(k => [k, p[k]]))));
  });

  it('embute valores originais, robustez e ressalva integral, sem links móveis', () => {
    const payload = JSON.parse(artifact.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)![1]);
    const pilot = JSON.parse(readFileSync('docs/obee/resultados/piloto-2022-v2.json', 'utf8'));
    const robustness = JSON.parse(readFileSync('docs/obee/resultados/robustez-ampliada-v3.json', 'utf8'));
    const precision = JSON.parse(readFileSync('docs/obee/resultados/precisao-candidatas.json', 'utf8'));
    expect(Object.keys(payload.original)).toHaveLength(26);
    for (const row of pilot.rows) {
      const original = payload.original[row.id];
      for (const [k, v] of Object.entries(row.raw_values)) expect(original[k]).toBe(v);
      for (const k of ['conectividade', 'domicilios_gt2', 'domicilios_gt3', 'moradores_gt2', 'moradores_gt3']) expect(Number.isFinite(original[k])).toBe(true);
    }
    expect(payload.robustness.summary).toEqual(robustness.summary);
    expect(payload.robustness.pairs.map((p: {robustness: string}) => p.robustness))
      .toEqual(robustness.pairs.map((p: {robustness: string}) => p.robustness));
    expect(payload.mandatory_label).toBe(precision.mandatory_label);
    expect(artifact).not.toContain('/blob/codex/');
    expect(artifact).not.toMatch(/min-width:\s*(660|700)px/);
    expect(artifact).toContain('Maior é mais favorável');
    expect(artifact).toContain('centro 50');
  });

  it('não permite geração estática ou cache entre ambientes', () => {
    expect(dynamic).toBe('force-dynamic');expect(revalidate).toBe(0);
  });
});
