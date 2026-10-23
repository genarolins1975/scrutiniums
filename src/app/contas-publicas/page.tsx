import {GuiaLeitura} from '@/components/contas-publicas/GuiaLeitura';
import {CascataFederal} from '@/components/contas-publicas/AberturaFederal';
import {IndiceFederal} from '@/components/contas-publicas/IndiceFederal';
import {SeloProntidao} from '@/components/observatorios/SeloProntidao';
import {ParaVoce} from '@/components/observatorios/ParaVoce';
import {ArteTriptico} from '@/components/observatorios/ArteParaVoce';
import {CemReaisPagos} from '@/components/contas-publicas/artefatos/CemReaisPagos';
import {AvisoAtualidadeRTN} from '@/components/contas-publicas/artefatos/AvisoAtualidadeRTN';
import {Proveniencia} from '@/components/contas-publicas/artefatos/Proveniencia';
import {EntradaColecao} from '@/components/observatorios/EntradaColecao';
import {ModeloDidatico} from '@/components/observatorios/ModeloDidatico';
import {Recolhido} from '@/components/observatorios/Recolhido';
import Link from 'next/link';
import {FaixaFrescor} from '@/components/frescor/FaixaFrescor';
import {FRESCOR_DAS_COLECOES} from '@/lib/frescor/entradas';
import { CAPITULOS_PUBLICADOS, INDICADORES } from '@/lib/contas-publicas/catalogo';
import { coberturaCapitulo } from '@/lib/contas-publicas/cobertura';
import { escalaFederal, respostasIniciais } from '@/lib/contas-publicas/entrada';

/**
 * Cada etapa do percurso leva ao primeiro capítulo da etapa que já tem dados.
 * Etapa sem capítulo com dados não vira link (banca de 19/10/2026, achado A4):
 * nenhum clique da entrada leva a um capítulo vazio sem aviso. Só os capítulos
 * publicados entram (os em preparação ficam fora da navegação, Onda 3).
 */
const comDados = (id: (typeof CAPITULOS_PUBLICADOS)[number]['id']) => { const c = coberturaCapitulo(id); return c.observados.length + c.complementares.length > 0; };
const CICLO = ([
  ['01', 'Planejar', 'Receitas, prioridades e orçamento aprovado.', 'panorama'],
  ['02', 'Executar', 'Empenhos, liquidação, pagamentos e restos a pagar.', 'execucao'],
  ['03', 'Entregar', 'Custos dos serviços e metas físicas.', 'metas'],
  ['04', 'Prestar contas', 'Dívida, rigidez do orçamento e riscos futuros.', 'riscos'],
] as const).map(([n, t, d, preferido]) => ({
  n, t, d,
  destino: CAPITULOS_PUBLICADOS.find((c) => c.id === preferido && comDados(c.id)) ?? CAPITULOS_PUBLICADOS.find((c) => c.etapa === t && comDados(c.id)) ?? null,
}));

/**
 * Entrada das Contas Federais no molde único (Iniciativa 4 do parecer de UX, 22/10/2026). O painel escuro "Da autorização ao
 * pagamento" virou a escala (os quatro estágios do exercício encerrado, lidos da mesma base do capítulo de execução) e a cascata
 * com o exercício parcial ficou recolhida; as três primeiras respostas são os caminhos; o mapa dos capítulos são os destinos; a
 * régua dos R$ 100 pagos é o modelo didático.
 */
