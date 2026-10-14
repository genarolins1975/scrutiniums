import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {laboratorioPublico} from '@/lib/eficiencia/laboratorio-v3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Query parameters nunca alteram o acesso; ver laboratorioPublico. */
export async function GET() {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!laboratorioPublico(process.env.OBEE_LABORATORIO_V3)) {
    return new Response('Not found', {status: 404, headers});
  }
  const html = await readFile(join(process.cwd(), 'docs/obee/resultados/revisao-interativa-v3.html'), 'utf8');
  const navigation = '<nav aria-label="Voltar ao OBEE" style="max-width:1240px;margin:auto;padding:16px 40px 0"><a id="backlink" href="/eficiencia-estatal?visao=cidades#atlas-indice">← Voltar ao panorama das capitais</a></nav>';
  // O piloto v2 deu lugar ao índice v4 na entrada; o modelo congelado da v3 ainda aponta para a âncora antiga.
  const page = html.replace('</header><main>', `</header>${navigation}<main>`).replaceAll('#atlas-piloto', '#atlas-indice');
  return new Response(page, {
    headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'},
  });
}
