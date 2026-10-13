'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {DIMENSOES, GRUPOS, estadoCatalogo, type GrupoDimensao} from '@/lib/eficiencia/dimensoes';
import dados from '@/lib/eficiencia/atlas-resumo.json';
import styles from './AtlasCidadao.module.css';
import {PilotoResultados} from './PilotoResultados';
import type {PilotSnapshot} from '@/lib/eficiencia/piloto-nucleo';
import {FrequenciaEscolar} from './FrequenciaEscolar';
import frequencia from '@/lib/eficiencia/frequencia-escolar.json';
import {AberturaCidada} from './AberturaCidada';
import {TrilhasEstado} from '@/components/observatorios/TrilhasEstado';
import {PanoramaTerritorial} from './PanoramaTerritorial';

type Scope = 'cidades' | 'regioes';
type Selection = {scope: Scope; place: string; reference: string; metric: 'frequencia' | 'saeb'; age: string; perspective?: string};
const DEFAULT: Selection = {scope:'cidades',place:'2611606',reference:'4106902',metric:'frequencia',age:'47813',perspective:'educacao'};
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
  const metric=q.get('indicador')==='saeb'?'saeb':'frequencia';
  const age=frequencia.ages.find(a=>a.id===q.get('idade'))?.id??DEFAULT.age;
  const perspective=['educacao','saude','trabalho','mobilidade'].find(p=>p===q.get('perspectiva'))??'educacao';
  return {scope,place,reference,metric,age,perspective};
}

