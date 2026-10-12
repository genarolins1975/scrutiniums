import { csvDisponibilidadeEducacao } from '@/lib/contas-estaduais/educacao';
export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const uf = p.get('uf') ?? '', ano = Number(p.get('ano')), etapa = p.get('etapa') ?? '';
  const csv = csvDisponibilidadeEducacao(uf, ano, etapa);
  if (csv === null) return new Response('UF, ano ou etapa inválidos', { status: 400 });
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="educacao-disponibilidade-${uf}-${ano}-${etapa}.csv"`,
  } });
}
