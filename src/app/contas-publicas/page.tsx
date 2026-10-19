import {GuiaLeitura} from '@/components/contas-publicas/GuiaLeitura';
import {AberturaFederal} from '@/components/contas-publicas/AberturaFederal';
import {IndiceFederal} from '@/components/contas-publicas/IndiceFederal';
import {ParaVoce} from '@/components/observatorios/ParaVoce';
import {CemReaisPagos} from '@/components/contas-publicas/artefatos/CemReaisPagos';
import {RespostasIniciais} from '@/components/contas-publicas/artefatos/RespostasIniciais';
import Link from 'next/link';
import {FaixaFrescor} from '@/components/frescor/FaixaFrescor';
import {FRESCOR_DAS_COLECOES} from '@/lib/frescor/entradas';
import { CAPITULOS, INDICADORES } from '@/lib/contas-publicas/catalogo';
import { coberturaCapitulo } from '@/lib/contas-publicas/cobertura';

/**
 * Cada etapa do percurso leva ao primeiro capítulo da etapa que já tem dados.
 * Etapa sem capítulo com dados não vira link (banca de 19/10/2026, achado A4):
 * nenhum clique da entrada leva a um capítulo vazio sem aviso.
 */
const comDados = (id: (typeof CAPITULOS)[number]['id']) => { const c = coberturaCapitulo(id); return c.observados.length + c.complementares.length > 0; };
const CICLO = ([
  ['01', 'Planejar', 'Receitas, prioridades e orçamento aprovado.', 'panorama'],
  ['02', 'Executar', 'Empenhos, liquidação, pagamentos e contratos.', 'execucao'],
  ['03', 'Entregar', 'Serviços, projetos, custos e metas físicas.', 'metas'],
  ['04', 'Prestar contas', 'Avaliações, transparência e riscos futuros.', 'avaliacao'],
] as const).map(([n, t, d, preferido]) => ({
  n, t, d,
  destino: CAPITULOS.find((c) => c.id === preferido && comDados(c.id)) ?? CAPITULOS.find((c) => c.etapa === t && comDados(c.id)) ?? null,
}));
export default function Page(){return <main id="conteudo-contas" className="cp-wrap cp-main cp-home">
 <FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/contas-publicas"]} className="-mt-2 mb-6"/>
 <AberturaFederal/>
 {/* "Para você" (Onda 2): substitui o tríptico de caminhos, com os mesmos destinos (panorama e metas) e o do estado do leitor, cada um com o número que a página mostra */}
 <ParaVoce entrada="/contas-publicas" conteiner=""/>
 <div className="cp-home-section-heading"><p className="cp-eyebrow">01 / Primeiras respostas</p><h2>Três perspectivas das contas federais.</h2><p>Pagamento, resultado fiscal e compromissos de outros exercícios têm conceitos distintos.</p></div>
 <RespostasIniciais/>
 <CemReaisPagos/>
 <p className="cp-note">{CAPITULOS.length} capítulos · {INDICADORES.length} indicadores propostos. Quatro têm integração parcial. O panorama de custos agregados é complementar; custos por entrega e impacto aguardam integração.</p>

 <section className="cp-section" aria-labelledby="ciclo"><div className="cp-section-head"><div><p className="cp-eyebrow">O percurso da gestão</p><h2 id="ciclo">Acompanhe o caminho dos recursos</h2></div></div><div className="cp-cycle">{CICLO.map(({n,t,d,destino})=>destino
  ?<Link key={t} href={`/contas-publicas/${destino.id}`}><span className="cp-index">{n} · {destino.titulo} →</span><strong>{t}</strong><span>{d}</span></Link>
  :<div key={t} className="cp-cycle-pending" aria-label={`${t}: em preparação, ainda sem dados`}><span className="cp-index">{n} · Em preparação</span><strong>{t}</strong><span>{d} Ainda sem dados integrados; veja os capítulos abaixo.</span></div>)}</div><p className="cp-note" style={{marginTop:12}}>Encadeamento de gestão, sem escala financeira. A relação entre gasto e impacto precisa de avaliação; não é uma conversão automática.</p></section>
 <section className="cp-section" id="capitulos" aria-labelledby="titulo-capitulos"><div className="cp-section-head"><div><p className="cp-eyebrow">Mapa completo</p><h2 id="titulo-capitulos">Uma pergunta para cada dimensão</h2><p>Abra um capítulo para conhecer suas medidas, fontes candidatas e condições de comparação.</p></div><Link className="cp-button" href="/contas-publicas/dados">Consultar os indicadores</Link></div><IndiceFederal/></section>
 <GuiaLeitura/>
 <section className="cp-section cp-split" aria-label="Interpretação e conexão"><article className="cp-method"><p className="cp-eyebrow">Leitura responsável</p><h2>Gastar, entregar e transformar são medidas diferentes.</h2><p>Execução não comprova eficiência. Metas cumpridas não comprovam impacto. Cada indicador explicita o que pode responder e seus limites.</p><Link href="/contas-publicas/metodologia">Entender as regras de comparação →</Link></article><article className="cp-method"><p className="cp-eyebrow">Conexão com o OBEE</p><h2>Quem financia e quem presta o serviço?</h2><p>Contas Públicas acompanha a gestão federal. O OBEE permite explorar acesso, resposta e qualidade dos serviços, considerando as responsabilidades compartilhadas entre esferas.</p><Link href="/eficiencia-estatal">Consultar serviços ao cidadão →</Link></article></section>
 <FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/contas-publicas"]} variante="metodo" className="cp-section"/>
 </main>}
