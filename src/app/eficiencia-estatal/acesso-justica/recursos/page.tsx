import type {Metadata} from 'next';
import Link from 'next/link';
import {Comparador,type Medida} from '@/components/eficiencia/justica/Exploradores';
import {FiguraAnalitica,PaginaPainel,type NumeroProps} from '@/components/painel';
import {dadosJustica as d,coberturaJustica as c} from '@/lib/eficiencia/justica/dados';
import {FONTE_DEFENSORIA,fichaJustica} from '@/lib/eficiencia/justica/molde';
import {razao,totalInformado,ROTA_JUSTICA} from '@/lib/eficiencia/justica/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
export const dynamic='force-static';
export const metadata:Metadata={title:'Recursos da assistência jurídica',alternates:{canonical:ROTA_JUSTICA+'/recursos'}};
const medidas:Medida[]=[{id:'percapita',nome:'Orçamento executado por habitante',unidade:'R$ por habitante',formato:'dinheiro',nota:'Orçamento anual executado de 2024 dividido pela população estimada de 2024, agregada das comarcas da UF. Valores nominais. Não é custo por atendimento nem gasto por pessoa elegível.'},{id:'executado',nome:'Orçamento anual executado',unidade:'R$ correntes',formato:'dinheiro',nota:'Valor declarado pela Defensoria no Relatório Administrativo de 2024. Não é orçamento autorizado na LOA, nem todo o gasto público em Justiça no território. Estágios contábeis não foram reconciliados com o Siconfi.'},{id:'densidade',nome:'Defensores por 100 mil habitantes',unidade:'por 100 mil habitantes',formato:'numero',nota:'Número de defensores informado para 2024 dividido pela população estimada de 2024, vezes 100 mil. Densidade institucional, sem ajuste por elegibilidade, carga de trabalho ou distribuição intraterritorial.'},{id:'defensores',nome:'Número de defensores',unidade:'defensores',formato:'numero',nota:'Quadro declarado em 2024. Não é equivalência de jornada nem quantidade de profissionais disponíveis em cada comarca.'}];
/**
 * Recursos da assistência jurídica no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): três números na faixa do kit, a
 * comparação por UF como figura, a nota final como limite (inteira no método) e "Como a conta é feita" como o glossário da página.
 */
