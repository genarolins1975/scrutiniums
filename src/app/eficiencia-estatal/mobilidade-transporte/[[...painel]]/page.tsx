import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {PainelMobilidade} from '@/components/eficiencia/mobilidade/PainelMobilidade';
import {PAGINAS_MOBILIDADE,ROTA_MOBILIDADE,type Parametros} from '@/lib/eficiencia/mobilidade/modelo';
export const dynamic='force-dynamic';
export const runtime='nodejs';
type Props={params:{painel?:string[]};searchParams:Parametros};
function pagina(params:Props['params']){const p=params.painel??[];if(p.length>1)notFound();const found=PAGINAS_MOBILIDADE.find(x=>x.slug===(p[0]??''));if(!found)notFound();return found;}
export function generateMetadata({params}:Props):Metadata{const p=pagina(params);return {title:p.nome+' · Mobilidade e transporte',description:p.descricao,alternates:{canonical:ROTA_MOBILIDADE+(p.slug?'/'+p.slug:'')}};}
export default function Pagina({params,searchParams}:Props){const p=pagina(params);return <PainelMobilidade slug={p.slug} p={searchParams}/>;}
