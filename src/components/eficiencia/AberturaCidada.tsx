'use client';
import dados from '@/lib/eficiencia/atlas-resumo.json';
import panorama from '@/lib/eficiencia/panorama-atlas.json';
import {panoramaPair,panoramaValue} from './PanoramaTerritorial';
import {IconeEstado} from '@/components/observatorios/TrilhasEstado';
import styles from '@/components/observatorios/EntradaEstado.module.css';

type Selection={scope:'cidades'|'regioes';place:string;reference:string;metric:'frequencia'|'saeb';age:string;perspective?:string};
export function AberturaCidada({selection,onSelect}:{selection:Selection;onSelect:(s:Selection)=>void}){
 const city=selection.scope==='cidades';
 const pool=city?dados.cities:dados.regions.filter(r=>r.id!=='Brasil');
 const a=pool.find(p=>p.id===selection.place)!,b=pool.find(p=>p.id===selection.reference)!;
 const metric=panorama.metrics.find(m=>m.id===selection.perspective)??panorama.metrics[0];
 const pair=panoramaPair(a.id,b.id,metric);
 const values=city?[pair.a,pair.b]:[a.value,b.value];
 const max=city?metric.scaleMax:100, unit=city?metric.unit:'%';
 const title=city?metric.title:'Domicílios com segurança alimentar';
 return <section className={styles.opening} aria-labelledby="titulo-eficiencia"><div><p className={styles.eyebrow}>Eficiência Estatal / Atlas do cidadão</p><h1 id="titulo-eficiencia" className={styles.title}>O Estado<br/>na <em>sua vida.</em></h1><p className={styles.lead}>Da escola ao trabalho, da saúde à moradia. Explore os serviços públicos e as condições de vida, com referências para entender cada território.</p><div className={styles.actions}><a className={styles.primary} href="#dados-publicados">Encontrar um tema <span aria-hidden="true">→</span></a><a href={city?'#atlas-panorama':'#atlas-comparacao'}>Comparar territórios ↓</a></div><div className={styles.readingKey}><IconeEstado tipo="servicos"/><p><strong>Gasto, serviço e resultado</strong>Perspectivas complementares. As medidas descrevem o território; não atribuem uma nota à gestão.</p></div></div>
 <div className={styles.panel}><fieldset className={styles.scope}><legend className="sr-only">Recorte territorial da comparação</legend>{(['cidades','regioes'] as const).map(scope=><button type="button" key={scope} aria-pressed={selection.scope===scope} onClick={()=>onSelect({...selection,scope,place:scope==='cidades'?'2611606':'Nordeste',reference:scope==='cidades'?'4106902':'Sul'})}>{scope==='cidades'?'Capitais':'Grandes Regiões'}</button>)}</fieldset>
 <div className={styles.selectors}><label>Território<select value={a.id} onChange={e=>onSelect({...selection,place:e.target.value})}>{pool.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Comparar com<select value={b.id} onChange={e=>onSelect({...selection,reference:e.target.value})}>{pool.filter(p=>p.id!==a.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
 {city?<div className={styles.measureChoices} role="group" aria-label="Perspectiva da abertura">{panorama.metrics.map(m=><button key={m.id} type="button" aria-pressed={metric.id===m.id} onClick={()=>onSelect({...selection,perspective:m.id})}>{{educacao:'Educação',saude:'Saúde',trabalho:'Renda',mobilidade:'Mobilidade'}[m.id]}</button>)}</div>:<p className={styles.period}>Situação alimentar dos domicílios</p>}
 <figure aria-labelledby="medida-abertura-obee"><figcaption><h2 id="medida-abertura-obee" className={styles.metricTitle}>{title}</h2><p className={styles.period}>{city?metric.period:dados.food.period} · {unit==='R$'?'Reais nominais por pessoa':unit}</p></figcaption><div className={styles.plot}>{[a,b].map((p,i)=><div className={i===1?styles.reference:undefined} key={p.id}><div className={styles.plotRow}><div className={styles.plotLabel}><span>{p.name}</span><strong>{panoramaValue(values[i],unit)}</strong></div><div className={styles.track} aria-hidden="true">{values[i]!==null&&<span style={{width:`${values[i]!/max*100}%`}}/>}</div></div></div>)}<div className={styles.axis}><span>0</span><span>{max.toLocaleString('pt-BR')} {unit} · escala da medida</span></div></div></figure>
 <div className={styles.panelFoot}><p className={styles.note}>{city?metric.warning:'Brasil e cinco Grandes Regiões. A pesquisa não fornece uma estimativa municipal nesta base.'}{city&&metric.id==='trabalho'?' Sem ajuste espacial de preços.':''}</p><p className={styles.note}>{city?metric.source:dados.food.source} · referência {city?metric.period:dados.food.period}</p><details><summary>Universo e limites da comparação</summary><p className={styles.note}>{city?metric.universe:dados.food.universe}</p><p className={styles.note}>Os recortes e períodos variam entre temas. As posições não formam uma nota. {city?'Distrito Federal fora do conjunto de 26 capitais estaduais.':'Segurança alimentar refere-se aos domicílios, não às pessoas.'}</p></details><a href={city?`#panorama-${metric.id}`:'#atlas-comparacao'}>Ver referências e fonte completa ↓</a></div>
 </div></section>;
}
