import {coberturaCapitulo} from '@/lib/contas-publicas/cobertura';
import {PainelCustos} from '@/components/contas-publicas/PainelCustos';
import {PainelRAP} from '@/components/contas-publicas/PainelRAP';
import {PainelMetas} from '@/components/contas-publicas/PainelMetas';
import {PainelPlanejamento} from '@/components/contas-publicas/PainelPlanejamento';
import {PainelRigidez} from '@/components/contas-publicas/PainelRiscos';
import {PainelDivida} from '@/components/contas-publicas/PainelDivida';
import {PainelBeneficios} from '@/components/contas-publicas/PainelBeneficios';
import {META_INFO,consultarMetas} from '@/lib/contas-publicas/metas-dados';
import {seriePlano} from '@/lib/contas-publicas/planejamento';
import {FONTE_RIGIDEZ,serieRigidez} from '@/lib/contas-publicas/riscos';
import {PainelFiscal,PainelOrcamento} from '@/components/contas-publicas/PaineisDados';
import {RecorteCompartilhavel} from '@/components/contas-publicas/RecorteCompartilhavel';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {CAPITULOS_PUBLICADOS,INDICADORES,PAINEIS_NAVEGACAO} from '@/lib/contas-publicas/catalogo';
import {FichaIndicador} from '@/components/contas-publicas/FichaIndicador';
/**
 * Só os capítulos com dados têm página (Onda 3, critério "nenhum capítulo 'Em desenvolvimento' na navegação"): os
 * em preparação ficam fora de generateStaticParams e, com dynamicParams=false, respondem 404. O desenho deles segue
 * no catálogo (src/lib/contas-publicas/catalogo.ts) e no download do catálogo.
 */
export const dynamicParams=false;
export function generateStaticParams(){return CAPITULOS_PUBLICADOS.map(c=>({capitulo:c.id}))}
export function generateMetadata({params}:{params:{capitulo:string}}):Metadata{const c=CAPITULOS_PUBLICADOS.find(c=>c.id===params.capitulo);return {title:c?`${c.titulo} · Contas Públicas`:'Capítulo não encontrado',alternates:{canonical:`/contas-publicas/${params.capitulo}`}}}
export default function Page({params}:{params:{capitulo:string}}){
 const c=CAPITULOS_PUBLICADOS.find(c=>c.id===params.capitulo);if(!c)notFound();
 const cobertura=coberturaCapitulo(c.id),indicadores=INDICADORES.filter(i=>i.capitulo===c.id);
 return <main id="conteudo-contas" className="cp-wrap cp-main">
  <div className="cp-breadcrumb"><Link href="/contas-publicas#capitulos">← Todos os temas</Link><span>{c.titulo}</span></div>
  <header className="cp-chapter-header"><p className="cp-eyebrow">{c.etapa} · Dados disponíveis · recorte parcial</p><h1>{c.pergunta}</h1><p className="cp-lead">{c.entrega}</p><p className="cp-note cp-chapter-limit">{c.limite}</p></header>
  <div className="cp-chapter-tools"><nav className="cp-panel-nav" aria-label="Painéis com dados">{PAINEIS_NAVEGACAO.map(([href,nome])=><Link key={href} href={href} aria-current={href===`/contas-publicas/${c.id}`?'page':undefined}>{nome}</Link>)}</nav><RecorteCompartilhavel/></div>
  {cobertura.complementares.filter(p=>!p.href.startsWith(`/contas-publicas/${c.id}`)).map(p=><p key={p.href} className="cp-status">Complemento deste capítulo: <Link href={p.href}>{p.nome} →</Link></p>)}
  {c.id==='panorama'&&<PainelFiscal/>}{c.id==='execucao'&&<PainelOrcamento/>}{c.id==='restos-a-pagar'&&<PainelRAP/>}{c.id==='custos'&&<PainelCustos/>}{c.id==='metas'&&<PainelMetas inicial={consultarMetas({busca:'',orgao:'',estado:'calculavel'})} info={META_INFO}/>}
  {c.id==='planejamento'&&<PainelPlanejamento anos={seriePlano()}/>}
  {c.id==='beneficios'&&<PainelBeneficios/>}
  {c.id==='riscos'&&<><PainelRigidez anos={serieRigidez()} fonte={FONTE_RIGIDEZ}/><PainelDivida/></>}
  <section className="cp-section" aria-label="Indicadores do capítulo">
   <details className="cp-method-fold"><summary>Definições, cobertura e indicadores ainda pendentes <span>{cobertura.observados.length} com integração parcial · {cobertura.pendentes.length} pendentes{cobertura.complementares.length>0?` · complemento com dados: ${cobertura.complementares.map(p=>p.nome.toLowerCase()).join(', ')}`:''}</span></summary>{indicadores.map(i=><FichaIndicador key={i.id} indicador={i}/>)}</details>
  </section>
  <section className="cp-section cp-method"><h2>Como conferir a leitura?</h2><p>Verifique a unidade, o período e o universo ao lado de cada medida. Fontes e arquivos permitem conferir o recorte. Indicadores pendentes dependem da integração e conciliação dos campos identificados nas fichas.</p><div className="cp-links"><Link href="/contas-publicas/dados">Fontes e cobertura →</Link><Link href="/contas-publicas/metodologia">Regras de comparação →</Link><Link href="/contas-publicas/glossario">Glossário →</Link></div></section>
 </main>;
}
