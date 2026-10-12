import { execucaoPrimaria } from './dados';

export const ROTULOS_FINANCIAMENTO = {
 receitas_correntes: 'Receitas correntes',
 tributaria: 'Impostos, taxas e contribuições de melhoria',
 contribuicoes: 'Contribuições',
 transferencias_correntes: 'Transferências correntes',
 receitas_capital: 'Receitas de capital',
 despesas_correntes: 'Despesas correntes liquidadas',
 demais_correntes_agrupadas: 'Demais receitas correntes agrupadas',
} as const;
export function financiamentoEstadual(uf:string,ano:number) {
 const dado=execucaoPrimaria(uf,ano);
 if(!dado) return null;
 const f=dado.financiamento, v=f.valores;
 const ids=['tributaria','contribuicoes','transferencias_correntes','demais_correntes_agrupadas'] as const;
 return {dado,...f,partes:ids.map(id=>({id,nome:ROTULOS_FINANCIAMENTO[id],valor:v[id],percentual:100*v[id]/v.receitas_correntes}))};
}
export function csvFinanciamento(uf:string,ano:number) {
 const f=financiamentoEstadual(uf,ano); if(!f) return null;
 const cell=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
 const fontes=f.dado.fontes;
 const origem=[fontes.map(x=>x.url).join(' | '),fontes.map(x=>x.arquivo).join(' | '),fontes.map(x=>x.sha256).join(' | ')];
 const rows:unknown[][]=[['UF','ano','periodo','medida','valor','unidade','formula_ou_campo','fonte','arquivo','sha256']];
 for(const [id,valor] of Object.entries(f.valores)) rows.push([uf,ano,'janeiro a dezembro',ROTULOS_FINANCIAMENTO[id as keyof typeof ROTULOS_FINANCIAMENTO],valor.toFixed(2),'BRL_nominal',id==='demais_correntes_agrupadas'?'Receitas correntes − tributária − contribuições − transferências correntes':'Linha própria do RREO 01',...origem]);
 rows.push([uf,ano,'janeiro a dezembro','Margem corrente em reais',f.margem_nominal.toFixed(2),'BRL_nominal','Receitas correntes − despesas correntes liquidadas',...origem]);
 rows.push([uf,ano,'janeiro a dezembro','CE-10',f.indicadores['CE-10'],'%','100 × (receitas correntes − despesas correntes liquidadas) / receitas correntes',...origem]);
 rows.push([uf,ano,'janeiro a dezembro','CE-14',f.indicadores['CE-14'],'%','100 × transferências correntes / receitas correntes',...origem]);
 return '\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
}
