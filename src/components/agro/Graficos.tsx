import { numeroAgro } from '@/lib/agro/modelo';
import s from './Agro.module.css';
export type LinhaBarraAgro = {
    nome: string;
    valor: number | null;
    focal?: boolean;
};
export function BarrasAgro({ titulo, unidade, periodo, linhas, nota, maximo }: {
    titulo: string;
    unidade: string;
    periodo: string;
    linhas: LinhaBarraAgro[];
    nota: string;
    maximo?: number;
}) { const max = maximo ?? Math.max(0, ...linhas.map(l => l.valor ?? 0)), abreviar = unidade.startsWith('R$') && max >= 1e9, fmt = (v: number | null) => v === null ? 'Não disponível' : abreviar ? numeroAgro(v / 1e9, 1) + ' bi' : numeroAgro(v, unidade.includes('%') || unidade.includes('bilhões') || unidade.includes('milhões') ? 1 : unidade.startsWith('R$') ? 2 : 0); return <figure className={s.figure}><figcaption><strong>{titulo}</strong><span>{unidade} · {periodo} · barras partem de zero{abreviar ? ' · valores abreviados em bilhões de reais' : ''}</span></figcaption><div className={s.barAxis} aria-hidden="true"><span>0</span><span>{fmt(max)}</span></div>{linhas.map((r, i) => <div className={s.barRow} key={r.nome + i} data-focal={r.focal}><span>{r.nome}</span><div className={s.barTrack} aria-hidden="true">{r.valor !== null && <span style={{ width: (max > 0 ? 100 * Math.max(0, r.valor) / max : 0) + '%' }}/>}</div><strong>{fmt(r.valor)}</strong></div>)}<p className={s.note}>{nota}</p></figure>; }
export function SerieAgro({ titulo, unidade, linhas, nota }: {
    titulo: string;
    unidade: string;
    linhas: {
        periodo: string;
        valor: number | null;
    }[];
    nota: string;
}) {
    const valores = linhas.filter(l => l.valor !== null).map(l => l.valor!), min = Math.min(0, ...valores), max = Math.max(0, ...valores), range = max - min || 1;
    return <figure className={s.figure}><figcaption><strong>{titulo}</strong><span>{unidade} · {linhas[0]?.periodo} a {linhas.at(-1)?.periodo} · lacunas interrompem a linha</span></figcaption>{[true, false].map(mobile => { const width = mobile ? 360 : 900, left = mobile ? 80 : 100, right = width - 20, top = 28, bottom = mobile ? 230 : 290, x = (i: number) => left + i * (right - left) / Math.max(1, linhas.length - 1), y = (v: number) => bottom - (v - min) * (bottom - top) / range; const segmentos: {
        i: number;
        v: number;
    }[][] = []; let atual: typeof segmentos[number] = []; linhas.forEach((l, i) => { if (l.valor === null) {
        if (atual.length)
            segmentos.push(atual);
        atual = [];
    }
    else
        atual.push({ i, v: l.valor }); }); if (atual.length)
        segmentos.push(atual); const ticks = [...new Set([0, Math.floor((linhas.length - 1) / 2), linhas.length - 1])]; return <svg key={String(mobile)} className={mobile ? s.figureMobile : s.figureDesktop} viewBox={`0 0 ${width} ${bottom + 50}`} role="img" aria-label={`${titulo}; tabela e exportação apresentam todos os períodos e valores.`}>{[min, min + range / 2, max].map((v, i) => <g key={i}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="var(--cor-linha)"/><text x={left - 10} y={y(v) + 5} textAnchor="end" fill="currentColor" fontSize={mobile ? 20 : 18}>{new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(v)}</text></g>)}{min < 0 && <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="var(--cor-mineral)"/>}{segmentos.map((r, i) => <g key={i}><polyline fill="none" stroke="var(--cor-energia)" strokeWidth="2.5" points={r.map(l => `${x(l.i)},${y(l.v)}`).join(' ')}/>{r.map(l => <circle key={l.i} cx={x(l.i)} cy={y(l.v)} r="2.5" fill="var(--cor-energia)"><title>{`${linhas[l.i].periodo}: ${numeroAgro(l.v, 2)} ${unidade}`}</title></circle>)}</g>)}{ticks.map(i => <text key={i} x={x(i)} y={bottom + 28} textAnchor={i === 0 ? 'start' : i === linhas.length - 1 ? 'end' : 'middle'} fontSize={mobile ? 20 : 18} fill="currentColor">{linhas[i]?.periodo}</text>)}</svg>; })}<p className={s.note}>{nota}</p></figure>;
}
export function TabelaAgro({ titulo, colunas, linhas }: {
    titulo: string;
    colunas: string[];
    linhas: (string | number | null)[][];
}) { return <div className={s.tableWrap} tabIndex={0} role="region" aria-label={titulo}><table className={s.table}><caption>{titulo}</caption><thead><tr>{colunas.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead><tbody>{linhas.map((r, i) => <tr key={i}>{r.map((v, j) => j === 0 ? <th key={j} scope="row">{typeof v === 'number' ? numeroAgro(v, Number.isInteger(v) ? 0 : 2) : v ?? 'Não disponível'}</th> : <td key={j}>{typeof v === 'number' ? numeroAgro(v, Number.isInteger(v) ? 0 : 2) : v ?? 'Não disponível'}</td>)}</tr>)}</tbody></table></div>; }
export type SerieLinhaAgro = {
    nome: string;
    valores: (number | null)[];
    referencia?: boolean;
};
export function LinhasAgro({ titulo, unidade, rotulos, series, nota, casas = 1 }: {
    titulo: string;
    unidade: string;
    rotulos: string[];
    series: SerieLinhaAgro[];
    nota: string;
    casas?: number;
}) {
    const valores = series.flatMap(serie => serie.valores.filter((v): v is number => v !== null)), min = Math.min(0, ...valores), max = Math.max(0, ...valores), range = max - min || 1, fmt = (v: number) => numeroAgro(v, casas);
    // Séries focais em paleta categórica estável; a referência fica tracejada em bronze.
    const PALETA = ['var(--cor-energia)', 'var(--cor-previsto)', 'var(--cor-gas)', 'var(--cor-sucesso)'], focais = series.filter(x => !x.referencia);
    const cor = (serie: SerieLinhaAgro) => serie.referencia ? 'var(--cor-bronze-dark)' : PALETA[focais.indexOf(serie) % PALETA.length];
    return <figure className={s.figure}><figcaption><strong>{titulo}</strong><span>{unidade} · {rotulos[0]} a {rotulos.at(-1)} · lacunas interrompem a linha</span></figcaption>{series.length > 1 && <ul className={s.legend}>{series.map(serie => <li key={serie.nome}><span aria-hidden="true" data-referencia={serie.referencia ? 'true' : undefined} style={{ borderTopColor: cor(serie) }}/>{serie.nome}</li>)}</ul>}{[true, false].map(mobile => {
        const width = mobile ? 360 : 900, left = mobile ? 70 : 90, right = width - (mobile ? 16 : 150), top = 24, bottom = mobile ? 230 : 290, x = (i: number) => left + i * (right - left) / Math.max(1, rotulos.length - 1), y = (v: number) => bottom - (v - min) * (bottom - top) / range;
        // No celular, rótulos longos (trimestres, anos parciais) ficam só nas pontas para não se sobreporem.
        const ticks = mobile && Math.max(...rotulos.map(r => r.length)) > 6 ? [...new Set([0, rotulos.length - 1])] : [...new Set([0, Math.floor((rotulos.length - 1) / 2), rotulos.length - 1])];
        const finais = series.map(serie => { let i = serie.valores.length - 1; while (i >= 0 && serie.valores[i] === null) i--; return i < 0 ? null : { serie, i, v: serie.valores[i]! }; }).filter(f => f !== null);
        // Rótulos diretos no fim das linhas, afastados quando os valores finais são próximos.
        const posicoes = finais.map(f => y(f.v)), ordem = posicoes.map((_, i) => i).sort((a, b) => posicoes[a] - posicoes[b]);
        ordem.forEach((i, k) => { if (k > 0) posicoes[i] = Math.max(posicoes[i], posicoes[ordem[k - 1]] + 20); });
        return <svg key={String(mobile)} className={mobile ? s.figureMobile : s.figureDesktop} viewBox={`0 0 ${width} ${bottom + 50}`} role="img" aria-label={`${titulo}. ${finais.map(f => `${f.serie.nome}: ${fmt(f.v)} em ${rotulos[f.i]}`).join('; ')}. A tabela apresenta todos os períodos.`}>{[min, min + range / 2, max].map((v, i) => <g key={i}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="var(--cor-linha)"/><text x={left - 10} y={y(v) + 5} textAnchor="end" fill="currentColor" fontSize={mobile ? 18 : 16}>{fmt(v)}</text></g>)}{min < 0 && <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="var(--cor-mineral)"/>}{series.map(serie => { const segmentos: { i: number; v: number }[][] = []; let atual: { i: number; v: number }[] = []; serie.valores.forEach((v, i) => { if (v === null) { if (atual.length) segmentos.push(atual); atual = []; } else atual.push({ i, v }); }); if (atual.length) segmentos.push(atual); return <g key={serie.nome}>{segmentos.map((seg, i) => <polyline key={i} fill="none" stroke={cor(serie)} strokeWidth={serie.referencia ? 2 : 2.75} strokeDasharray={serie.referencia ? '6 4' : undefined} points={seg.map(p => `${x(p.i)},${y(p.v)}`).join(' ')}/>)}{segmentos.flat().map(p => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="2.5" fill={cor(serie)}><title>{`${serie.nome}, ${rotulos[p.i]}: ${fmt(p.v)} ${unidade}`}</title></circle>)}</g>; })}{!mobile && finais.map((f, i) => <text key={f.serie.nome} x={x(f.i) + 10} y={posicoes[i] + 5} fontSize="15" fill={cor(f.serie)}>{fmt(f.v)}</text>)}{ticks.map(i => <text key={i} x={x(i)} y={bottom + 28} textAnchor={i === 0 ? 'start' : i === rotulos.length - 1 ? 'end' : 'middle'} fontSize={mobile ? 18 : 16} fill="currentColor">{rotulos[i]}</text>)}</svg>;
    })}<p className={s.note}>{nota}</p></figure>;
}
/** Barras com origem no zero central, para variações que podem ser negativas. */
export function DivergenteAgro({ titulo, unidade, periodo, linhas, nota, casas = 1 }: {
    titulo: string;
    unidade: string;
    periodo: string;
    linhas: LinhaBarraAgro[];
    nota: string;
    casas?: number;
}) { const max = Math.max(1e-9, ...linhas.map(l => Math.abs(l.valor ?? 0))), fmt = (v: number | null) => v === null ? 'Não disponível' : (v > 0 ? '+' : '') + numeroAgro(v, casas); return <figure className={s.figure}><figcaption><strong>{titulo}</strong><span>{unidade} · {periodo} · barras partem do zero central</span></figcaption><div className={s.barAxis} aria-hidden="true"><span>{fmt(-max)}</span><span>0</span><span>{fmt(max)}</span></div>{linhas.map((r, i) => <div className={s.barRow} key={r.nome + i} data-focal={r.focal}><span>{r.nome}</span><div className={`${s.barTrack} ${s.barTrackDivergente}`} aria-hidden="true">{r.valor !== null && <span data-negativo={r.valor < 0 ? 'true' : undefined} style={{ width: 50 * Math.abs(r.valor) / max + '%', [r.valor < 0 ? 'right' : 'left']: '50%' }}/>}</div><strong>{fmt(r.valor)}</strong></div>)}<p className={s.note}>{nota}</p></figure>; }
