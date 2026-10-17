import Link from 'next/link';
import {internacionalJudiciario as d} from '@/lib/eficiencia/judiciario/internacional-dados';
import {escore,paisesReferencia,referenciaIndicador,INDICADORES_INTERNACIONAIS,type IndicadorInternacional} from '@/lib/eficiencia/judiciario/internacional';
import {BASE_JUDICIARIO} from '@/lib/eficiencia/judiciario/modelo';
import {n} from '@/lib/eficiencia/justica/modelo';
import {SetaJudiciario} from './Editoria';
import s from './Judiciario.module.css';

const DESTAQUES:IndicadorInternacional[]=['f_7_1','f_7_5','f_7_6','f_7_2','f_8_4'];

/** Posição entre os países com valor na edição; empate recebe a mesma posição. */
function posicao(indicador:IndicadorInternacional,valor:number){
 return d.paises.filter(p=>{const v=escore(p,indicador);return v!==null&&v>valor;}).length+1;
}

export function EntradaInternacionalJudiciario(){
 const brasil=d.paises.find(p=>p.iso3==='BRA')!,outros=paisesReferencia(d.paises,'mundo',[]);
 const linhas=DESTAQUES.map(id=>{const valor=escore(brasil,id);const ref=referenciaIndicador(outros,id);const comValor=d.paises.filter(p=>escore(p,id)!==null).length;return {id,valor,mediana:ref.mediana,posicao:valor===null?null:posicao(id,valor),comValor};});
 const imparcialidade=linhas.find(l=>l.id==='f_8_4')!;
 const pos=(id:IndicadorInternacional)=>{const l=linhas.find(l=>l.id===id)!;return l.posicao===null?'posição não informada':l.posicao+'º';};
 return <section className={s.internationalTeaser} aria-labelledby="entrada-internacional-titulo"><div><p className={s.eyebrow}>Brasil e outros países · tratamento igual</p><h2 id="entrada-internacional-titulo">Todos são tratados<br/>igualmente?</h2><p>Na pesquisa do World Justice Project, o Brasil fica em {pos('f_7_1')} em acesso e custo da Justiça civil, em {pos('f_7_5')} em demora, em {pos('f_7_6')} no cumprimento das decisões e em {pos('f_8_4')} na imparcialidade do sistema criminal, entre {imparcialidade.comValor} países.</p><p>Os escores medem experiências e percepções de pesquisas domiciliares e de especialistas, de 0 a 1. Não são taxas administrativas nem meses de espera.</p><Link className={s.primaryButton} href={BASE_JUDICIARIO+'/internacional'}>Explorar a comparação internacional<SetaJudiciario/></Link></div><figure><figcaption>Posição do Brasil entre {d.cobertura.paises} países<span>Escores WJP · edição {d.edicao} · escala de 0 a 1 · referência: mediana dos outros países com valor, peso igual por país</span></figcaption><table><thead><tr><th scope="col">Subfator</th><th scope="col">Brasil</th><th scope="col">Mediana dos outros</th><th scope="col">Posição entre {d.cobertura.paises}</th></tr></thead><tbody>{linhas.map(l=><tr key={l.id} className={l.posicao!==null&&l.posicao>l.comValor*0.75?s.lowerQuartile:undefined}><th scope="row">{INDICADORES_INTERNACIONAIS[l.id].titulo}</th><td>{n(l.valor,3)}</td><td>{n(l.mediana,3)}</td><td>{l.posicao===null?'Sem valor':`${l.posicao}º`}</td></tr>)}</tbody></table><p>Linhas marcadas: Brasil no quarto inferior dos países com valor. Sem intervalo de incerteza; diferenças pequenas não demonstram significância.</p><p><a href={d.fonte.url}>Fonte: World Justice Project, Rule of Law Index, edição {d.edicao}.</a></p></figure></section>;
}
