import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pilotPreviewEnabled} from '@/lib/eficiencia/piloto-nucleo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Review surface only. Query parameters can never enable the route. */
export async function GET() {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!pilotPreviewEnabled(process.env.VERCEL_ENV, process.env.NODE_ENV)) {
    return new Response('Not found', {status: 404, headers});
  }
  const html = await readFile(join(process.cwd(), 'docs/obee/resultados/revisao-interativa-v3.html'), 'utf8');
  const navigation = '<nav aria-label="Voltar ao OBEE" style="max-width:1240px;margin:auto;padding:16px 40px 0"><a id="backlink" href="/eficiencia-estatal?visao=cidades#atlas-piloto">← Voltar ao panorama das capitais</a></nav>';
  return new Response(html.replace('</header><main>', `</header>${navigation}<main>`), {
    headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'},
  });
}
