'use client';
import {useEffect,useRef,useState} from 'react';
import {COLUNAS_INTERNACIONAIS,INDICADORES_INTERNACIONAIS,segmentosHistoricos,type PaisInternacional,type IndicadorInternacional,type HistoricoInternacional} from '@/lib/eficiencia/judiciario/internacional';
import {csvJudiciario} from '@/lib/eficiencia/judiciario/modelo';
import {n} from '@/lib/eficiencia/justica/modelo';
import s from './Internacional.module.css';

export function baixarCsvInternacional(nome:string,conteudo:string){
 const url=URL.createObjectURL(new Blob([conteudo],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const cores=['var(--cor-obee)','var(--cor-obee-atlas-serie-par)','var(--cor-obee-atlas-linha-inversa)','var(--cor-obee-tinta)'];
const tracos=['','7 4','2 4','10 3 2 3'];
export function EvolucaoInternacional({paises,indicador,fonte}:{paises:PaisInternacional[];indicador:IndicadorInternacional;fonte:string}){
 const [historico,setHistorico]=useState<HistoricoInternacional|null>(null);
 const [estado,setEstado]=useState<'inicial'|'carregando'|'erro'|'pronto'>('inicial');
 const controller=useRef<AbortController|null>(null);
 const destino=useRef<HTMLElement|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{if(estado==='pronto')destino.current?.focus({preventScroll:true});},[estado]);
 async function carregar(){
  controller.current?.abort();const atual=new AbortController();controller.current=atual;setEstado('carregando');
  try{
   const resposta=await fetch('/eficiencia/judiciario/internacional-historico.json',{signal:atual.signal,credentials:'same-origin'});
   if(!resposta.ok)throw new Error('Resposta indisponível');
   const dados=await resposta.json() as HistoricoInternacional;
   if(dados.versao!=='judiciario-internacional-1'||dados.colunas.join('|')!==COLUNAS_INTERNACIONAIS.join('|')||!Array.isArray(dados.observacoes)||!dados.edicoes.length)throw new Error('Série incompatível');
   if(dados.observacoes.some(r=>!dados.edicoes.includes(r.edicao)||r.escores.length!==COLUNAS_INTERNACIONAIS.length||r.escores.some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>1))))throw new Error('Série inválida');
   setHistorico(dados);setEstado('pronto');
  }catch{if(!atual.signal.aborted)setEstado('erro');}
 }
 const m=INDICADORES_INTERNACIONAIS[indicador];
 const linhas=historico?paises.flatMap(p=>historico.edicoes.map(edicao=>({pais:p,edicao,valor:historico.observacoes.find(r=>r.iso3===p.iso3&&r.edicao===edicao)?.escores[COLUNAS_INTERNACIONAIS.indexOf(indicador)]??null}))):[];
 return <section className={s.history} aria-labelledby="evolucao-internacional-titulo" aria-busy={estado==='carregando'}>
  <div className={s.sectionHeading}><div><p className={s.eyebrow}>A experiência muda ao longo do tempo?</p><h2 id="evolucao-internacional-titulo">Veja a trajetória.<br/>Além da fotografia.</h2></div><p>A série acompanha o mesmo indicador dos países selecionados. Edições sem informação permanecem como lacunas.</p></div>
  {!historico&&<div className={s.historyLoad}><p>Explore as edições de 2015 a 2025, com os rótulos originais. A edição conjunta 2017–2018 conta uma vez.</p><button className={s.button} disabled={estado==='carregando'} onClick={carregar}>{estado==='carregando'?'Carregando evolução…':estado==='erro'?'Tentar carregar novamente':'Explorar evolução histórica'}</button>{estado==='erro'&&<p role="alert">Não foi possível carregar a série. Tente novamente; se a sessão tiver terminado, entre de novo na sua conta.</p>}</div>}
  {historico&&<><figure ref={destino} tabIndex={-1} aria-label="Histórico internacional carregado" className={s.historyFigure}><figcaption><strong>{m.titulo}</strong><span>Edições {historico.edicoes[0]}–{historico.edicoes.at(-1)} · escores WJP · escala fixa de 0 a 1</span></figcaption><div className={s.historyLegend}>{paises.map((p,i)=><span key={p.iso3}><svg width="30" height="10" aria-hidden="true"><path d="M0 5h30" stroke={cores[i]} strokeWidth="3" strokeDasharray={tracos[i]}/></svg>{p.nome}</span>)}</div>
   {[true,false].map(mobile=>{
    const width=mobile?320:840,left=mobile?36:48,right=width-24,top=20,bottom=mobile?220:300;
    const first=Number(historico.edicoes[0].split('-').at(-1)),last=Number(historico.edicoes.at(-1)!.split('-').at(-1));
    const x=(ano:number)=>left+(ano-first)*(right-left)/(last-first),y=(v:number)=>bottom-v*(bottom-top);
    return <svg key={String(mobile)} className={mobile?s.historyMobile:s.historyDesktop} viewBox={`0 0 ${width} ${bottom+42}`} role="img" aria-label={`${m.titulo}: evolução dos escores de ${paises.map(p=>p.nome).join(', ')}; valores por edição na tabela equivalente.`}>
     {[0,.5,1].map(v=><g key={v}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="var(--cor-linha)"/><text x={left-8} y={y(v)+5} textAnchor="end" fill="currentColor" fontSize={mobile?18:14}>{n(v,1)}</text></g>)}
     {(mobile?[first,2020,last]:[first,2018,2020,2022,last]).map(ano=><text key={ano} x={x(ano)} y={bottom+28} textAnchor="middle" fill="currentColor" fontSize={mobile?18:14}>{ano}</text>)}
     {paises.map((p,i)=><g key={p.iso3}>{segmentosHistoricos(historico,p.iso3,indicador).map((segmento,index)=><g key={index}><polyline points={segmento.map(v=>`${x(v.anoFinal)},${y(v.valor)}`).join(' ')} fill="none" stroke={cores[i]} strokeWidth={i===0?3:2} strokeDasharray={tracos[i]}/>{segmento.map(v=><circle key={v.edicao} cx={x(v.anoFinal)} cy={y(v.valor)} r={i===0?4:3} fill={cores[i]}><title>{`${p.nome} · ${v.edicao}: ${n(v.valor,3)}`}</title></circle>)}</g>)}</g>)}
    </svg>;
   })}<p className={s.note}>Pontuações por edição, não resultados de uma mesma coorte de pessoas. A edição 2017–2018 ocupa um único ponto em 2018; o rótulo completo está na tabela. Não se atribui uma mudança a determinada reforma.</p></figure>
   <details className={s.details}><summary>Ver valores por país e edição</summary><div className={s.tableWrap} tabIndex={0} role="region" aria-label="Tabela histórica dos países selecionados"><table><caption>{m.titulo} · escores de 0 a 1 · edições WJP</caption><thead><tr><th scope="col">País/jurisdição</th><th scope="col">Edição</th><th scope="col">Escore</th></tr></thead><tbody>{linhas.map(r=><tr key={r.pais.iso3+r.edicao}><th scope="row">{r.pais.nome}</th><td>{r.edicao}</td><td>{r.valor===null?'Não disponível':n(r.valor,3)}</td></tr>)}</tbody></table></div></details>
   <button className={s.button} onClick={()=>baixarCsvInternacional('judiciario-internacional-historico-'+indicador+'.csv',csvJudiciario(['ISO3','País/jurisdição','Edição WJP','Indicador','Valor','Unidade','Estado','Fonte'],linhas.map(r=>[r.pais.iso3,r.pais.nome,r.edicao,indicador,r.valor,'escore de 0 a 1',r.valor===null?'AUSENTE':'PUBLICADO',fonte])))}>Baixar histórico dos países selecionados CSV</button>
  </>}
 </section>;
}
