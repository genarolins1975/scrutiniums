import type {Metadata} from 'next';
import {Barras,Edicao,FonteFjp,LeituraBarras,RECORTE,SIGLAS,fichaFjp,tabelaBarras} from '@/components/eficiencia/habitacao/Editoria';
import {Comparacao} from '@/components/eficiencia/habitacao/Comparacao';
import {FiguraAnalitica,PaginaPainel} from '@/components/painel';
import {brasil as b,dados} from '@/lib/eficiencia/habitacao/dados';
import {MEDIDAS,ROTA,n,pct} from '@/lib/eficiencia/habitacao/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Habitação — condições da moradia", "alternates": {"canonical": "/eficiencia-estatal/habitacao/inadequacao"}};

const DIMENSOES=[{nome:'Infraestrutura urbana',valor:b.infraestrutura},{nome:'Condições da edificação',valor:b.edilicia},{nome:'Situação fundiária',valor:b.fundiaria}];
const SOBREPOSICAO='Os componentes se sobrepõem. Somar infraestrutura, edificação e situação fundiária contaria alguns domicílios mais de uma vez. O universo exclui áreas rurais e os componentes improvisados, rústicos e cômodos do déficit; pode incluir domicílios com ônus excessivo de aluguel.';
const FUNDIARIA=<>A aba Inadeq_Fundiária da planilha contém apenas inadequação fundiária exclusiva: {n(b.fundiariaExclusiva)} domicílios no Brasil. O total usado neste painel, {n(b.fundiaria)}, vem da tabela 30 do relatório e inclui domicílios com outras carências. Ambos são preservados nos arquivos abertos.</>;

/**
 * Condições da moradia no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os três números no NumeroIndicador, a nota de
 * sobreposição junto da faixa, as três dimensões (barras do kit, sem somar) e a comparação territorial (o mesmo componente do déficit)
 * cada uma numa FiguraAnalitica, a nota da inadequação fundiária exclusiva como ressalva à vista das dimensões e as três definições no
 * ParaLer. A fundiária total vem do relatório, não da planilha: a figura cita as duas fichas.
 */
