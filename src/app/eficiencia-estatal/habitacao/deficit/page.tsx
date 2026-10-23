import type {Metadata} from 'next';
import Link from 'next/link';
import {Comparacao} from '@/components/eficiencia/habitacao/Comparacao';
import {FiguraAnalitica,PaginaPainel} from '@/components/painel';
import {brasil as b,dados} from '@/lib/eficiencia/habitacao/dados';
import {MEDIDAS,ROTA,n,pct} from '@/lib/eficiencia/habitacao/modelo';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBR} from '@/lib/painel/formato';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Habitação — déficit habitacional", "alternates": {"canonical": "/eficiencia-estatal/habitacao/deficit"}};

const FJP='https://fjp.mg.gov.br/deficit-habitacional-no-brasil/';
const planilha=dados.fontes.find(f=>f.arquivo==='deficit.xlsx')!;
/** Ficha "Sobre este dado" da comparação: a planilha do déficit lida pelo snapshot, com hash e captura; a licença não está registrada. */
const ficha=fichaDaFigura({
 indicador:'Déficit habitacional e componentes, por UF e região',natureza:'ESTIMADO',orgao:'Fundação João Pinheiro',conjunto:'Déficit habitacional no Brasil, estimativas '+dados.ano,
 recurso:planilha.arquivo+', abas Deficit_habitacional, Total_domicilios_ocupados e DH_Componentes',url:FJP,urlArquivo:planilha.url,unidade:'domicílios estimados e % do denominador declarado',
 frequencia:'Edição única nesta base',referencia:{inicio:String(dados.ano),fim:String(dados.ano)},capturadoEm:dados.capturadoEm,sha256:planilha.sha256,snapshot:'public/eficiencia/habitacao/snapshot.json',versao:'snapshot da habitação, versão '+dados.versao,
 transformacoes:['Percentual calculado como razão entre a estimativa e o denominador da mesma base (razão de totais, não média simples das UFs).'],
 limitacoes:MEDIDAS.deficit.map(m=>m.nome+': '+m.nota),notas:'FJP, '+dados.edicao+'. Estimativas a partir da Pnad Contínua/IBGE e do CadÚnico no componente de improvisados.',
});

/** Fonte da página, por extenso: a mesma frase do rodapé de antes, agora no bloco recolhido da abertura e no método. */
function FonteExtenso(){return <p>Fonte: <a className="underline" href={FJP}>Fundação João Pinheiro, estimativas 2024</a>, a partir da Pnad Contínua/IBGE e do CadÚnico no componente de improvisados. Abas Deficit_habitacional e Total_domicilios_ocupados. <Link className="underline" href={ROTA+'/dados'}>Fontes, localizadores e arquivos.</Link></p>;}

// molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): abertura com recorte e limite, os três números no NumeroIndicador,
// a comparação numa FiguraAnalitica, os três conceitos no ParaLer e a fonte por extenso no método; nenhum texto ou número mudou
export default function Pagina(){return <PaginaPainel rota={ROTA+'/deficit'} principal={false}
 abertura={{grupo:TEMAS_EFICIENCIA.habitacao.nome,acento:'obee',titulo:'Onde se concentram as necessidades de moradia?',
  lead:'O número estimado dimensiona o problema. O percentual usa os domicílios particulares ocupados como referência. Compare as duas leituras antes de interpretar diferenças entre estados.',
  recorte:{periodo:'referência '+dados.ano,universo:'Brasil, regiões e 27 UFs',unidade:'domicílios estimados e %',fonte:'FJP, edição 2026'},
  limite:'quantas pessoas estão sem moradia nem quem está numa fila de atendimento: o déficit é uma estimativa de necessidades habitacionais, calculada pela FJP, e não equivale a pessoas nem a famílias cadastradas em programas.',
  fontesDatasSiglas:<><FonteExtenso/><p>Edição: {dados.edicao}. Captura pela Scrutiniums em {dataBR(dados.capturadoEm,'pt')}.</p><p>FJP: Fundação João Pinheiro. Pnad Contínua: Pesquisa Nacional por Amostra de Domicílios Contínua, do IBGE. CadÚnico: Cadastro Único para Programas Sociais.</p></>}}
 numeros={[
  {rotulo:'Déficit habitacional',recorte:'Brasil',valor:b.deficit,formato:'inteiro',unidade:'domicílios',periodo:String(dados.ano),fonte:'FJP, Deficit_habitacional',natureza:'ESTIMADO',nota:'Estimativa de 2024; valores exibidos arredondados à unidade.'},
  {rotulo:'Déficit relativo',recorte:'Brasil',valor:pct(b.deficit,b.domicilios)!,formato:'percentual',casas:1,unidade:'%',periodo:String(dados.ano),fonte:'FJP, Deficit_habitacional e Total_domicilios_ocupados',natureza:'CALCULADO',nota:'Denominador: '+n(b.domicilios)+' domicílios particulares ocupados.'},
  {rotulo:'Parcela urbana do déficit',recorte:'Brasil',valor:pct(b.urbano,b.deficit)!,formato:'percentual',casas:1,unidade:'%',periodo:String(dados.ano),fonte:'FJP, Deficit_habitacional',natureza:'CALCULADO',nota:n(b.urbano)+' na área urbana; '+n(b.rural)+' na rural.'},
 ]}
 figuras={<FiguraAnalitica id="comparacao" pergunta="Tamanho, proporção e composição" subtitulo="Indicador do déficit · % do denominador ou número estimado · 27 UFs ou 5 regiões, 2024" natureza="ESTIMADO" idioma="pt"
  comoInterpretar="Alterne o indicador, a unidade e o nível territorial. A ordenação é descritiva e não atribui qualidade à gestão."
  naoConcluir="A ordenação é descritiva e não atribui qualidade à gestão. O déficit não é uma contagem de pessoas nem uma lista de famílias cadastradas em programas."
  tabela={{naFigura:'logo abaixo do gráfico, com estimativa, denominador e percentual de cada território no recorte escolhido.'}} proveniencia={ficha}>
  <Comparacao dados={dados.territorios} grupo="deficit"/>
 </FiguraAnalitica>}
 notas={{id:'conceitos',titulo:'Três conceitos que não são equivalentes',itens:[
  {termo:'Habitação precária',definicao:'Domicílios improvisados e rústicos. A precariedade é definida pelos critérios da fonte, não pela aparência de uma área.'},
  {termo:'Coabitação',definicao:'Cômodos e unidades domésticas conviventes que atendem aos critérios de déficit. Morar com parentes, por si só, não caracteriza déficit.'},
  {termo:'Ônus excessivo',definicao:'Aluguel urbano acima de 30% da renda em domicílios com renda de até três salários mínimos. É uma medida de acesso econômico.'},
 ],nota:'A FJP aplica uma sequência de classificação para evitar duplicidades entre componentes, com tratamento próprio das unidades domésticas conviventes. Por isso, o déficit não é uma contagem de pessoas nem uma lista de famílias cadastradas em programas.'}}
 metodo={<><FonteExtenso/><p>Edição: {dados.edicao}. Captura pela Scrutiniums em {dataBR(dados.capturadoEm,'pt')}. Os arquivos originais, os localizadores de cada célula e os hashes estão em <Link className="underline" href={ROTA+'/dados'}>Dados e métodos</Link>.</p></>}
/>;}
