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
import {FluxoFederal} from '@/components/contas-publicas/artefatos/FluxoFederal';
import {RecorteCompartilhavel} from '@/components/contas-publicas/RecorteCompartilhavel';
import {ResumoFiscalAbertura} from '@/components/contas-publicas/ResumoFiscalAbertura';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {CAPITULOS_PUBLICADOS,INDICADORES} from '@/lib/contas-publicas/catalogo';
import {FichaIndicador} from '@/components/contas-publicas/FichaIndicador';
import {Termo} from '@/components/contas-publicas/artefatos/Termo';
import {PaginaPainel} from '@/components/painel/PaginaPainel';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {dataFonte} from '@/lib/contas-publicas/dados';
import {participacao} from '@/lib/contas-publicas/formato';
import {ESTADOS_METAS,numeroFisico,type EstadoMeta} from '@/lib/contas-publicas/metas-modelo';
/**
 * Só os capítulos com dados têm página (Onda 3, critério "nenhum capítulo 'Em desenvolvimento' na navegação"): os
 * em preparação ficam fora de generateStaticParams e, com dynamicParams=false, respondem 404. O desenho deles segue
 * no catálogo (src/lib/contas-publicas/catalogo.ts) e no download do catálogo.
 */
export const dynamicParams=false;
export function generateStaticParams(){return CAPITULOS_PUBLICADOS.map(c=>({capitulo:c.id}))}
export function generateMetadata({params}:{params:{capitulo:string}}):Metadata{const c=CAPITULOS_PUBLICADOS.find(c=>c.id===params.capitulo);return {title:c?c.titulo:'Capítulo não encontrado',alternates:{canonical:`/contas-publicas/${params.capitulo}`}}}
export default function Page({params}:{params:{capitulo:string}}){
 const c=CAPITULOS_PUBLICADOS.find(c=>c.id===params.capitulo);if(!c)notFound();
 // o capítulo Metas e entregas tem corpo próprio e é o do Grupo 1 da Iniciativa 1: só ele entra no molde de painel por enquanto
 if(c.id==='metas')return <CapituloMetas c={c}/>;
 const cobertura=coberturaCapitulo(c.id),indicadores=INDICADORES.filter(i=>i.capitulo===c.id);
 // os complementos saíram do topo (diagnóstico de 20/10/2026, item 9): viram links depois do painel, onde a leitura pede o próximo passo
 const complementos=cobertura.complementares.filter(p=>!p.href.startsWith(`/contas-publicas/${c.id}`));
 return <main id="conteudo-contas" className="cp-wrap cp-main">
  <header className="cp-chapter-header"><p className="rotulo cp-eyebrow">{c.etapa} · Dados disponíveis · recorte parcial</p><h1>{c.pergunta}</h1><p className="cp-lead">{c.entrega}</p><p className="cp-note cp-chapter-limit">{c.limite}</p></header>
  {c.id==='panorama'&&<ResumoFiscalAbertura/>}
  {/* os outros painéis estão na navegação da coleção (NavegacaoColecao), acima do título */}<div className="cp-chapter-tools"><RecorteCompartilhavel/></div>
  {c.id==='panorama'&&<><FluxoFederal/><PainelFiscal/></>}{c.id==='execucao'&&<PainelOrcamento/>}{c.id==='restos-a-pagar'&&<PainelRAP/>}{c.id==='custos'&&<PainelCustos/>}{/* metas tem a própria página no molde (CapituloMetas, abaixo) */}
  {c.id==='planejamento'&&<PainelPlanejamento anos={seriePlano()}/>}
  {c.id==='beneficios'&&<PainelBeneficios/>}
  {c.id==='riscos'&&<><PainelRigidez anos={serieRigidez()} fonte={FONTE_RIGIDEZ}/><PainelDivida/></>}
  {complementos.length>0&&<section className="cp-section cp-complementos" aria-labelledby="complementos-capitulo"><h2 id="complementos-capitulo">O que completa este capítulo?</h2><div className="cp-links">{complementos.map(p=><Link key={p.href} href={p.href}>{p.nome} →</Link>)}</div></section>}
  <section className="cp-section" aria-label="Indicadores do capítulo">
   <details className="cp-method-fold"><summary>Definições, cobertura e indicadores ainda pendentes <span>{cobertura.observados.length} com integração parcial · {cobertura.pendentes.length} pendentes{cobertura.complementares.length>0?` · complemento com dados: ${cobertura.complementares.map(p=>p.nome.toLowerCase()).join(', ')}`:''}</span></summary>{indicadores.map(i=><FichaIndicador key={i.id} indicador={i}/>)}</details>
  </section>
  <section className="cp-section cp-method"><h2>Como conferir a leitura?</h2><p>Verifique a unidade, o período e o universo ao lado de cada medida. Fontes e arquivos permitem conferir o recorte. Indicadores pendentes dependem da integração e conciliação dos campos identificados nas fichas.</p><div className="cp-links"><Link href="/contas-publicas/dados">Fontes e cobertura →</Link><Link href="/contas-publicas/metodologia">Regras de comparação →</Link><Link href="/contas-publicas/glossario">Glossário →</Link></div></section>
 </main>;
}

type CapituloPublicado=(typeof CAPITULOS_PUBLICADOS)[number];

