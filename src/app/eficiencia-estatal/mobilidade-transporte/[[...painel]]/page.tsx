import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import {PainelMobilidade} from '@/components/eficiencia/mobilidade/PainelMobilidade';
import {PAGINAS_MOBILIDADE,ROTA_MOBILIDADE,type Parametros} from '@/lib/eficiencia/mobilidade/modelo';
import s from '@/components/eficiencia/mobilidade/mobilidade.module.css';
export const dynamic='force-dynamic';
export const dynamicParams=false;
export const runtime='nodejs';
/** A lista finita rejeita slugs inexistentes antes de iniciar o streaming. */
export function generateStaticParams(){return PAGINAS_MOBILIDADE.map(p=>({painel:p.slug?[p.slug]:[]}));}
type Props={params:{painel?:string[]};searchParams:Parametros};
function pagina(params:Props['params']){const p=params.painel??[];if(p.length>1)notFound();const found=PAGINAS_MOBILIDADE.find(x=>x.slug===(p[0]??''));if(!found)notFound();return found;}
export function generateMetadata({params}:Props):Metadata{const p=pagina(params);return {title:p.nome+' · Mobilidade e transporte',description:p.descricao,alternates:{canonical:ROTA_MOBILIDADE+(p.slug?'/'+p.slug:'')}};}
export default function Pagina({params,searchParams}:Props){
 const p=pagina(params);
 return <><CabecalhoEntrada/><main id="conteudo" aria-labelledby="titulo-mobilidade" className={'mx-auto max-w-page px-4 pb-20 pt-7 sm:px-6 '+s.painel}><PainelMobilidade slug={p.slug} p={searchParams}/></main></>;
}
