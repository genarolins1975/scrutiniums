import dados from '@/lib/contas-publicas/snapshots/custos.json';
import {moeda,numero} from '@/lib/contas-publicas/formato';
import {ORIGEM_CUSTOS} from '@/lib/contas-publicas/proveniencia';
import {ReguaCem} from './ReguaCem';
import {Proveniencia} from './Proveniencia';
export function CemReaisCustos({grupo,fora=false}:{grupo:string;fora?:boolean}){
 const linhas=dados.registros.filter(r=>r.parent===(fora?'fora-custos':grupo));
 const soma=linhas.reduce((s,r)=>s+r.ano2025,0);const pai=dados.registros.find(r=>r.id===grupo)!;
 return <figure className="cp-artifact" aria-labelledby={fora?'cem-fora':'cem-custos'}><figcaption><h3 id={fora?'cem-fora':'cem-custos'}>{fora?'Como se repartem os itens fora dos custos?':'O que compõe cada R$ 100 de custo?'}</h3><p className="cp-note">2025 · União · {fora?'repartições de receitas e outras reduções patrimoniais':pai.nome} · valores nominais.</p></figcaption><ReguaCem parcelas={linhas.map(r=>({id:r.id,nome:r.nome,valor:r.ano2025,financeiro:r.id==='financeiros'}))}/><p className="cp-note">Base da régua: {moeda(soma,'milhoes')}. {fora?'Universo separado. Esta régua não integra nem deve ser adicionada ao total de custos.':'Somente componentes do mesmo nível. Pais e filhos não são somados. Custos contábeis não equivalem a pagamentos do orçamento.'}</p><details className="cp-exact"><summary>Conferir a composição exata</summary><table className="cp-table"><caption>RFC · 2025 · R$ milhões correntes</caption><thead><tr><th scope="col">Componente</th><th scope="col">Valor</th></tr></thead><tbody>{linhas.map(r=><tr key={r.id}><th scope="row">{r.nome}</th><td>{numero(r.ano2025)}</td></tr>)}</tbody></table></details><Proveniencia {...ORIGEM_CUSTOS} referencia="2025" perimetro={fora?'União · itens fora do total de custos':`União · ${pai.nome}`}/></figure>;
}