export default function Page(){
 const respostas=respostasIniciais();
 return <EntradaColecao
  tipo="colecao"
  rota="/contas-publicas"
  acento="obee"
  idPrincipal="conteudo-contas"
  titulo={<>Quanto do orçamento federal vira <em>pagamento</em>?</>}
  frase="O que foi autorizado, empenhado, liquidado e pago no ano, e quais entregas o governo informa."
  frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/contas-publicas"]} conteiner="mx-auto max-w-page px-6"/>}
  escala={escalaFederal(2025)}
  notaEscala="Orçamentos Fiscal e da Seguridade Social da União. Inclui juros, amortização e refinanciamento; pagamentos de restos a pagar ficam separados. Os estágios não se somam: cada um está dentro do anterior. Liquidação e pagamento não comprovam entrega ou impacto."
  paraVoce={<ParaVoce entrada="/contas-publicas" artes={{previdencia:<ArteTriptico tema="federal" cena={0}/>,metas:<ArteTriptico tema="federal" cena={1}/>,"estado-contas":<ArteTriptico tema="federal" cena={2}/>}}/>}
  destinos={<section className="cp-section mx-auto max-w-page px-6" id="capitulos" aria-labelledby="titulo-capitulos"><div className="cp-section-head"><div><p className="cp-eyebrow">Mapa completo</p><h2 id="titulo-capitulos">Uma pergunta para cada dimensão</h2><p>Abra um capítulo para conhecer suas medidas, fontes candidatas e condições de comparação.</p></div><Link className="cp-button" href="/contas-publicas/dados">Consultar os indicadores</Link></div><IndiceFederal/></section>}
  artefato={
   <ModeloDidatico
    recolhido
    id="cem-reais"
    titulo="Para onde vai cada R$ 100 pagos?"
    descricao="A régua reparte o que o orçamento federal pagou no ano por grupo de despesa, o que se compra. Bronze identifica juros e amortização."
    deixaDeFora={[
     "Os pagamentos de restos a pagar, acompanhados separadamente",
     "A repartição por área, como saúde e educação, que está em Despesa por área",
     "Se o gasto foi alto ou baixo: a régua mostra a composição, não avalia",
    ]}
   >
    <CemReaisPagos embutido/>
   </ModeloDidatico>
  }
  caminhos={[
   ...respostas.map((r)=>({pergunta:r.pergunta,resumo:r.nota,href:`/contas-publicas/${r.href}`,numero:{rotulo:r.rotulo,valor:r.valor,unidade:'',periodo:r.recorte.split(' · ')[0],fonte:r.origem.fonte,href:`/contas-publicas/${r.href}`}})),
   {pergunta:'Quem financia e quem presta o serviço?',resumo:'Contas Públicas acompanha a gestão federal. O OBEE permite explorar acesso, resposta e qualidade dos serviços, considerando as responsabilidades compartilhadas entre esferas.',href:'/eficiencia-estatal'},
  ]}
  recolhidos={<>
   <Recolhido id="recolhido-cascata" titulo="Da autorização ao pagamento" resumo="A cascata do orçamento no exercício encerrado e no parcial, com os valores exatos."><CascataFederal/></Recolhido>
   <Recolhido id="recolhido-ciclo" titulo="Acompanhe o caminho dos recursos" resumo="Planejar, executar, entregar e prestar contas, cada etapa no seu capítulo.">
    <section className="cp-section" aria-labelledby="ciclo" style={{marginTop:0}}><h3 id="ciclo" className="sr-only">O percurso da gestão</h3><div className="cp-cycle">{CICLO.map(({n,t,d,destino})=>destino
     ?<Link key={t} href={`/contas-publicas/${destino.id}`}><span className="cp-index">{n} · {destino.titulo} →</span><strong>{t}</strong><span>{d}</span></Link>
     :<div key={t} className="cp-cycle-pending" aria-label={`${t}: em preparação, ainda sem dados`}><span className="cp-index">{n} · <SeloProntidao valor="preparacao"/></span><strong>{t}</strong><span>{d} Ainda sem dados integrados; veja os capítulos abaixo.</span></div>)}</div><p className="cp-note" style={{marginTop:12}}>Encadeamento de gestão, sem escala financeira. A relação entre gasto e impacto precisa de avaliação; não é uma conversão automática.</p></section>
   </Recolhido>
   <Recolhido id="recolhido-guia" titulo="Quatro perguntas, quatro medidas diferentes" resumo="Pagamento, saldo, compromisso e entrega: o conceito, um exemplo e o limite de cada um."><GuiaLeitura/></Recolhido>
  </>}
  metodo={<div className="space-y-6">
   <p className="cp-note">{CAPITULOS_PUBLICADOS.length} capítulos com dados · {INDICADORES.filter(i=>i.status==='integracao-parcial').length} indicadores com recorte observado, cada um com fonte, período e limite. A despesa por área e os custos agregados são painéis complementares; custos por entrega e impacto aguardam integração.</p>
   <p className="cp-note"><SeloProntidao valor="parcial"/> Orçamento, despesa por área, previdência e INSS, plano e execução, resultado fiscal, dívida bruta e rigidez, gastos tributários, restos a pagar, entregas físicas e custos agregados; fontes e datas identificadas em cada painel.</p>
   <article className="cp-method"><p className="cp-eyebrow">Leitura responsável</p><h3>Gastar, entregar e transformar são medidas diferentes.</h3><p>Execução não comprova eficiência. Metas cumpridas não comprovam impacto. Cada indicador explicita o que pode responder e seus limites.</p><Link href="/contas-publicas/metodologia">Entender as regras de comparação →</Link></article>
   <div><h3 className="font-serif text-xl text-carvao">Fonte e recorte das primeiras respostas</h3>{respostas.map(r=><div key={r.href} className="mt-4"><p className="text-sm text-carvao">{r.pergunta}</p><Proveniencia {...r.origem}/></div>)}<AvisoAtualidadeRTN/></div>
  </div>}
  frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/contas-publicas"]} variante="metodo"/>}
 />;
}
