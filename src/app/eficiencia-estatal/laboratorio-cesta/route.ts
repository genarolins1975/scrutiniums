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
  const navigation = '<nav aria-label="Voltar ao OBEE" style="max-width:1240px;margin:auto;padding:16px 40px 0"><a id="backlink" href="/eficiencia-estatal/indice-de-resultados#atlas-indice">← Voltar ao índice de resultados das capitais</a></nav>';
  // O modelo congelado da v3 ainda aponta para a entrada e para a âncora do piloto v2. O índice v4 saiu da entrada
  // para o próprio painel (decisão do dono de 19/10/2026): o retorno leva o par de capitais para lá.
  const page = html.replace('</header><main>', `</header>${navigation}<main>`)
    .replaceAll("'/eficiencia-estatal?visao=cidades&territorio='", "'/eficiencia-estatal/indice-de-resultados?territorio='")
    .replaceAll('#atlas-piloto', '#atlas-indice');
  return new Response(page, {
    headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'},
  });
}
