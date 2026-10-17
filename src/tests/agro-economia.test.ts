import { describe, it, expect } from 'vitest';
import snapshot from '../../public/agro/gold/snapshot.json';
import type { SnapshotAgro } from '@/lib/agro/tipos';
import { destaquesEconomiaAgro, safraComparada, concentracaoAgro, mesesAgro, trimestreAgro, variacaoPctAgro } from '@/lib/agro/economia';

const e = (snapshot as unknown as SnapshotAgro).economia!;

describe('economia do Agro: números de destaque', () => {
    it('a participação vem dos quatro trimestres do snapshot', () => {
        const d = destaquesEconomiaAgro(e), ult = e.pib.trimestres.slice(-4);
        expect(d.participacao.valor).toBeCloseTo(100 * ult.reduce((s, t) => s + t.agro, 0) / ult.reduce((s, t) => s + t.va, 0));
        expect(d.participacao.fim).toBe(e.pib.trimestres.at(-1)!.periodo);
        expect(d.exportacoes.ano).toBe(e.comercio.anoCompleto);
    });
    it('safra compara com a estimativa de dezembro do ano anterior, sem inventar o que falta', () => {
        const s = safraComparada(e, 'graos')!;
        expect(s.anterior!.ano).toBe(s.atual.ano - 1);
        expect(s.anterior!.mesEstimativa.endsWith('-12')).toBe(true);
        expect(safraComparada(e, 'inexistente')).toBeNull();
        expect(variacaoPctAgro(10, null)).toBeNull();
        expect(variacaoPctAgro(10, 0)).toBeNull();
        expect(variacaoPctAgro(11, 10)).toBeCloseTo(10);
    });
    it('relação de troca compara o mesmo intervalo de meses nos dois anos', () => {
        const d = destaquesEconomiaAgro(e), m = e.comercio.insumos.mesmoPeriodo;
        expect(m.soja.map(r => r.meses)).toEqual(m.fertilizantes.map(r => r.meses));
        expect(d.troca.atual).toBeCloseTo(m.fertilizantes.at(-1)!.valorUnitario! / m.soja.at(-1)!.valorUnitario!);
    });
    it('rótulos de período e concentração', () => {
        expect(mesesAgro(2026, 9)).toBe('jan a set/2026');
        expect(mesesAgro(2025, 12)).toBe('2025');
        expect(trimestreAgro('2026-T2')).toBe('2º tri/2026');
        expect(concentracaoAgro([{ participacao: 50 }, { participacao: 20 }, { participacao: 5 }], 2)).toBe(70);
    });
});
