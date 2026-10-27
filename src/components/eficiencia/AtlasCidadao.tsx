'use client';

import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import Link from 'next/link';
import dados from '@/lib/eficiencia/atlas-resumo.json';
import styles from './AtlasCidadao.module.css';
import {FrequenciaEscolar} from './FrequenciaEscolar';
import frequencia from '@/lib/eficiencia/frequencia-escolar.json';
import {Recolhido} from "@/components/observatorios/Recolhido";
import {ReguaRetrato, SeletoresRetrato} from './entrada/RetratoCapital';
import {PerguntasCapital} from './entrada/PerguntasCapital';
import {daCapital, naCapital, numero, type RetratoDados} from '@/lib/eficiencia/entrada-nucleo';
import {SeloComConta} from '@/components/acesso/SeloComConta';
import {prefetchDoLink} from '@/lib/rotasPublicas';
import entrada from './entrada/Entrada.module.css';

type Selection = {place: string; reference: string; metric: 'frequencia' | 'saeb'; age: string};
const DEFAULT: Selection = {place: '2611606', reference: '4106902', metric: 'frequencia', age: '47813'};
/** CSV das 26 capitais, montado no servidor numa rota fechada: a exportação fica com conta (leva 1, 19/10/2026). */
const CSV_RETRATO = '/eficiencia-estatal/retrato-26-capitais.csv';
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
 * A capital escolhida na entrada do OBEE e a de comparação, no endereço (?territorio=&comparador=&indicador=&idade=). No molde único
 * (Iniciativa 4 do parecer de UX, 22/10/2026) a entrada é montada pelo EntradaColecao no servidor, e as peças que dependem da
 * escolha (título, seletores, régua, perguntas, educação e o modelo do escore) leem este contexto. A entrada mostra só as posições;
 * a nota experimental fica no painel do índice (decisão do dono de 19/10/2026).
 */
type Escolha = {retrato: RetratoDados; selection: Selection; select: (next: Selection) => void; a: RetratoDados['capitais'][number]; b: RetratoDados['capitais'][number]};
const Contexto = createContext<Escolha | null>(null);
function useEscolha(): Escolha {
  const c = useContext(Contexto);
  if (!c) throw new Error('peça da entrada do OBEE fora do ProvedorCapital');
  return c;
}

export function ProvedorCapital({retrato, children}: {retrato: RetratoDados; children: ReactNode}) {
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
  return <Contexto.Provider value={{retrato, selection, select, a, b}}>{children}</Contexto.Provider>;
}

/** O título da entrada, com a capital escolhida: "Como se vive em Recife?". */
export function TituloCapital() {
  const {a} = useEscolha();
  return <>Como se vive {naCapital(a.nome).split(' ')[0]} <em>{a.nome}</em>?</>;
}

/** Pedido do dono, 27/10/2026: a escolha entrega os resultados da capital antes das medianas e dos caminhos. */
export function SeletorCapital() {
  const {retrato, selection, select, a, b} = useEscolha();
  return <SeletoresRetrato a={a} b={b} capitais={retrato.capitais}
    onSelect={(campo, id) => select(campo === 'territorio' ? {...selection, place: id} : {...selection, reference: id})}
    resposta={<section className="mt-6" aria-labelledby="resposta-capital-titulo" data-resposta-especifica="">
      <h2 id="resposta-capital-titulo" className="font-serif text-2xl text-carvao">Sete resultados de {a.nome}</h2>
      <p className="mt-2 text-sm text-carvao-muted" role="status">Comparação com {b.nome}. São 26 capitais estaduais, sem o DF; os resultados não atribuem efeito à gestão.</p>
      <dl className="mt-4 grid gap-x-8 md:grid-cols-2">
        {retrato.condicoes.map(m => <div key={m.id} data-resultado-capital={m.id} className="border-t border-linha py-3">
          <dt className="text-sm font-medium text-carvao">{m.curto}</dt>
          <dd className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 tabular-nums">
            <span data-valor-resposta="" className="text-2xl text-carvao">{numero(m.valores[a.id]?.valor ?? null, m.unidade)} <span className="text-xs text-carvao-muted">{a.nome}</span></span>
            <span className="text-sm text-carvao-muted">{b.nome}: {numero(m.valores[b.id]?.valor ?? null, m.unidade)}</span>
          </dd>
          <dd className="mt-2 text-xs leading-relaxed text-mineral">{m.fonte} · {m.periodo} · {m.natureza}</dd>
          <dd className="mt-1 text-xs leading-relaxed text-carvao-muted">{m.nota} {m.precisao}</dd>
        </div>)}
      </dl>
      <a href="#retrato-titulo" className="inline-flex min-h-[44px] items-center text-sm text-carvao underline underline-offset-4">Ver a posição nas 26 capitais e como compará-las</a>
    </section>}/>;
}

