import type {Metadata} from 'next';
import {Abertura,Nota,Numeros,Secao,Fonte} from '@/components/eficiencia/habitacao/Editoria';
import {Comparacao} from '@/components/eficiencia/habitacao/Comparacao';
import {brasil as b,dados} from '@/lib/eficiencia/habitacao/dados';
import {n,pct} from '@/lib/eficiencia/habitacao/modelo';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Habitação — déficit habitacional", "alternates": {"canonical": "/eficiencia-estatal/habitacao/deficit"}};
export default function Pagina(){return <><Abertura titulo="Onde se concentram as necessidades de moradia?" texto="O número estimado dimensiona o problema. O percentual usa os domicílios particulares ocupados como referência. Compare as duas leituras antes de interpretar diferenças entre estados."/>
<Numeros itens={[{titulo:'Déficit habitacional — Brasil',valor:n(b.deficit),nota:'Estimativa de 2024; valores exibidos arredondados à unidade.'},{titulo:'Déficit relativo',valor:n(pct(b.deficit,b.domicilios),1)+'%',nota:'Denominador: '+n(b.domicilios)+' domicílios particulares ocupados.'},{titulo:'Parcela urbana do déficit',valor:n(pct(b.urbano,b.deficit),1)+'%',nota:n(b.urbano)+' na área urbana; '+n(b.rural)+' na rural.'}]}/>
<Fonte>Abas Deficit_habitacional e Total_domicilios_ocupados.</Fonte>
<Secao titulo="Tamanho, proporção e composição." texto="Alterne o indicador, a unidade e o nível territorial. A ordenação é descritiva e não atribui qualidade à gestão."><Comparacao dados={dados.territorios} grupo="deficit"/><Fonte/></Secao>
<Secao titulo="Três conceitos que não são equivalentes."><dl className="grid gap-8 md:grid-cols-3">{[['Habitação precária','Domicílios improvisados e rústicos. A precariedade é definida pelos critérios da fonte, não pela aparência de uma área.'],['Coabitação','Cômodos e unidades domésticas conviventes que atendem aos critérios de déficit. Morar com parentes, por si só, não caracteriza déficit.'],['Ônus excessivo','Aluguel urbano acima de 30% da renda em domicílios com renda de até três salários mínimos. É uma medida de acesso econômico.']].map(([t,x])=><div key={t}><dt className="font-serif text-xl">{t}</dt><dd className="mt-3 text-sm leading-relaxed">{x}</dd></div>)}</dl></Secao>
<Nota>A FJP aplica uma sequência de classificação para evitar duplicidades entre componentes, com tratamento próprio das unidades domésticas conviventes. Por isso, o déficit não é uma contagem de pessoas nem uma lista de famílias cadastradas em programas.</Nota></>}
