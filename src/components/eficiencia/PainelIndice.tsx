'use client';

import {useEffect, useState} from 'react';
import {IndiceResultados} from './IndiceResultados';
import {Controles, FiguraAnalitica} from '@/components/painel';
import type {IndiceSnapshot} from '@/lib/eficiencia/indice-v4-nucleo';
import type {Proveniencia} from '@/lib/painel/tipos';
// Mesmo contexto tipográfico e de cores da entrada, de que a seção do índice depende.
import styles from './AtlasCidadao.module.css';

const PADRAO = {place: '2611606', reference: '4106902'};

/**
 * Painel do índice de resultados (decisão do dono de 19/10/2026: a nota sai da
 * entrada e fica aqui). A escolha das capitais usa os mesmos parâmetros da
 * entrada, então o link "ver a nota" leva o par já escolhido.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a escolha do par nos Controles do kit, logo antes da figura que ela
 * muda, e a interface da edição v4 dentro da FiguraAnalitica, marcada como figura legada (os gráficos dela são os da edição congelada,
 * identificados por SHA-256 em docs/obee/resultados/v4/interface-v4.json, e não os do kit).
 */
export function PainelIndice({data, proveniencia, complementares, rota}: {data: IndiceSnapshot; proveniencia: Proveniencia; complementares: {rotulo: string; p: Proveniencia}[]; rota: string}) {
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
  const nome = (id: string) => data.rows.find(r => r.id === id)?.name ?? id;
  const padrao = sel.place === PADRAO.place && sel.reference === PADRAO.reference;
  return <>
    <Controles rotulo="Par de capitais da comparação" resumo={`Mostrando ${nome(sel.place)}, comparada com ${nome(sel.reference)}.`} limpar={padrao ? undefined : {href: rota}} idioma="pt">
      <label className="min-w-[14rem] text-sm font-medium text-carvao">Capital
        <select className={campo} value={sel.place} onChange={e => escolher({...sel, place: e.target.value})}>{capitais.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
      <label className="min-w-[14rem] text-sm font-medium text-carvao">Comparar com
        <select className={campo} value={sel.reference} onChange={e => escolher({...sel, reference: e.target.value})}>{capitais.filter(c => c.id !== sel.place).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
    </Controles>
    <FiguraAnalitica
      id="indice"
      pergunta="Qual é a nota de cada capital, e quão estável ela é nos testes?"
      subtitulo={`Índice de resultados · pontos de 0 a 100 · 26 capitais estaduais · ${data.reference_year}`}
      natureza="CALCULADO"
      proveniencia={proveniencia}
      complementares={complementares}
      idioma="pt"
      tabela={{naFigura: 'as notas e as faixas das 26 capitais estão em "Notas e faixas das 26 capitais", logo abaixo da distribuição; as parcelas da diferença e cada hipótese do par estão em "Composição, diferença e testes da nota".'}}
      comoInterpretar="A nota é a média das posições relativas da capital nos sete indicadores, com peso 1/7 cada. A média das capitais é 50 por construção; 50 não é meta."
      naoConcluir="Não identifica quem produziu o resultado nem separa competências de União, estado e município. Não mede satisfação, qualidade de um serviço específico ou gasto."
    >
      <div data-figura-legado="indice-v4" className={styles.atlas}>
        <IndiceResultados data={data} place={sel.place} reference={sel.reference} onReference={reference => escolher({...sel, reference})}/>
      </div>
    </FiguraAnalitica>
  </>;
}