/** A régua das sete condições (seção própria da entrada). */
export function ReguaCapital() {
  const {retrato, a, b} = useEscolha();
  return <div className={entrada.wrap}><Recolhido id="posicoes-capitais" titulo={`Onde ${a.nome} fica entre as 26 capitais`} resumo="As sete posições, os valores originais e os limites de comparação."><ReguaRetrato a={a} b={b} condicoes={retrato.condicoes} capitais={retrato.capitais} fonteContornos={retrato.fonteContornos} fontePopulacao={retrato.fontePopulacao}/></Recolhido></div>;
}

/** As sete perguntas sobre a vida na capital. */
export function PerguntasDaCapital() {
  const {retrato, selection, select, a, b} = useEscolha();
  return <div className={styles.atlas}><div className={entrada.wrap}>
      <PerguntasCapital id="perguntas" eyebrow="01 · A vida na capital" titulo={`Sete perguntas sobre a vida ${naCapital(a.nome)}`}
      texto="Resultados observados entre os moradores em 2022, nas 26 capitais estaduais, sem o Distrito Federal. Cada ponto é uma capital; a linha tracejada é a mediana simples das capitais. Os valores descrevem o território: não identificam quem os produziu."
      medidas={retrato.condicoes} a={a} b={b} capitais={retrato.capitais}
      onReference={id => select({...selection, reference: id})}
      rodape={<div className={entrada.sectionFoot}><p>Cinco medidas vêm da amostra do Censo 2022, sem erro municipal publicado; homicídios combinam registros e modelo; esgotamento é dado do universo. Renda em reais nominais, sem ajuste de preços entre cidades.</p><a href={CSV_RETRATO} download>Baixar as 26 capitais · CSV ↓<SeloComConta href={CSV_RETRATO}/></a></div>}/>

  </div></div>;
}

/** O que a prefeitura aplica e oferece. */
export function RecursosDaCapital() {
  const {retrato, selection, select, a, b} = useEscolha();
  return <div className={styles.atlas}><div className={entrada.wrap}>
    <PerguntasCapital id="recursos" eyebrow="02 · O que o poder público aplica e oferece" titulo="Quanto a prefeitura aplica, e que capacidade registra"
      texto="Despesa do orçamento municipal por habitante em 2025 e capacidade potencial da atenção primária em dezembro de 2025. Gasto e resultados vêm de anos e perímetros diferentes: mais gasto não é melhor nem pior por si, e a página não os relaciona como causa e efeito."
      medidas={retrato.recursos} a={a} b={b} capitais={retrato.capitais}
      onReference={id => select({...selection, reference: id})}/>

  </div></div>;
}

