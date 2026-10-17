import type { EconomiaAgro } from './tipos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-T2" → "2º tri/2026". */
export function trimestreAgro(periodo: string) { return `${periodo.slice(-1)}º tri/${periodo.slice(0, 4)}`; }
/** Intervalo de meses do mesmo ano: "jan a set/2026" (ou "2025" quando completo). */
export function mesesAgro(ano: number, meses: number) { return meses === 12 ? String(ano) : `jan a ${MESES[meses - 1]}/${ano}`; }
export const mesCurtoAgro = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`;
export const variacaoPctAgro = (atual: number | null | undefined, anterior: number | null | undefined) => atual != null && anterior != null && anterior > 0 ? 100 * (atual / anterior - 1) : null;

export function produtoSafra(e: EconomiaAgro, id: string) { return e.safra.produtos.find(p => p.id === id) ?? null; }

/**
 * Safra corrente contra a estimativa de dezembro do ano anterior, do mesmo levantamento.
 * Retorna null quando um dos lados não tem produção publicada.
 */
export function safraComparada(e: EconomiaAgro, id: string) {
    const p = produtoSafra(e, id);
    if (!p) return null;
    const atual = p.anos.at(-1)!, anterior = p.anos.find(a => a.ano === atual.ano - 1) ?? null;
    return { nome: p.nome, atual, anterior, variacao: variacaoPctAgro(atual.producao, anterior?.producao) };
}

/** Os números de escala da abertura, todos derivados do mesmo snapshot. */
export function destaquesEconomiaAgro(e: EconomiaAgro) {
    const c = e.comercio, x = c.exportacoes, ultimoAno = x.anual.at(-1)!, cresc = e.pib.crescimento.acumulado4.at(-1)!;
    const troca = c.insumos.mesmoPeriodo, relacaoAtual = troca.relacao.at(-1) ?? null, relacaoAnterior = troca.relacao.at(-2) ?? null;
    return {
        participacao: { valor: e.pib.ultimos4.participacaoVa, inicio: e.pib.ultimos4.inicio, fim: e.pib.ultimos4.fim, crescimentoAgro: cresc.agro, crescimentoPib: cresc.pib },
        exportacoes: { participacao: ultimoAno.participacao, agro: ultimoAno.agro, total: ultimoAno.total, ano: ultimoAno.ano },
        safra: safraComparada(e, 'graos'),
        troca: { atual: relacaoAtual, anterior: relacaoAnterior, ano: troca.soja.at(-1)!.ano, meses: troca.soja.at(-1)!.meses },
    };
}

/** Participação somada dos primeiros n países: concentração sem índice próprio. */
export function concentracaoAgro(paises: { participacao: number }[], n: number) { return paises.slice(0, n).reduce((soma, p) => soma + p.participacao, 0); }
