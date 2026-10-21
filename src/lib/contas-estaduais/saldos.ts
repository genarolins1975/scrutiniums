import { execucaoPrimaria } from './dados';

// Saldos do mesmo demonstrativo, não fluxos ou estoque de restos a pagar.
export function saldosExecucao(uf: string, ano: number) {
 const dado = execucaoPrimaria(uf, ano);
 if (!dado) return null;
 const v = dado.valores;
 const partes = [
  { id: 'paga', nome: 'Paga', valor: v.paga, formula: 'Despesa paga' },
  { id: 'liquidada_nao_paga', nome: 'Liquidada, ainda não paga', valor: v.liquidada - v.paga, formula: 'Liquidada − paga' },
  { id: 'empenhada_nao_liquidada', nome: 'Empenhada, ainda não liquidada', valor: v.empenhada - v.liquidada, formula: 'Empenhada − liquidada' },
  { id: 'nao_empenhada', nome: 'Dotação não empenhada', valor: v.dotacao_atualizada - v.empenhada, formula: 'Dotação atualizada − empenhada' },
 ];
 if (v.dotacao_atualizada <= 0 || partes.some(p => !Number.isFinite(p.valor) || p.valor < 0)) return null;
 return { dado, partes: partes.map(p => ({ ...p, percentual: p.valor / v.dotacao_atualizada * 100 })),
  alteracao: v.dotacao_atualizada - v.dotacao_inicial,
  alteracaoPercentual: v.dotacao_inicial > 0 ? (v.dotacao_atualizada / v.dotacao_inicial - 1) * 100 : null };
}

export function csvSaldos(uf: string, ano: number) {
 const s = saldosExecucao(uf, ano);
 if (!s) return null;
 const cell = (v: unknown) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
 const fontes = s.dado.fontes;
 const linhas: unknown[][] = [['UF','ano','periodo','medida','valor_BRL_nominal','percentual_dotacao_atualizada','formula','fonte','arquivo','sha256']];
 for (const p of s.partes) linhas.push([uf,ano,'janeiro a dezembro',p.nome,p.valor.toFixed(2),p.percentual,p.formula,fontes.map(f=>f.url).join(' | '),fontes.map(f=>f.arquivo).join(' | '),fontes.map(f=>f.sha256).join(' | ')]);
 linhas.push([uf,ano,'janeiro a dezembro','Alteração líquida da dotação',s.alteracao.toFixed(2),'','Dotação atualizada − inicial',fontes.map(f=>f.url).join(' | '),fontes.map(f=>f.arquivo).join(' | '),fontes.map(f=>f.sha256).join(' | ')]);
 return '\uFEFF' + linhas.map(l=>l.map(cell).join(';')).join('\r\n');
}