/** `pilot` só é fornecido pelo servidor em preview/desenvolvimento; sem ele, nada do piloto é exibido. */
export function AtlasCidadao({pilot=null}:{pilot?:PilotSnapshot|null}){
  const showPilot=pilot!==null;
  const [selection,setSelection] = useState<Selection>(DEFAULT);
  const [chapter,setChapter] = useState('educacao');
  const [group,setGroup] = useState<GrupoDimensao | 'Todas'>('Todas');
  const [search,setSearch] = useState('');
  useEffect(()=>{const sync=()=>setSelection(selectionFromUrl());sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  function select(next: Selection){
    const pool=options(next.scope);
    if(next.place===next.reference) next={...next,reference:pool.find(p=>p.id!==next.place)!.id};
    setSelection(next);
    const url=new URL(window.location.href);
    url.searchParams.set('visao',next.scope);url.searchParams.set('territorio',next.place);url.searchParams.set('comparador',next.reference);url.searchParams.set('indicador',next.metric);url.searchParams.set('idade',next.age);url.searchParams.set('perspectiva',next.perspective??'educacao');
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
  const {visible,dimension}=estadoCatalogo(search,group,chapter);
  const published=DIMENSOES.filter(d=>d.href).length;
  const valuesHref=city?'/eficiencia-estatal/educacao-municipal-capitais/resultados':'/eficiencia-estatal/seguranca-alimentar/necessidades';
  const sourceHref=city?'/eficiencia-estatal/educacao-municipal-capitais/metodos':'/eficiencia-estatal/seguranca-alimentar/metodos';
  return <div className={styles.atlas}>
    <AberturaCidada selection={selection} onSelect={select}/>
    <TrilhasEstado itens={[
      {titulo:'A vida no território',texto:'Educação, saúde, renda e mobilidade: referências lado a lado.',href:city?'#atlas-panorama':'#atlas-comparacao',icone:'territorio'},
      {titulo:'Encontre seu tema',texto:'Acesso, recursos e resultados em 16 dimensões da vida pública.',href:'#dados-publicados',icone:'servicos'},
      {titulo:'Entenda a cobertura',texto:'O que cada fonte permite comparar e quais evidências ainda faltam.',href:'#cobertura',icone:'recursos'},
    ]}/>
    <dl className={styles.strip}><div><dt>Dimensões no observatório</dt><dd>{DIMENSOES.length}<small>visão completa dos temas</small></dd></div><div><dt>Capítulos com painéis publicados</dt><dd>{published}<small>cobertura variável por fonte</small></dd></div><div><dt>{city&&showPilot?"Nota integral do OBEE":"Nota agregada"}</dt><dd className={styles.stripText}>Indisponível<small>Em construção · dados publicados não equivalem a escore validado</small></dd></div></dl>
    {city&&pilot&&<PilotoResultados data={pilot} place={a.id} reference={b.id} onReference={reference=>select({...selection,reference})}/>}
    {city&&<PanoramaTerritorial place={a.id} reference={b.id} onReference={reference=>select({...selection,reference})} onEducation={()=>select({...selection,metric:'frequencia',age:'47813'})}/>}
    <section id="atlas-comparacao" className={styles.section} aria-labelledby="atlas-compare-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / Aprofundar a comparação</p><h2 id="atlas-compare-title">Uma medida. Diferentes contextos.</h2></div><p>{city&&selection.metric==='frequencia'?`${frequencia.source} · referência ${frequencia.period}`:`${meta.source} · referência ${meta.period}`}</p></div>
      {city&&<fieldset className={styles.indicatorChoice}><legend>Escolha a medida de educação</legend>{(['frequencia','saeb'] as const).map(m=><button type="button" key={m} aria-pressed={selection.metric===m} onClick={()=>select({...selection,metric:m})}>{m==='frequencia'?`Frequência escolar · ${frequencia.period}`:`Aprendizagem · Saeb ${dados.education.period}`}</button>)}</fieldset>}
      {city&&selection.metric==='frequencia'?<FrequenciaEscolar place={a.id} reference={b.id} age={selection.age} onAgeChange={age=>select({...selection,age})}/>:
      <div className={styles.comparison}><div><h3>{measure}</h3><p>{meta.universe}</p><p className={styles.difference} aria-live="polite">{diff===null?'Comparação indisponível':`${diff>0?'+':''}${format(diff)} ${city?'pontos Saeb':'pontos percentuais'}`}</p><p>{a.name} em relação a {b.name}. Esta diferença não é uma nota de serviço nem demonstra efeito da gestão pública.</p><p className={styles.universe}>{city?'Universo disponível: 26 capitais, rede municipal. Distrito Federal fora deste recorte.':'Universo disponível: cinco Grandes Regiões. Não há estimativa municipal da EBIA nesta base.'}</p></div>
        <div><div className={styles.bars} aria-hidden="true">{[a,b].map((p,i)=><div className={styles.barRow} key={p.id}><div><span>{p.name}</span><strong>{format(p.value)}</strong></div><div className={styles.track}>{p.value!==null&&<span className={i===0?styles.barPrimary:styles.barReference} style={{width:`${p.value/max*100}%`}}/>}</div></div>)}<p>Escala de 0 a {format(max)} {meta.unit}{city?' · limite visual fixo entre as 26 capitais':''}</p></div>
        <table className={styles.values}><caption>{measure} · {meta.period}</caption><thead><tr><th scope="col">Território</th><th scope="col">{meta.unit}</th></tr></thead><tbody>{[a,b].map(p=><tr key={p.id}><th scope="row">{p.name}</th><td>{format(p.value)}</td></tr>)}</tbody></table><div className={styles.links}><Link href={valuesHref}>Explorar este indicador ↗</Link><Link href={sourceHref}>Fonte e método ↗</Link><a href={'/'+meta.path.replace(/^public\//, '')} download>Baixar base completa ↓</a></div><p className={styles.small}>O download contém a base completa da fonte, não apenas os dois territórios selecionados.</p></div></div>}
    </section>
    <section id="dados-publicados" className={styles.section} aria-labelledby="atlas-chapters-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / Explorar capítulos</p><h2 id="atlas-chapters-title">O que faz parte da sua vida?</h2></div><p>Os capítulos abrem seus próprios recortes e períodos.</p></div>
      <div className={styles.chapterTools}><label>Encontrar um tema<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Educação, moradia, direitos…"/></label><label>Área<select value={group} onChange={e=>setGroup(e.target.value as GrupoDimensao | 'Todas')}>{['Todas',...GRUPOS].map(g=><option key={g}>{g}</option>)}</select></label></div>
      <div className={styles.chaptersLayout}><div className={styles.chapterList}>{visible.map(d=><button type="button" key={d.id} aria-pressed={dimension?.id===d.id} onClick={()=>setChapter(d.id)}><span className={styles.chapterNumber}>{String(DIMENSOES.indexOf(d)+1).padStart(2,'0')}</span><span>{d.titulo}<small>{d.href?'Painel publicado':'Em desenvolvimento'}</small></span><span aria-hidden="true">↗</span></button>)}{visible.length===0&&<p role="status">Nenhum tema encontrado. Tente outro termo ou selecione Todas.</p>}</div>
        <article className={styles.chapterDetail} aria-labelledby="atlas-detail-title">{dimension?<><p className={styles.eyebrow}>{dimension.grupo}</p><h3 id="atlas-detail-title">{dimension.verbo}.</h3><p>{dimension.descricao}</p><dl><div><dt>Recursos</dt><dd>{dimension.recursos}</dd></div><div><dt>Acesso</dt><dd>{dimension.acesso}</dd></div><div><dt>Resultados</dt><dd>{dimension.resultados}</dd></div></dl><p className={styles.small}>Escopo temático. A disponibilidade efetiva de cada indicador está declarada no painel. A seleção territorial atualiza o panorama e as comparações desta página. Os acessos no panorama preservam os recortes compatíveis; os demais capítulos abrem seus próprios universos.</p>{dimension.href?<Link className={styles.primaryLink} href={dimension.href}>Explorar {dimension.titulo} <span aria-hidden="true">→</span></Link>:<p className={styles.universe}>Este capítulo ainda não tem painel publicado.</p>}<a href={dimension.href?`#cobertura-${dimension.id}`:"#cobertura"} className={styles.detailLink}>Consultar cobertura e fontes{dimension.href?` de ${dimension.titulo}`:""} ↓</a></>:<><h3 id="atlas-detail-title">Nenhum capítulo neste recorte.</h3><p>Altere a busca ou a área para encontrar outro tema.</p><button type="button" className={styles.primaryLink} onClick={()=>{setSearch('');setGroup('Todas');}}>Limpar busca e área</button></>}</article></div>
    </section>
    <section className={styles.method} aria-labelledby="atlas-method-title"><div><p className={styles.eyebrow}>04 / Da evidência ao escore</p><h2 id="atlas-method-title">Uma nota precisa ser explicável.</h2><p>O modelo experimental dos serviços reúne três perguntas e ainda não produz nota. É distinto do piloto de resultados para os moradores.</p></div><ol>{[['Acesso','Quem precisa consegue ser atendido?'],['Resposta','A entrega chega a tempo e tem continuidade?'],['Qualidade','O serviço cumpre o padrão esperado?']].map(([title,text],i)=><li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
  </div>;
}
