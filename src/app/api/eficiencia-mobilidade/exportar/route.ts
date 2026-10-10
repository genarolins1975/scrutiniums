import {dadosMobilidade} from '@/lib/eficiencia/mobilidade/dados';
import {exportarCSV,linhasDaMedida,type Parametros,type Observacao} from '@/lib/eficiencia/mobilidade/modelo';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){
 const url=new URL(request.url),q=url.searchParams;const {base:g,hash,raw}=dadosMobilidade();
 const formato=q.get('formato')??'csv';if(!['csv','json'].includes(formato))return Response.json({erro:'Formato inválido'},{status:400});
 const m=q.get('medida');if(m&&!g.metrics.some(x=>x.id===m))return Response.json({erro:'Indicador desconhecido'},{status:400});
 const nivel=q.get('nivel');if(nivel&&!['brasil','uf','municipio'].includes(nivel))return Response.json({erro:'Nível inválido'},{status:400});
 const uf=q.get('uf');if(uf&&!g.territories.some(t=>t.uf===uf))return Response.json({erro:'UF desconhecida'},{status:400});
 if(formato==='json'){if(m||nivel||uf||q.get('busca'))return Response.json({erro:'JSON é apenas o snapshot integral; use CSV para recortes'},{status:400});return new Response(raw,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="mobilidade-snapshot.json"','X-Snapshot-SHA256':hash,'Cache-Control':'no-store'}});}
 let obs:Iterable<Observacao>=g.observations;
 if(m&&(nivel||uf||q.get('busca'))){const p:Parametros=Object.fromEntries(q.entries());obs=linhasDaMedida(g,m,p);}else if(m){obs=g.observations.filter(o=>o.metric===m);}else if(nivel||uf||q.get('busca'))return Response.json({erro:'Informe a medida para filtrar territórios'},{status:400});
 const iterator=exportarCSV(g,obs),encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({pull(controller){const chunk=iterator.next();if(chunk.done)controller.close();else controller.enqueue(encoder.encode(chunk.value));},cancel(){iterator.return();}});
 return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="mobilidade-dados.csv"','X-Snapshot-SHA256':hash,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
