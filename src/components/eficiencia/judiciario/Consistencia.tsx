'use client';
import {useState} from 'react';
import {n} from '@/lib/eficiencia/justica/modelo';
import {HalteresTribunais,type LinhaHalter} from './Halteres';
import s from './Judiciario.module.css';

/** Limites binomiais do acaso para uma vara com n casos sorteados e taxa de referência p. */
export function limitesAcaso(p:number,casos:number,desvios:number){
 const dp=Math.sqrt(p*(1-p)/casos);
 return [Math.max(0,p-desvios*dp),Math.min(1,p+desvios*dp)] as const;
}

const ESCALA=[20,50,100,200,500,1000,2000,5000];
const casosDe=(posicao:number)=>Math.round(20*Math.pow(250,posicao/100));

/** Modelo didático: só a conta da variação do acaso; nenhum dado de vara real. */
export function LaboratorioConsistencia(){
 const [taxa,setTaxa]=useState(50),[posicao,setPosicao]=useState(54),[observada,setObservada]=useState(58);
 const p=taxa/100,casos=casosDe(posicao),o=observada/100;
 const [i95,s95]=limitesAcaso(p,casos,1.96),[i998,s998]=limitesAcaso(p,casos,3.09);
 const fora95=o<i95||o>s95,fora998=o<i998||o>s998;
 const W=560,H=300,E=44,D=14,T=12,B=36;
 const x=(c:number)=>E+(W-E-D)*Math.log(c/20)/Math.log(250),y=(v:number)=>H-B-(H-B-T)*v;
 const faixa=(k:number)=>{const sup:string[]=[],inf:string[]=[];for(let i=0;i<=60;i++){const c=20*Math.pow(250,i/60);const [a,b]=limitesAcaso(p,c,k);sup.push(`${x(c).toFixed(1)},${y(b).toFixed(1)}`);inf.unshift(`${x(c).toFixed(1)},${y(a).toFixed(1)}`);}return 'M'+sup.join('L')+'L'+inf.join('L')+'Z';};
 const pct=(v:number)=>n(100*v,1)+'%';
 return <section className={s.funnelLab} aria-labelledby="laboratorio-titulo">
  <div className={s.funnelControls}>
   <p className={s.eyebrow} id="laboratorio-titulo">Modelo didático · acaso ou divergência?</p>
   <label htmlFor="lab-taxa"><span>Taxa de procedência do grupo de varas<output htmlFor="lab-taxa">{taxa}%</output></span><input id="lab-taxa" type="range" min={10} max={90} value={taxa} onChange={e=>setTaxa(+e.target.value)}/></label>
   <label htmlFor="lab-casos"><span>Processos julgados pela vara<output htmlFor="lab-casos">{n(casos)}</output></span><input id="lab-casos" type="range" min={0} max={100} value={posicao} onChange={e=>setPosicao(+e.target.value)}/></label>
   <label htmlFor="lab-observada"><span>Taxa observada na vara<output htmlFor="lab-observada">{observada}%</output></span><input id="lab-observada" type="range" min={0} max={100} value={observada} onChange={e=>setObservada(+e.target.value)}/></label>
   <p role="status" className={fora95?s.funnelOut:s.funnelIn}>{!fora95?`Dentro do acaso. Com ${n(casos)} casos sorteados e taxa real de ${taxa}%, a vara fica entre ${pct(i95)} e ${pct(s95)} em 95% das vezes.`:!fora998?`Fora do limite de 95% (${pct(i95)} a ${pct(s95)}), dentro de 99,8%. Entre muitas varas, algumas caem aqui por acaso.`:`Fora de 99,8% (${pct(i998)} a ${pct(s998)}). Se os casos foram de fato sorteados, dificilmente é acaso.`}</p>
  </div>
  <figure className={s.funnelFigure}>
   <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Funil: limites do acaso em torno de ${taxa}% e a vara escolhida com ${n(casos)} casos e ${observada}%`}>
    {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={E} x2={W-D} y1={y(v)} y2={y(v)} className={s.seriesGrid}/><text x={E-6} y={y(v)+4} textAnchor="end" className={s.seriesAxis}>{n(v*100)}%</text></g>)}
    {ESCALA.map(c=><text key={c} x={x(c)} y={H-B+16} textAnchor="middle" className={s.seriesAxis}>{n(c)}</text>)}
    <path d={faixa(3.09)} className={s.funnelOuter}/><path d={faixa(1.96)} className={s.funnelInner}/>
    <line x1={E} x2={W-D} y1={y(p)} y2={y(p)} className={s.funnelReference}/>
    <circle cx={x(casos)} cy={y(o)} r={7} className={fora95?s.funnelDotOut:s.funnelDot}/>
    <text x={(E+W-D)/2} y={H-4} textAnchor="middle" className={s.seriesAxis}>Processos julgados pela vara, escala logarítmica</text>
   </svg>
   <figcaption className={s.figureNote}>Faixa escura: 95% do acaso; faixa clara: 99,8%. Limites: taxa do grupo ± 1,96 e ± 3,09 desvios padrão binomiais, √(p(1−p)/n). Supõe casos sorteados e independentes; deixa de fora acordos, extinções sem mérito, substituições de juiz e mudança de titular. Não há dado de vara real neste modelo.</figcaption>
  </figure>
 </section>;
}

type LinhaExecucao=LinhaHalter&{ramo:string};
/** Execução por tribunal, um ramo por vez: tempos têm universos próprios em cada ramo. */
export function ExecucaoTribunais({linhas,ano}:{linhas:LinhaExecucao[];ano:number}){
 const [ramo,setRamo]=useState('estadual');
 const nomes:Record<string,string>={estadual:'Tribunais de Justiça',federal:'Tribunais Regionais Federais',trabalho:'Tribunais Regionais do Trabalho'};
 return <div><div className={s.dumbbellToggle} role="group" aria-label="Escolher ramo">{Object.entries(nomes).map(([id,nome])=><button key={id} type="button" aria-pressed={ramo===id} onClick={()=>setRamo(id)}>{nome}</button>)}</div>
  <HalteresTribunais key={ramo} linhas={linhas.filter(l=>l.ramo===ramo)} titulo={`Fase de execução do primeiro grau: duração dos baixados e idade dos pendentes · ${nomes[ramo]}`} ano={ano}/></div>;
}
