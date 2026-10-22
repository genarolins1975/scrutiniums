import { describe, expect, it } from 'vitest';
import { afastarRotulos, conferirFluxo, layoutFluxo } from '@/lib/fluxo/layout';
import { reaisCurto, parcela } from '@/lib/fluxo/formato';
import { diagramaFederal, FLUXO_FEDERAL } from '@/lib/contas-publicas/fluxo';
import { diagramaEstadual, FLUXO_ESTADUAL } from '@/lib/contas-estaduais/fluxo';
import { DADOS } from '@/lib/contas-publicas/dados';
import primarios from '@/lib/contas-estaduais/primarios.json';

const OPCOES = { largura: 1120, altura: 580, margemEsquerda: 210, margemDireita: 270 };

describe('fluxo do dinheiro: layout', () => {
  it('afasta rótulos sobrepostos sem trocar a ordem e respeita os limites', () => {
    const y = afastarRotulos([10, 12, 13, 200, 201], 30, 20, 300);
    for (let i = 1; i < y.length; i++) expect(y[i] - y[i - 1]).toBeGreaterThanOrEqual(30 - 1e-9);
    expect(y[0]).toBeGreaterThanOrEqual(20);
    expect(y[y.length - 1]).toBeLessThanOrEqual(300);
    const apertado = afastarRotulos([100, 100, 100, 100], 50, 0, 90);
    expect(apertado[0]).toBe(0);
    expect(apertado[3]).toBe(90);
  });

  it('a espessura das faixas é proporcional ao valor, na mesma escala do diagrama', () => {
    const { nos, elos } = diagramaFederal();
    const l = layoutFluxo(nos, elos, OPCOES);
    for (const e of l.elos) {
      expect(e.espessura).toBeCloseTo(e.valor * l.escala, 6);
      expect(e.caminho).not.toMatch(/NaN|Infinity/);
    }
    // As faixas que saem de um nó somam a altura do nó (quando o nó não foi alargado para ficar visível).
    for (const n of l.nos.filter(n => n.altura > 1.5)) {
      const sai = l.elos.filter(e => e.de === n.id).reduce((s, e) => s + e.espessura, 0);
      if (sai > 0) expect(sai).toBeCloseTo(n.altura, 4);
    }
    for (const n of l.nos) {
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y + n.altura).toBeLessThanOrEqual(OPCOES.altura + 1e-6);
    }
  });
});

describe('fluxo do dinheiro federal', () => {
  it('cada nó fecha e os totais são os da série anual publicada', () => {
    const { nos, elos } = diagramaFederal();
    expect(conferirFluxo(nos, elos)).toEqual([]);
    const anual = DADOS.rtnAnual.find(r => r.periodo === String(FLUXO_FEDERAL.ano))!;
    expect(FLUXO_FEDERAL.arrecadacao).toBeCloseTo(anual.receitaTotal, 2);
    expect(FLUXO_FEDERAL.repasse.valor).toBeCloseTo(anual.transferencias, 2);
    expect(FLUXO_FEDERAL.gasto).toBeCloseTo(anual.despesa, 2);
    expect(FLUXO_FEDERAL.resultado).toBeCloseTo(anual.resultado, 2);
    expect(FLUXO_FEDERAL.sha256).toBe(DADOS.sha256['rtn.xlsx']);
  });

  it('as partes de cada grupo somam o grupo', () => {
    for (const g of [...FLUXO_FEDERAL.fontes, ...FLUXO_FEDERAL.usos]) {
      if (g.partes.length) expect(g.partes.reduce((s, p) => s + Number(p[1]), 0)).toBeCloseTo(g.valor, 2);
    }
    expect(FLUXO_FEDERAL.repasse.partes.reduce((s, p) => s + Number(p[1]), 0)).toBeCloseTo(FLUXO_FEDERAL.repasse.valor, 2);
  });
});

describe('fluxo do dinheiro estadual', () => {
  it('as 27 unidades fecham em cada nó e desenham sem erro', () => {
    expect(FLUXO_ESTADUAL.ufs).toHaveLength(27);
    for (const u of FLUXO_ESTADUAL.ufs) {
      const { nos, elos } = diagramaEstadual(u);
      expect(conferirFluxo(nos, elos), u.uf).toEqual([]);
      const l = layoutFluxo(nos, elos, OPCOES);
      expect(l.elos.every(e => !/NaN/.test(e.caminho)), u.uf).toBe(true);
    }
  });

  it('receita e despesa conferem com a execução já publicada do Anexo 01', () => {
    for (const u of FLUXO_ESTADUAL.ufs) {
      const r = primarios.rreo.find(r => r.uf === u.uf && r.ano === 2025)!;
      expect(u.totais_fonte.receita_anexo01, u.uf).toBeCloseTo(r.valores.receita_arrecadada, 2);
      expect(u.totais_fonte.despesa_anexo01, u.uf).toBeCloseTo(r.valores.empenhada, 2);
    }
  });

  it('diferença entre demonstrativos vira nó próprio, nunca some', () => {
    const pi = FLUXO_ESTADUAL.ufs.find(u => u.uf === 'PI')!;
    expect(pi.diferenca_gasto).toBeLessThan(0);
    const { nos } = diagramaEstadual(pi);
    expect(nos.some(n => n.tipo === 'diferenca' && n.valor === -pi.diferenca_gasto)).toBe(true);
  });
});

describe('fluxo do dinheiro: formato', () => {
  it('escreve bilhões e milhões à brasileira', () => {
    expect(reaisCurto(2_902_274_564_064.6)).toBe('R$ 2.902,3 bi');
    expect(reaisCurto(640_000_000)).toBe('R$ 640 mi');
    expect(reaisCurto(-61_694_308_989)).toBe('−R$ 61,7 bi');
    expect(parcela(1026.87, 2394.25)).toBe('43%');
    expect(parcela(1, 0)).toBe('');
  });
});
