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

  it('não permite geração estática ou cache entre ambientes', () => {
    expect(dynamic).toBe('force-dynamic');expect(revalidate).toBe(0);
  });
});
