'use client';
import {useMemo} from 'react';
import dados from '@/lib/eficiencia/atlas-resumo.json';
import panorama from '@/lib/eficiencia/panorama-atlas.json';
import {panoramaPair,panoramaValue} from './PanoramaTerritorial';
import {IconeEstado} from '@/components/observatorios/TrilhasEstado';
import {createIndice,STATUS_LABELS,indiceNumber as n,type IndiceSnapshot} from '@/lib/eficiencia/indice-v4-nucleo';
import styles from '@/components/observatorios/EntradaEstado.module.css';
import s from './AberturaCidada.module.css';

type Selection={scope:'cidades'|'regioes';place:string;reference:string;metric:'frequencia'|'saeb';age:string;perspective?:string};
/** Rótulos curtos fiéis ao valor exibido: nas medidas em que menor é mais favorável, o rótulo nomeia a condição contada. */
const CURTO:Record<string,string>={educacao:'Escola, 4 e 5 anos',trabalho:'Renda por pessoa',mobilidade:'Mais de 1 h até o trabalho',saneamento:'Rede ou fossa séptica',seguranca:'Homicídios por 100 mil',habitacao:'Moradia adensada',conectividade:'Internet em casa'};
const valor=(v:number,unit:string)=>unit==='R$'?`R$ ${n(v,0)}`:`${n(v,1)}${unit==='%'?'%':''}`;

/** Painel do índice: nota das duas capitais e perfil nos sete resultados, na mesma escala de posições. */
function PainelIndice({data,place,reference}:{data:IndiceSnapshot;place:string;reference:string}){
 const indice=useMemo(()=>createIndice(data),[data]);
 const a=indice.row(place)!,b=indice.row(reference)!,st=indice.stability(place,reference)!;
 return <>
  <div className={s.scores}>
   <p className={s.kicker}>Índice de resultados · {data.reference_year} · edição experimental</p>
   <dl>
    <div><dt><i className={s.dot} aria-hidden="true"/>{a.name}</dt><dd className={s.main}>{n(a.score)}</dd></div>
    <div><dt><i className={s.diamond} aria-hidden="true"/>{b.name}</dt><dd>{n(b.score)}</dd></div>
   </dl>
   <p className={s.status}>{STATUS_LABELS[st.status]} entre as duas capitais. Faixa de {a.name} nos testes: {n(a.band[0])} a {n(a.band[1])}.</p>
  </div>
  <table className={s.profile}>
   <caption>Posição em cada resultado entre as 26 capitais, de 0 a 100. Mais à direita, resultado mais favorável; a linha tracejada marca 50, a posição mediana. A nota é a média das sete posições.</caption>
   <thead className="sr-only"><tr><th scope="col">Resultado</th><th scope="col">Posições de {a.name} e {b.name}</th><th scope="col">Valor de {a.name}</th></tr></thead>
   <tbody>{data.indicators.map(i=>{const pa=a.percentiles[i.id],pb=b.percentiles[i.id];return <tr key={i.id}>
    <th scope="row">{CURTO[i.id]??i.label}</th>
    <td><span className="sr-only">{a.name}: posição {n(pa)}; {b.name}: posição {n(pb)}.</span><span className={s.track} aria-hidden="true"><i className={s.median}/><i className={s.link} style={{left:`${Math.min(pa,pb)}%`,width:`${Math.abs(pa-pb)}%`}}/><i className={s.diamond} style={{left:`${pb}%`}}/><i className={s.dot} style={{left:`${pa}%`}}/></span></td>
    <td title={i.label}>{valor(a.raw_values[i.id],i.unit)}</td>
   </tr>;})}</tbody>
  </table>
  <div className={styles.panelFoot}>
   <p className={styles.note}>Censo 2022 e Atlas da Violência 2024, dados de 2022. Precisão municipal não quantificada: diferenças pequenas não são diferenças certas. Saúde ainda fora da nota.</p>
   <details><summary>Universo e limites da comparação</summary><p className={styles.note}>26 capitais estaduais, sem o Distrito Federal, em 2022. A nota descreve condições de vida e a posição relativa entre as capitais; não identifica quem produziu o resultado nem separa competências de União, estado e município. Renda em reais nominais, sem ajuste de preços entre cidades.</p></details>
   <a href="#atlas-indice">Ver de onde vem cada ponto da nota ↓</a>
  </div>
 </>;
}

