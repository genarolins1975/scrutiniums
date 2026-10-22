import base from './snapshots/fluxo.json';
import type { EloFluxo, NoFluxo } from '@/lib/fluxo/layout';
import { parcela } from '@/lib/fluxo/formato';

export const FLUXO_FEDERAL = base;
const MI = 1e6;
const COLUNAS = ['De onde vem', 'Arrecadação', 'O que sai, fica ou falta', 'Gasto', 'Em que é gasto'];

/** Nós e faixas do fluxo federal, em reais. Valores do RTN em R$ milhões correntes. */
export function diagramaFederal(): { nos: NoFluxo[]; elos: EloFluxo[]; colunas: string[] } {
  const b = base;
  const nos: NoFluxo[] = [];
  const elos: EloFluxo[] = [];
  const reais = (p: (string | number)[][]) => p.map(([k, v]) => [String(k), Number(v) * MI] as [string, number]);
  for (const f of b.fontes) {
    nos.push({ id: 'f-' + f.id, nome: f.nome, valor: f.valor * MI, coluna: 0, tipo: 'entrada', nota: parcela(f.valor, b.arrecadacao) + ' da arrecadação', partes: reais(f.partes) });
    elos.push({ de: 'f-' + f.id, para: 'arrecadacao', valor: f.valor * MI });
  }
  nos.push({ id: 'arrecadacao', nome: 'Arrecadação', valor: b.arrecadacao * MI, coluna: 1, tipo: 'tronco', nota: 'receita total do Governo Central' });
  nos.push({ id: 'repasse', nome: 'Repasse a estados e municípios', valor: b.repasse.valor * MI, coluna: 2, tipo: 'outro-ente', nota: 'FPE, FPM e outras repartições', partes: reais(b.repasse.partes) });
  elos.push({ de: 'arrecadacao', para: 'repasse', valor: b.repasse.valor * MI });
  nos.push({ id: 'liquida', nome: 'Receita líquida', valor: b.receita_liquida * MI, coluna: 2, tipo: 'tronco', nota: 'o que fica com a União' });
  elos.push({ de: 'arrecadacao', para: 'liquida', valor: b.receita_liquida * MI });
  const deficit = b.resultado < 0 ? -b.resultado : 0;
  const superavit = b.resultado > 0 ? b.resultado : 0;
  if (deficit > 0) {
    nos.push({ id: 'deficit', nome: 'Déficit primário', valor: deficit * MI, coluna: 2, tipo: 'resultado', nota: 'gasto acima da receita líquida, sem juros' });
    elos.push({ de: 'deficit', para: 'gasto', valor: deficit * MI });
  }
  nos.push({ id: 'gasto', nome: 'Gasto primário', valor: b.gasto * MI, coluna: 3, tipo: 'tronco', nota: 'pago no ano, sem juros' });
  elos.push({ de: 'liquida', para: 'gasto', valor: (b.receita_liquida - superavit) * MI });
  if (superavit > 0) {
    nos.push({ id: 'superavit', nome: 'Superávit primário', valor: superavit * MI, coluna: 3, tipo: 'resultado', nota: 'receita líquida acima do gasto, sem juros' });
    elos.push({ de: 'liquida', para: 'superavit', valor: superavit * MI });
  }
  for (const u of b.usos) {
    nos.push({ id: 'u-' + u.id, nome: u.nome, valor: u.valor * MI, coluna: 4, tipo: 'gasto', nota: `${parcela(u.valor, b.gasto)} do gasto · ${u.natureza}`, partes: reais(u.partes) });
    elos.push({ de: 'gasto', para: 'u-' + u.id, valor: u.valor * MI });
  }
  return { nos, elos, colunas: COLUNAS };
}
