import base from './fluxo.json';
import type { EloFluxo, NoFluxo } from '@/lib/fluxo/layout';
import { parcela } from '@/lib/fluxo/formato';

export const FLUXO_ESTADUAL = base;
export type FluxoUF = (typeof base.ufs)[number];

export function fluxoDaUF(uf: string): FluxoUF | null {
  return base.ufs.find(u => u.uf === uf) ?? null;
}

const CONTRACAO: Record<string, string> = {
  AC: 'do', AM: 'do', AP: 'do', CE: 'do', ES: 'do', MA: 'do', PA: 'do', PI: 'do', PR: 'do', RJ: 'do', RN: 'do', RS: 'do', TO: 'do', DF: 'do',
  BA: 'da', PB: 'da',
};
/** "de São Paulo", "do Piauí", "da Bahia". */
export function doEstado(u: Pick<FluxoUF, 'uf' | 'nome'>): string {
  return `${CONTRACAO[u.uf] ?? 'de'} ${u.nome}`;
}

const COLUNAS = ['De onde vem', 'Arrecadação', 'O que sai, fica ou falta', 'Gasto', 'Em que é gasto'];

/**
 * Nós e faixas do fluxo de um estado. Cada diferença entre os demonstrativos aparece como nó
 * próprio, do lado em que ela ocorre; nenhum valor é redistribuído.
 */
export function diagramaEstadual(u: FluxoUF): { nos: NoFluxo[]; elos: EloFluxo[]; colunas: string[] } {
  const nos: NoFluxo[] = [];
  const elos: EloFluxo[] = [];
  for (const f of u.fontes) {
    if (f.valor <= 0) continue;
    nos.push({ id: 'f-' + f.id, nome: f.nome, valor: f.valor, coluna: 0, tipo: 'entrada', nota: parcela(f.valor, u.arrecadacao) + ' da arrecadação', partes: f.partes as [string, number][] });
    elos.push({ de: 'f-' + f.id, para: 'arrecadacao', valor: f.valor });
  }
  nos.push({ id: 'arrecadacao', nome: 'Arrecadação', valor: u.arrecadacao, coluna: 1, tipo: 'tronco', nota: 'receitas correntes brutas e de capital' });

  const difReceitaPositiva = u.diferenca_receita > 0 ? u.diferenca_receita : 0;
  const difReceitaNegativa = u.diferenca_receita < 0 ? -u.diferenca_receita : 0;
  if (difReceitaNegativa > 0) {
    nos.push({ id: 'dif-receita-entra', nome: 'Diferença entre anexos', valor: difReceitaNegativa, coluna: 1, tipo: 'diferenca', nota: 'receita do Anexo 01 acima do Anexo 03' });
    elos.push({ de: 'dif-receita-entra', para: 'disponivel', valor: difReceitaNegativa });
  }
  if (u.repasse > 0) {
    nos.push({ id: 'repasse', nome: 'Repasse a municípios', valor: u.repasse, coluna: 2, tipo: 'outro-ente', nota: 'cota do ICMS, do IPVA e do IPI-Exportação' });
    elos.push({ de: 'arrecadacao', para: 'repasse', valor: u.repasse });
  }
  nos.push({ id: 'fundeb', nome: 'Retido para o Fundeb', valor: u.fundeb, coluna: 2, tipo: 'outro-ente', nota: 'o que volta ao estado entra em "Fundeb, SUS e convênios"' });
  elos.push({ de: 'arrecadacao', para: 'fundeb', valor: u.fundeb });
  if (difReceitaPositiva > 0) {
    nos.push({ id: 'dif-receita', nome: 'Diferença entre anexos', valor: difReceitaPositiva, coluna: 2, tipo: 'diferenca', nota: 'Anexo 03 acima da receita do Anexo 01' });
    elos.push({ de: 'arrecadacao', para: 'dif-receita', valor: difReceitaPositiva });
  }
  const disponivelDaArrecadacao = u.receita_disponivel - difReceitaNegativa;
  nos.push({ id: 'disponivel', nome: 'Receita disponível', valor: u.receita_disponivel, coluna: 2, tipo: 'tronco', nota: 'receita realizada, Anexo 01' });
  elos.push({ de: 'arrecadacao', para: 'disponivel', valor: disponivelDaArrecadacao });

  const deficit = u.resultado < 0 ? -u.resultado : 0;
  const superavit = u.resultado > 0 ? u.resultado : 0;
  const difGastoNegativa = u.diferenca_gasto < 0 ? -u.diferenca_gasto : 0;
  if (deficit > 0) {
    nos.push({ id: 'deficit', nome: 'Déficit orçamentário', valor: deficit, coluna: 2, tipo: 'resultado', nota: 'gasto acima da receita disponível' });
    elos.push({ de: 'deficit', para: 'gasto', valor: deficit });
  }
  if (difGastoNegativa > 0) {
    nos.push({ id: 'dif-gasto-entra', nome: 'Diferença entre anexos', valor: difGastoNegativa, coluna: 2, tipo: 'diferenca', nota: 'gasto por área (Anexo 02) acima do total do Anexo 01' });
    elos.push({ de: 'dif-gasto-entra', para: 'gasto', valor: difGastoNegativa });
  }
  const gastoNo = u.gasto + difGastoNegativa;
  nos.push(difGastoNegativa > 0
    ? { id: 'gasto', nome: 'Gasto por área', valor: gastoNo, coluna: 3, tipo: 'tronco', nota: 'soma do Anexo 02, acima do total do Anexo 01' }
    : { id: 'gasto', nome: 'Gasto', valor: gastoNo, coluna: 3, tipo: 'tronco', nota: 'despesa empenhada no ano' });
  elos.push({ de: 'disponivel', para: 'gasto', valor: u.receita_disponivel - superavit });
  if (superavit > 0) {
    nos.push({ id: 'superavit', nome: 'Superávit orçamentário', valor: superavit, coluna: 3, tipo: 'resultado', nota: 'receita disponível acima do gasto' });
    elos.push({ de: 'disponivel', para: 'superavit', valor: superavit });
  }
  const totalAreas = u.usos.reduce((s, a) => s + a.valor, 0);
  for (const a of u.usos) {
    if (a.valor <= 0) continue;
    nos.push({ id: 'u-' + a.id, nome: a.nome, valor: a.valor, coluna: 4, tipo: 'gasto', nota: parcela(a.valor, totalAreas) + ' do gasto por área', partes: a.partes as [string, number][] });
    elos.push({ de: 'gasto', para: 'u-' + a.id, valor: a.valor });
  }
  if (u.diferenca_gasto > 0) {
    nos.push({ id: 'dif-gasto', nome: 'Sem área no Anexo 02', valor: u.diferenca_gasto, coluna: 4, tipo: 'diferenca', nota: 'gasto do Anexo 01 acima da soma por função' });
    elos.push({ de: 'gasto', para: 'dif-gasto', valor: u.diferenca_gasto });
  }
  return { nos, elos, colunas: COLUNAS };
}
