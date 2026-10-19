import { DADOS, dataFonte } from './dados';

/**
 * Repartição de cada R$ 100 pagos pelo Orçamento Fiscal e da Seguridade Social
 * da União, por grupo de natureza da despesa (GND), na ordem do artefato:
 * a dívida primeiro (amortização e juros), depois as despesas correntes,
 * pessoal, inversões, investimentos e a reserva. Usada pelo painel
 * (CemReaisPagos) e pela página aberta (CemReaisAberto), com a mesma conta.
 */
export const ORDEM_GRUPOS_CEM = ['6', '2', '3', '1', '5', '4', '9'] as const;
/** Grupos financeiros da dívida (amortização, que inclui refinanciamento, e juros). */
export const GRUPOS_FINANCEIROS = ['2', '6'];

export type ParcelaPaga = { id: string; nome: string; valor: number; financeiro: boolean };

/** Valores pagos por grupo no exercício; null quando o ano não está no snapshot. */
export function parcelasPagas(ano: number): ParcelaPaga[] | null {
  const b = DADOS.orcamento.find((o) => o.ano === ano);
  if (!b) return null;
  return ORDEM_GRUPOS_CEM.map((c) => b.grupos.find((g) => g.codigo === c)!).map((g) => ({
    id: g.codigo,
    nome: g.nome,
    valor: g.pago,
    financeiro: GRUPOS_FINANCEIROS.includes(g.codigo),
  }));
}

/**
 * Último exercício encerrado do snapshot: o mais recente cuja base do SIOP foi
 * atualizada depois de 31 de dezembro do próprio ano. Ano em curso fica fora,
 * porque o recorte parcial não se compara com um ano completo.
 */
export function ultimoExercicioEncerrado(): { ano: number; totalPago: number; atualizacao: string } | null {
  const encerrados = DADOS.orcamento
    .map((b) => ({ ano: b.ano, totalPago: b.total.pago, atualizacao: b.esferas[0]?.atualizacao ?? '' }))
    .filter((b) => b.atualizacao.slice(0, 10) > `${b.ano}-12-31`)
    .sort((a, b) => b.ano - a.ano);
  return encerrados[0] ?? null;
}

/** Data da captura do SIOP pelo pipeline, em dd/mm/aaaa. */
export function capturaSiop(): string {
  return dataFonte(DADOS.capturaSIOP);
}

export const FONTE_SIOP = DADOS.fonteSIOP;
