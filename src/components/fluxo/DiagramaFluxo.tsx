'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { layoutFluxo, type EloFluxo, type NoFluxo, type TipoFluxo } from '@/lib/fluxo/layout';
import { milhoes, parcela, reaisCurto } from '@/lib/fluxo/formato';
import s from './DiagramaFluxo.module.css';

const LEGENDA: Record<TipoFluxo, string> = {
  entrada: 'Receita que entra',
  tronco: 'Total em cada etapa',
  'outro-ente': 'Sai para outros entes',
  gasto: 'Gasto',
  resultado: 'Déficit ou superávit',
  diferenca: 'Diferença entre os demonstrativos',
};

export interface DiagramaFluxoProps {
  id: string;
  titulo: string;
  nivel?: 'h2' | 'h3';
  subtitulo: ReactNode;
  nos: NoFluxo[];
  elos: EloFluxo[];
  colunas: string[];
  /** Frase factual, calculada do mesmo dado do diagrama. */
  leitura?: ReactNode;
  /** Descrição curta para quem não vê o desenho. */
  resumo: string;
  /** Total de referência para as parcelas da tabela (normalmente a arrecadação). */
  referencia: number;
  rotuloReferencia: string;
  ressalvas?: ReactNode;
  metodo?: ReactNode;
  rodape?: ReactNode;
  controles?: ReactNode;
}

