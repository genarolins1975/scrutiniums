import {pilotNumber as n,type createPilot} from '@/lib/eficiencia/piloto-nucleo';
import s from './PilotoResultados.module.css';
const signed=(v:number)=>`${v>1e-9?'+':''}${n(Math.abs(v)<=1e-9?0:v,2)}`;
export function EstabilidadePiloto({pilot,place,reference}:{pilot:ReturnType<typeof createPilot>;place:string;reference:string}){
 const result=pilot.pilotStability(place,reference),a=pilot.pilotRow(place),b=pilot.pilotRow(reference);
 if(!result||!a||!b)return null;
 const limit=Math.max(10,Math.ceil(Math.max(Math.abs(result.baseline),...result.families.flatMap(f=>[Math.abs(f.lower),Math.abs(f.upper)]))/10)*10);
 const position=(v:number)=>50+50*v/limit;
 return <section className={s.stability} aria-labelledby="pilot-stability-title">
  <p className={s.kicker}>Sensibilidade da comparação</p><h3 id="pilot-stability-title">A ordem entre as cidades se mantém?</h3>
  <p>{a.name} menos {b.name}: <strong>{signed(result.baseline)} pontos</strong> na cesta original. Cada hipótese é aplicada às duas cidades ao mesmo tempo.</p>
  <p className={s.note}>Faixas são diferenças observadas nas hipóteses, não intervalos de confiança. Contagens não são probabilidades. As três famílias são avaliadas separadamente.</p>
  <div className={s.stabilityLegend}><span>━ Faixa das hipóteses</span><span>◆ Cesta original</span><span>│ Zero = empate</span></div>
  {result.families.map(f=><article className={s.stabilityRow} key={f.id}>
   <div><h4>{f.name}</h4><p>{f.note}</p><strong>{f.label}</strong></div>
   <div><div className={s.stabilityPlot} aria-hidden="true"><i className={s.stabilityZero}/><i className={s.stabilityBand} style={{left:`${position(f.lower)}%`,width:`${position(f.upper)-position(f.lower)}%`}}/><i className={s.stabilityBase} style={{left:`${position(result.baseline)}%`}}/></div><div className={s.stabilityAxis} aria-hidden="true"><span>−{limit}</span><span>0</span><span>+{limit}</span></div><p className={s.stabilityRange}>Diferença: <strong>{signed(f.lower)} a {signed(f.upper)} pontos</strong></p><p className={s.note}>Escore de {a.name}: maior em {f.above}; igual em {f.ties}; menor em {f.below} de {f.scenarios.length} hipóteses.</p></div>
  </article>)}
  <details><summary>Conferir as hipóteses do par selecionado</summary><p>Valores sem arredondamento definem os estados; diferenças absolutas até 0,000000001 ponto são tratadas como empate numérico. Uma diferença exibida como 0,00 pode apenas ter sido arredondada. “Ordem mantida” vale somente para as hipóteses avaliadas e não estabelece significância estatística.</p>{result.families.map(f=><table key={f.id}><caption>{f.name} · {a.name} menos {b.name}</caption><thead><tr><th scope="col">Hipótese</th><th scope="col">Diferença (pontos)</th></tr></thead><tbody>{f.scenarios.map(x=><tr key={x.id}><th scope="row">{x.label}<small>{x.assumption}</small></th><td>{signed(x.difference)}</td></tr>)}</tbody></table>)}</details>
 </section>;
}
