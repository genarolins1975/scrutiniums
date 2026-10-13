import { execucaoPrimaria } from './dados';
export const NOMES_DESPESA: Record<string,string> = {
 PessoalEEncargosSociais:'Pessoal e encargos sociais', JurosEEncargosDaDivida:'Juros e encargos da dívida', OutrasDespesasCorrentes:'Outras despesas correntes', Investimentos:'Investimentos', InversoesFinanceiras:'Inversões financeiras', AmortizacaoDaDivida:'Amortização da dívida', DespesasCorrentes:'Despesas correntes', DespesasDeCapital:'Despesas de capital',
};
export function composicaoDespesa(uf:string, ano:number) {
 const dado=execucaoPrimaria(uf,ano);return dado ? {dado,...dado.composicao_despesa} : null;
}
export function csvDespesas(uf:string,ano:number) {
 const d=composicaoDespesa(uf,ano);if(!d)return null;
 const cell=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
 const rows:unknown[][]=[['UF','ano','periodo','grupo','medida','valor_BRL_nominal','percentual_liquidada','cod_conta','coluna','fonte','arquivo','sha256']];
 for(const p of d.partes)rows.push([uf,ano,'janeiro a dezembro',p.grupo,NOMES_DESPESA[p.conta],p.valor.toFixed(2),p.percentual,p.conta,d.coluna,d.dado.fontes.map(f=>f.url).join(' | '),d.dado.fontes.map(f=>f.arquivo).join(' | '),d.dado.fontes.map(f=>f.sha256).join(' | ')]);
 return '\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
}
