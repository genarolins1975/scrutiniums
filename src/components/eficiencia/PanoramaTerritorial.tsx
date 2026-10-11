import Link from 'next/link';
import data from '@/lib/eficiencia/panorama-atlas.json';
import styles from './PanoramaTerritorial.module.css';

type Metric = typeof data.metrics[number];
export const panoramaValue = (value: number | null, unit: string) => value === null ? 'Não disponível' : (unit === 'R$' ? 'R$ ' : '') + value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + (unit === '%' ? '%' : '');
const date = (value: string) => value.slice(0,10).split('-').reverse().join('/');
export function panoramaDetailHref(metric: Metric, place: string, reference: string) {
  if (metric.id === 'saude') {
    const ids = metric.territoryKeys as Record<string,string>;
    return `${metric.detailPath}?cap=${ids[place]??''}&vs=${ids[reference]??''}&med=cobertura_aps&ano=2025`;
  }
  if (metric.id === 'trabalho') return `${metric.detailPath}?ter=${place}&med=renda-mediana&per=2022&sexo=total&grp=Total`;
  if (metric.id === 'mobilidade') return `${metric.detailPath}?territorio=${place}&nivel=municipio&medida=censo.tempo.longo`;
  return metric.detailPath;
}
export function panoramaPair(place: string, reference: string, metric: Metric) {
  const first = metric.observations.find(o=>o.territory===place);
  const second = metric.observations.find(o=>o.territory===reference);
  const a = first?.eligible ? first.value : null;
  const b = second?.eligible ? second.value : null;
  return {a:a??null, b:b??null, first, second, difference:a!=null&&b!=null?a-b:null};
}

export function PanoramaTerritorial({place,reference,onEducation}:{place:string;reference:string;onEducation:()=>void}) {
  const a = data.cities.find(c=>c.id===place)?.name??'Território selecionado';
  const b = data.cities.find(c=>c.id===reference)?.name??'Comparador selecionado';
  return <section id="atlas-panorama" className={styles.section} aria-labelledby="panorama-title">
    <div className={styles.heading}><div><p className={styles.eyebrow}>01 / Retrato em quatro perspectivas</p><h2 id="panorama-title">A vida no território, lado a lado.</h2></div><a href="/eficiencia/atlas/panorama-capitais.csv" download>Baixar 26 capitais · CSV ↓</a></div>
    <p className={styles.lead}><strong>{a}</strong> e <strong>{b}</strong>, com uma referência entre capitais para cada medida. Os anos e os universos variam entre os temas; não formam uma nota nem um retrato do mesmo ano.</p>
    <div className={styles.legend}><span><i className={styles.primaryDot}/>{a}</span><span><i className={styles.referenceDot}/>{b}</span><span><i className={styles.medianDot}/>Mediana das capitais elegíveis</span></div>
    <div className={styles.grid}>{data.metrics.map((m,index)=>{
      const pair=panoramaPair(place,reference,m);
      const midpoint=m.reference.value;
      const point=(v:number)=>8+v/m.scaleMax*84;
      return <article key={m.id} className={styles.metric} aria-labelledby={`panorama-${m.id}`}>
        <div className={styles.meta}><span>{String(index+1).padStart(2,'0')} / {m.chapter}</span><span>{m.kind}</span></div>
        <h3 id={`panorama-${m.id}`}>{m.question}</h3><p className={styles.title}>{m.title}</p><p className={styles.period}>{m.period} · {m.unit==='R$'?'R$ nominais por pessoa':m.unit}</p>
        <dl className={styles.pair}><div><dt>{a}</dt><dd>{panoramaValue(pair.a,m.unit)}</dd></div><div><dt>{b}</dt><dd>{panoramaValue(pair.b,m.unit)}</dd></div></dl>
        <svg viewBox="0 0 400 66" className={styles.plot} aria-hidden="true">
          <line x1="32" x2="368" y1="24" y2="24" className={styles.axis}/>
          {pair.a!==null&&pair.b!==null&&<line x1={point(pair.a)*4} x2={point(pair.b)*4} y1="24" y2="24" className={styles.connector}/>}
          {midpoint!==null&&<path d={`M ${point(midpoint)*4} 16 l 8 8 l -8 8 l -8 -8 Z`} className={styles.medianMark}/>}
          {pair.b!==null&&<circle cx={point(pair.b)*4} cy="24" r="7" className={styles.referenceMark}/>}
          {pair.a!==null&&<circle cx={point(pair.a)*4} cy="24" r="4.5" className={styles.primaryMark}/>}
          <text x="32" y="59">0</text><text x="368" y="59" textAnchor="end">{m.scaleMax.toLocaleString('pt-BR')} {m.unit}</text>
        </svg>
        <p className={styles.benchmark}>Mediana: <strong>{panoramaValue(midpoint,m.unit)}</strong> · {m.reference.count}/{m.reference.total} capitais elegíveis</p>
        <p className={styles.difference}>{pair.difference===null?'Diferença indisponível':`${pair.difference>0?'+':''}${pair.difference.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${m.unit==='%'?'pontos percentuais':'reais'} de ${a} em relação a ${b}.`}</p>
        <p className={styles.universe}>{m.universe}</p><p className={styles.warning}>{m.warning}</p>
        <p className={styles.source}>{m.source} · captura {date(m.capturedAt)}</p>
        <details className={styles.details}><summary>Ver valores, recortes e fontes</summary>
          <table><caption>{m.title} · {m.period}</caption><thead><tr><th scope="col">Referência</th><th scope="col">{m.unit}</th></tr></thead><tbody>{[[a,pair.a],[b,pair.b],['Mediana das capitais',midpoint]].map(([name,value],i)=><tr key={i}><th scope="row">{name}</th><td>{panoramaValue(value as number|null,m.unit)}</td></tr>)}</tbody></table>
          <p>{m.reference.method} Distrito Federal fora do conjunto de 26 capitais estaduais. Escala fixa entre capitais para esta medida; posições não são comparáveis entre temas.</p>
          {[pair.first,pair.second].map((o,i)=><div key={i}><p><strong>{i===0?a:b}</strong> · código {i===0?place:reference} · estado {o?.state??'ausente'} · {o?.eligible?'elegível':'fora da comparação'}</p>{o?.numerator!=null&&<p>Numerador: {o.numerator.toLocaleString('pt-BR')}. Denominador: {o.denominator?.toLocaleString('pt-BR')}.</p>}{o?.note&&<p>{o.note}</p>}</div>)}
          <a href={m.sourceUrl}>Abrir fonte original ↗</a><Link href={m.methodPath}>Método do capítulo ↗</Link>
        </details>
        <a className={styles.explore} href={panoramaDetailHref(m,place,reference)} onClick={m.id==='educacao'?onEducation:undefined}>{m.id==='educacao'?'Explorar idades e referências':'Explorar este recorte'} →</a>
      </article>;
    })}</div>
    <p className={styles.footer}>Este panorama reúne condições dos moradores e capacidade potencial do serviço. Não mede satisfação, efeito da gestão ou eficiência. Outros temas têm recortes próprios nos capítulos abaixo.</p>
  </section>;
}
