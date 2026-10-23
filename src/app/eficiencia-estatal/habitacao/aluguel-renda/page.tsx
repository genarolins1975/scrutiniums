import type {Metadata} from 'next';
import {Barras,Edicao,FonteFjp,LeituraBarras,RECORTE,SIGLAS,fichaFjp,tabelaBarras} from '@/components/eficiencia/habitacao/Editoria';
import {Comparacao} from '@/components/eficiencia/habitacao/Comparacao';
import {FiguraAnalitica,PaginaPainel} from '@/components/painel';
import {brasil as b,dados} from '@/lib/eficiencia/habitacao/dados';
import {MEDIDAS,ROTA,pct} from '@/lib/eficiencia/habitacao/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Habitação — aluguel e renda", "alternates": {"canonical": "/eficiencia-estatal/habitacao/aluguel-renda"}};

const FAIXAS=[{nome:'Até 1 salário mínimo',valor:b.renda1},{nome:'Mais de 1 até 2 salários mínimos',valor:b.renda2},{nome:'Mais de 2 até 3 salários mínimos',valor:b.renda3},{nome:'Mais de 3 salários mínimos',valor:b.rendaMais3}];
const DIVERGENCIA='As tabelas oficiais de renda e de déficit geral divergem em aproximadamente 546 unidades para Piauí e Ceará, em sentidos opostos. Os valores originais foram preservados. A composição por renda usa o total da própria tabela, sem redistribuição presumida entre os estados.';

/**
 * Aluguel e renda no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os três números no NumeroIndicador, a distribuição
 * por renda e a comparação territorial (o mesmo componente do déficit) cada uma numa FiguraAnalitica, a divergência entre as tabelas do
 * Piauí e do Ceará como ressalva à vista da distribuição por renda e o "o que a medida não responde" como o limite da abertura.
 */
export default function Pagina(){return <PaginaPainel rota={ROTA+'/aluguel-renda'} principal={false}
 abertura={{grupo:TEMAS_EFICIENCIA.habitacao.nome,acento:'obee',titulo:'Quando o aluguel pesa demais na renda?',
  lead:'O ônus excessivo combina duas condições: renda domiciliar de até três salários mínimos e aluguel urbano superior a 30% dessa renda. O indicador não mede o preço médio dos aluguéis.',
  recorte:RECORTE,
  limite:'inadimplência de aluguel, risco de despejo, aluguel médio ou elegibilidade a um programa. Também não identifica se auxílio-aluguel, locação social ou novas unidades seriam a resposta mais adequada para cada família.',
  fontesDatasSiglas:<><FonteFjp>Abas DH_Componentes e DH_faixa_renda.</FonteFjp><Edicao/>{SIGLAS}</>}}
 numeros={[
  {rotulo:'Domicílios com ônus excessivo',recorte:'Brasil',valor:b.aluguel,formato:'inteiro',unidade:'domicílios',periodo:String(dados.ano),fonte:'FJP, DH_Componentes',natureza:'ESTIMADO',nota:'Brasil, 2024. Classificação da FJP.'},
  {rotulo:'Participação no déficit',recorte:'Brasil',valor:pct(b.aluguel,b.deficit)!,formato:'percentual',casas:1,unidade:'%',periodo:String(dados.ano),fonte:'FJP, DH_Componentes',natureza:'CALCULADO',nota:'Não é a parcela de todos os inquilinos que têm dificuldade de pagamento.'},
  {rotulo:'Déficit com renda de até 2 salários mínimos',recorte:'Brasil',valor:pct(b.renda1+b.renda2,b.rendaTotal)!,formato:'percentual',casas:1,unidade:'%',periodo:String(dados.ano),fonte:'FJP, DH_faixa_renda',natureza:'CALCULADO',nota:'Distribuição do déficit na tabela de renda; renda domiciliar total.'},
 ]}
 figuras={<>
  <FiguraAnalitica id="renda" pergunta="A distribuição do déficit por renda." subtitulo="Participação no total da tabela de renda · % e número estimado · Brasil, 2024; faixas em salários mínimos do ano de referência" natureza="CALCULADO" idioma="pt"
   leitura={<LeituraBarras itens={FAIXAS} total={b.rendaTotal}/>} ressalva={DIVERGENCIA}
   naoConcluir="As faixas descrevem a renda domiciliar total dos domicílios em déficit, não a renda por pessoa nem a distribuição de renda de todos os domicílios do país."
   tabela={tabelaBarras(FAIXAS,b.rendaTotal,'Faixas de renda domiciliar no déficit · Brasil, 2024')}
   proveniencia={fichaFjp({indicador:'Déficit habitacional por faixa de renda domiciliar',natureza:'CALCULADO',arquivo:'deficit.xlsx',recurso:'aba DH_faixa_renda',limitacoes:[...MEDIDAS.renda.map(m=>m.nome+': '+m.nota),DIVERGENCIA]})}>
   <Barras titulo="Faixas de renda domiciliar no déficit" total={b.rendaTotal} itens={FAIXAS}/>
  </FiguraAnalitica>
  <FiguraAnalitica id="comparacao" pergunta="Aluguel e perfil de renda nos territórios." subtitulo="Ônus excessivo ou faixa de renda · % do denominador ou número estimado · 27 UFs ou 5 regiões, 2024" natureza="ESTIMADO" idioma="pt"
   comoInterpretar="O seletor permite comparar o ônus excessivo e cada faixa de renda. O denominador acompanha a medida escolhida."
   naoConcluir="A ordenação é descritiva e não atribui qualidade à gestão. O percentual do ônus excessivo é participação no déficit, não incidência entre todos os inquilinos."
   tabela={{naFigura:'logo abaixo do gráfico, com estimativa, denominador e percentual de cada território no recorte escolhido.'}}
   proveniencia={fichaFjp({indicador:'Ônus excessivo com aluguel e faixas de renda, por UF e região',natureza:'ESTIMADO',arquivo:'deficit.xlsx',recurso:'abas DH_Componentes e DH_faixa_renda',limitacoes:[...MEDIDAS.aluguel,...MEDIDAS.renda].map(m=>m.nome+': '+m.nota)})}>
   <Comparacao dados={dados.territorios} grupo="aluguel"/>
  </FiguraAnalitica>
 </>}
 metodo={<><FonteFjp>Abas DH_Componentes e DH_faixa_renda.</FonteFjp><Edicao/></>}
/>;}
