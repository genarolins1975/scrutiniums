import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {PainelOportunidades} from '@/components/eficiencia/mobilidade/PainelOportunidades';
import {PainelMobilidade} from '@/components/eficiencia/mobilidade/PainelMobilidade';
import {PAGINAS_MOBILIDADE,ROTA_MOBILIDADE,primeiro,type Parametros} from '@/lib/eficiencia/mobilidade/modelo';
import s from '@/components/eficiencia/mobilidade/mobilidade.module.css';
export const dynamic='force-dynamic';
/** Subcabeçalho comum da Eficiência Estatal (item 10 do diagnóstico de 20/10/2026); o recorte territorial acompanha a troca de visão. */
export const dynamicParams=false;
export const runtime='nodejs';
/** A lista finita rejeita slugs inexistentes antes de iniciar o streaming. */
export function generateStaticParams(){return PAGINAS_MOBILIDADE.map(p=>({painel:p.slug?[p.slug]:[]}));}
type Props={params:{painel?:string[]};searchParams:Parametros};
function pagina(params:Props['params']){const p=params.painel??[];if(p.length>1)notFound();const found=PAGINAS_MOBILIDADE.find(x=>x.slug===(p[0]??''));if(!found)notFound();return found;}
export function generateMetadata({params}:Props):Metadata{const p=pagina(params);return {title:p.nome,description:p.descricao,alternates:{canonical:ROTA_MOBILIDADE+(p.slug?'/'+p.slug:'')}};}
export default function Pagina({params,searchParams}:Props){
 const p=pagina(params);
 // Navegação por Link preserva controles não controlados. Uma nova seleção na
 // URL precisa remontá-los para que defaultValue reflita o recorte servido.
 const chaveOportunidades=JSON.stringify(['indicador','modo','cidade','pico'].map(k=>primeiro(searchParams[k])));
 return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/mobilidade-transporte" navegacao="mobilidade" /></header><main id="conteudo" aria-labelledby="titulo-mobilidade" className={'mx-auto max-w-page px-4 pb-20 pt-7 sm:px-6 '+s.painel}>{p.slug==='oportunidades'?<PainelOportunidades key={chaveOportunidades} p={searchParams}/>:<PainelMobilidade slug={p.slug} p={searchParams}/>}</main></>;
}
