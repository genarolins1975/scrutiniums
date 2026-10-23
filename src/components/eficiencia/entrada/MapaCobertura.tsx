import { SeloProntidao } from "@/components/observatorios/SeloProntidao";
import Link from 'next/link';
import {DIMENSOES, GRUPOS} from '@/lib/eficiencia/dimensoes';
import {Siglas} from '@/components/eficiencia/Siglas';
import styles from './Entrada.module.css';
import {SeloComConta} from '@/components/acesso/SeloComConta';
import {prefetchDoLink} from '@/lib/rotasPublicas';

export type Nivel = 'indice' | 'capitais' | 'municipios' | 'ufs' | 'regioes' | 'brasil';
export type TemaCobertura = {id: string; titulo: string; pergunta: string; escopo: string; naoInclui: string; cobertura: string; fontes: string;
  entradas: {href: string; rotulo: string}[]; atualizacao: string | null; niveis: Nivel[]; outros?: string};

const COLUNAS: {id: Nivel; rotulo: string; ajuda: string}[] = [
  {id: 'indice', rotulo: 'Índice', ajuda: 'Tem indicador no índice de resultados v4, 26 capitais, 2022'},
  {id: 'capitais', rotulo: 'Capitais', ajuda: 'Estudo dedicado às 26 capitais estaduais, com conferência própria'},
  {id: 'municipios', rotulo: 'Municípios', ajuda: 'Dados por município, inclusive as capitais'},
  {id: 'ufs', rotulo: 'UFs', ajuda: 'Dados por Unidade da Federação'},
  {id: 'regioes', rotulo: 'Regiões', ajuda: 'Dados por Grande Região'},
  {id: 'brasil', rotulo: 'Brasil', ajuda: 'Total nacional'},
];

/** Até onde cada tema chega: níveis territoriais com dado publicado e a ficha do tema. */
export function MapaCobertura({temas}: {temas: TemaCobertura[]}) {
  const porId = new Map(temas.map(t => [t.id, t]));
  return <section id="cobertura" className={styles.coverage} aria-labelledby="titulo-cobertura">
    <header className={styles.sectionHead}>
      <div><p className={`rotulo ${styles.eyebrow}`}>04 · O que ainda não se sabe</p><h2 id="titulo-cobertura">Até onde cada tema chega.</h2></div>
      <div className={styles.sectionAside}>
        <p>Comparar capitais exige a mesma medida, no mesmo ano, para todas. Esta matriz mostra em que nível territorial cada tema tem dados publicados. Dos 16 temas, {DIMENSOES.filter(d => (porId.get(d.id)?.niveis ?? []).some(n => n === 'indice' || n === 'capitais' || n === 'municipios')).length} têm algum dado por município ou capital; {DIMENSOES.filter(d => !porId.has(d.id)).length} ainda não têm painel.</p>
        <p className={styles.small}>Abra um tema para ver o que mostra, o que não inclui, fontes, cobertura e acessos. Os anos de referência variam entre temas e não devem ser tratados como contemporâneos.</p>
      </div>
    </header>
    <div className={styles.matrix}>
      <div className={styles.matrixHead} aria-hidden="true"><span>Tema</span>{COLUNAS.map(c => <span key={c.id} title={c.ajuda}>{c.rotulo}</span>)}</div>
      {GRUPOS.map(g => <div key={g} className={styles.matrixGroup}>
        <p className={styles.matrixGroupTitle}>{g}</p>
        {DIMENSOES.filter(d => d.grupo === g).map(d => { const t = porId.get(d.id);
          return <details key={d.id} id={`cobertura-${d.id}`} className={styles.matrixRow}>
            <summary className="list-none">
              <span className={styles.matrixName}><strong>{t?.titulo ?? d.titulo}</strong><small><SeloProntidao valor={t ? 'publicado' : 'preparacao'} /></small></span>
              {COLUNAS.map(c => { const tem = !!t?.niveis.includes(c.id); return <span key={c.id} className={styles.matrixCell}><i className={tem ? (c.id === 'indice' ? styles.cellIndex : styles.cellOn) : styles.cellOff} aria-hidden="true"/><span className="sr-only">{c.ajuda}: {tem ? 'sim' : 'não'}.</span></span>; })}
            </summary>
            <div className={styles.matrixDetail}>
              {t ? <>
                <p className={styles.matrixQuestion}>{t.pergunta}</p>
                <dl>
                  <div><dt>O que mostra</dt><dd>{t.escopo}</dd></div>
                  <div><dt>O que não inclui</dt><dd>{t.naoInclui}</dd></div>
                  <div><dt>Cobertura</dt><dd>{t.cobertura}{t.outros ? ` Outros recortes: ${t.outros}.` : ''}</dd></div>
                  <div><dt>Fontes</dt><dd><Siglas texto={t.fontes}/></dd></div>
                  <div><dt>Última captura de dados</dt><dd>{t.atualizacao ?? 'não informada'}; os anos de referência estão em cada medida.</dd></div>
                </dl>
                <ul className={styles.matrixLinks}>{t.entradas.map((e, i) => <li key={e.href}><Link href={e.href} prefetch={prefetchDoLink(e.href)} className={i === 0 ? styles.matrixPrimary : undefined}>{e.rotulo}<SeloComConta href={e.href}/></Link></li>)}</ul>
              </> : <>
                <p className={styles.matrixQuestion}>{d.verbo}. {d.descricao}</p>
                <dl><div><dt>Recursos</dt><dd>{d.recursos}</dd></div><div><dt>Acesso</dt><dd>{d.acesso}</dd></div><div><dt>Resultados</dt><dd>{d.resultados}</dd></div></dl>
                <p className={styles.small}>Escopo temático do capítulo. Ainda não há painel publicado nem dado coletado neste observatório.</p>
              </>}
            </div>
          </details>; })}
      </div>)}
      <p className={styles.matrixKey}><span><i className={styles.cellIndex}/>Indicador no índice de resultados v4</span><span><i className={styles.cellOn}/>Dado publicado neste nível</span><span><i className={styles.cellOff}/>Sem dado publicado</span></p>
    </div>
  </section>;
}