export function DiagramaFluxo(p: DiagramaFluxoProps) {
  const raiz = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(1120);
  const [foco, setFoco] = useState<string | null>(null);
  const [fixo, setFixo] = useState<string | null>(null);
  const Titulo = p.nivel ?? 'h2';

  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Abaixo de 1000 px o diagrama dá lugar às etapas (CSS); o layout nunca é calculado mais estreito que isso.
  const largo = largura >= 1120;
  const layout = useMemo(() => layoutFluxo(p.nos, p.elos, {
    largura: Math.max(1000, Math.min(largura, 1280)),
    altura: 600,
    margemEsquerda: largo ? 236 : 210,
    margemDireita: largo ? 300 : 262,
    larguraNo: 12,
    espaco: 12,
    passoRotulo: 36,
  }), [p.nos, p.elos, largura, largo]);

  const ativo = fixo ?? foco;
  const ligados = useMemo(() => {
    if (!ativo) return null;
    const ids = new Set([ativo]);
    for (const e of p.elos) {
      if (e.de === ativo) ids.add(e.para);
      if (e.para === ativo) ids.add(e.de);
    }
    return ids;
  }, [ativo, p.elos]);
  const noAtivo = ativo ? p.nos.find(n => n.id === ativo) : null;
  const tipos = Array.from(new Set(p.nos.map(n => n.tipo)));
  const ultima = p.colunas.length - 1;

  return (
    <section className={s.raiz} id={p.id} aria-labelledby={`${p.id}-titulo`}>
      <header className={s.cabeca}>
        <div>
          <Titulo id={`${p.id}-titulo`} className={s.titulo}>{p.titulo}</Titulo>
          <p className={s.subtitulo}>{p.subtitulo}</p>
        </div>
        {p.controles}
      </header>
      {p.leitura && <p className={s.leitura}>{p.leitura}</p>}

      <div ref={raiz} className={s.quadro}>
        <figure className={s.largo}>
          <svg
            className={s.svg}
            viewBox={`0 0 ${layout.largura} ${layout.altura}`}
            width={layout.largura}
            height={layout.altura}
            role="img"
            aria-labelledby={`${p.id}-titulo ${p.id}-resumo`}
          >
            <desc id={`${p.id}-resumo`}>{p.resumo}</desc>
            <g aria-hidden="true">
              {p.colunas.map((c, i) => {
                const x = layout.nos.find(n => n.coluna === i)?.x ?? 0;
                const anchor = i === 0 ? 'end' : i === ultima ? 'start' : 'middle';
                const dx = i === 0 ? layout.larguraNo : i === ultima ? 0 : layout.larguraNo / 2;
                return <text key={c} x={x + dx} y={-6} className={s.coluna} textAnchor={anchor}>{c}</text>;
              })}
            </g>
            <g>
              {layout.elos.map(e => (
                <path
                  key={`${e.de}-${e.para}`}
                  d={e.caminho}
                  className={`${s.elo} ${s['t-' + e.tipo]} ${ligados ? (ligados.has(e.de) && ligados.has(e.para) && (e.de === ativo || e.para === ativo) ? s.aceso : s.apagado) : ''}`}
                >
                  <title>{`${nome(p.nos, e.de)} → ${nome(p.nos, e.para)}: ${reaisCurto(e.valor)}`}</title>
                </path>
              ))}
            </g>
            {layout.nos.map(n => {
              const esquerda = n.coluna === 0;
              const meio = n.coluna !== 0 && n.coluna !== ultima;
              const xt = esquerda ? n.x - 10 : n.x + layout.larguraNo + 8;
              const centro = n.y + n.altura / 2;
              const desloca = Math.abs(n.yRotulo - centro) > 3;
              const apagado = ligados && !ligados.has(n.id);
              return (
                <g
                  key={n.id}
                  className={`${s.no} ${s['t-' + n.tipo]} ${apagado ? s.apagado : ''} ${fixo === n.id ? s.fixo : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={fixo === n.id}
                  aria-label={`${n.nome}: ${reaisCurto(n.valor)}${n.nota ? ', ' + n.nota : ''}`}
                  onMouseEnter={() => setFoco(n.id)}
                  onMouseLeave={() => setFoco(null)}
                  onFocus={() => setFoco(n.id)}
                  onBlur={() => setFoco(null)}
                  onClick={() => setFixo(fixo === n.id ? null : n.id)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setFixo(fixo === n.id ? null : n.id); }
                    if (ev.key === 'Escape') setFixo(null);
                  }}
                >
                  <rect x={n.x} y={n.y} width={layout.larguraNo} height={n.altura} />
                  {/* Área de toque maior que a barra fina. */}
                  <rect x={esquerda ? n.x - 180 : n.x} y={Math.min(n.y, n.yRotulo - 16)} width={180 + layout.larguraNo} height={Math.max(n.altura, 32)} className={s.alvo} />
                  {desloca && !meio && (
                    <path d={esquerda ? `M${n.x - 2},${centro}L${n.x - 8},${n.yRotulo}` : `M${n.x + layout.larguraNo + 2},${centro}L${n.x + layout.larguraNo + 6},${n.yRotulo}`} className={s.guia} />
                  )}
                  <text x={xt} y={n.yRotulo - 3} textAnchor={esquerda ? 'end' : 'start'} className={`${s.rotulo} ${meio ? s.halo + ' ' + s.rotuloMeio : ''}`}>
                    {quebrar(n.nome, meio ? 19 : 34).map((linha, i, todas) => (
                      <tspan key={i} x={xt} dy={i === 0 ? -(todas.length - 1) * 15 : 15}>{linha}</tspan>
                    ))}
                  </text>
                  <text x={xt} y={n.yRotulo + 14} textAnchor={esquerda ? 'end' : 'start'} className={`${s.valor} ${meio ? s.halo : ''}`}>
                    {reaisCurto(n.valor)}
                    {n.nota && n.coluna === ultima ? <tspan className={s.nota}>{` · ${n.nota.split(' do ')[0]}`}</tspan> : null}
                  </text>
                </g>
              );
            })}
          </svg>
          <figcaption className={s.detalhe} aria-live="polite">
            {noAtivo ? (
              <>
                <strong>{noAtivo.nome}</strong> {reaisCurto(noAtivo.valor)}{noAtivo.nota ? ` · ${noAtivo.nota}` : ''}
                {noAtivo.partes && noAtivo.partes.length > 0 && (
                  <span className={s.partes}>{noAtivo.partes.map(([k, v]) => `${k}: ${reaisCurto(v)}`).join(' · ')}</span>
                )}
              </>
            ) : (
              <span>A espessura de cada faixa é proporcional ao valor. Passe o mouse, toque ou use Tab sobre um bloco para ver a composição.</span>
            )}
          </figcaption>
        </figure>

        <ol className={s.etapas} aria-label={`${p.titulo}, etapa por etapa`}>
          {p.colunas.map((c, i) => {
            const nos = p.nos.filter(n => n.coluna === i);
            const total = nos.reduce((acc, n) => acc + n.valor, 0);
            return (
              <li key={c} className={s.etapa}>
                <h4 className={s.etapaTitulo}>{c}</h4>
                {nos.length > 1 && (
                  <div className={s.regua} aria-hidden="true">
                    {nos.map(n => <span key={n.id} className={s['t-' + n.tipo]} style={{ width: `${(100 * n.valor) / total}%` }} />)}
                  </div>
                )}
                <ul className={s.linhas}>
                  {nos.map(n => (
                    <li key={n.id} className={s.linha}>
                      <i className={`${s.amostra} ${s['t-' + n.tipo]}`} aria-hidden="true" />
                      <span className={s.linhaNome}>{n.nome}{n.nota && <small>{n.nota}</small>}</span>
                      <strong className={s.linhaValor}>{reaisCurto(n.valor)}</strong>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      <ul className={s.legenda} aria-label="Legenda">
        {tipos.map(t => <li key={t}><i className={`${s.amostra} ${s['t-' + t]}`} aria-hidden="true" />{LEGENDA[t]}</li>)}
      </ul>
      {p.ressalvas && <div className={s.ressalvas}>{p.ressalvas}</div>}

      <details className={s.recolhido}>
        <summary>Conferir os valores exatos</summary>
        <div className={s.tabelaRolagem} role="region" tabIndex={0} aria-label={`Tabela do fluxo: ${p.titulo}`}>
          <table className={s.tabela}>
            <caption>Valores em R$ milhões correntes, uma casa decimal. Parcela sobre {p.rotuloReferencia}.</caption>
            <thead><tr><th scope="col">Etapa</th><th scope="col">Item</th><th scope="col" className={s.num}>R$ milhões</th><th scope="col" className={s.num}>Parcela</th></tr></thead>
            <tbody>
              {p.nos.flatMap(n => [
                <tr key={n.id}><td>{p.colunas[n.coluna]}</td><th scope="row">{n.nome}</th><td className={s.num}>{milhoes(n.valor)}</td><td className={s.num}>{parcela(n.valor, p.referencia)}</td></tr>,
                ...(n.partes ?? []).map(([k, v]) => <tr key={n.id + k} className={s.sub}><td /><td>{k}</td><td className={s.num}>{milhoes(v)}</td><td className={s.num}>{parcela(v, p.referencia)}</td></tr>),
              ])}
            </tbody>
          </table>
        </div>
      </details>
      {p.metodo && (
        <details className={s.recolhido}>
          <summary>Como este fluxo foi montado</summary>
          <div className={s.metodo}>{p.metodo}</div>
        </details>
      )}
      {p.rodape}
    </section>
  );
}

/** Quebra o nome em até duas linhas de até `max` caracteres, sem cortar palavra. */
export function quebrar(texto: string, max: number): string[] {
  if (texto.length <= max) return [texto];
  const palavras = texto.split(' ');
  let primeira = '';
  while (palavras.length && (primeira + ' ' + palavras[0]).trim().length <= max) primeira = (primeira + ' ' + palavras.shift()).trim();
  if (!primeira) primeira = palavras.shift() ?? '';
  return palavras.length ? [primeira, palavras.join(' ')] : [primeira];
}

function nome(nos: NoFluxo[], id: string): string {
  return nos.find(n => n.id === id)?.nome ?? id;
}
