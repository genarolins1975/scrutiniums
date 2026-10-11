import Link from 'next/link';
import data from '@/lib/eficiencia/panorama-atlas.json';
import styles from './PanoramaTerritorial.module.css';

type Metric = typeof data.metrics[number];
// Empilha apenas para evitar colisões. A altura não codifica outra medida.
export function panoramaDistribution(metric: Metric) {
  const rows = data.cities.map(city => {
    const observation = metric.observations.find(o => o.territory === city.id);
    const value = observation?.eligible && observation.value !== null && Number.isFinite(observation.value) ? observation.value : null;
    return {...city, value, state: observation?.state ?? 'ausente', eligible: observation?.eligible ?? false};
  }).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
  const lanes: number[] = [];
  const points = rows.filter(row => row.value !== null).sort((a,b) => a.value! - b.value! || a.name.localeCompare(b.name, 'pt-BR')).map(row => {
    const x = 32 + row.value! / metric.scaleMax * 336;
    let lane = lanes.findIndex(lastX => x - lastX >= 14);
    if (lane === -1) lane = lanes.length;
    lanes[lane] = x;
    return {...row, x, y: 18 + lane * 14};
  });
  return {rows, points, axisY: 34 + Math.max(0, lanes.length - 1) * 14};
}
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
    <div className={styles.legend}><span><i className={styles.primaryDot}/>{a}</span><span><i className={styles.referenceDot}/>{b}</span><span><i className={styles.contextDot}/>Demais capitais</span><span><i className={styles.medianDot}/>Mediana das capitais elegíveis</span></div>
    <div className={styles.grid}>{data.metrics.map((m,index)=>{
      const pair=panoramaPair(place,reference,m);
      const midpoint=m.reference.value;
      const point=(v:number)=>8+v/m.scaleMax*84;
      const distribution=panoramaDistribution(m);
      return <article key={m.id} className={styles.metric} aria-labelledby={`panorama-${m.id}`}>
        <div className={styles.meta}><span>{String(index+1).padStart(2,'0')} / {m.chapter}</span><span>{m.kind}</span></div>
        <h3 id={`panorama-${m.id}`}>{m.question}</h3><p className={styles.title}>{m.title}</p><p className={styles.period}>{m.period} · {m.unit==='R$'?'R$ nominais por pessoa':m.unit}</p>
        <dl className={styles.pair}><div><dt>{a}</dt><dd>{panoramaValue(pair.a,m.unit)}</dd></div><div><dt>{b}</dt><dd>{panoramaValue(pair.b,m.unit)}</dd></div></dl>
        <figure className={styles.distribution}>
          <figcaption>Cada ponto, uma capital <span>· {distribution.points.length} de {distribution.rows.length} com valor elegível</span></figcaption>
          <svg viewBox={`0 0 400 ${distribution.axisY+36}`} className={styles.plot} aria-hidden="true">
            <line x1="32" x2="368" y1={distribution.axisY} y2={distribution.axisY} className={styles.axis}/>
            {midpoint!==null&&<><line x1={point(midpoint)*4} x2={point(midpoint)*4} y1="8" y2={distribution.axisY} className={styles.medianLine}/><path d={`M ${point(midpoint)*4} ${distribution.axisY-5} l 5 5 l -5 5 l -5 -5 Z`} className={styles.medianMark}/></>}
            {distribution.points.map(p=><g key={p.id}>
              <circle cx={p.x} cy={p.y} r={p.id===reference?5.5:p.id===place?4.5:3.5} className={p.id===reference?styles.referenceMark:p.id===place?styles.primaryMark:styles.contextMark}/>
              {p.id===place&&p.id===reference&&<circle cx={p.x} cy={p.y} r="2.5" className={styles.primaryMark}/>}
            </g>)}
            <text x="32" y={distribution.axisY+28}>0</text><text x="368" y={distribution.axisY+28} textAnchor="end">{m.scaleMax.toLocaleString('pt-BR')} {m.unit}</text>
          </svg>
          <p className={styles.plotNote}>A posição horizontal mostra o valor. Pontos empilhados evitam sobreposição; a altura não representa outra medida. Distrito Federal fora do conjunto.</p>
        </figure>
        <p className={styles.benchmark}>Mediana: <strong>{panoramaValue(midpoint,m.unit)}</strong> · {m.reference.count}/{m.reference.total} capitais elegíveis</p>
        <p className={styles.difference}>{pair.difference===null?'Diferença indisponível':`${pair.difference>0?'+':''}${pair.difference.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${m.unit==='%'?'pontos percentuais':'reais'} de ${a} em relação a ${b}.`}</p>
        <p className={styles.universe}>{m.universe}</p><p className={styles.warning}>{m.warning}</p>
        <p className={styles.source}>{m.source} · captura {date(m.capturedAt)}</p>
        <details className={`${styles.details} ${styles.capitals}`}><summary>Comparar as {distribution.rows.length} capitais</summary>
          <p>Ordem alfabética. A tabela apresenta os mesmos valores da distribuição; as duas seleções estão identificadas por texto.</p>
          <table><caption>{m.title} · {m.period} · {m.unit}</caption><thead><tr><th scope="col">Capital</th><th scope="col">Valor</th></tr></thead><tbody>{distribution.rows.map(row=><tr key={row.id} className={row.id===place||row.id===reference?styles.selectedRow:undefined}><th scope="row">{row.name}{row.id===place&&<small>Território selecionado</small>}{row.id===reference&&<small>Comparador selecionado</small>}</th><td>{panoramaValue(row.value,m.unit)}{row.value===null&&<small>{row.eligible?'Sem valor observado':'Fora da comparação'} · {row.state}</small>}</td></tr>)}</tbody></table>
        </details>
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
