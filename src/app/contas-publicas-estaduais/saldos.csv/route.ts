import { ANOS, snapshot } from '@/lib/contas-estaduais/dados';
import { csvSaldos } from '@/lib/contas-estaduais/saldos';
export function GET(request: Request) {
 const q = new URL(request.url).searchParams, uf = q.get('uf') || 'PE', ano = Number(q.get('ano') || 2025);
 if (!snapshot.ufs.some(u=>u.uf===uf) || !ANOS.includes(ano)) return new Response('Recorte inválido', {status:400});
 const csv = csvSaldos(uf, ano);
 if (csv === null) return new Response('Sem execução conferida neste recorte', {status:404});
 return new Response(csv, {headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="saldos-${uf}-${ano}.csv"`}});
}
