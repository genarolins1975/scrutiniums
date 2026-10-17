import {n} from '@/lib/eficiencia/justica/modelo';
import s from './Judiciario.module.css';
export function TemposUniversosJudiciario({linhas,ano}:{linhas:{nome:string;baixados:number;pendentes:number}[];ano:number}){
 const max=Math.max(...linhas.flatMap(l=>[l.baixados,l.pendentes]));
 return <figure className={s.timeComparison}><figcaption><strong>Duas medidas. Duas histórias.</strong><span>Médias nacionais em meses · {ano} · mesma escala, de zero a {max} meses</span></figcaption>{linhas.map(l=><div key={l.nome} className={s.timeUniverse}><h3>{l.nome}</h3>{([['Baixados',l.baixados],['Pendentes',l.pendentes]] as const).map(([nome,valor],i)=><div className={s.timeRow} key={nome}><span>{nome}</span><div><i data-serie={i} style={{width:100*valor/max+'%'}}/></div><strong>{n(valor)}<small> meses</small></strong></div>)}</div>)}<p className={s.figureNote}>Baixados: duração até a primeira baixa. Pendentes: idade já decorrida no acervo, sem duração final observada. As médias descrevem grupos diferentes e não são somadas.</p></figure>;
}
