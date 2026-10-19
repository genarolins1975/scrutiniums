'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import dados from '@/lib/eficiencia/atlas-resumo.json';
import styles from './AtlasCidadao.module.css';
import {FrequenciaEscolar} from './FrequenciaEscolar';
import frequencia from '@/lib/eficiencia/frequencia-escolar.json';
import {RetratoCapital} from './entrada/RetratoCapital';
import {PerguntasCapital} from './entrada/PerguntasCapital';
import {csv, daCapital, naCapital, type RetratoDados} from '@/lib/eficiencia/entrada-nucleo';
import entrada from './entrada/Entrada.module.css';

type Selection = {place: string; reference: string; metric: 'frequencia' | 'saeb'; age: string};
const DEFAULT: Selection = {place: '2611606', reference: '4106902', metric: 'frequencia', age: '47813'};
const format = (value: number | null) => value === null ? 'Não disponível' : value.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 2});

function selectionFromUrl(ids: string[]): Selection {
  const q = new URLSearchParams(window.location.search);
  const place = ids.find(id => id === q.get('territorio')) ?? DEFAULT.place;
  const reference = ids.find(id => id === q.get('comparador') && id !== place) ?? (place === DEFAULT.reference ? DEFAULT.place : DEFAULT.reference);
  const metric = q.get('indicador') === 'saeb' ? 'saeb' : 'frequencia';
  const age = frequencia.ages.find(a => a.id === q.get('idade'))?.id ?? DEFAULT.age;
  return {place, reference, metric, age};
}

/**
 * Entrada do OBEE organizada por perguntas. `retrato` chega do servidor. A entrada mostra
 * só as posições; a nota experimental fica no painel do índice (decisão do dono de 19/10/2026).
 */
