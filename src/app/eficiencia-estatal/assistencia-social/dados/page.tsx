import type {Metadata} from 'next';
import {dadosAssistencia} from '@/lib/eficiencia/assistencia/dados';
import {ExploradorSuas} from '@/components/eficiencia/assistencia/ExploradorSuas';
export const dynamic='force-static';
export const metadata:Metadata={title:'Dados de assistência social e cuidado'};
export default function Page(){const g=dadosAssistencia();return <><p className="rotulo text-obee">Dados de base · Censo SUAS e RMA 2025</p><h1 className="mt-3 font-serif text-4xl">Uma unidade, uma variável,<br/>um período.</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">Recorte de CRAS, CREAS e centros-dia e similares: {(Object.values(g.manifest.counts).reduce((a,b)=>a+b,0)).toLocaleString('pt-BR')} unidades. O RMA contém {g.manifest.rma_rows.toLocaleString('pt-BR')} formulários unidade-mês, com quatro variáveis e seus valores originais. Nulos e saltos de questionário permanecem identificados.</p><ExploradorSuas catalog={g.catalog} ufs={g.ufs}/></>}