export default function Pagina(){return <PaginaPainel rota={ROTA+'/inadequacao'} principal={false}
 abertura={{grupo:TEMAS_EFICIENCIA.habitacao.nome,acento:'obee',titulo:'A casa existe. Em que condições?',
  lead:'A inadequação descreve carências em domicílios duráveis urbanos. Infraestrutura, edificação e situação fundiária podem exigir melhorias diferentes e coexistir na mesma moradia.',
  recorte:RECORTE,
  limite:'a soma das três dimensões como total de domicílios com carência: os componentes se sobrepõem, e o universo exclui áreas rurais e os componentes improvisados, rústicos e cômodos do déficit.',
  fontesDatasSiglas:<><FonteFjp/><Edicao/>{SIGLAS}</>}}
 numeros={[
  {rotulo:'Com alguma inadequação',recorte:'Brasil',valor:b.inadequados,formato:'inteiro',unidade:'domicílios',periodo:String(dados.ano),fonte:'FJP, planilha Inadequação',natureza:'ESTIMADO',nota:'Domicílios duráveis urbanos em 2024; contados uma vez no total.'},
  {rotulo:'Parcela do universo analisado',recorte:'Brasil',valor:pct(b.inadequados,b.urbanosDuraveis)!,formato:'percentual',casas:1,unidade:'%',periodo:String(dados.ano),fonte:'FJP, planilha Inadequação',natureza:'CALCULADO',nota:'Base: '+n(b.urbanosDuraveis)+' domicílios duráveis urbanos.'},
  {rotulo:'Inadequação fundiária total',recorte:'Brasil',valor:b.fundiaria,formato:'inteiro',unidade:'domicílios',periodo:String(dados.ano),fonte:'FJP, relatório Inadequação, tabela 30',natureza:'ESTIMADO',nota:'Inclui coexistência com outras carências; tabela 30 do relatório.'},
 ]}
 notaNumeros={SOBREPOSICAO}
 figuras={<>
  <FiguraAnalitica id="dimensoes" pergunta="Quais dimensões da moradia precisam de melhoria?" subtitulo="% dos domicílios duráveis urbanos e número estimado · Brasil, 2024, sem somar categorias" natureza="CALCULADO" idioma="pt"
   leitura={<LeituraBarras itens={DIMENSOES} total={b.urbanosDuraveis}/>} ressalva={FUNDIARIA}
   naoConcluir="As três dimensões se sobrepõem: somá-las contaria alguns domicílios mais de uma vez. Cada percentual descreve carências pelos critérios da FJP, não a avaliação dos prestadores nem a situação documental de cada imóvel."
   tabela={tabelaBarras(DIMENSOES,b.urbanosDuraveis,'Dimensões da inadequação · Brasil, 2024')}
   proveniencia={fichaFjp({indicador:'Dimensões da inadequação de domicílios',natureza:'CALCULADO',arquivo:'inadequacao.xlsx',recurso:'abas Inadequação_de_Infraestrutura e Inadequação_Edilícias',transformacoes:['Percentual calculado sobre os domicílios duráveis urbanos (aba Domicílios_urbanos_duráveis); as dimensões não se somam.'],limitacoes:[SOBREPOSICAO]})}
   complementares={[{rotulo:'Sobre a fundiária total (relatório, tabela 30)',p:fichaFjp({indicador:'Inadequação fundiária total',natureza:'ESTIMADO',arquivo:'inadequacao.pdf',recurso:'tabela 30, pp. 87–89 (numeração impressa)',transformacoes:[],limitacoes:['Inclui domicílios com outras carências; a aba Inadeq_Fundiária da planilha traz só os casos exclusivamente fundiários.']})}]}
   extraFonte="Fundiária: relatório, tabela 30; demais: planilha Inadequação.">
   <Barras titulo="Dimensões da inadequação" total={b.urbanosDuraveis} somaveis={false} itens={DIMENSOES}/>
  </FiguraAnalitica>
  <FiguraAnalitica id="comparacao" pergunta="Do total às carências específicas." subtitulo="Indicador da inadequação · % dos domicílios duráveis urbanos ou número estimado · 27 UFs ou 5 regiões, 2024" natureza="ESTIMADO" idioma="pt"
   comoInterpretar="Explore água, esgoto, energia, coleta de lixo, banheiro, piso, cobertura e outras condições. Cada medida segue os critérios da FJP."
   naoConcluir="A ordenação é descritiva e não atribui qualidade à gestão. Infraestrutura urbana não representa a avaliação completa dos prestadores desses serviços."
   tabela={{naFigura:'logo abaixo do gráfico, com estimativa, denominador e percentual de cada território no recorte escolhido.'}}
   proveniencia={fichaFjp({indicador:'Inadequação de domicílios e carências específicas, por UF e região',natureza:'ESTIMADO',arquivo:'inadequacao.xlsx',recurso:'abas de cada carência, linha do território',limitacoes:MEDIDAS.inadequacao.map(m=>m.nome+': '+m.nota)})}>
   <Comparacao dados={dados.territorios} grupo="inadequacao"/>
  </FiguraAnalitica>
 </>}
 notas={{id:'tres-dimensoes',titulo:'Como interpretar as três dimensões?',itens:[
  {termo:'Infraestrutura urbana',definicao:'Abastecimento de água, esgotamento, coleta de lixo e energia elétrica segundo os critérios da pesquisa. Não representa a avaliação completa dos prestadores desses serviços.'},
  {termo:'Edificação',definicao:'Armazenamento de água, cômodos usados como dormitório, cobertura, banheiro exclusivo e piso. Diferentes problemas podem ocorrer juntos.'},
  {termo:'Situação fundiária',definicao:'A posse da moradia não corresponde à propriedade total ou parcial do terreno ou de sua fração ideal. O indicador não substitui análise documental individual.'},
 ]}}
 metodo={<><FonteFjp>Fundiária: relatório, tabela 30; demais: planilha Inadequação.</FonteFjp><Edicao/></>}
/>;}
