import { ANOS } from '@/lib/contas-estaduais/dados';
import { MEDIDAS, REGIOES, csvComparacao, type Medida } from '@/lib/contas-estaduais/comparacao';
export function GET(request:Request) {
 const q=new URL(request.url).searchParams, ano=Number(q.get('ano')||2025), id=q.get('indicador')||'CE-04', regiao=q.get('regiao')||'Todas';
 if((q.has('df')&&!['0','1'].includes(q.get('df')!))||!ANOS.includes(ano)||!MEDIDAS.some(i=>i.id===id)||!REGIOES.includes(regiao)) return new Response('Recorte inválido',{status:400});
 return new Response(csvComparacao(ano,id as Medida,regiao,q.get('df')==='1'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="comparacao-estadual-${id}-${ano}.csv"`}});
}
