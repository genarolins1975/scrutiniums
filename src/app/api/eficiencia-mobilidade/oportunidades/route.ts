import {NextRequest} from 'next/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {dadosOportunidades} from '@/lib/eficiencia/mobilidade/oportunidades-dados';
import {csvAop,recorteAop} from '@/lib/eficiencia/mobilidade/oportunidades';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const p=Object.fromEntries(request.nextUrl.searchParams),formato=p.formato??'csv';
 if(!['csv','json','seed'].includes(formato)||Object.keys(p).some(k=>!['formato','escopo','modo','pico','indicador','cidade'].includes(k))||(p.escopo&&p.escopo!=='recorte'))return new Response('Parâmetro inválido',{status:400});
 if(formato!=='csv'&&Object.keys(p).some(k=>k!=='formato'))return new Response('JSON e semente são arquivos integrais; use CSV para recortes.',{status:400});
 const {base:g,raw}=dadosOportunidades();
 const headers={'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="aop-2019-populacao-2010.csv"','X-Content-Type-Options':'nosniff'};
 if(formato==='json')return new Response(raw,{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="aop-2019-resumo.json"'}});
 if(formato==='seed'){
  const bytes=Buffer.from(readFileSync(join(process.cwd(),'data/eficiencia_mobilidade/aop/seed.json.gz.b64'),'utf8'),'base64');
  if(createHash('sha256').update(bytes).digest('hex')!==g.seedSha256)throw new Error('Semente AOP divergente');
  let offset=0;const body=new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(new Uint8Array(bytes.subarray(offset,offset+65536)));offset+=65536;}});
  return new Response(body,{headers:{...headers,'Content-Type':'application/gzip','Content-Disposition':'attachment; filename="aop-2019-seed.json.gz"'}});
 }
 let records=g.records;
 if(p.escopo==='recorte'){
  const r=recorteAop(g,p);
  if(r.avisos.length)return new Response(r.avisos.join(' '),{status:400});
  records=r.rows.flatMap(x=>x.record?[x.record]:[]);
 }else if(Object.keys(p).some(k=>!['formato','escopo'].includes(k)))return new Response('Declare escopo=recorte para aplicar filtros.',{status:400});
 const iterator=csvAop(g,records),encoder=new TextEncoder();
 const body=new ReadableStream<Uint8Array>({pull(controller){let chunk='';for(let i=0;i<100;i++){const item=iterator.next();if(item.done){if(chunk)controller.enqueue(encoder.encode(chunk));controller.close();return;}chunk+=item.value;}controller.enqueue(encoder.encode(chunk));},cancel(){iterator.return(undefined);}});
 return new Response(body,{headers});
}