export function AtlasCidadao({retrato, cobertura = null}: {retrato: RetratoDados; cobertura?: React.ReactNode}) {
  const ids = retrato.capitais.map(c => c.id);
  const [selection, setSelection] = useState<Selection>(DEFAULT);
  useEffect(() => {
    const sync = () => setSelection(selectionFromUrl(retrato.capitais.map(c => c.id)));
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [retrato]);
  function select(next: Selection) {
    if (next.place === next.reference) next = {...next, reference: ids.find(id => id !== next.place)!};
    setSelection(next);
    const url = new URL(window.location.href);
    url.searchParams.set('territorio', next.place); url.searchParams.set('comparador', next.reference);
    url.searchParams.set('indicador', next.metric); url.searchParams.set('idade', next.age);
    window.history.pushState(null, '', url);
  }
  const a = retrato.capitais.find(c => c.id === selection.place) ?? retrato.capitais[0];
  const b = retrato.capitais.find(c => c.id === selection.reference) ?? retrato.capitais[1];
  const saeb = [a, b].map(c => ({c, v: dados.cities.find(x => x.id === c.id)?.value ?? null}));
  const max = Math.max(1, ...dados.cities.map(r => r.value ?? 0));
  const diff = saeb[0].v !== null && saeb[1].v !== null ? saeb[0].v - saeb[1].v : null;
  function download() {
    const url = URL.createObjectURL(new Blob(['﻿' + csv(retrato)], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'obee-retrato-26-capitais.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className={styles.atlas}>
    <RetratoCapital a={a} b={b} condicoes={retrato.condicoes} capitais={retrato.capitais}
      onSelect={(campo, id) => select(campo === 'territorio' ? {...selection, place: id} : {...selection, reference: id})}
      fonteContornos={retrato.fonteContornos} fontePopulacao={retrato.fontePopulacao}/>
    <div className={entrada.wrap}>

    <PerguntasCapital id="perguntas" eyebrow="01 · A vida na capital" titulo={`Sete perguntas sobre a vida ${naCapital(a.nome)}`}
      texto="Resultados observados entre os moradores em 2022, nas 26 capitais estaduais, sem o Distrito Federal. Cada ponto é uma capital; a linha tracejada é a mediana simples das capitais. Os valores descrevem o território: não identificam quem os produziu."
      medidas={retrato.condicoes} a={a} b={b} capitais={retrato.capitais}
      onReference={id => select({...selection, reference: id})}
      rodape={<div className={entrada.sectionFoot}><p>Cinco medidas vêm da amostra do Censo 2022, sem erro municipal publicado; homicídios combinam registros e modelo; esgotamento é dado do universo. Renda em reais nominais, sem ajuste de preços entre cidades.</p><button type="button" onClick={download}>Baixar as 26 capitais · CSV ↓</button></div>}/>

    <PerguntasCapital id="recursos" eyebrow="02 · O que o poder público aplica e oferece" titulo="Quanto a prefeitura aplica, e que capacidade registra"
      texto="Despesa do orçamento municipal por habitante em 2025 e capacidade potencial da atenção primária em dezembro de 2025. Gasto e resultados vêm de anos e perímetros diferentes: mais gasto não é melhor nem pior por si, e a página não os relaciona como causa e efeito."
      medidas={retrato.recursos} a={a} b={b} capitais={retrato.capitais}
      onReference={id => select({...selection, reference: id})}/>

    <section id="atlas-comparacao" className={styles.section} aria-labelledby="atlas-compare-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 · Aprofundar a educação</p><h2 id="atlas-compare-title">Escola por idade e aprendizagem.</h2></div><p>{selection.metric === 'frequencia' ? `${frequencia.source} · referência ${frequencia.period}` : `${dados.education.source} · referência ${dados.education.period}`}</p></div>
      <fieldset className={styles.indicatorChoice}><legend>Escolha a medida de educação</legend>{(['frequencia', 'saeb'] as const).map(m => <button type="button" key={m} aria-pressed={selection.metric === m} onClick={() => select({...selection, metric: m})}>{m === 'frequencia' ? `Frequência escolar · ${frequencia.period}` : `Aprendizagem · Saeb ${dados.education.period}`}</button>)}</fieldset>
      {selection.metric === 'frequencia' ? <FrequenciaEscolar place={a.id} reference={b.id} age={selection.age} onAgeChange={age => select({...selection, age})}/> :
      <div className={styles.comparison}><div><h3>Aprendizagem em português</h3><p>{dados.education.universe}</p><p className={styles.difference} aria-live="polite">{diff === null ? 'Comparação indisponível' : `${diff > 0 ? '+' : ''}${format(diff)} pontos Saeb`}</p><p>{a.nome} em relação a {b.nome}. Esta diferença não é uma nota de serviço nem demonstra efeito da gestão pública.</p><p className={styles.universe}>Universo disponível: 26 capitais, rede municipal. Distrito Federal fora deste recorte.</p></div>
        <div><div className={styles.bars} aria-hidden="true">{saeb.map(({c, v}, i) => <div className={styles.barRow} key={c.id}><div><span>{c.nome}</span><strong>{format(v)}</strong></div><div className={styles.track}>{v !== null && <span className={i === 0 ? styles.barPrimary : styles.barReference} style={{width: `${v / max * 100}%`}}/>}</div></div>)}<p>Escala de 0 a {format(max)} {dados.education.unit} · limite visual fixo entre as 26 capitais</p></div>
        <table className={styles.values}><caption>Aprendizagem em português · {dados.education.period}</caption><thead><tr><th scope="col">Território</th><th scope="col">{dados.education.unit}</th></tr></thead><tbody>{saeb.map(({c, v}) => <tr key={c.id}><th scope="row">{c.nome}</th><td>{format(v)}</td></tr>)}</tbody></table><div className={styles.links}><Link href="/eficiencia-estatal/educacao-municipal-capitais/resultados">Explorar este indicador ↗</Link><Link href="/eficiencia-estatal/educacao-municipal-capitais/metodos">Fonte e método ↗</Link><a href={'/' + dados.education.path.replace(/^public\//, '')} download>Baixar base completa ↓</a></div><p className={styles.small}>O download contém a base completa da fonte, não apenas os dois territórios selecionados.</p></div></div>}
    </section>

    {cobertura}

    <section className={styles.method} aria-labelledby="atlas-method-title"><div><p className={styles.eyebrow}>05 · Da evidência ao escore</p><h2 id="atlas-method-title">Uma nota precisa ser explicável.</h2><p>O modelo experimental dos serviços reúne três perguntas e ainda não produz nota. É distinto do índice de resultados na vida dos moradores, que tem nota experimental para as 26 capitais, com faixa, contribuições e estabilidade de cada par, num painel próprio.</p><p><Link href={`/eficiencia-estatal/indice-de-resultados?territorio=${a.id}&comparador=${b.id}`}>Ver o índice de resultados {daCapital(a.nome)} ↗</Link></p></div><ol>{[['Acesso', 'Quem precisa consegue ser atendido?'], ['Resposta', 'A entrega chega a tempo e tem continuidade?'], ['Qualidade', 'O serviço cumpre o padrão esperado?']].map(([title, text], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    </div>
  </div>;
}
