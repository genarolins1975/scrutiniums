import type {Metadata} from 'next';
import Link from 'next/link';
import {PainelAreas} from '@/components/contas-publicas/areas/PainelAreas';
import {RecorteCompartilhavel} from '@/components/contas-publicas/RecorteCompartilhavel';
import {MarcaVisita} from '@/components/telemetria/MarcaVisita';
import {ROTA_AREAS,lerRecorte} from '@/lib/contas-publicas/areas';

/**
 * Painel "Para onde vai o dinheiro federal, por área?" (autorizado pelo dono em 20/10/2026): complemento do capítulo
 * Panorama, que responde à metade "para onde vão" da pergunta dele com a classificação funcional do SIOP. Rota com
 * conta (não consta de src/lib/rotasPublicas.ts). O recorte (exercício, estágio, base e área) vive na URL e é lido no
 * servidor: a base por subfunção de 2000 em diante não vai para o navegador.
 */
export const metadata:Metadata={title:'Para onde vai o dinheiro federal, por área?',description:'Cada R$ 100 pagos pelo orçamento da União por área de governo, com a dívida pública à parte, de 2000 ao ano corrente, pelos dados abertos do SIOP.',alternates:{canonical:ROTA_AREAS}};

export default function Page({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){
 const r=lerRecorte(searchParams);
 return <main id="conteudo-contas" className="cp-wrap cp-main">
  <MarcaVisita secao="contas:por-area"/>
  <div className="cp-breadcrumb"><span>Complemento do capítulo&nbsp;<Link href="/contas-publicas/panorama">Panorama das contas</Link></span></div>
  <header className="cp-chapter-header"><p className="rotulo cp-eyebrow">Planejar · Dados disponíveis · SIOP, {r.ano}</p><h1>Para onde vai o dinheiro federal, por área?</h1><p className="cp-lead">Cada R$ 100 que o orçamento da União pagou, repartidos pelas áreas de governo: previdência, assistência social, saúde, educação e as demais. A dívida pública aparece à parte, porque não é uma área.</p><p className="cp-note cp-chapter-limit">A área é a função orçamentária, definida pela competência do órgão que gasta. O valor mostra para onde o dinheiro foi, não o que ele entregou.</p></header>
  {/* os outros painéis estão na navegação da coleção (NavegacaoColecao), acima do título */}<div className="cp-chapter-tools"><RecorteCompartilhavel/></div>
  <PainelAreas r={r}/>
 </main>;
}
