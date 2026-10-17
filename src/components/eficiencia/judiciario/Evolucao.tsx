import Link from 'next/link';
import {BASE_JUDICIARIO,type PontoHistorico} from '@/lib/eficiencia/judiciario/modelo';
import {n} from '@/lib/eficiencia/justica/modelo';
import s from './Judiciario.module.css';

type Serie='tempoBaixados'|'idadePendentes';
const SERIES:[Serie,string][]=[['tempoBaixados','Duração média dos baixados'],['idadePendentes','Idade média dos pendentes']];

/** Segmentos contínuos: ausência quebra a linha, nunca é ligada por interpolação. */
function trechos(pontos:PontoHistorico[],serie:Serie,x:(i:number)=>number,y:(v:number)=>number){
 const saida:string[]=[];let atual:string[]=[];
 pontos.forEach((p,i)=>{const v=p[serie];if(v===null){if(atual.length)saida.push(atual.join(' '));atual=[];return;}atual.push(`${atual.length?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`);});
 if(atual.length)saida.push(atual.join(' '));
 return saida;
}

function Grafico({pontos,topo,largura,altura,margem,rotulos}:{pontos:PontoHistorico[];topo:number;largura:number;altura:number;margem:{e:number;d:number;t:number;b:number};rotulos:boolean}){
 const x=(i:number)=>margem.e+(largura-margem.e-margem.d)*(pontos.length===1?0.5:i/(pontos.length-1));
 const y=(v:number)=>altura-margem.b-(altura-margem.b-margem.t)*v/topo;
 const grade=rotulos?Array.from({length:topo/12+1},(_,i)=>i*12):[0,topo];
 return <svg viewBox={`0 0 ${largura} ${altura}`} className={s.seriesSvg} aria-hidden="true">
  {grade.map(v=><g key={v}><line x1={margem.e} x2={largura-margem.d} y1={y(v)} y2={y(v)} className={s.seriesGrid}/>{rotulos&&<text x={margem.e-6} y={y(v)+4} textAnchor="end" className={s.seriesAxis}>{v}</text>}</g>)}
  {rotulos&&pontos.map((p,i)=><text key={p.ano} x={x(i)} y={altura-6} textAnchor="middle" className={s.seriesAxis}>{p.ano}</text>)}
  {SERIES.map(([serie],k)=><g key={serie} data-serie={k}>
   {trechos(pontos,serie,x,y).map(d=><path key={d} d={d} className={s.seriesLine}/>)}
   {pontos.map((p,i)=>p[serie]===null?null:<circle key={p.ano} cx={x(i)} cy={y(p[serie]!)} r={rotulos?4:2.6} className={s.seriesDot}/>)}
  </g>)}
 </svg>;
}

/** Ficha: as cinco edições do tribunal, com tabela equivalente. */
export function SerieTribunal({sigla,historico,nota}:{sigla:string;historico:PontoHistorico[];nota:string}){
 const valores=historico.flatMap(p=>[p.tempoBaixados,p.idadePendentes]).filter((v):v is number=>v!==null);
 const topo=Math.max(12,Math.ceil(Math.max(...valores)/12)*12);
 return <figure className={s.seriesFigure}><figcaption><strong>{sigla}: como evoluíram as duas médias de tempo</strong><span>Meses · uma edição do Justiça em Números por ano-base · {historico[0].ano} a {historico.at(-1)!.ano}</span></figcaption>
  <p className={s.dumbbellLegend}><span><i data-serie="0" aria-hidden="true"/>Duração média dos baixados</span><span><i data-serie="1" aria-hidden="true"/>Idade média dos pendentes</span></p>
  <Grafico pontos={historico} topo={topo} largura={640} altura={240} margem={{e:36,d:16,t:12,b:30}} rotulos/>
  <div className={s.tableWrap} tabIndex={0} role="region" aria-label={`Série de tempos do ${sigla}`}><table className={s.table}><caption>{sigla} · meses · valor publicado em cada edição</caption><thead><tr><th scope="col">Ano-base</th><th scope="col">Edição</th><th scope="col">Duração média dos baixados</th><th scope="col">Idade média dos pendentes</th></tr></thead><tbody>{historico.map(p=><tr key={p.ano}><th scope="row">{p.ano}</th><td>{p.edicao}</td><td>{p.tempoBaixados===null?'Ausente':n(p.tempoBaixados)}</td><td>{p.idadePendentes===null?'Ausente':n(p.idadePendentes)}</td></tr>)}</tbody></table></div>
  <p className={s.figureNote}>{nota}</p>
 </figure>;
}

/** Pequenos múltiplos: mesma escala para todos os tribunais do ramo. */
export function MultiplosTribunais({tribunais,titulo,nota}:{tribunais:{id:string;sigla:string;historico:PontoHistorico[]}[];titulo:string;nota:string}){
 const valores=tribunais.flatMap(t=>t.historico.flatMap(p=>[p.tempoBaixados,p.idadePendentes])).filter((v):v is number=>v!==null);
 const topo=Math.ceil(Math.max(...valores)/12)*12;
 const anos=tribunais[0].historico.map(p=>p.ano);
 return <figure className={s.multiples}><figcaption><strong>{titulo}</strong><span>Meses · escala comum de 0 a {topo} · {anos[0]} a {anos.at(-1)} · valores à direita: último ano, baixados · pendentes</span></figcaption>
  <p className={s.dumbbellLegend}><span><i data-serie="0" aria-hidden="true"/>Duração média dos baixados</span><span><i data-serie="1" aria-hidden="true"/>Idade média dos pendentes</span></p>
  <ol className={s.multiplesGrid}>{tribunais.map(t=>{const ultimo=t.historico.at(-1)!,primeiro=t.historico.find(p=>p.tempoBaixados!==null);return <li key={t.id}>
   <p><Link href={BASE_JUDICIARIO+'/tribunais/'+t.id} prefetch={false}>{t.sigla}</Link><span>{n(ultimo.tempoBaixados)} · {n(ultimo.idadePendentes)}</span></p>
   <div role="img" aria-label={`${t.sigla}: baixados de ${primeiro?.tempoBaixados??'ausente'} meses em ${primeiro?.ano??''} para ${ultimo.tempoBaixados} em ${ultimo.ano}; pendentes de ${primeiro?.idadePendentes??'ausente'} para ${ultimo.idadePendentes}`}><Grafico pontos={t.historico} topo={topo} largura={160} altura={64} margem={{e:2,d:2,t:4,b:4}} rotulos={false}/></div>
  </li>;})}</ol>
  <p className={s.figureNote}>{nota}</p>
 </figure>;
}
