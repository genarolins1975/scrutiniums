'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {DistribuicaoCapitais} from './DistribuicaoCapitais';
import {diferencaBMC, formataBMC, grupoBMC, grupoDePorte, PORTE_BMC, selecaoBMC, TITULO_PRECISAO, urlBMC,
  type BaseComparavel, type MedidaBMC, type ObservacaoBMC, type SelecaoBMC} from '@/lib/eficiencia/base_comparavel';
import styles from './CompararCidades.module.css';

const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
const label = (o: ObservacaoBMC | undefined, measure: MedidaBMC) => formataBMC(o?.valor ?? null, measure);

/** Cada valor aponta para a ressalva visível da sua medida; não depende de tooltip. */
export function ValorComparavel({observation, measure, warningId}: {observation?: ObservacaoBMC; measure: MedidaBMC; warningId: string}) {
  return <div className={styles.observation} data-alinhamento={measure.alinhamento}>
    <strong aria-describedby={warningId}>{label(observation, measure)}</strong>
    <span>{TITULO_PRECISAO[measure.precisao]}</span>
    <span>Classe {measure.alinhamento}{measure.alinhamento === 'B' ? ` · ${measure.desvios[0]}` : ''}</span>
    {observation?.intervalo_95 && <span>Intervalo condicional de 95%: {formataBMC(observation.intervalo_95[0], measure)} a {formataBMC(observation.intervalo_95[1], measure)}.</span>}
    {observation?.erro_padrao != null && <span>Erro padrão condicional: {formataBMC(observation.erro_padrao, measure)}.</span>}
    {!observation || observation.valor === null ? <span>{observation?.motivo_ausencia ?? 'A fonte não oferece este recorte municipal.'}</span> : null}
  </div>;
}

