"use client";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/energia/riscos-formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import r from "./Riscos.module.css";
import s from "./LeiturasIntegradas.module.css";
const textoEntrada=(valor:number)=>String(Number(valor.toPrecision(12)));
export function EntradaRisco({nome,valor,min,max,passo=1,mudar}:{nome:string;valor:number;min:number;max:number;passo?:number;mudar:(v:number)=>void}){
  const tx=useTx();
  const [texto,setTexto]=useState(textoEntrada(valor));
  useEffect(()=>setTexto(textoEntrada(valor)),[valor]);
  const aplicar=(t:string)=>{setTexto(t);const n=Number(t);if(t.trim()&&Number.isFinite(n)&&n>=min&&n<=max)mudar(n);};
  return <div className={r.input}><span>{nome}</span><input aria-label={tx(`${nome} — controle deslizante`,`${nome}, slider`)} type="range" min={min} max={max} step={passo} value={valor} onChange={e=>mudar(Number(e.target.value))}/><input aria-label={nome} type="number" inputMode="decimal" min={min} max={max} step={passo} value={texto} onChange={e=>aplicar(e.target.value)} onBlur={()=>setTexto(textoEntrada(valor))}/></div>;
}
export function MetricasRisco({itens}:{itens:{nome:string;valor:string;nota:string}[]}){return <dl className={r.kpis}>{itens.map(x=><div key={x.nome}><dt>{x.nome}</dt><dd>{x.valor}</dd><small>{x.nota}</small></div>)}</dl>;}
export function BarrasRisco({linhas,unidade}:{linhas:{nome:string;valor:number}[];unidade?:string}){
  const idioma=useIdioma();const tx=useTx();
  const u=unidade??tx("R$ milhões","R$ million");
  const max=Math.max(1,...linhas.map(x=>Math.abs(x.valor)));
  return <figure><figcaption className={s.note}>{tx(`Componentes do cálculo · ${u}. Esquerda: valor negativo; direita: positivo. Escala comum a todas as linhas.`,`Calculation components · ${u}. Left: negative value; right: positive. Same scale for all rows.`)}</figcaption><div className={r.signedRows}>{linhas.map(x=><div className={r.signedRow} key={x.nome}><span>{x.nome}</span><span className={r.signedTrack} aria-hidden="true"><span className={x.valor<0?r.negative:r.positive} style={{width:`${100*Math.abs(x.valor)/max}%`}}/></span><span>{fmt(x.valor,2,idioma)}</span></div>)}</div></figure>;
}
export function ExportarRisco({nome,entrada,saida}:{nome:string;entrada:object;saida:object}){
  const tx=useTx();
  const baixar=()=>{
    window.dispatchEvent(new Event("scrutiniums:riscos-gravar"));
    const artefato={modelo:`scrutiniums-riscos-${nome}-v1`,natureza:"CENARIO_HIPOTETICO",metodo:tx("Modelos próprios, não calibrados para ativos reais. Consulte as fórmulas e limitações na página.","Own models, not calibrated to real assets. See the formulas and limitations on the page."),url:window.location.href,entrada,saida};
    const blob=new Blob([JSON.stringify(artefato,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`cenario-${nome}.json`;a.click();URL.revokeObjectURL(url);
  };
  return <button className={s.button} onClick={baixar}>{tx("Baixar premissas e resultados (JSON)","Download assumptions and results (JSON)")}</button>;
}
