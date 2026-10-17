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
}) { const max = maximo ?? Math.max(0, ...linhas.map(l => l.valor ?? 0)), abreviar = unidade.startsWith('R$') && max >= 1e9, fmt = (v: number | null) => v === null ? 'Não disponível' : abreviar ? numeroAgro(v / 1e9, 1) + ' bi' : numeroAgro(v, unidade.includes('%') || unidade.includes('bilhões') ? 1 : unidade.startsWith('R$') ? 2 : 0); return <figure className={s.figure}><figcaption><strong>{titulo}</strong><span>{unidade} · {periodo} · barras partem de zero{abreviar ? ' · valores abreviados em bilhões de reais' : ''}</span></figcaption><div className={s.barAxis} aria-hidden="true"><span>0</span><span>{fmt(max)}</span></div>{linhas.map((r, i) => <div className={s.barRow} key={r.nome + i} data-focal={r.focal}><span>{r.nome}</span><div className={s.barTrack} aria-hidden="true">{r.valor !== null && <span style={{ width: (max > 0 ? 100 * Math.max(0, r.valor) / max : 0) + '%' }}/>}</div><strong>{fmt(r.valor)}</strong></div>)}<p className={s.note}>{nota}</p></figure>; }
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
