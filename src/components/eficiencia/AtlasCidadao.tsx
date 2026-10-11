'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {DIMENSOES, GRUPOS, normalizaBusca} from '@/lib/eficiencia/dimensoes';
import dados from '@/lib/eficiencia/atlas-resumo.json';
import styles from './AtlasCidadao.module.css';

type Scope = 'cidades' | 'regioes';
type Selection = {scope: Scope; place: string; reference: string};
const DEFAULT: Selection = {scope:'cidades',place:'2611606',reference:'4106902'};
const options = (scope: Scope) => scope === 'cidades' ? dados.cities : dados.regions.filter(r=>r.id!=='Brasil');
const format = (value: number | null) => value === null ? 'Não disponível' : value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2});
function selectionFromUrl(): Selection {
  const q = new URLSearchParams(window.location.search);
  const scope: Scope = q.get('visao') === 'regioes' ? 'regioes' : 'cidades';
  const pool = options(scope);
  const place = pool.find(p=>p.id===q.get('territorio'))?.id ?? (scope==='cidades'?DEFAULT.place:'Nordeste');
  const reference = pool.find(p=>p.id===q.get('comparador') && p.id!==place)?.id
    ?? pool.find(p=>p.id===(scope==='cidades'?DEFAULT.reference:'Sul') && p.id!==place)?.id
    ?? pool.find(p=>p.id!==place)!.id;
  return {scope,place,reference};
}

