import type {Metadata} from 'next';
import Link from 'next/link';
import {Barras,Edicao,FonteFjp,LeituraBarras,RECORTE,SIGLAS,fichaFjp,tabelaBarras} from '@/components/eficiencia/habitacao/Editoria';
import {FiguraAnalitica,PaginaPainel} from '@/components/painel';
import {brasil as b} from '@/lib/eficiencia/habitacao/dados';
import {ROTA,n,pct} from '@/lib/eficiencia/habitacao/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import { tituloNaColecao } from "@/lib/observatorios/contexto";
export const dynamic='force-static';
export const metadata:Metadata={"title": tituloNaColecao("Habitação — panorama", "/eficiencia-estatal/habitacao"), "alternates": {"canonical": "/eficiencia-estatal/habitacao"}};

const COMPONENTES=[{nome:'Ônus excessivo com aluguel urbano',valor:b.aluguel},{nome:'Habitação precária',valor:b.precaria},{nome:'Coabitação',valor:b.coabitacao}];
const link='inline-flex min-h-[44px] items-center text-sm text-obee-dark underline';

/** Duas perguntas, duas formas de medir: a distinção que orienta a leitura dos painéis e leva a cada um deles (navegação local, logo depois dos números). */
function DuasPerguntas(){return <nav aria-labelledby="duas-perguntas" className="mt-10 border-t border-linha pt-6">
 <h2 id="duas-perguntas" className="t-h2 text-carvao">Duas perguntas, duas formas de medir.</h2>
 <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">A distinção orienta a leitura dos painéis e evita tratar qualquer problema de moradia como necessidade de construir uma unidade nova.</p>
 <div className="mt-6 grid gap-8 md:grid-cols-2">
  <article><p className="rotulo text-mineral">Necessidade habitacional</p><h3 className="t-h3 mt-2 text-carvao">Déficit</h3><p className="t-corpo mt-2 text-carvao">Habitação precária, coabitação e ônus excessivo com aluguel urbano. A metodologia identifica necessidades de reposição, ampliação e acesso à moradia.</p><Link className={link} href={ROTA+'/deficit'}>Explorar componentes e territórios →</Link></article>
  <article><p className="rotulo text-mineral">Qualidade da moradia existente</p><h3 className="t-h3 mt-2 text-carvao">Inadequação</h3><p className="t-corpo mt-2 text-carvao">Carências de infraestrutura urbana, da edificação ou da situação fundiária em domicílios duráveis urbanos. Uma mesma casa pode ter mais de uma carência.</p><Link className={link} href={ROTA+'/inadequacao'}>Examinar condições da moradia →</Link></article>
 </div>
</nav>;}

/**
 * Panorama da habitação no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os três números no NumeroIndicador, a nota de
 * que os totais não se somam junto da faixa, as duas perguntas com os links para os painéis logo depois dos números, a composição do
 * déficit numa FiguraAnalitica com o GraficoBarras do kit e o "o que este diagnóstico permite acompanhar" no método, por inteiro.
 * Nenhum número ou texto mudou; a frase de escala das barras passou a descrever a escala do kit (linear a partir de zero).
 */
export default function Pagina(){return <PaginaPainel rota={ROTA} principal={false}
 abertura={{grupo:TEMAS_EFICIENCIA.habitacao.nome,acento:'obee',titulo:'O que falta para morar com dignidade?',
  lead:'Parte das necessidades habitacionais envolve uma nova solução de moradia. Outra parte exige melhorar a casa, a infraestrutura ou a segurança da ocupação. São problemas distintos, que pedem respostas diferentes.',
  recorte:RECORTE,
  limite:'a eficiência de um governo nem o efeito de uma política: as estimativas descrevem necessidades habitacionais, e gastos públicos, unidades contratadas ou entregues e tempos de atendimento não fazem parte desta base.',
  fontesDatasSiglas:<><FonteFjp/><Edicao/>{SIGLAS}</>}}
 numeros={[
  {rotulo:'Déficit habitacional estimado',recorte:'Brasil',valor:b.deficit/1e6,casas:2,unidade:'milhões de domicílios',periodo:'2024',fonte:'FJP, Deficit_habitacional',natureza:'ESTIMADO',nota:n(pct(b.deficit,b.domicilios),1)+'% dos domicílios particulares ocupados. Brasil, 2024.'},
  {rotulo:'Ônus excessivo com aluguel',recorte:'Brasil',valor:b.aluguel/1e6,casas:2,unidade:'milhões de domicílios',periodo:'2024',fonte:'FJP, DH_Componentes',natureza:'ESTIMADO',nota:n(pct(b.aluguel,b.deficit),1)+'% do déficit. Renda de até 3 salários mínimos e aluguel superior a 30% da renda.'},
  {rotulo:'Domicílios com alguma inadequação',recorte:'Brasil',valor:b.inadequados/1e6,casas:2,unidade:'milhões de domicílios',periodo:'2024',fonte:'FJP, planilha Inadequação',natureza:'ESTIMADO',nota:n(pct(b.inadequados,b.urbanosDuraveis),1)+'% dos domicílios duráveis urbanos. Universo próprio.'},
 ]}
 notaNumeros="Os dois totais não podem ser somados. Domicílios com ônus excessivo de aluguel podem também ter inadequações. As estimativas descrevem necessidades habitacionais; não medem, isoladamente, a eficiência de um governo."
 navegacaoLocal={<DuasPerguntas/>}
 figuras={<FiguraAnalitica id="composicao" pergunta="Do que é composto o déficit?" subtitulo="Participação no déficit habitacional estimado · % e número estimado · Brasil, 2024" natureza="CALCULADO" idioma="pt"
  leitura={<LeituraBarras itens={COMPONENTES} total={b.deficit}/>}
  naoConcluir="As três partes descrevem a composição das necessidades estimadas pela FJP, não a resposta adequada a cada uma: o peso do aluguel não indica, sozinho, se auxílio, locação social ou novas unidades atenderiam melhor."
  tabela={tabelaBarras(COMPONENTES,b.deficit,'Três componentes do déficit nacional · Brasil, 2024')}
  proveniencia={fichaFjp({indicador:'Componentes do déficit habitacional',natureza:'CALCULADO',arquivo:'deficit.xlsx',recurso:'aba DH_Componentes',limitacoes:['Participação no déficit habitacional estimado: as três partes compõem o total pela sequência de classificação da FJP, sem duplicidade entre componentes.']})}
  extraFonte="Planilha Déficit, aba DH_Componentes."
  depois={<Link className={link} href={ROTA+'/aluguel-renda'}>Entender o peso do aluguel e as faixas de renda →</Link>}>
  <Barras titulo="Três componentes do déficit nacional" total={b.deficit} itens={COMPONENTES}/>
 </FiguraAnalitica>}
 metodo={<><FonteFjp/><Edicao/>
  <p><span className="font-medium text-carvao">O que este diagnóstico permite acompanhar?</span> A comparação entre regiões e estados mostra a escala e a composição das necessidades. A leitura em percentual controla o tamanho do universo; a leitura em número estimado dimensiona a quantidade. Nenhuma delas identifica, sozinha, o efeito de uma política.</p>
  <p>Esta edição reúne o diagnóstico habitacional de 2024. Gastos públicos, unidades contratadas ou entregues e tempos de atendimento não fazem parte desta base. Não os confundimos com redução do déficit.</p>
  <p>Os arquivos originais, os localizadores de cada célula e os hashes estão em <Link className="underline" href={ROTA+'/dados'}>Dados e métodos</Link>.</p></>}
/>;}
