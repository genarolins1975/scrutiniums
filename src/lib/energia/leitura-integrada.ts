/** Exercícios didáticos: nunca alimentam séries observadas nem a previsão de PLD. */
export type BlocoComercial = { nome: string; consumo: number; contrato: number; pld: number };
export const BLOCOS_COMERCIAIS: BlocoComercial[] = [
  { nome: "00–06h", consumo: 10, contrato: 25, pld: 100 },
  { nome: "06–12h", consumo: 30, contrato: 25, pld: 200 },
  { nome: "12–18h", consumo: 20, contrato: 25, pld: 50 },
  { nome: "18–24h", consumo: 40, contrato: 25, pld: 400 },
];

export function liquidacaoDidatica(blocos: readonly BlocoComercial[], precoContrato: number) {
  if (!Number.isFinite(precoContrato) || precoContrato < 0 || !blocos.length || blocos.some(b =>
    [b.consumo, b.contrato, b.pld].some(v => !Number.isFinite(v) || v < 0))) return null;
  const linhas = blocos.map(b => ({ ...b, diferenca: b.contrato - b.consumo, resultado: (b.contrato - b.consumo) * b.pld }));
  const consumo = linhas.reduce((s, b) => s + b.consumo, 0);
  const contrato = linhas.reduce((s, b) => s + b.contrato, 0);
  const resultado = linhas.reduce((s, b) => s + b.resultado, 0);
  const pagamentoContrato = contrato * precoContrato;
  return { linhas, consumo, contrato, saldo: contrato - consumo, resultado, pagamentoContrato, custoEnergia: pagamentoContrato - resultado };
}

/** Energia útil especificada na saída AC. Rendimento global de ida e volta. */
export function bateriaDidatica(mw: number, mwh: number, eficiencia: number, compra: number, venda: number) {
  if ([mw, mwh, eficiencia, compra, venda].some(v => !Number.isFinite(v)) || mw <= 0 || mwh < 0 || eficiencia <= 0 || eficiencia > 1 || compra < 0 || venda < 0) return null;
  const entrada = mwh / eficiencia;
  return { duracao: mwh / mw, entrada, perdas: entrada - mwh, margemBruta: mwh * venda - entrada * compra, precoEquilibrio: compra / eficiencia };
}

/** Potência TI nominal × utilização média × PUE, 8.760h: cenário anual não bissexto. */
export function cargaDataCenter(mwTI: number, utilizacao: number, pue: number) {
  if (![mwTI, utilizacao, pue].every(Number.isFinite) || mwTI < 0 || utilizacao < 0 || utilizacao > 1 || pue < 1) return null;
  const mwMedios = mwTI * utilizacao * pue;
  return { mwMedios, gwhAno: mwMedios * 8760 / 1000, gwhTI: mwTI * utilizacao * 8760 / 1000 };
}

/** Denominador estritamente positivo; zero/negativo não admite variação percentual convencional. */
export function variacaoComparavel(atual: number | null, anterior: number | null): number | null {
  return atual !== null && anterior !== null && Number.isFinite(atual) && Number.isFinite(anterior) && anterior > 0 ? 100 * (atual / anterior - 1) : null;
}
export function razaoPositiva(numerador: number | null, denominador: number | null): number | null {
  return numerador !== null && denominador !== null && Number.isFinite(numerador) && Number.isFinite(denominador) && denominador > 0 ? 100 * numerador / denominador : null;
}
