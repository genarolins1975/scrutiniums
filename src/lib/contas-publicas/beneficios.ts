/**
 * Capítulo "Subsídios e benefícios": gastos tributários da União, pela Receita Federal (DGT Bases Efetivas 2023,
 * série 2021 a 2026; importador scripts/contas-publicas/importar-beneficios.py).
 *
 * Gasto tributário é receita que a União deixa de arrecadar por uma exceção à regra geral do tributo (isenção,
 * dedução, alíquota reduzida, regime especial). O valor é uma estimativa oficial, não uma despesa paga: por isso
 * nunca é somado ao orçamento executado, e uma redução do benefício não devolve automaticamente o mesmo valor ao
 * caixa (as pessoas e empresas mudam de comportamento).
 * 2021 a 2023 são estimativas com dados efetivos; 2024 a 2026 são projeções da mesma edição, mostradas à parte.
 */
import snapshot from './snapshots/beneficios.json';
import {dataFonte} from './dados';

export type PontoBeneficio = {ano: number; natureza: 'efetivo' | 'projecao'; valor: number; pctPIB: number; pctArrecadacao: number; pib: number; arrecadacao: number};
export const BENEFICIOS = snapshot as typeof snapshot & {serie: PontoBeneficio[]};
export const ANO_BASE_BENEFICIOS = BENEFICIOS.anoBase;
export const SERIE_BENEFICIOS = BENEFICIOS.serie;
export const BASE_BENEFICIOS = SERIE_BENEFICIOS.find((s) => s.ano === ANO_BASE_BENEFICIOS)!;
export const ANTERIOR_BENEFICIOS = SERIE_BENEFICIOS.find((s) => s.ano === ANO_BASE_BENEFICIOS - 1) ?? null;

/** Modalidades com valor em 2023, as dez maiores e o resto somado. */
export function principaisModalidades(n = 10) {
  const com = BENEFICIOS.modalidades.filter((m) => m.valor > 0);
  const top = com.slice(0, n);
  const resto = com.slice(n);
  return {top, demais: {quantidade: resto.length, valor: resto.reduce((s, m) => s + m.valor, 0)}, comValor: com.length, semValor: BENEFICIOS.modalidades.length - com.length};
}

export const ORIGEM_BENEFICIOS = {
  fonte: 'Receita Federal · DGT Bases Efetivas 2023 · quadros V, VI, X e XXVI',
  url: BENEFICIOS.fonte.pagina,
  referencia: `${ANO_BASE_BENEFICIOS} (base efetiva) · série 2021 a 2026`,
  publicacao: BENEFICIOS.fonte.publicacao,
  captura: BENEFICIOS.captura,
  perimetro: 'Tributos federais administrados pela Receita Federal',
  unidade: 'R$ correntes',
  natureza: 'Estimativa oficial de receita que deixou de ser arrecadada; não é despesa paga',
  download: '/contas-publicas/beneficios.json',
};
export const atualizacaoPaginaBeneficios = () => dataFonte(BENEFICIOS.fonte.atualizacaoPagina);
