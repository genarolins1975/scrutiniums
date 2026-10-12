import {PainelCustos} from '@/components/contas-publicas/PainelCustos';
import {PainelRAP} from '@/components/contas-publicas/PainelRAP';
import {PainelMetas} from '@/components/contas-publicas/PainelMetas';
import {META_INFO,consultarMetas} from '@/lib/contas-publicas/metas-dados';
import {PainelFiscal,PainelOrcamento} from '@/components/contas-publicas/PaineisDados';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {CAPITULOS, INDICADORES} from '@/lib/contas-publicas/catalogo';
import {FichaIndicador} from '@/components/contas-publicas/FichaIndicador';
export const dynamicParams = false;
export function generateStaticParams(){return CAPITULOS.map(c=>({capitulo:c.id}))}
export function generateMetadata({params}:{params:{capitulo:string}}):Metadata{const c=CAPITULOS.find(c=>c.id===params.capitulo);return {title:c?`${c.titulo} · Contas Públicas`:'Capítulo não encontrado',alternates:{canonical:`/contas-publicas/${params.capitulo}`}}}
export default function Page({params}:{params:{capitulo:string}}){const c=CAPITULOS.find(c=>c.id===params.capitulo);if(!c)notFound();const indicadores=INDICADORES.filter(i=>i.capitulo===c.id);return <main id="conteudo-contas" className="cp-wrap cp-main"><Link className="cp-button" href="/contas-publicas#capitulos">← Todos os capítulos</Link><p className="cp-eyebrow" style={{marginTop:24}}>{c.etapa} · {c.titulo}</p><h1>{c.pergunta}</h1><p className="cp-lead">{c.entrega}</p><p className="cp-status"><strong>Contrato metodológico inicial.</strong> A cobertura varia por indicador e está identificada em cada ficha. {c.limite}</p>{c.id==='panorama'&&<PainelFiscal/>}{c.id==='execucao'&&<PainelOrcamento/>}{c.id==='restos-a-pagar'&&<PainelRAP/>}{c.id==='custos'&&<PainelCustos/>}{c.id==='metas'&&<PainelMetas inicial={consultarMetas({busca:'',orgao:'',estado:'calculavel'})} info={META_INFO}/>}<section className="cp-section" aria-label="Indicadores do capítulo">{indicadores.map(i=><FichaIndicador key={i.id} indicador={i}/>)}</section><section className="cp-section cp-method"><h2>O que falta para ampliar a cobertura?</h2><p>Homologar os campos de origem, registrar a data de captura, conciliar os totais e verificar as condições de comparação de cada indicador. O período de referência será exibido junto ao valor, sem confundir publicação com atualização.</p><Link href="/contas-publicas/dados">Consultar fontes e catálogo completo →</Link></section></main>}