/** Escola por idade e aprendizagem, entre as duas capitais. */
export function EducacaoDaCapital() {
  const {selection, select, a, b} = useEscolha();
  const saeb = [a, b].map(c => ({c, v: dados.cities.find(x => x.id === c.id)?.value ?? null}));
  const max = Math.max(1, ...dados.cities.map(r => r.value ?? 0));
  const baseSaeb = '/' + dados.education.path.replace(/^public\//, '');
  const diff = saeb[0].v !== null && saeb[1].v !== null ? saeb[0].v - saeb[1].v : null;
  return <div className={styles.atlas}><div className={entrada.wrap}>
    <section id="atlas-comparacao" className={styles.section} aria-labelledby="atlas-compare-title"><div className={styles.sectionHeading}><div><p className={`rotulo ${styles.eyebrow}`}>03 · Aprofundar a educação</p><h2 id="atlas-compare-title">Escola por idade e aprendizagem.</h2></div><p>{selection.metric === 'frequencia' ? `${frequencia.source} · referência ${frequencia.period}` : `${dados.education.source} · referência ${dados.education.period}`}</p></div>
      <fieldset className={styles.indicatorChoice}><legend>Escolha a medida de educação</legend>{(['frequencia', 'saeb'] as const).map(m => <button type="button" key={m} aria-pressed={selection.metric === m} onClick={() => select({...selection, metric: m})}>{m === 'frequencia' ? `Frequência escolar · ${frequencia.period}` : `Aprendizagem · Saeb ${dados.education.period}`}</button>)}</fieldset>
      {selection.metric === 'frequencia' ? <FrequenciaEscolar place={a.id} reference={b.id} age={selection.age} onAgeChange={age => select({...selection, age})}/> :
      <div className={styles.comparison}><div><h3>Aprendizagem em português</h3><p>{dados.education.universe}</p><p className={styles.difference} aria-live="polite">{diff === null ? 'Comparação indisponível' : `${diff > 0 ? '+' : ''}${format(diff)} pontos Saeb`}</p><p>{a.nome} em relação a {b.nome}. Esta diferença não é uma nota de serviço nem demonstra efeito da gestão pública.</p><p className={styles.universe}>Universo disponível: 26 capitais, rede municipal. Distrito Federal fora deste recorte.</p></div>
        <div><div className={styles.bars} aria-hidden="true">{saeb.map(({c, v}, i) => <div className={styles.barRow} key={c.id}><div><span>{c.nome}</span><strong>{format(v)}</strong></div><div className={styles.track}>{v !== null && <span className={i === 0 ? styles.barPrimary : styles.barReference} style={{width: `${v / max * 100}%`}}/>}</div></div>)}<p>Escala de 0 a {format(max)} {dados.education.unit} · limite visual fixo entre as 26 capitais</p></div>
        <table className={styles.values}><caption>Aprendizagem em português · {dados.education.period}</caption><thead><tr><th scope="col">Território</th><th scope="col">{dados.education.unit}</th></tr></thead><tbody>{saeb.map(({c, v}) => <tr key={c.id}><th scope="row">{c.nome}</th><td>{format(v)}</td></tr>)}</tbody></table><div className={styles.links}><Link href="/eficiencia-estatal/educacao-municipal-capitais/resultados" prefetch={false}>Explorar este indicador ↗<SeloComConta href="/eficiencia-estatal/educacao-municipal-capitais/resultados"/></Link><Link href="/eficiencia-estatal/educacao-municipal-capitais/metodos">Fonte e método ↗</Link><a href={baseSaeb} download>Baixar base completa ↓<SeloComConta href={baseSaeb}/></a></div><p className={styles.small}>O download contém a base completa da fonte, não apenas os dois territórios selecionados.</p></div></div>}
    </section>

  </div></div>;
}

/** Da evidência ao escore: as três perguntas do modelo dos serviços, que ainda não produz nota (modelo didático da entrada). */
export function ModeloDoEscore() {
  const {a, b} = useEscolha();
  return <div className={styles.atlas}>
    <section className={styles.method} aria-label="Da evidência ao escore"><div><p>O modelo experimental dos serviços reúne três perguntas e ainda não produz nota. É distinto do índice de resultados na vida dos moradores, que tem nota experimental para as 26 capitais, com faixa, contribuições e estabilidade de cada par, num painel próprio.</p><p><Link href={`/eficiencia-estatal/indice-de-resultados?territorio=${a.id}&comparador=${b.id}`} prefetch={prefetchDoLink('/eficiencia-estatal/indice-de-resultados')}>Ver o índice de resultados {daCapital(a.nome)} ↗<SeloComConta href="/eficiencia-estatal/indice-de-resultados"/></Link></p></div><ol>{[['Acesso', 'Quem precisa consegue ser atendido?'], ['Resposta', 'A entrega chega a tempo e tem continuidade?'], ['Qualidade', 'O serviço cumpre o padrão esperado?']].map(([title, text], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
  </div>;
}