/**
 * Metas e entregas no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta do capítulo na abertura, com a etapa e o
 * recorte parcial (SeloProntidao) e a fonte; os três números da cobertura do arquivo na faixa do kit; o explorador das programações num
 * capítulo recolhido aberto, com os filtros logo antes da lista; os complementos depois; as fichas dos indicadores e o "Como conferir a
 * leitura?" no método. Os números, os textos e a consulta são os de antes; o "Compartilhar recorte" saiu (o "Salvar recorte" da barra é
 * o único, seção 4.7 do prompt da Iniciativa 1).
 */
function CapituloMetas({c}:{c:CapituloPublicado}){
 const cobertura=coberturaCapitulo(c.id),indicadores=INDICADORES.filter(i=>i.capitulo===c.id);
 const complementos=cobertura.complementares.filter(p=>!p.href.startsWith(`/contas-publicas/${c.id}`));
 const info=META_INFO,n=numeroFisico;
 const base={periodo:'jan/2025 a dez/2025',fonte:'SIOP, AFFO 2025, captação final',formato:'inteiro' as const,tamanho:'m' as const};
 return <main id="conteudo-contas" tabIndex={-1}>
  <PaginaPainel
   rota={`/contas-publicas/${c.id}`}
   principal={false}
   abertura={{
    grupo:'Capítulos',
    prontidao:'parcial',
    acento:'obee',
    titulo:c.pergunta,
    lead:c.entrega,
    recorte:{periodo:'jan/2025 a dez/2025',universo:'Orçamentos fiscal e da seguridade social, nível localizador',unidade:'quantidade na unidade do produto e R$ correntes',fonte:'SIOP, AFFO 2025, captação final'},
    limite:<>o impacto das entregas. {c.limite}</>,
    fontesDatasSiglas:<p>Etapa do ciclo: {c.etapa} · Dados disponíveis · recorte parcial. Referência: janeiro a dezembro de 2025, apuração física por registro. Captura em {dataFonte(info.captura)}; edição do arquivo de {dataFonte(info.edicaoArquivo)}.</p>,
   }}
   rotuloNumeros="Cobertura do arquivo de metas físicas"
   numeros={[
    {...base,rotulo:'Localizadores no arquivo',valor:info.contagemFonte.localizadores,unidade:'localizadores',natureza:'OBSERVADO',nota:<>{n(info.contagemFonte.planosOrcamentariosExcluidos)} registros de <Termo id="plano-orcamentario">planos orçamentários</Termo> excluídos para evitar sobreposição.</>},
    {...base,rotulo:'Razões físicas calculáveis',valor:info.cobertura.calculavel,unidade:'localizadores',natureza:'CALCULADO',nota:`${participacao(info.cobertura.calculavel,info.contagemFonte.localizadores)} do arquivo têm os campos necessários. Isso mede cobertura dos dados, não desempenho.`},
    {...base,rotulo:'Demais registros preservados',valor:info.contagemFonte.localizadores-info.cobertura.calculavel,unidade:'localizadores',natureza:'CALCULADO',nota:'Ausência não vira zero. Metas não positivas não geram percentuais.'},
   ]}
   notaNumeros={<details className="cp-data-details"><summary>Ver cobertura e condições de cálculo</summary><ul>{Object.entries(info.cobertura).map(([id,total])=><li key={id}>{ESTADOS_METAS[id as EstadoMeta]}: {n(total)}</li>)}</ul><p className="cp-note">A cobertura decorre dos campos preenchidos, não do sinal administrativo de captação. A razão não mede qualidade, impacto ou custo; valores acima de 100% são preservados e exigem análise da meta.</p></details>}
   figuras={<>
    <Recolhido id="entregas" aberto nivelTitulo={2} titulo="Da autorização à entrega declarada." resumo="Entregas físicas · AFFO / SIOP · 2025">
     <p className="t-corpo max-w-prose2 text-carvao">Compare o realizado com a meta de uma ação, unidade orçamentária e <Termo id="localizador"/>. Produtos diferentes não formam uma quantidade total nem uma nota geral de eficácia.</p>
     <PainelMetas inicial={consultarMetas({busca:'',orgao:'',estado:'calculavel'})} info={META_INFO}/>
    </Recolhido>
    {complementos.length>0&&<Recolhido id="complementos-capitulo" aberto nivelTitulo={2} titulo="O que completa este capítulo?" resumo="Painéis com dados que completam a pergunta deste capítulo."><div className="cp-links">{complementos.map(p=><Link key={p.href} href={p.href}>{p.nome} →</Link>)}</div></Recolhido>}
   </>}
   metodo={<>
    <details className="cp-method-fold"><summary>Definições, cobertura e indicadores ainda pendentes <span>{cobertura.observados.length} com integração parcial · {cobertura.pendentes.length} pendentes{cobertura.complementares.length>0?` · complemento com dados: ${cobertura.complementares.map(p=>p.nome.toLowerCase()).join(', ')}`:''}</span></summary>{indicadores.map(i=><FichaIndicador key={i.id} indicador={i}/>)}</details>
    <h3 className="t-h3 text-carvao">Como conferir a leitura?</h3>
    <p>Verifique a unidade, o período e o universo ao lado de cada medida. Fontes e arquivos permitem conferir o recorte. Indicadores pendentes dependem da integração e conciliação dos campos identificados nas fichas.</p>
    <div className="cp-links"><Link href="/contas-publicas/dados">Fontes e cobertura →</Link><Link href="/contas-publicas/metodologia">Regras de comparação →</Link><Link href="/contas-publicas/glossario">Glossário →</Link></div>
   </>}
  />
 </main>;
}
