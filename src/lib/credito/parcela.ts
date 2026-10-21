/**
 * Matemática do simulador do custo da dívida (/observatorio-do-credito/simulador-da-parcela).
 *
 * Código puro, sem dependência de navegador nem de servidor: o componente do simulador e os testes usam as
 * mesmas funções. Taxas entram e saem em pontos percentuais (1 representa 1%), como o Banco Central publica.
 *
 * - Conversão entre taxa anual e mensal por capitalização composta: (1 + a)^(1/12) − 1 e (1 + m)^12 − 1.
 * - Parcela pela tabela Price (parcelas iguais, juros sobre o saldo devedor): P = V × i ÷ (1 − (1 + i)^−n);
 *   com taxa zero, P = V ÷ n.
 */

/** Taxa mensal equivalente a uma taxa anual, por capitalização composta. Entrada e saída em %. */
export function taxaMensalDeAnual(anualPct: number): number {
  return (Math.pow(1 + anualPct / 100, 1 / 12) - 1) * 100;
}

/** Taxa anual equivalente a uma taxa mensal, por capitalização composta. Entrada e saída em %. */
export function taxaAnualDeMensal(mensalPct: number): number {
  return (Math.pow(1 + mensalPct / 100, 12) - 1) * 100;
}

/**
 * Parcela fixa pela tabela Price. `valor` em reais, `mensalPct` em % ao mês, `meses` inteiro positivo.
 * Taxa zero reparte o valor em parcelas iguais; prazo de um mês devolve o valor acrescido de um mês de juros.
 */
export function parcelaPrice(valor: number, mensalPct: number, meses: number): number {
  const i = mensalPct / 100;
  if (i === 0) return valor / meses;
  return (valor * i) / (1 - Math.pow(1 + i, -meses));
}

export type ResultadoParcela = {
  /** Parcela mensal fixa, em reais. */
  parcela: number;
  /** Soma das parcelas, em reais. */
  total: number;
  /** Total pago menos o valor tomado, em reais. */
  juros: number;
  /** Taxa usada no cálculo, em % ao mês. */
  mensalPct: number;
  /** A mesma taxa em % ao ano (composta). */
  anualPct: number;
};

/** Limites do simulador: fora deles o cálculo não é feito e a página diz o motivo. */
export const LIMITES = {
  valorMin: 1,
  valorMax: 100_000_000,
  prazoMin: 1,
  prazoMax: 600,
  /** % ao ano. O rotativo do cartão passa de 1.000% ao ano em parte das instituições. */
  taxaAnualMax: 100_000,
} as const;

export type Entrada = { valor: number; meses: number; anualPct: number };

/** Motivo pelo qual a entrada não pode ser calculada, ou null se pode. */
export function problemaDaEntrada({ valor, meses, anualPct }: Entrada): string | null {
  if (!Number.isFinite(valor) || valor < LIMITES.valorMin) return "Informe um valor a partir de R$ 1.";
  if (valor > LIMITES.valorMax) return "O simulador aceita valores até R$ 100 milhões.";
  if (!Number.isInteger(meses) || meses < LIMITES.prazoMin) return "Informe o prazo em meses inteiros, a partir de 1.";
  if (meses > LIMITES.prazoMax) return "O simulador aceita prazos até 600 meses.";
  if (!Number.isFinite(anualPct) || anualPct < 0) return "Informe uma taxa igual ou maior que zero.";
  if (anualPct > LIMITES.taxaAnualMax) return "A taxa informada passa do limite do simulador.";
  return null;
}

/** Parcela, total pago e juros totais para valor, prazo e taxa anual. */
export function calcular({ valor, meses, anualPct }: Entrada): ResultadoParcela {
  const mensalPct = taxaMensalDeAnual(anualPct);
  const parcela = parcelaPrice(valor, mensalPct, meses);
  const total = parcela * meses;
  return { parcela, total, juros: total - valor, mensalPct, anualPct };
}

/**
 * Comparação com o CET informado pelo leitor. O CET é a taxa que iguala o valor liberado às parcelas pagas,
 * com juros, tarifas, seguros e tributos. Com parcelas iguais, a parcela compatível com o CET é a parcela Price
 * do mesmo valor ao CET; a diferença para a parcela calculada com a taxa de juros é o peso dos demais encargos.
 */
export function compararComCet(entrada: Entrada, cetAnualPct: number) {
  const base = calcular(entrada);
  const comCet = calcular({ ...entrada, anualPct: cetAnualPct });
  return {
    base,
    comCet,
    diferencaParcela: comCet.parcela - base.parcela,
    diferencaTotal: comCet.total - base.total,
    /** Diferença do total pago, em % do total calculado com a taxa de juros. */
    diferencaTotalPct: base.total > 0 ? ((comCet.total - base.total) / base.total) * 100 : null,
    /** CET menos a taxa usada, em pontos percentuais ao ano. */
    diferencaTaxaPp: cetAnualPct - entrada.anualPct,
  };
}
