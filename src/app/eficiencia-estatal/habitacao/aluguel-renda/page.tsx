import type {Metadata} from 'next';
import {Abertura,Nota,Numeros,Secao,Fonte,Barras} from '@/components/eficiencia/habitacao/Editoria';
import {Comparacao} from '@/components/eficiencia/habitacao/Comparacao';
import {brasil as b,dados} from '@/lib/eficiencia/habitacao/dados';
import {n,pct} from '@/lib/eficiencia/habitacao/modelo';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Habitação — aluguel e renda", "alternates": {"canonical": "/eficiencia-estatal/habitacao/aluguel-renda"}};
export default function Pagina(){return <><Abertura numero="03" titulo="Quando o aluguel pesa demais na renda?" texto="O ônus excessivo combina duas condições: renda domiciliar de até três salários mínimos e aluguel urbano superior a 30% dessa renda. O indicador não mede o preço médio dos aluguéis."/>
<Numeros itens={[{titulo:'Domicílios com ônus excessivo',valor:n(b.aluguel),nota:'Brasil, 2024. Classificação da FJP.'},{titulo:'Participação no déficit',valor:n(pct(b.aluguel,b.deficit),1)+'%',nota:'Não é a parcela de todos os inquilinos que têm dificuldade de pagamento.'},{titulo:'Déficit com renda de até 2 salários mínimos',valor:n(pct(b.renda1+b.renda2,b.rendaTotal),1)+'%',nota:'Distribuição do déficit na tabela de renda; renda domiciliar total.'}]}/>
<Fonte>Abas DH_Componentes e DH_faixa_renda.</Fonte>
<Secao titulo="A distribuição do déficit por renda." texto="Brasil, 2024. Participações no total da tabela de renda; faixas em salários mínimos do ano de referência."><Barras titulo="Faixas de renda domiciliar no déficit" total={b.rendaTotal} itens={[{nome:'Até 1 salário mínimo',valor:b.renda1},{nome:'Mais de 1 até 2 salários mínimos',valor:b.renda2},{nome:'Mais de 2 até 3 salários mínimos',valor:b.renda3},{nome:'Mais de 3 salários mínimos',valor:b.rendaMais3}]}/><Fonte/></Secao>
<Secao titulo="Aluguel e perfil de renda nos territórios." texto="O seletor permite comparar o ônus excessivo e cada faixa de renda. O denominador acompanha a medida escolhida."><Comparacao dados={dados.territorios} grupo="aluguel"/><Fonte/></Secao>
<Nota>As tabelas oficiais de renda e de déficit geral divergem em aproximadamente 546 unidades para Piauí e Ceará, em sentidos opostos. Os valores originais foram preservados. A composição por renda usa o total da própria tabela, sem redistribuição presumida entre os estados.</Nota>
<Secao titulo="O que a medida não responde?"><p className="max-w-prose2 text-sm leading-relaxed">Não informa inadimplência de aluguel, risco de despejo, aluguel médio ou elegibilidade a um programa. Também não identifica se auxílio-aluguel, locação social ou novas unidades seriam a resposta mais adequada para cada família.</p></Secao></>}
