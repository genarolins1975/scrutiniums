import { snapshot, ANOS } from '@/lib/contas-estaduais/dados';
import { csvFinanciamento } from '@/lib/contas-estaduais/financiamento';
export function GET(req:Request) {
 const q=new URL(req.url).searchParams, uf=q.get('uf')??'', ano=Number(q.get('ano'));
 if(!snapshot.ufs.some(x=>x.uf===uf)||!ANOS.includes(ano)) return new Response('UF ou ano inválido',{status:400});
 const csv=csvFinanciamento(uf,ano);
 if(!csv) return new Response('Sem observação conferida neste recorte',{status:404});
 return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="financiamento-${uf}-${ano}.csv"`}});
}
