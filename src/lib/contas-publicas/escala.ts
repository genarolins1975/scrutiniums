import snapshot from './snapshots/escala.json';
import {fiscalAcumulado} from './dados';

export const ESCALA = snapshot;
export type EscalaFiscal = 'total' | 'habitante' | 'pib';
export const UNIDADES_ESCALA = {total:'R$ milhões correntes',habitante:'R$ correntes por habitante',pib:'% do PIB'} as const;
export function denominador(ano:number, mes=12) {
  return mes === 12 ? ESCALA.registros.find(r=>r.ano===ano) ?? null : null;
}
/** Input is always R$ millions. No annualisation, imputation or rounding. */
export function converterEscala(valor:number|null, ano:number, mes:number, escala:EscalaFiscal):number|null {
  if(valor===null || !Number.isFinite(valor) || !Number.isInteger(mes) || mes<1 || mes>12) return null;
  if(escala==='total') return valor;
  const d=denominador(ano,mes);
  if(!d) return null;
  const base=escala==='pib'?d.pibMilhoes:d.populacao;
  if(!Number.isFinite(base)||base<=0) return null;
  return escala==='pib'?100*valor/base:valor*1e6/base;
}
export const GRUPOS_FISCAIS=[
  {id:'previdencia',nome:'Benefícios previdenciários'},
  {id:'pessoal',nome:'Pessoal e encargos sociais'},
  {id:'outrasObrigatorias',nome:'Outras despesas obrigatórias'},
  {id:'programacaoFinanceira',nome:'Executivo: sujeitas à programação financeira'},
] as const;
export function compararDespesas(ano:number,mes:number,escala:EscalaFiscal) {
  const atual=fiscalAcumulado(ano,mes), anterior=fiscalAcumulado(ano-1,mes);
  if(!atual||!anterior) return null;
  const linhas=GRUPOS_FISCAIS.map(g=>{
    const a=converterEscala(atual[g.id],ano,mes,escala);
    const b=converterEscala(anterior[g.id],ano-1,mes,escala);
    return {...g,atual:a,anterior:b,diferenca:a===null||b===null?null:a-b,
      variacao:a===null||b===null||b<=0?null:100*(a/b-1),
      participacao:atual.despesa>0?100*atual[g.id]/atual.despesa:null};
  });
  if(linhas.some(l=>l.atual===null||l.anterior===null)) return null;
  return linhas as (typeof linhas[number]&{atual:number;anterior:number;diferenca:number})[];
}
export function exportarComparacaoFiscal(linhas:NonNullable<ReturnType<typeof compararDespesas>>,ano:number,mes:number,escala:EscalaFiscal) {
  const unidade=UNIDADES_ESCALA[escala];
  return [['categoria',`valor_${ano-1}`,`valor_${ano}`,'diferenca','unidade_valores','unidade_diferenca','meses_comparados'],
    ...linhas.map(l=>[l.nome,l.anterior,l.atual,l.diferenca,unidade,escala==='pib'?'p.p.':unidade,`1-${mes}`])]
    .map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\r\n');
}
