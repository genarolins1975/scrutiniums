'use client';
import Link from 'next/link';
import {aCapital,daCapital,diferenca,faixa,hrefPainel,numero,type CapitalRetrato,type Medida} from '@/lib/eficiencia/entrada-nucleo';
import styles from './Entrada.module.css';

const DIRECAO = {maior: 'Valor maior, condição mais favorável', menor: 'Valor menor, condição mais favorável', nenhuma: 'Sem direção: mais não é melhor nem pior por si'};

/** Uma pergunta: valores das duas capitais e a faixa das 26, com a mediana simples das elegíveis. */
function Linha({m, a, b, nomes}: {m: Medida; a: CapitalRetrato; b: CapitalRetrato; nomes: Record<string, string>}) {
  const f = faixa(m), alto = 18 + f.trilhas * 11;
  const va = m.valores[a.id], vb = m.valores[b.id];
  const fora = [a, b].filter(c => m.valores[c.id]?.foraDaComparacao);
  return <article className={styles.row} aria-labelledby={`pergunta-${m.id}`}>
    <div className={styles.rowQuestion}>
      <h3 id={`pergunta-${m.id}`}>{m.pergunta}</h3>
      <p className={styles.rowMeta}>{m.titulo} · {m.periodo}</p>
      <p className={styles.rowDirection}>{DIRECAO[m.direcao]}</p>
    </div>
    <div className={styles.rowValues}>
      <p><span>{a.nome}</span><strong className={styles.valueA}>{numero(va?.valor ?? null, m.unidade)}</strong></p>
      <p><span>{b.nome}</span><strong className={styles.valueB}>{numero(vb?.valor ?? null, m.unidade)}</strong></p>
      <p className={styles.rowDiff}>{diferenca(va?.valor ?? null, vb?.valor ?? null, m.unidade)} <span>{daCapital(a.nome)} em relação {aCapital(b.nome)}</span></p>
    </div>
    <div className={styles.rowStrip}>
      <svg viewBox={`0 0 400 ${alto + 6}`} role="img" aria-label={`${m.titulo}: ${f.pontos.length} capitais elegíveis; mediana ${numero(f.mediana, m.unidade)}; ${a.nome} ${numero(va?.valor ?? null, m.unidade)}; ${b.nome} ${numero(vb?.valor ?? null, m.unidade)}.`}>
        <line x1="12" x2="388" y1={alto} y2={alto} className={styles.stripAxis}/>
        {f.medianaX !== null && <line x1={f.medianaX} x2={f.medianaX} y1="4" y2={alto + 4} className={styles.stripMedian}/>}
        {f.pontos.filter(p => p.id !== a.id && p.id !== b.id).map(p => <circle key={p.id} cx={p.x} cy={alto - 7 - p.trilha * 11} r="4" className={styles.stripDot}><title>{`${nomes[p.id]}: ${numero(p.valor, m.unidade)}`}</title></circle>)}
        {f.pontos.filter(p => p.id === b.id).map(p => <path key={p.id} d={`M${p.x} ${alto - 7 - p.trilha * 11 - 6.5}l6.5 6.5l-6.5 6.5l-6.5 -6.5Z`} className={styles.stripPeer}><title>{`${b.nome}: ${numero(p.valor, m.unidade)}`}</title></path>)}
        {f.pontos.filter(p => p.id === a.id).map(p => <circle key={p.id} cx={p.x} cy={alto - 7 - p.trilha * 11} r="6.5" className={styles.stripFocus}><title>{`${a.nome}: ${numero(p.valor, m.unidade)}`}</title></circle>)}
      </svg>
      <div className={styles.stripScale} aria-hidden="true"><span>mín. {numero(f.pontos[0]?.valor ?? null, m.unidade)}</span><span>mediana {numero(f.mediana, m.unidade)}</span><span>máx. {numero(f.pontos.at(-1)?.valor ?? null, m.unidade)}</span></div>
      <p className={styles.rowNote}>{m.nota} {f.pontos.length} de {Object.keys(nomes).length} capitais na faixa.{fora.length ? ` ${fora.map(c => `${c.nome}: ${m.valores[c.id]!.foraDaComparacao}`).join('; ')}; valor exibido, fora da faixa e da mediana.` : ''}</p>
      <p className={styles.rowLinks}><a href={m.fonteUrl}>{m.fonte} ↗</a>{m.painel && (m.painel.href.startsWith('#') ? <a href={m.painel.href}>{m.painel.rotulo} ↓</a> : <Link href={hrefPainel(m.painel, a.id, b.id)}>{m.painel.rotulo} →</Link>)}</p>
    </div>
  </article>;
}

export function PerguntasCapital({id, eyebrow, titulo, texto, medidas, a, b, capitais, onReference, rodape}: {
  id: string; eyebrow: string; titulo: string; texto: string; medidas: Medida[]; a: CapitalRetrato; b: CapitalRetrato;
  capitais: CapitalRetrato[]; onReference: (id: string) => void; rodape?: React.ReactNode;
}) {
  const nomes = Object.fromEntries(capitais.map(c => [c.id, c.nome]));
  return <section id={id} className={styles.questions} aria-labelledby={`${id}-titulo`}>
    <header className={styles.sectionHead}>
      <div><p className={styles.eyebrow}>{eyebrow}</p><h2 id={`${id}-titulo`}>{titulo}</h2></div>
      <div className={styles.sectionAside}><p>{texto}</p>
        <p className={styles.legend}><span><i className={styles.legendFocus}/>{a.nome}</span><span><i className={styles.legendPeer}/>{b.nome}</span><span><i className={styles.legendDot}/>Demais capitais</span><span><i className={styles.legendMedian}/>Mediana das capitais</span></p></div>
    </header>
    {medidas.map(m => <Linha key={m.id} m={m} a={a} b={b} nomes={nomes}/>)}
    <details className={styles.tableDetails}><summary>Valores das 26 capitais</summary>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`Tabela: ${titulo}`}><table><caption>{titulo} · ordem alfabética · valores originais. Selecione uma capital para compará-la com {a.nome}.</caption>
        <thead><tr><th scope="col">Capital</th>{medidas.map(m => <th scope="col" key={m.id}>{m.curto}<small>{m.unidade} · {m.periodo}</small></th>)}</tr></thead>
        <tbody>{capitais.map(c => <tr key={c.id} className={c.id === a.id || c.id === b.id ? styles.tableSelected : undefined}><th scope="row"><button type="button" aria-disabled={c.id === a.id || c.id === b.id} onClick={() => { if (c.id !== a.id && c.id !== b.id) onReference(c.id); }}>{c.nome}</button>{c.id === a.id ? <small>Selecionada</small> : c.id === b.id ? <small>Comparador</small> : null}</th>{medidas.map(m => { const v = m.valores[c.id]; return <td key={m.id}>{numero(v?.valor ?? null, m.unidade)}{v?.foraDaComparacao ? <small>fora da comparação</small> : null}</td>; })}</tr>)}</tbody>
      </table></div>
    </details>
    {rodape}
  </section>;
}
