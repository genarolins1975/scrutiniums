import {AberturaFederal} from '@/components/contas-publicas/AberturaFederal';
import {IndiceFederal} from '@/components/contas-publicas/IndiceFederal';
import {TrilhasEstado} from '@/components/observatorios/TrilhasEstado';
import {CemReaisPagos} from '@/components/contas-publicas/artefatos/CemReaisPagos';
import {RespostasIniciais} from '@/components/contas-publicas/artefatos/RespostasIniciais';
import Link from 'next/link';
import { CAPITULOS, INDICADORES } from '@/lib/contas-publicas/catalogo';
export default function Page(){return <main id="conteudo-contas" className="cp-wrap cp-main cp-home">
 <AberturaFederal/>
 <TrilhasEstado tema="federal" itens={[
  {titulo:'Acompanhe os recursos',texto:'Orçamento, resultado fiscal e compromissos que ficam para depois.',href:'/contas-publicas/panorama'},
  {titulo:'Explore as entregas',texto:'Metas físicas e realizações, com unidade e período próprios.',href:'/contas-publicas/metas'},
  {titulo:'Escolha uma pergunta',texto:'Navegue pelos capítulos e veja onde já há dados disponíveis.',href:'#capitulos'},
 ]}/>
 <div className="cp-home-section-heading"><p className="cp-eyebrow">01 / Primeiras respostas</p><h2>Três perspectivas das contas federais.</h2><p>Pagamento, resultado fiscal e compromissos de outros exercícios têm conceitos distintos.</p></div>
 <RespostasIniciais/>
 <CemReaisPagos/>
 <p className="cp-note">{CAPITULOS.length} capítulos · {INDICADORES.length} indicadores propostos. Quatro têm integração parcial. O panorama de custos agregados é complementar; custos por entrega e impacto aguardam integração.</p>

 <section className="cp-section" aria-labelledby="ciclo"><div className="cp-section-head"><div><p className="cp-eyebrow">O percurso da gestão</p><h2 id="ciclo">Acompanhe o caminho dos recursos</h2></div></div><div className="cp-cycle">{[
 ['01','Planejar','Receitas, prioridades e orçamento aprovado.','planejamento'],['02','Executar','Empenhos, liquidação, pagamentos e contratos.','execucao'],['03','Entregar','Serviços, projetos, custos e metas físicas.','metas'],['04','Prestar contas','Avaliações, transparência e riscos futuros.','avaliacao']
 ].map(([n,t,d,id])=><Link key={id} href={`/contas-publicas/${id}`}><span className="cp-index">{n} · Explorar →</span><strong>{t}</strong><span>{d}</span></Link>)}</div><p className="cp-note" style={{marginTop:12}}>Encadeamento de gestão, sem escala financeira. A relação entre gasto e impacto precisa de avaliação; não é uma conversão automática.</p></section>
 <section className="cp-section" id="capitulos" aria-labelledby="titulo-capitulos"><div className="cp-section-head"><div><p className="cp-eyebrow">Mapa completo</p><h2 id="titulo-capitulos">Uma pergunta para cada dimensão</h2><p>Abra um capítulo para conhecer suas medidas, fontes candidatas e condições de comparação.</p></div><Link className="cp-button" href="/contas-publicas/dados">Consultar os indicadores</Link></div><IndiceFederal/></section>
 <section className="cp-section cp-split" aria-label="Interpretação e conexão"><article className="cp-method"><p className="cp-eyebrow">Leitura responsável</p><h2>Gastar, entregar e transformar são medidas diferentes.</h2><p>Execução não comprova eficiência. Metas cumpridas não comprovam impacto. Cada indicador explicita o que pode responder e seus limites.</p><Link href="/contas-publicas/metodologia">Entender as regras de comparação →</Link></article><article className="cp-method"><p className="cp-eyebrow">Conexão com o OBEE</p><h2>Quem financia e quem presta o serviço?</h2><p>Contas Públicas acompanha a gestão federal. O OBEE permite explorar acesso, resposta e qualidade dos serviços, considerando as responsabilidades compartilhadas entre esferas.</p><Link href="/eficiencia-estatal">Consultar serviços ao cidadão →</Link></article></section>
 </main>}
