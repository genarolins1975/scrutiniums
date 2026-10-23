import Link from 'next/link';
import {internacionalJudiciario as d} from '@/lib/eficiencia/judiciario/internacional-dados';
import {escore,paisesReferencia,referenciaIndicador,INDICADORES_INTERNACIONAIS,type IndicadorInternacional} from '@/lib/eficiencia/judiciario/internacional';
import {BASE_JUDICIARIO} from '@/lib/eficiencia/judiciario/modelo';
import {TabelaDados} from '@/components/painel';
import {SetaJudiciario} from './Editoria';
import s from './Judiciario.module.css';

const DESTAQUES:IndicadorInternacional[]=['f_7_1','f_7_5','f_7_6','f_7_2','f_8_4'];

/** Posição entre os países com valor na edição; empate recebe a mesma posição. */
function posicao(indicador:IndicadorInternacional,valor:number){
 return d.paises.filter(p=>{const v=escore(p,indicador);return v!==null&&v>valor;}).length+1;
}

/** Brasil, mediana dos outros países com valor e posição, por subfator: a mesma conta da entrada e dos capítulos de consistência e criminal. */
export function linhasPosicoesWjp(ids:IndicadorInternacional[]){
 const brasil=d.paises.find(p=>p.iso3==='BRA')!,outros=paisesReferencia(d.paises,'mundo',[]);
 return ids.map(id=>{const valor=escore(brasil,id);const comValor=d.paises.filter(p=>escore(p,id)!==null).length;return {id,valor,mediana:referenciaIndicador(outros,id).mediana,posicao:valor===null?null:posicao(id,valor),comValor};});
}

/**
 * A comparação internacional na entrada. Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a tabela à mão passa à TabelaDados
 * do kit, à vista como antes, com as linhas do quarto inferior destacadas (fundo de contexto, nunca cor de julgamento) e as mesmas colunas.
 */
export function EntradaInternacionalJudiciario(){
 const linhas=linhasPosicoesWjp(DESTAQUES);
 const imparcialidade=linhas.find(l=>l.id==='f_8_4')!;
 const pos=(id:IndicadorInternacional)=>{const l=linhas.find(l=>l.id===id)!;return l.posicao===null?'posição não informada':l.posicao+'º';};
 return <section className={s.internationalTeaser} aria-label="Brasil e outros países"><div><p>Na pesquisa do World Justice Project, o Brasil fica em {pos('f_7_1')} em acesso e custo da Justiça civil, em {pos('f_7_5')} em demora, em {pos('f_7_6')} no cumprimento das decisões e em {pos('f_8_4')} na imparcialidade do sistema criminal, entre {imparcialidade.comValor} países.</p><p>Os escores medem experiências e percepções de pesquisas domiciliares e de especialistas, de 0 a 1. Não são taxas administrativas nem meses de espera.</p><Link className={s.primaryButton} href={BASE_JUDICIARIO+'/internacional'}>Explorar a comparação internacional<SetaJudiciario/></Link></div>
  <div><TabelaDados recolhida={false} titulo={`Posição do Brasil entre ${d.cobertura.paises} países · escores WJP · edição ${d.edicao} · escala de 0 a 1 · referência: mediana dos outros países com valor, peso igual por país`} colunas={['Subfator','Brasil','Mediana dos outros',`Posição entre ${d.cobertura.paises}`]}
   linhas={linhas.map(l=>[INDICADORES_INTERNACIONAIS[l.id].titulo,l.valor,l.mediana,l.posicao===null?'Sem valor':`${l.posicao}º`])} casas={[null,3,3,null]} limite={linhas.length} linhasDestacadas={linhas.flatMap((l,i)=>l.posicao!==null&&l.posicao>l.comValor*0.75?[i]:[])}
   nota={<>Linhas destacadas: Brasil no quarto inferior dos países com valor. Sem intervalo de incerteza; diferenças pequenas não demonstram significância. <a className="underline" href={d.fonte.url}>Fonte: World Justice Project, Rule of Law Index, edição {d.edicao}.</a></>}/></div></section>;
}