export default function Pagina(){const rows=d.defensorias.filter(r=>r.ano===2024);const total=totalInformado(rows.map(r=>r.executado));const pop=c.reduce((a,r)=>a+r.populacao,0);const defensores=totalInformado(rows.map(r=>r.defensores));
 const ficha=fichaJustica('defensoria',{indicador:'Orçamento executado e defensores declarados pelas Defensorias, por UF, e razões pela população',natureza:'CALCULADO',unidade:'R$ correntes; R$ por habitante; defensores; por 100 mil habitantes',inicio:'2024',fim:'2024',recurso:'Relatório Administrativo, colunas AT (orçamento executado) e D (defensores); população: soma da coluna F da aba Comarcas',formula:'Orçamento executado ÷ população da UF; defensores ÷ população da UF × 100.000',limitacoes:['Declarações institucionais, sem conciliação contábil independente nesta publicação.','A assistência jurídica prestada por outros órgãos não compõe este orçamento.']});
 return <PaginaPainel rota={ROTA_JUSTICA+'/recursos'} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.justica.nome,acento:'obee',titulo:'Que recursos sustentam a assistência?',
   lead:'Orçamento executado e quadro de defensores ajudam a descrever a capacidade institucional. A população oferece uma referência de escala; a demanda elegível e a complexidade dos casos exigiriam outros denominadores.',
   recorte:{periodo:'execução e população: 2024',universo:'Defensorias estaduais e do Distrito Federal, 27 UFs',unidade:'reais correntes e defensores',fonte:FONTE_DEFENSORIA},
   limite:'uma classificação de eficiência: são declarações institucionais sem conciliação contábil independente, e a assistência prestada por outros órgãos não entra neste orçamento.',
   fontesDatasSiglas:<p>DPU: Defensoria Pública da União. LOA: Lei Orçamentária Anual.</p>}}
  numeros={[
   // soma sem nenhuma UF informada é ausência, nunca zero
   {rotulo:'Orçamento executado declarado',...(total.valor===null?{valor:null,motivoAusencia:'Nenhuma Defensoria informou o orçamento executado.'}:{valor:total.valor/1e9}),formato:'reais',casas:2,unidade:'R$ bi',periodo:'2024',fonte:FONTE_DEFENSORIA,natureza:'CALCULADO',nota:`Soma de ${total.informados} UFs com informação · valores nominais · União excluída.`},
   {rotulo:'Por habitante, no agregado',...(razao(total.valor,pop)===null?{valor:null,motivoAusencia:'Sem orçamento ou população válidos para a razão.'}:{valor:razao(total.valor,pop)!}),formato:'reais',casas:2,unidade:'R$ por habitante',periodo:'2024',fonte:FONTE_DEFENSORIA,natureza:'CALCULADO',nota:'Razão entre a soma do orçamento e a soma da população; não é média simples das UFs.'},
   {rotulo:'Defensores informados',...(defensores.valor===null?{valor:null,motivoAusencia:'Nenhuma Defensoria informou o quadro de defensores.'}:{valor:defensores.valor}),formato:'inteiro',unidade:'defensores',periodo:'2024',fonte:FONTE_DEFENSORIA,natureza:'CALCULADO',nota:'Quadros estaduais e distrital declarados; não inclui a DPU.'},
  ] as NumeroProps[]}
  figuras={<FiguraAnalitica id="por-uf" pergunta="Recursos por UF" subtitulo="Orçamento executado, gasto por habitante e defensores · reais correntes ou contagem · 27 UFs, 2024" natureza="CALCULADO" idioma="pt" proveniencia={ficha}
   comoInterpretar="Escolha a medida, destaque uma UF e mude a ordem. Gasto por habitante e defensores por 100 mil usam a população estimada de 2024 agregada das comarcas da UF."
   naoConcluir="Comparações de recursos não sustentam uma classificação automática de eficiência: gasto por habitante não é custo por atendimento, e o quadro declarado não é jornada disponível em cada comarca."
   tabela={{naFigura:'logo abaixo das barras, com o valor exato de cada UF na medida escolhida.'}}>
   <Comparador linhas={rows.map(r=>{const p=c.find(c=>c.uf===r.uf)!.populacao;return {id:r.uf,nome:r.estado,valores:{executado:r.executado,percapita:razao(r.executado,p),defensores:r.defensores,densidade:r.defensores===null?null:r.defensores/p*1e5}};})} medidas={medidas} titulo="Recursos por UF" fonte="Pesquisa Nacional da Defensoria Pública 2025, Relatório Administrativo e Comarcas" periodo="2024"/>
  </FiguraAnalitica>}
  notas={{id:'como-a-conta',titulo:'Como a conta é feita',itens:[
   {termo:'Gasto por habitante',definicao:'Orçamento anual executado da Defensoria ÷ população da UF na base de comarcas. Numerador e denominador são de 2024.'},
   {termo:'Defensores por 100 mil',definicao:'Quadro de defensores ÷ população da UF × 100.000. O cálculo mantém o zero informado e deixa ausências sem valor.'},
  ]}}
  metodo={<><p>Comparações de recursos não sustentam uma classificação automática de eficiência. Os dados são declarações institucionais, sem conciliação contábil independente nesta publicação. A assistência jurídica prestada por outros órgãos não compõe este orçamento.</p><p>Fonte: {FONTE_DEFENSORIA}. Orçamento executado: coluna AT. Defensores: coluna D. População: soma da coluna F da aba Comarcas.</p><p>Fontes, recortes, hashes e arquivos em <Link className="underline" href={ROTA_JUSTICA+'/dados'}>Dados e métodos</Link>.</p></>}
 />;}
