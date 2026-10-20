'use client';

import {useEffect, useState} from 'react';
import {inteiro, naCapital, numero, RESSALVA_PRECISAO} from '@/lib/eficiencia/entrada-nucleo';
import {textoPosicao, type AperitivoCapital} from '@/lib/eficiencia/aperitivo-capital';
import {ConviteAperitivo} from '@/components/acesso/ConviteAperitivo';
import styles from './MinhaCapitalAperitivo.module.css';

/** Mesma capital de partida da página completa, para o HTML estático já mostrar números. */
const PADRAO = '2611606';
const DIRECAO = {maior: 'Valor maior, condição mais favorável', menor: 'Valor menor, condição mais favorável', nenhuma: 'Sem direção: mais não é melhor nem pior por si'};

/**
 * "Como está a minha capital?": o leitor escolhe uma das 26 capitais e vê quatro condições de 2022, cada uma
 * com valor, unidade, ano, posição entre as 26 e fonte. Os dados chegam por prop, montados no servidor; o
 * navegador não busca arquivo. A escolha fica no endereço (`?territorio=`), como na página completa.
 * O convite do fecho é renderizado aqui, no cliente: `ConviteAperitivo` usa o módulo de hooks `sessao.ts`
 * e não pode ser importado direto por página de servidor.
 */
export function MinhaCapitalAperitivo({dados, comConta}: {dados: AperitivoCapital; comConta: readonly string[]}) {
  const [id, setId] = useState(PADRAO);
  useEffect(() => {
    const ler = () => {
      const q = new URLSearchParams(window.location.search).get('territorio');
      setId(dados.capitais.some(c => c.id === q) ? q as string : PADRAO);
    };
    ler(); window.addEventListener('popstate', ler);
    return () => window.removeEventListener('popstate', ler);
  }, [dados]);
  function escolher(novo: string) {
    setId(novo);
    const url = new URL(window.location.href);
    url.searchParams.set('territorio', novo);
    window.history.replaceState(null, '', url);
  }
  const c = dados.capitais.find(x => x.id === id) ?? dados.capitais[0];
  const total = dados.capitais.length;
  return <><div className={styles.pagina}>
    <section className={styles.abertura} aria-labelledby="titulo-minha-capital">
      <div className={styles.aberturaInterna}>
        <p className={styles.kicker}>Eficiência Estatal · Consulta aberta</p>
        <h1 id="titulo-minha-capital" className={styles.titulo}>Como está a minha capital?</h1>
        <p className={styles.lead}>Escolha uma das {total} capitais estaduais e veja quatro resultados na vida dos moradores, cada um com o ano, a fonte e a posição da capital entre as {total}.</p>
        <label className={styles.escolha}>Sua capital
          <select value={c.id} onChange={e => escolher(e.target.value)}>
            {dados.capitais.map(x => <option key={x.id} value={x.id}>{x.nome} · {x.uf}</option>)}
          </select>
        </label>
        <p className={styles.contexto}><strong>{c.nome}</strong> · {c.uf} · {c.populacao === null ? 'população não disponível' : `${inteiro(c.populacao)} moradores`}<small>{dados.fontePopulacao}</small></p>
      </div>
    </section>

    <section className={styles.corpo} aria-labelledby="titulo-resultados">
      <h2 id="titulo-resultados" className={styles.subtitulo}>Quatro resultados {naCapital(c.nome)}</h2>
      <div className={styles.grade} aria-live="polite">
        {dados.indicadores.map(m => {
          const v = m.valores[c.id] ?? null;
          return <article key={m.id} className={styles.indicador} aria-labelledby={`aperitivo-${m.id}`}>
            <h3 id={`aperitivo-${m.id}`}>{m.pergunta}</h3>
            <p className={v === null ? styles.ausente : styles.valor}>{numero(v, m.unidade)}</p>
            <p className={styles.medida}>{m.titulo} · {m.periodo}</p>
            <p className={styles.posicao}><span>Posição</span>{textoPosicao(m.posicoes[c.id], total)}</p>
            <p className={styles.nota}>{DIRECAO[m.direcao]}. {m.nota} {m.precisao}</p>
            <p className={styles.fonte}>Fonte: <a href={m.fonteUrl} rel="noopener noreferrer">{m.fonte} <span aria-hidden="true">↗</span></a></p>
          </article>;
        })}
      </div>
      <p className={styles.ressalva}>As posições contam do maior para o menor valor entre as {total} capitais estaduais, sem o Distrito Federal, e não são nota nem meta. Os valores descrevem o território: não identificam quem os produziu. {RESSALVA_PRECISAO}</p>
    </section>
  </div>
  <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
    <ConviteAperitivo rota="/eficiencia-estatal" comConta={comConta} className="mt-10"/>
  </div></>;
}
