import type {Metadata} from 'next';
import {dadosAssistencia} from '@/lib/eficiencia/assistencia/dados';
import {PainelSuas} from '@/components/eficiencia/assistencia/PainelSuas';
import {SerieRma} from '@/components/eficiencia/assistencia/SerieRma';
export const dynamic='force-static';
export const metadata:Metadata={title:'Acompanhamento das famílias'};
export default function Page(){const g=dadosAssistencia();return <><p className="rotulo text-obee">Acompanhamento · PAIF e PAEFI</p><h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight">Atender, acompanhar<br/>e dar continuidade.</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">O PAIF é o Serviço de Proteção e Atendimento Integral à Família, realizado nos CRAS. O PAEFI é o Serviço de Proteção e Atendimento Especializado a Famílias e Indivíduos, realizado nos CREAS. Planos e acompanhamento de encaminhamentos são práticas declaradas; não comprovam que cada pessoa recebeu acompanhamento contínuo.</p><SerieRma ufs={g.ufs} series={Object.fromEntries(Object.entries(g.stats).map(([k,v])=>[k,v.monthly]))}/><PainelSuas ids={['CRAS.q12_12','CRAS.q12_14','CREAS.q12_4','CREAS.q12_6']}/></>}
