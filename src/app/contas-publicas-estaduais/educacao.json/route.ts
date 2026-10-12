import { disponibilidadeEducacao } from '@/lib/contas-estaduais/educacao';
export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const dado = disponibilidadeEducacao(p.get('uf') ?? '', Number(p.get('ano')), p.get('etapa') ?? '');
  if (!dado) return new Response('UF, ano ou etapa inválidos', { status: 400 });
  return Response.json(dado, { headers: { 'Content-Disposition': `attachment; filename="educacao-disponibilidade-${dado.uf}-${dado.ano}-${dado.etapa}.json"` } });
}
