import snapshot from './snapshots/dados.json';
export const DADOS = snapshot;
export type Estagio = 'inicial'|'atualizada'|'empenhado'|'liquidado'|'pago';
export const ESTAGIOS: {id:Estagio;nome:string;descricao:string}[] = [
 {id:'inicial',nome:'Dotação inicial',descricao:'Autorização na lei orçamentária original.'},
 {id:'atualizada',nome:'Dotação atualizada',descricao:'Autorização após alterações orçamentárias.'},
 {id:'empenhado',nome:'Empenhado',descricao:'Compromissos registrados, líquidos de anulações.'},
 {id:'liquidado',nome:'Liquidado',descricao:'Verificação do direito do credor; não atesta impacto social.'},
 {id:'pago',nome:'Pago no exercício',descricao:'Pagamentos da dotação do exercício; não inclui pagamentos de restos a pagar.'},
];
export const CAMPOS_FISCAIS = ['receitaTotal','transferencias','receitaLiquida','despesa','previdencia','pessoal','outrasObrigatorias','programacaoFinanceira','resultado'] as const;
export type CampoFiscal = typeof CAMPOS_FISCAIS[number];
export function fiscalAcumulado(ano:number,mesFinal:number):Record<CampoFiscal,number>|null {
 if(!Number.isInteger(mesFinal)||mesFinal<1||mesFinal>12)return null;
 const meses=DADOS.rtnMensal.filter(m=>m.periodo.startsWith(`${ano}-`)&&Number(m.periodo.slice(5))<=mesFinal);
 if(meses.length!==mesFinal || new Set(meses.map(m=>m.periodo)).size!==mesFinal)return null;
 return Object.fromEntries(CAMPOS_FISCAIS.map(k=>[k,meses.reduce((s,m)=>s+m[k],0)])) as Record<CampoFiscal,number>;
}
export function bilhoes(valor:number,unidade:'reais'|'milhoes'='reais') {
 return (valor/(unidade==='reais'?1e9:1000)).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
}
export function percentual(n:number,d:number){return d>0?(100*n/d).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'Não calculável'}
export function dataFonte(iso:string){return iso.slice(0,10).split('-').reverse().join('/')}
