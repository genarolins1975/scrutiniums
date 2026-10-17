'use client';
import Link from 'next/link';
import {useState} from 'react';
import {BASE_JUDICIARIO,MEDIDAS_TRIBUNAL,medianaDasMedias,type MedidaTribunal} from '@/lib/eficiencia/judiciario/modelo';
import {n} from '@/lib/eficiencia/justica/modelo';
import s from './Judiciario.module.css';

export type LinhaHalter={id:string;sigla:string;uf:string|null;tempoBaixados:number;idadePendentes:number};

/** As duas médias de tempo sempre juntas: a duração dos baixados sozinha penaliza quem encerra acervo antigo. */
export function HalteresTribunais({linhas,medida:inicial='tempoBaixados',selecionados=[],alternar=false,titulo,ano}:{linhas:LinhaHalter[];medida?:MedidaTribunal;selecionados?:string[];alternar?:boolean;titulo:string;ano:number}){
 const [escolhida,setEscolhida]=useState<MedidaTribunal>(inicial);
 const medida=alternar?escolhida:inicial,outra:MedidaTribunal=medida==='tempoBaixados'?'idadePendentes':'tempoBaixados';
 const ordenadas=[...linhas].sort((a,b)=>a[medida]-b[medida]||a[outra]-b[outra]||a.sigla.localeCompare(b.sigla,'pt-BR'));
 const topo=Math.max(10,Math.ceil(Math.max(...linhas.flatMap(l=>[l.tempoBaixados,l.idadePendentes]))/10)*10);
 const mediana=medianaDasMedias(linhas.map(l=>l[medida]));
 const x=(v:number)=>100*v/topo+'%';
 const marcas=Array.from({length:topo/10+1},(_,i)=>i*10);
 return <figure className={s.dumbbell}>
  <figcaption><strong>{titulo}</strong><span>{linhas.length} tribunais · {ano} · meses · ordenados pela {MEDIDAS_TRIBUNAL[medida].titulo.toLocaleLowerCase('pt-BR')}</span></figcaption>
  {alternar&&<div className={s.dumbbellToggle} role="group" aria-label="Ordenar tribunais">{(['tempoBaixados','idadePendentes'] as const).map(m=><button key={m} type="button" aria-pressed={medida===m} onClick={()=>setEscolhida(m)}>Ordenar pela {m==='tempoBaixados'?'duração dos baixados':'idade dos pendentes'}</button>)}</div>}
  <p className={s.dumbbellLegend}><span><i data-serie="0" aria-hidden="true"/>Duração média dos baixados</span><span><i data-serie="1" aria-hidden="true"/>Idade média dos pendentes</span><span><i data-serie="mediana" aria-hidden="true"/>Mediana das médias · {n(mediana,mediana!==null&&mediana%1?1:0)} meses</span></p>
  <div className={s.dumbbellAxis} aria-hidden="true"><span/><div>{marcas.map(v=><b key={v} style={{left:x(v)}}>{v}</b>)}</div><span/></div>
  <ol className={s.dumbbellRows}>{ordenadas.map(l=>{const menor=Math.min(l.tempoBaixados,l.idadePendentes),maior=Math.max(l.tempoBaixados,l.idadePendentes);return <li key={l.id} className={selecionados.includes(l.id)?s.selected:undefined}>
   <Link href={BASE_JUDICIARIO+'/tribunais/'+l.id}>{l.sigla}</Link>
   <div className={s.dumbbellTrack} role="img" aria-label={`${l.sigla}: baixados duraram ${l.tempoBaixados} meses; pendentes têm ${l.idadePendentes} meses`}>
    {mediana!==null&&<span className={s.dumbbellMedian} style={{left:x(mediana)}}/>}
    <span className={s.dumbbellLink} style={{left:x(menor),width:100*(maior-menor)/topo+'%'}}/>
    <span className={s.dumbbellDot} data-serie="1" style={{left:x(l.idadePendentes)}}/>
    <span className={s.dumbbellDot} data-serie="0" style={{left:x(l.tempoBaixados)}}/>
   </div>
   <span className={s.dumbbellValues}>{l.tempoBaixados}<small> · {l.idadePendentes}</small></span>
  </li>;})}</ol>
  <p className={s.figureNote}>Cada linha liga as duas médias publicadas do tribunal; valores à direita: baixados · pendentes. Escala comum de zero a {topo} meses. Médias, não medianas; assuntos e proporção de execuções não controlados. Quando os baixados superam os pendentes, o tribunal encerrou processos mais antigos que o acervo restante.</p>
 </figure>;
}
