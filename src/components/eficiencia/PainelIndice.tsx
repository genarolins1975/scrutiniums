'use client';

import {useEffect, useState} from 'react';
import {IndiceResultados} from './IndiceResultados';
import type {IndiceSnapshot} from '@/lib/eficiencia/indice-v4-nucleo';
// Mesmo contexto tipográfico e de cores da entrada, de que a seção do índice depende.
import styles from './AtlasCidadao.module.css';

const PADRAO = {place: '2611606', reference: '4106902'};

/**
 * Painel do índice de resultados (decisão do dono de 19/10/2026: a nota sai da
 * entrada e fica aqui). A escolha das capitais usa os mesmos parâmetros da
 * entrada, então o link "ver a nota" leva o par já escolhido.
 */
export function PainelIndice({data}: {data: IndiceSnapshot}) {
  const capitais = [...data.rows].sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'));
  const ids = capitais.map(c => c.id);
  const [sel, setSel] = useState(PADRAO);
  useEffect(() => {
    const validos = data.rows.map(r => r.id);
    const sync = () => {
      const q = new URLSearchParams(window.location.search);
      const place = validos.find(id => id === q.get('territorio')) ?? PADRAO.place;
      const reference = validos.find(id => id === q.get('comparador') && id !== place) ?? (place === PADRAO.reference ? PADRAO.place : PADRAO.reference);
      setSel({place, reference});
    };
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [data]);
  function escolher(next: {place: string; reference: string}) {
    if (next.place === next.reference) next = {...next, reference: ids.find(id => id !== next.place)!};
    setSel(next);
    const url = new URL(window.location.href);
    url.searchParams.set('territorio', next.place); url.searchParams.set('comparador', next.reference);
    window.history.pushState(null, '', url);
  }
  const campo = 'mt-2 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-base text-carvao';
  return <div className={styles.atlas}>
    <div className="grid gap-5 border-b border-linha pb-7 sm:grid-cols-2 md:max-w-[640px]">
      <label className="text-sm font-medium text-carvao">Capital
        <select className={campo} value={sel.place} onChange={e => escolher({...sel, place: e.target.value})}>{capitais.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
      <label className="text-sm font-medium text-carvao">Comparar com
        <select className={campo} value={sel.reference} onChange={e => escolher({...sel, reference: e.target.value})}>{capitais.filter(c => c.id !== sel.place).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
    </div>
    <IndiceResultados data={data} place={sel.place} reference={sel.reference} onReference={reference => escolher({...sel, reference})}/>
  </div>;
}
