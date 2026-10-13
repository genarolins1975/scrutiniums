import {coberturaCapitulo} from '@/lib/contas-publicas/cobertura';
import {PainelCustos} from '@/components/contas-publicas/PainelCustos';
import {PainelRAP} from '@/components/contas-publicas/PainelRAP';
import {PainelMetas} from '@/components/contas-publicas/PainelMetas';
import {META_INFO,consultarMetas} from '@/lib/contas-publicas/metas-dados';
import {PainelFiscal,PainelOrcamento} from '@/components/contas-publicas/PaineisDados';
import {RecorteCompartilhavel} from '@/components/contas-publicas/RecorteCompartilhavel';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {CAPITULOS,INDICADORES} from '@/lib/contas-publicas/catalogo';
import {FichaIndicador} from '@/components/contas-publicas/FichaIndicador';
export const dynamicParams=false;
export function generateStaticParams(){return CAPITULOS.map(c=>({capitulo:c.id}))}
export function generateMetadata({params}:{params:{capitulo:string}}):Metadata{const c=CAPITULOS.find(c=>c.id===params.capitulo);return {title:c?`${c.titulo} · Contas Públicas`:'Capítulo não encontrado',alternates:{canonical:`/contas-publicas/${params.capitulo}`}}}
const paineis=[['execucao','Pagamentos'],['panorama','Resultado fiscal'],['restos-a-pagar','Restos a pagar'],['custos','Custos'],['metas','Entregas']];
export default function Page({params}:{params:{capitulo:string}}){
 const c=CAPITULOS.find(c=>c.id===params.capitulo);if(!c)notFound();
 const cobertura=coberturaCapitulo(c.id),indicadores=INDICADORES.filter(i=>i.capitulo===c.id),observado=cobertura.observados.length+cobertura.complementares.length>0;
 return <main id="conteudo-contas" className="cp-wrap cp-main">
  <div className="cp-breadcrumb"><Link href="/contas-publicas#capitulos">← Todos os temas</Link><span>{c.titulo}</span></div>
  <header className="cp-chapter-header"><p className="cp-eyebrow">{c.etapa} · {observado?'Dados disponíveis · recorte parcial':'Em desenvolvimento · método proposto'}</p><h1>{c.pergunta}</h1><p className="cp-lead">{observado?c.entrega:'Este capítulo apresenta as perguntas e os indicadores previstos. Ainda não há série integrada para responder à pergunta com dados.'}</p><p className="cp-note cp-chapter-limit">{c.limite}</p></header>
  {observado&&<><div className="cp-chapter-tools"><nav className="cp-panel-nav" aria-label="Painéis com dados">{paineis.map(([id,nome])=><Link key={id} href={`/contas-publicas/${id}`} aria-current={id===c.id?'page':undefined}>{nome}</Link>)}</nav><RecorteCompartilhavel/></div>
   {c.id==='panorama'&&<PainelFiscal/>}{c.id==='execucao'&&<PainelOrcamento/>}{c.id==='restos-a-pagar'&&<PainelRAP/>}{c.id==='custos'&&<PainelCustos/>}{c.id==='metas'&&<PainelMetas inicial={consultarMetas({busca:'',orgao:'',estado:'calculavel'})} info={META_INFO}/>}
  </>}
  {!observado&&<aside className="cp-pending-panel"><p className="cp-eyebrow">Enquanto a integração avança</p><h2>Você já pode explorar a execução e as entregas.</h2><p>Os painéis disponíveis apresentam os pagamentos, o saldo fiscal, os compromissos de anos anteriores, os custos agregados e as metas físicas declaradas.</p><Link className="cp-button" href="/contas-publicas#capitulos">Escolher um painel com dados →</Link></aside>}
  <section className="cp-section" aria-label="Indicadores do capítulo">
   {observado?<details className="cp-method-fold"><summary>Definições, cobertura e indicadores ainda pendentes <span>{cobertura.observados.length} com integração parcial · {cobertura.pendentes.length} pendentes{cobertura.complementares.length>0?' · custos agregados disponíveis como complemento':''}</span></summary>{indicadores.map(i=><FichaIndicador key={i.id} indicador={i}/>)}</details>:<><h2>Indicadores propostos para este tema</h2><p className="cp-note">As fórmulas abaixo descrevem o método pretendido. Ausência de série não significa valor zero.</p>{indicadores.map(i=><FichaIndicador key={i.id} indicador={i}/>)}</>}
  </section>
  <section className="cp-section cp-method"><h2>Como conferir a leitura?</h2><p>Verifique a unidade, o período e o universo ao lado de cada medida. Fontes e arquivos permitem conferir o recorte. Indicadores pendentes dependem da integração e conciliação dos campos identificados nas fichas.</p><div className="cp-links"><Link href="/contas-publicas/dados">Fontes e cobertura →</Link><Link href="/contas-publicas/metodologia">Regras de comparação →</Link><Link href="/contas-publicas/glossario">Glossário →</Link></div></section>
 </main>;
}
