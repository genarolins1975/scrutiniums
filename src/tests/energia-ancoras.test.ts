import { afterEach, describe, expect, it, vi } from 'vitest';
import { ancoraDoDocumento, guardarAncora, observarAncoras } from '@/components/energia/navegacao-ancoras';

afterEach(() => vi.unstubAllGlobals());

describe('Navegação entre análises', () => {
  it('só abre o painel quando o link pertence ao documento atual', () => {
    const atual = 'https://scrutiniums.com/setor-eletrico?modo=analisar#etapa-geracao';
    expect(ancoraDoDocumento('#etapa-consumo', atual)).toBe('#etapa-consumo');
    expect(ancoraDoDocumento('/setor-eletrico/qualidade#p052', atual)).toBeNull();
    expect(ancoraDoDocumento('https://outro.example/setor-eletrico?modo=analisar#etapa-consumo', atual)).toBeNull();
    expect(ancoraDoDocumento('/setor-eletrico#etapa-consumo', atual)).toBeNull();
  });
  it('reabre o mesmo hash após mudar a seleção, sem sequestrar cliques modificados, e remove os listeners', () => {
    const win = new EventTarget();
    const doc = new EventTarget();
    Object.assign(win, { location: { href: 'https://scrutiniums.com/setor-eletrico#pergunta-agua', hash: '#pergunta-agua' } });
    class LinkTarget {
      closest() { return { href: '#pergunta-agua', target: '', hasAttribute: () => false }; }
    }
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc); vi.stubGlobal('Element', LinkTarget);
    const abrir = vi.fn();
    const limpar = observarAncoras(abrir);
    const click = (ctrlKey = false) => {
      const e = new Event('click');
      Object.defineProperties(e, { target: { value: new LinkTarget() }, button: { value: 0 }, ctrlKey: { value: ctrlKey } });
      doc.dispatchEvent(e);
    };
    expect(abrir).toHaveBeenLastCalledWith('#pergunta-agua');
    abrir.mockClear(); click(); click();
    expect(abrir.mock.calls).toEqual([['#pergunta-agua'], ['#pergunta-agua']]);
    click(true); expect(abrir).toHaveBeenCalledTimes(2);
    win.dispatchEvent(new Event('popstate')); expect(abrir).toHaveBeenCalledTimes(3);
    limpar(); click(); win.dispatchEvent(new Event('hashchange'));
    expect(abrir).toHaveBeenCalledTimes(3);
  });
  it('preserva o estado do roteador ao guardar a seleção na URL', () => {
    const state = { __NA: true, tree: ['rota'] };
    const replaceState = vi.fn();
    vi.stubGlobal('window', { history: { state, replaceState } });
    guardarAncora('#etapa-consumo');
    expect(replaceState).toHaveBeenCalledWith(state, '', '#etapa-consumo');
  });
});