export function AberturaCidada({selection,onSelect,indice=null}:{selection:Selection;onSelect:(s:Selection)=>void;indice?:IndiceSnapshot|null}){
 const city=selection.scope==='cidades';
 const pool=city?dados.cities:dados.regions.filter(r=>r.id!=='Brasil');
 const a=pool.find(p=>p.id===selection.place)!,b=pool.find(p=>p.id===selection.reference)!;
 const comIndice=city&&!!indice&&indice.rows.some(r=>r.id===a.id)&&indice.rows.some(r=>r.id===b.id);
 const metric=panorama.metrics.find(m=>m.id===selection.perspective)??panorama.metrics[0];
 const pair=panoramaPair(a.id,b.id,metric);
 const values=city?[pair.a,pair.b]:[a.value,b.value];
 const max=city?metric.scaleMax:100, unit=city?metric.unit:'%';
 const title=city?metric.title:'Domicílios com segurança alimentar';
 return <section className={`${styles.opening} ${comIndice?s.opening:''}`} aria-labelledby="titulo-eficiencia"><div className={comIndice?s.intro:undefined}><p className={styles.eyebrow}>Eficiência Estatal / Atlas do cidadão</p><h1 id="titulo-eficiencia" className={styles.title}>O Estado<br/>na <em>sua vida.</em></h1>
  {comIndice?<><p className={styles.lead}>Sete resultados do dia a dia, medidos nas 26 capitais. Escolha sua capital, compare com outra e veja de onde vem cada ponto da nota.</p>
   <dl className={`${s.facts} ${s.later}`}><div><dt>Capitais</dt><dd>26</dd></div><div><dt>Resultados, peso igual</dt><dd>7</dd></div><div><dt>Referência</dt><dd>2022</dd></div></dl>
   <div className={`${styles.actions} ${s.later}`}><a className={styles.primary} href="#atlas-indice">Entender a nota <span aria-hidden="true">→</span></a><a href="#dados-publicados">Explorar os 16 temas ↓</a></div>
   <div className={`${styles.readingKey} ${s.later}`}><IconeEstado tipo="servicos"/><p><strong>Resultados, não diagnóstico</strong>A nota descreve condições de vida e a posição entre as capitais. Não mede eficiência nem atribui o resultado a prefeitura, estado ou União.</p></div></>
  :<><p className={styles.lead}>Da escola ao trabalho, da saúde à moradia. Explore os serviços públicos e as condições de vida, com referências para entender cada território.</p><div className={styles.actions}><a className={styles.primary} href="#dados-publicados">Encontrar um tema <span aria-hidden="true">→</span></a><a href={city?'#atlas-panorama':'#atlas-comparacao'}>Comparar territórios ↓</a></div><div className={styles.readingKey}><IconeEstado tipo="servicos"/><p><strong>Gasto, serviço e resultado</strong>Perspectivas complementares. As medidas descrevem o território; não atribuem uma nota à gestão.</p></div></>}
 </div>
 <div className={`${styles.panel} ${comIndice?s.panel:''}`}><fieldset className={styles.scope}><legend className="sr-only">Recorte territorial da comparação</legend>{(['cidades','regioes'] as const).map(scope=><button type="button" key={scope} aria-pressed={selection.scope===scope} onClick={()=>onSelect({...selection,scope,place:scope==='cidades'?'2611606':'Nordeste',reference:scope==='cidades'?'4106902':'Sul'})}>{scope==='cidades'?'Capitais':'Grandes Regiões'}</button>)}</fieldset>
 <div className={styles.selectors}><label>{city?'Sua capital':'Território'}<select value={a.id} onChange={e=>onSelect({...selection,place:e.target.value})}>{pool.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Comparar com<select value={b.id} onChange={e=>onSelect({...selection,reference:e.target.value})}>{pool.filter(p=>p.id!==a.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
 {comIndice?<PainelIndice data={indice!} place={a.id} reference={b.id}/>:<>
 {city?<div className={styles.measureChoices} role="group" aria-label="Perspectiva da abertura">{panorama.metrics.map(m=><button key={m.id} type="button" aria-pressed={metric.id===m.id} onClick={()=>onSelect({...selection,perspective:m.id})}>{{educacao:'Educação',saude:'Saúde',trabalho:'Renda',mobilidade:'Mobilidade'}[m.id]}</button>)}</div>:<p className={styles.period}>Situação alimentar dos domicílios</p>}
 <figure aria-labelledby="medida-abertura-obee"><figcaption><h2 id="medida-abertura-obee" className={styles.metricTitle}>{title}</h2><p className={styles.period}>{city?metric.period:dados.food.period} · {unit==='R$'?'Reais nominais por pessoa':unit}</p></figcaption><div className={styles.plot}>{[a,b].map((p,i)=><div className={i===1?styles.reference:undefined} key={p.id}><div className={styles.plotRow}><div className={styles.plotLabel}><span>{p.name}</span><strong>{panoramaValue(values[i],unit)}</strong></div><div className={styles.track} aria-hidden="true">{values[i]!==null&&<span style={{width:`${values[i]!/max*100}%`}}/>}</div></div></div>)}<div className={styles.axis}><span>0</span><span>{max.toLocaleString('pt-BR')} {unit} · escala da medida</span></div></div></figure>
 <div className={styles.panelFoot}><p className={styles.note}>{city?metric.warning:'Brasil e cinco Grandes Regiões. A pesquisa não fornece uma estimativa municipal nesta base.'}{city&&metric.id==='trabalho'?' Sem ajuste espacial de preços.':''}</p><p className={styles.note}>{city?metric.source:dados.food.source} · referência {city?metric.period:dados.food.period}</p><details><summary>Universo e limites da comparação</summary><p className={styles.note}>{city?metric.universe:dados.food.universe}</p><p className={styles.note}>Os recortes e períodos variam entre temas. As posições não formam uma nota. {city?'Distrito Federal fora do conjunto de 26 capitais estaduais.':'Segurança alimentar refere-se aos domicílios, não às pessoas.'}</p></details><a href={city?`#panorama-${metric.id}`:'#atlas-comparacao'}>Ver referências e fonte completa ↓</a></div></>}
 </div></section>;
}
