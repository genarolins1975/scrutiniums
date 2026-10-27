import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('public/obs/atlas.js', 'utf8');
type Scenario = { lgd: number; loss: number; rate: number } | null;
const context = { window: {} as { CreditAtlas?: { lossScenario: (ead: number, pd: number, recovery: number) => Scenario } }, Intl };
runInNewContext(source, context);
const calculate = context.window.CreditAtlas!.lossScenario;

describe('Laboratório de crédito: unidades e fronteiras', () => {
  it('calcula os cenários aprovados sem confundir percentuais com frações', () => {
    expect(calculate(100, 4, 55)).toEqual({ lgd: 45, loss: 1.8, rate: 1.8 });
    expect(calculate(100, 8, 55)?.loss).toBeCloseTo(3.6);
    expect(calculate(100, 4, 75)?.loss).toBeCloseTo(1);
  });
  it('respeita os extremos econômicos', () => {
    expect(calculate(100, 0, 0)?.loss).toBe(0);
    expect(calculate(100, 100, 0)?.loss).toBe(100);
    expect(calculate(100, 100, 100)?.loss).toBe(0);
    expect(calculate(0, 15, 0)?.loss).toBe(0);
  });
  it('a exposição muda a perda em reais, mas não a taxa de perda', () => {
    const a = calculate(100, 6, 40)!;
    const b = calculate(250, 6, 40)!;
    expect(b.loss).toBeCloseTo(a.loss * 2.5);
    expect(b.rate).toBe(a.rate);
  });
  it('rejeita entradas inválidas em vez de fabricar resultados', () => {
    for (const args of [[NaN, 4, 55], [Infinity, 4, 55], [-1, 4, 55], [100, -1, 55], [100, 101, 55], [100, 4, -1], [100, 4, 101]]) {
      expect(calculate(...args as [number, number, number])).toBeNull();
    }
  });
});

describe('Atlas: integração e separação das hipóteses', () => {
  it('carrega antes da camada editorial e usa apenas metadados já carregados', () => {
    const html = readFileSync('public/obs/index.html', 'utf8');
    expect(html.indexOf('/obs/atlas.js')).toBeLessThan(html.indexOf('/obs/editorial.js'));
    expect(html).toContain('/obs/atlas.css');
    expect(readFileSync('public/obs/editorial.js', 'utf8')).toContain('window.CreditAtlas?.enhance');
    expect(source).not.toMatch(/fetch\(|localStorage\.(?:setItem|removeItem|clear)\s*\(|state\.data\s*=/);
    expect(readFileSync('src/lib/observatorios/cascaPura.ts', 'utf8')).toContain('Number.isFinite(d.value)');
    expect(readFileSync('src/lib/observatorios/cascaPura.ts', 'utf8')).toContain('Indicador não disponível nesta publicação da base.');
  });
  it('o catálogo original é movido, não reescrito; o fluxo só muda com as sete etapas', () => {
    expect(source).toContain('cards.length !== STAGES.length');
    expect(source).toContain('disclosure.append(summary, index)');
    expect(source).toContain('panel.append(card)');
    expect(source).toContain('aria-controls');
    expect(source).toContain("e.key === 'Home'");
    expect(source).toContain("e.key === 'End'");
    expect(source).toContain('não é a taxa de inadimplência observada no SCR');
  });
});