export function CompararCidades({data}: {data: BaseComparavel}) {
  const initial = selecaoBMC(new URLSearchParams(), data);
  const [selection, setSelection] = useState<SelecaoBMC>(initial);
  useEffect(() => {
    const sync = () => setSelection(selecaoBMC(new URLSearchParams(window.location.search), data));
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [data]);
  const measures = data.medidas.filter(m => m.base_2022);
  const index = useMemo(() => new Map(data.observacoes.map(o => [`${o.municipio}/${o.medida}`, o])), [data]);
  const a = data.municipios.find(c => c.id === selection.cidade)!;
  const b = data.municipios.find(c => c.id === selection.comparador)!;
  const current = measures.find(m => m.id === selection.medida)!;
  const groupKey = grupoBMC(data, selection);
  const distribution = data.distribuicoes[current.id][groupKey];
  const members = new Set(distribution.municipios);
  const groupRows = data.municipios.filter(c => members.has(c.id)).map(c => ({city: c, observation: index.get(`${c.id}/${current.id}`)!}));
  const ordered = [...groupRows].sort((x, y) => selection.ordem === 'valor'
    ? (x.observation.valor === null ? 1 : y.observation.valor === null ? -1 : x.observation.valor - y.observation.valor) || x.city.nome.localeCompare(y.city.nome, 'pt-BR')
    : x.city.nome.localeCompare(y.city.nome, 'pt-BR'));
  const groupTitle = groupKey === 'universo' ? `Universo de referência, ${distribution.n_universo} municípios`
    : groupKey.startsWith('porte:') ? PORTE_BMC[groupKey.slice(6)] : `Grande Região ${groupKey.slice(7)}`;
  function change(next: SelecaoBMC) {
    if (next.cidade === next.comparador) next = {...next, comparador: data.municipios.find(c => c.id !== next.cidade)!.id};
    setSelection(next);
    window.history.pushState(null, '', urlBMC(new URL(window.location.href), next));
  }
  return <section id="atlas-panorama" className={styles.section} aria-labelledby="bmc-title">
    <header className={styles.heading}><div><p className={styles.eyebrow}>Base Municipal Comparável / 2022</p><h1 id="bmc-title">Comparar cidades</h1><p>Oito medidas nas unidades de origem. Cada comparação declara o universo, a precisão e qualquer desvio da referência de 2022.</p></div><a className={styles.download} href="/eficiencia/base_comparavel_2022/observacoes.csv" download>Baixar observações e ressalvas · CSV</a></header>
    {data.estado !== 'UNIVERSO_ADQUIRIDO_E_RECONCILIADO' && <p role="status" className={styles.pending}>As 26 capitais estão reconciliadas. A referência de 318 municípios ainda não foi adquirida nesta etapa de trabalho; as distribuições abaixo contêm apenas os municípios indicados.</p>}
    <div className={styles.controls}><label>Cidade<select aria-label="Cidade" value={selection.cidade} onChange={e => change({...selection, cidade: e.target.value})}>{data.municipios.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.uf})</option>)}</select></label><label>Comparar com<select aria-label="Comparar com" value={selection.comparador} onChange={e => change({...selection, comparador: e.target.value})}>{data.municipios.filter(c => c.id !== selection.cidade).map(c => <option key={c.id} value={c.id}>{c.nome} ({c.uf})</option>)}</select></label></div>
    <p className={styles.selection} role="status" aria-atomic="true">Diferença de <strong>{a.nome}</strong> em relação a <strong>{b.nome}</strong>. Distrito Federal fora da coorte. Os grupos de pares usam somente porte e Grande Região.</p>
    <div className={styles.rows}>{measures.map(measure => {
      const first = index.get(`${a.id}/${measure.id}`), second = index.get(`${b.id}/${measure.id}`);
      const difference = diferencaBMC(first, second, measure);
      const warningId = `bmc-precisao-${measure.id}`;
      const number = difference === null ? 'Não disponível' : `${difference > 0 ? '+' : ''}${difference.toLocaleString('pt-BR', {minimumFractionDigits: measure.casas_publicadas, maximumFractionDigits: measure.casas_publicadas})} ${measure.unidade_diferenca}`;
      return <article key={measure.id} className={styles.row} aria-labelledby={`bmc-${measure.id}`}>
        <div className={styles.rowTitle}><h2 id={`bmc-${measure.id}`}>{measure.titulo}</h2><p>{measure.periodo} · classe {measure.alinhamento}{measure.alinhamento === 'B' ? `: ${measure.desvios[0]}` : ''}</p><button type="button" aria-pressed={selection.medida === measure.id} onClick={() => {change({...selection, medida: measure.id}); requestAnimationFrame(() => {const target = document.getElementById('bmc-reference-title'); target?.scrollIntoView({block: 'start'}); target?.focus({preventScroll: true});});}}>Ver distribuição desta medida</button></div>
        <div className={styles.numbers}><div className={styles.difference}><span>Diferença em unidade nativa</span><strong>{number}</strong><span>{a.nome} em relação a {b.nome}</span></div><dl className={styles.pair}><div><dt>{a.nome} ({a.uf})</dt><dd><ValorComparavel observation={first} measure={measure} warningId={warningId}/></dd></div><div><dt>{b.nome} ({b.uf})</dt><dd><ValorComparavel observation={second} measure={measure} warningId={warningId}/></dd></div></dl></div>
        <p id={warningId} className={styles.precision}>{measure.ressalva_precisao}</p>
        <details className={styles.method}><summary>Definição, fonte e limites</summary><p>{measure.universo}</p><p>{measure.limites}</p><p>{measure.fonte} · referência {measure.periodo}.</p>{[first, second].filter((o): o is ObservacaoBMC => !!o).map(o => <p key={o.municipio}>{o.nome}: captura {date(o.capturado_em)}. Hash do arquivo de origem: <code>{o.sha256}</code>.</p>)}<Link href="/eficiencia/base_comparavel_2022/base.json">Consultar base e contratos em JSON</Link></details>
      </article>;
    })}</div>
    <section className={styles.reference} aria-labelledby="bmc-reference-title"><div className={styles.referenceHeading}><div><p className={styles.eyebrow}>Referências descritivas</p><h2 id="bmc-reference-title" tabIndex={-1}>Onde os valores se situam?</h2><p>Uma distribuição por medida. Cada município tem igual peso; os grupos não ajustam os resultados por contexto.</p></div><label>Medida da distribuição<select aria-label="Medida da distribuição" value={selection.medida} onChange={e => change({...selection, medida: e.target.value})}>{measures.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}</select></label></div>
      <label className={styles.peerControl}>Universo ou grupo de pares<select aria-label="Universo ou grupo de pares" value={selection.grupo} onChange={e => change({...selection, grupo: e.target.value})}><option value="universo">Todos os {data.municipios.length} municípios da referência</option><option value="a_porte">Porte de {a.nome}: {PORTE_BMC[grupoDePorte(a.populacao)]}</option><option value="a_regiao">Região de {a.nome}: {a.grande_regiao}</option><option value="b_porte">Porte de {b.nome}: {PORTE_BMC[grupoDePorte(b.populacao)]}</option><option value="b_regiao">Região de {b.nome}: {b.grande_regiao}</option></select></label>
      <p className={styles.coverage}>{groupTitle}. {distribution.n_observados} observados e {distribution.n_ausentes} ausentes, de {distribution.n_universo} municípios.{!distribution.cobertura_completa && ' A distribuição descreve somente os valores observados, não todo o universo.'}</p>
      <div className={styles.legend}><span>{a.nome} ({a.uf}) · cidade selecionada{!members.has(a.id) && ', fora deste grupo'}</span><span>{b.nome} ({b.uf}) · comparador{!members.has(b.id) && ', fora deste grupo'}</span></div>
      <DistribuicaoCapitais compacta titulo={`${current.titulo} · ${current.periodo}`} zero={false} rotuloGrupo="municípios com valor observado" rotuloPrecisao={current.ressalva_precisao}
        linhas={groupRows.filter(r => r.observation.valor !== null).map(r => ({chave: r.city.id, rotulo: `${r.city.nome} (${r.city.uf})`, valor: r.observation.valor!, destacada: [a.id, b.id].includes(r.city.id)}))}
        referencias={{mediana: distribution.mediana, media: null, faixa: distribution.q1 !== null && distribution.q3 !== null ? {q1: distribution.q1, q3: distribution.q3} : null}}
        formata={value => formataBMC(value, current)} formataEixo={value => value.toLocaleString('pt-BR', {maximumFractionDigits: 1})}/>
      <dl className={styles.statistics}>{([['Mínimo', distribution.minimo], ['Primeiro quartil', distribution.q1], ['Mediana', distribution.mediana], ['Terceiro quartil', distribution.q3], ['Máximo', distribution.maximo]] as const).map(([title, value]) => <div key={title}><dt>{title}</dt><dd aria-describedby="bmc-distribution-precision">{formataBMC(value, current)}</dd></div>)}</dl>
      <p id="bmc-distribution-precision" className={styles.precision}>{current.ressalva_precisao} Os quartis são descrições da distribuição, não intervalos de confiança.</p>
      <details className={styles.tableDetails}><summary>Tabela equivalente dos {distribution.n_universo} municípios deste grupo</summary><label>Ordem da tabela<select aria-label="Ordem da tabela" value={selection.ordem} onChange={e => change({...selection, ordem: e.target.value as 'nome' | 'valor'})}><option value="nome">Nome, em ordem alfabética</option><option value="valor">Valor, do menor para o maior</option></select></label>
        <table className={styles.table}><caption>{current.titulo} · {current.periodo} · {current.unidade}</caption><thead><tr><th scope="col">Município</th><th scope="col">Valor e precisão</th><th scope="col">Alinhamento e estado</th></tr></thead><tbody>{ordered.map(({city, observation: o}) => <tr key={city.id} data-selecionado={[a.id, b.id].includes(city.id) ? 'sim' : undefined}><th scope="row">{city.nome} ({city.uf}){city.id === a.id ? ' · cidade selecionada' : city.id === b.id ? ' · comparador' : ''}</th><td data-label="Valor e precisão"><strong>{formataBMC(o.valor, current)}</strong><p>{TITULO_PRECISAO[o.precisao]}. {o.ressalva_precisao}</p></td><td data-label="Alinhamento e estado">Classe {o.alinhamento}{o.alinhamento === 'B' ? ` · ${o.desvios[0]}` : ''}<p>{o.estado === 'OBSERVADO' ? 'Observado' : o.motivo_ausencia}</p></td></tr>)}</tbody></table>
      </details>
    </section>
    <section className={styles.capacity} aria-labelledby="bmc-capacity-title"><p className={styles.eyebrow}>Outra camada / dezembro de 2025</p><h2 id="bmc-capacity-title">Capacidade dos serviços</h2><p>A cobertura potencial de APS tem classe C: outra natureza e outro período. Ela fica fora das oito medidas e das distribuições de 2022.</p><dl className={styles.pair}>{[a, b].map(city => {
      const measure = data.medidas.find(m => m.id === 'aps')!;
      const o = data.capacidade_servicos.find(r => r.municipio === city.id);
      return <div key={city.id}><dt>{city.nome} ({city.uf})</dt><dd><ValorComparavel observation={o} measure={measure} warningId="bmc-aps-precision"/></dd></div>;
    })}</dl><p id="bmc-aps-precision" className={styles.precision}>{data.medidas.find(m => m.id === 'aps')!.ressalva_precisao}</p><Link href="/eficiencia-estatal/saude-capitais/comparar?med=cobertura_aps&ano=2025">Explorar a cobertura potencial e sua fonte</Link></section>
    <p className={styles.footer}><Link href="/eficiencia-estatal?visao=regioes">Comparar Grandes Regiões em seus próprios recortes</Link> · <Link href="#dados-publicados">Explorar capítulos e fontes</Link></p>
  </section>;
}