export function AtlasCidadao(){
  const [selection,setSelection] = useState<Selection>(DEFAULT);
  const [chapter,setChapter] = useState('educacao');
  const [group,setGroup] = useState('Todas');
  const [search,setSearch] = useState('');
  useEffect(()=>{const sync=()=>setSelection(selectionFromUrl());sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  function select(next: Selection){
    const pool=options(next.scope);
    if(next.place===next.reference) next={...next,reference:pool.find(p=>p.id!==next.place)!.id};
    setSelection(next);
    const url=new URL(window.location.href);
    url.searchParams.set('visao',next.scope);url.searchParams.set('territorio',next.place);url.searchParams.set('comparador',next.reference);
    window.history.pushState(null,'',url);
  }
  const pool=options(selection.scope);
  const a=pool.find(p=>p.id===selection.place)!;
  const b=pool.find(p=>p.id===selection.reference)!;
  const city=selection.scope==='cidades';
  const meta=city?dados.education:dados.food;
  const measure=city?'Aprendizagem em português':'Domicílios com segurança alimentar';
  const max=city?Math.max(1,...dados.cities.map(r=>r.value??0)):100;
  const diff=a.value!==null&&b.value!==null?a.value-b.value:null;
  const dimension=DIMENSOES.find(d=>d.id===chapter)!;
  const terms=normalizaBusca(search).trim().split(/\s+/).filter(Boolean);
  const visible=DIMENSOES.filter(d=>(group==='Todas'||d.grupo===group)&&terms.every(t=>normalizaBusca(d.titulo+' '+d.verbo+' '+d.descricao).includes(t)));
  const published=DIMENSOES.filter(d=>d.href).length;
  const valuesHref=city?'/eficiencia-estatal/educacao-municipal-capitais/resultados':'/eficiencia-estatal/seguranca-alimentar/necessidades';
  const sourceHref=city?'/eficiencia-estatal/educacao-municipal-capitais/metodos':'/eficiencia-estatal/seguranca-alimentar/metodos';
  return <div className={styles.atlas}>
    <header className={styles.intro}><div><p className={styles.eyebrow}>OBEE / Atlas do cidadão</p><h1 id="titulo-eficiencia">O Estado na sua vida.</h1></div><p>Conheça os serviços, compare territórios e acompanhe as evidências de cada capítulo.</p></header>
    <div className={styles.toolbar}>
      <fieldset className={styles.scope}><legend className={styles.srOnly}>Recorte territorial da comparação</legend>{(['cidades','regioes'] as const).map(s=><button key={s} type="button" aria-pressed={selection.scope===s} onClick={()=>select(s==='cidades'?DEFAULT:{scope:s,place:'Nordeste',reference:'Sul'})}>{s==='cidades'?'Cidades':'Regiões'}</button>)}</fieldset>
      <label>Território<select value={a.id} onChange={e=>select({...selection,place:e.target.value})}>{pool.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Comparar com<select value={b.id} onChange={e=>select({...selection,reference:e.target.value})}>{pool.filter(p=>p.id!==a.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <a className={styles.toolbarLink} href="#atlas-comparacao">Ver comparação ↓</a>
    </div>
    <section className={styles.hero} aria-label="Panorama do território e mapa dos capítulos">
      <div className={styles.place}><p className={styles.eyebrow}>{city?'Capital brasileira':'Grande Região'}</p><h2>{a.name}</h2><p className={styles.scoreLabel}>Escore agregado de serviços</p><p className={styles.pending}>Em construção<span>Acesso · resposta · qualidade</span></p><p className={styles.heroNote}>Faltam componentes e referências validadas para publicar uma nota.</p><a href="#atlas-score-method">Entender o que falta ↗</a></div>
      <div className={styles.orbitWrap}><svg viewBox="0 0 400 400" className={styles.orbit} role="img" aria-labelledby="atlas-orbit-title atlas-orbit-desc"><title id="atlas-orbit-title">Mapa dos 16 capítulos do OBEE</title><desc id="atlas-orbit-desc">Cada posição representa um capítulo. O desenho organiza temas; não representa notas, cobertura territorial ou desempenho. A lista interativa está logo abaixo.</desc><circle cx="200" cy="200" r="128" fill="none" stroke="#557278" strokeDasharray="2 7"/><circle cx="200" cy="200" r="88" fill="none" stroke="#38565e"/>{DIMENSOES.map((d,i)=>{const angle=(i*22.5-90)*Math.PI/180;const x=200+128*Math.cos(angle),y=200+128*Math.sin(angle);return <g key={d.id}><line x1={200+92*Math.cos(angle)} y1={200+92*Math.sin(angle)} x2={x} y2={y} stroke={d.id===chapter?'#a3e3d7':'#557278'} strokeWidth={d.id===chapter?3:1}/><circle cx={x} cy={y} r={d.id===chapter?15:12} fill={d.id===chapter?'#a3e3d7':'#173b44'} stroke={d.href?'#a3e3d7':'#7e969b'}/><text x={x} y={y+4} textAnchor="middle" fill={d.id===chapter?'#102e36':'#f8f7f2'} fontSize="10">{String(i+1).padStart(2,'0')}</text></g>})}<text x="200" y="192" textAnchor="middle" fill="#f8f7f2" fontSize="44" fontFamily="Georgia,serif">16</text><text x="200" y="219" textAnchor="middle" fill="#c4d7d7" fontSize="12">dimensões da vida pública</text></svg><p>Mapa temático · não representa escores</p></div>
      <div className={styles.heroAside}><div><p className={styles.eyebrow}>Evidência disponível / {meta.period}</p><h3>{measure}</h3><strong>{format(a.value)}</strong><p>{meta.unit}</p><a href="#atlas-comparacao">Comparar com {b.name} →</a></div><div className={styles.heroAsideBottom}><p className={styles.eyebrow}>Explore além da média</p><p>Recursos, atendimento e resultados têm universos próprios. Cada fonte explica seu recorte.</p></div></div>
      <div className={styles.heroFooter}><span>Dados reais · períodos identificados em cada medida</span><span>Comparação internacional ainda não disponível</span></div>
    </section>
    <dl className={styles.strip}><div><dt>Dimensões no observatório</dt><dd>{DIMENSOES.length}<small>visão completa dos temas</small></dd></div><div><dt>Capítulos com painéis publicados</dt><dd>{published}<small>cobertura variável por fonte</small></dd></div><div><dt>Nota agregada</dt><dd className={styles.stripText}>Indisponível<small>dados publicados não equivalem a escore validado</small></dd></div></dl>
    <section id="atlas-comparacao" className={styles.section} aria-labelledby="atlas-compare-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / Comparar territórios</p><h2 id="atlas-compare-title">Uma medida. Dois contextos.</h2></div><p>{meta.source} · referência {meta.period}</p></div>
      <div className={styles.comparison}><div><h3>{measure}</h3><p>{meta.universe}</p><p className={styles.difference} aria-live="polite">{diff===null?'Comparação indisponível':`${diff>0?'+':''}${format(diff)} ${city?'pontos Saeb':'pontos percentuais'}`}</p><p>{a.name} em relação a {b.name}. Esta diferença não é uma nota de serviço nem demonstra efeito da gestão pública.</p><p className={styles.universe}>{city?'Universo disponível: 26 capitais, rede municipal. Distrito Federal fora deste recorte.':'Universo disponível: cinco Grandes Regiões. Não há estimativa municipal da EBIA nesta base.'}</p></div>
        <div><div className={styles.bars} aria-hidden="true">{[a,b].map((p,i)=><div className={styles.barRow} key={p.id}><div><span>{p.name}</span><strong>{format(p.value)}</strong></div><div className={styles.track}>{p.value!==null&&<span className={i===0?styles.barPrimary:styles.barReference} style={{width:`${p.value/max*100}%`}}/>}</div></div>)}<p>Escala de 0 a {format(max)} {meta.unit}{city?' · limite visual fixo entre as 26 capitais':''}</p></div>
        <table className={styles.values}><caption>{measure} · {meta.period}</caption><thead><tr><th scope="col">Território</th><th scope="col">{meta.unit}</th></tr></thead><tbody>{[a,b].map(p=><tr key={p.id}><th scope="row">{p.name}</th><td>{format(p.value)}</td></tr>)}</tbody></table><div className={styles.links}><Link href={valuesHref}>Explorar este indicador ↗</Link><Link href={sourceHref}>Fonte e método ↗</Link><a href={'/'+meta.path} download>Baixar base completa ↓</a></div><p className={styles.small}>O download contém a base completa da fonte, não apenas os dois territórios selecionados.</p></div></div>
    </section>
    <section id="dados-publicados" className={styles.section} aria-labelledby="atlas-chapters-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / Explorar capítulos</p><h2 id="atlas-chapters-title">O que faz parte da sua vida?</h2></div><p>Os capítulos abrem seus próprios recortes e períodos.</p></div>
      <div className={styles.chapterTools}><label>Encontrar um tema<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Educação, moradia, direitos…"/></label><label>Área<select value={group} onChange={e=>setGroup(e.target.value)}>{['Todas',...GRUPOS].map(g=><option key={g}>{g}</option>)}</select></label></div>
      <div className={styles.chaptersLayout}><div className={styles.chapterList}>{visible.map(d=><button type="button" key={d.id} aria-pressed={chapter===d.id} onClick={()=>setChapter(d.id)}><span className={styles.chapterNumber}>{String(DIMENSOES.indexOf(d)+1).padStart(2,'0')}</span><span>{d.titulo}<small>{d.href?'Painel publicado':'Em desenvolvimento'}</small></span><span aria-hidden="true">↗</span></button>)}{visible.length===0&&<p role="status">Nenhum tema encontrado. Tente outro termo ou selecione Todas.</p>}</div>
        <article className={styles.chapterDetail} aria-labelledby="atlas-detail-title"><p className={styles.eyebrow}>{dimension.grupo}</p><h3 id="atlas-detail-title">{dimension.verbo}.</h3><p>{dimension.descricao}</p><dl><div><dt>Recursos</dt><dd>{dimension.recursos}</dd></div><div><dt>Acesso</dt><dd>{dimension.acesso}</dd></div><div><dt>Resultados</dt><dd>{dimension.resultados}</dd></div></dl><p className={styles.small}>Escopo temático. A disponibilidade efetiva de cada indicador está declarada no painel. A seleção de território acima aplica-se à comparação da medida, não filtra todos os capítulos.</p>{dimension.href?<Link className={styles.primaryLink} href={dimension.href}>Explorar {dimension.titulo} <span aria-hidden="true">→</span></Link>:<p className={styles.universe}>Este capítulo ainda não tem painel publicado.</p>}<a href="#cobertura" className={styles.detailLink}>Consultar cobertura e fontes ↓</a></article></div>
    </section>
    <section className={styles.method} aria-labelledby="atlas-method-title"><div><p className={styles.eyebrow}>03 / Da evidência ao escore</p><h2 id="atlas-method-title">Uma nota precisa ser explicável.</h2><p>O escore experimental reúne três perguntas. A nota só pode ser calculada com componentes e referências válidos.</p></div><ol>{[['Acesso','Quem precisa consegue ser atendido?'],['Resposta','A entrega chega a tempo e tem continuidade?'],['Qualidade','O serviço cumpre o padrão esperado?']].map(([title,text],i)=><li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
  </div>;
}
