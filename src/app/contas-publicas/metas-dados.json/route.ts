import {NextResponse} from 'next/server';
import {META_INFO,consultarMetas,filtrarMetas,type FiltrosMetas} from '@/lib/contas-publicas/metas-dados';
import {ESTADOS_METAS} from '@/lib/contas-publicas/metas-modelo';
export const dynamic='force-dynamic';
export function GET(req:Request){
 const q=new URL(req.url).searchParams;const estado=q.get('estado')??'calculavel';const busca=q.get('busca')??'';const orgao=q.get('orgao')??'';
 if((estado!=='todos'&&!Object.prototype.hasOwnProperty.call(ESTADOS_METAS,estado))||busca.length>200||orgao.length>10)return NextResponse.json({erro:'Filtro inválido.'},{status:400});
 const filtros={busca,orgao,estado} as FiltrosMetas;
 if(q.get('download')==='1')return NextResponse.json({metadados:META_INFO,filtros,registros:filtrarMetas(filtros)},{headers:{'Content-Disposition':'attachment; filename="metas-fisicas-2025-recorte.json"'}});
 return NextResponse.json(consultarMetas(filtros,Number(q.get('pagina')??1)));
}
