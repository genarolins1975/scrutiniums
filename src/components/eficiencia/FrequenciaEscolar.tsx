'use client';

import dados from '@/lib/eficiencia/frequencia-escolar.json';
import styles from './AtlasCidadao.module.css';

type Props = {place: string; reference: string; age: string; onAgeChange: (age: string) => void};
const format=(value:number|null)=>value===null?'Não disponível':value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

export function FrequenciaEscolar({place,reference,age,onAgeChange}:Props){
  const selected=dados.ages.find(a=>a.id===age)??dados.ages[1];
  const rows=[place,reference,'1'].map(id=>dados.observations.find(o=>o.territory===id&&o.age===selected.id));
  const a=rows[0],b=rows[1];
  const difference=a?.value!=null&&b?.value!=null?a.value-b.value:null;
  return <div className={styles.comparison}>
    <div>
      <h3>Quem frequenta escola ou creche?</h3>
      <p>Percentual da população residente na faixa etária que frequenta escola ou creche, independentemente do nível de ensino.</p>
      <label className={styles.ageControl}>Faixa etária<select value={selected.id} onChange={e=>onAgeChange(e.target.value)}>{dados.ages.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
      <p className={styles.difference} aria-live="polite">{difference===null?'Comparação indisponível':`${difference>0?'+':''}${format(difference)} pontos percentuais`}</p>
      <p>{a?.name??'Território sem dado'} em relação a {b?.name??'comparador sem dado'} · {selected.label} · {dados.period}.</p>
      <p className={styles.universe}>Inclui redes públicas e privadas. Não mede atendimento exclusivo pelo Estado, qualidade do ensino ou eficiência da gestão.</p>
      <p className={styles.frequencyNote}>Brasil é a taxa nacional publicada pelo IBGE, não a média das capitais. Os dados de {dados.period} e do Saeb têm anos e universos distintos.</p>
    </div>
    <div>
      <div className={styles.bars} aria-hidden="true">{rows.map((row,i)=><div className={styles.barRow} key={row?.territory??i}><div><span>{row?.name??'Não disponível'}</span><strong>{format(row?.value??null)}{row?.value!=null?'%':''}</strong></div><div className={styles.track}>{row?.value!=null&&<span className={i===0?styles.barPrimary:i===1?styles.barReference:styles.barNational} style={{width:`${row.value}%`}}/>}</div></div>)}<div className={styles.frequencyAxis}><span>0%</span><span>50%</span><span>100%</span></div></div>
      <table className={styles.values}><caption>Frequência escolar · {selected.label} · {dados.period}</caption><thead><tr><th scope="col">Território</th><th scope="col">% dos residentes</th></tr></thead><tbody>{rows.map((row,i)=><tr key={row?.territory??i}><th scope="row">{row?.name??'Não disponível'}</th><td>{format(row?.value??null)}</td></tr>)}</tbody></table>
      <div className={styles.links}><a href="https://sidra.ibge.gov.br/tabela/10056" target="_blank" rel="noreferrer">Fonte: IBGE / SIDRA ↗</a><a href="/eficiencia/atlas/frequencia-escolar-2022.csv" download>Baixar as quatro faixas etárias ↓</a></div>
      <p className={styles.small}>Download: 26 capitais estaduais e Brasil, quatro faixas etárias. Censo 2022, resultados da amostra; taxa bruta de frequência escolar. Captura em {new Date(dados.capturedAt).toLocaleDateString('pt-BR',{timeZone:'UTC'})}.</p>
    </div>
  </div>;
}
