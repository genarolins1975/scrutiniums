import {type Estagio,type CampoFiscal} from './dados';
import {porOrigemRAP,type RegistroRAP} from './rap-modelo';
export function intervalosExecucao(total:Record<Estagio,number>){return [
 {nome:'Autorizado sem empenho',de:'atualizada' as const,ate:'empenhado' as const,valor:total.atualizada-total.empenhado},
 {nome:'Empenhado sem liquidação',de:'empenhado' as const,ate:'liquidado' as const,valor:total.empenhado-total.liquidado},
 {nome:'Liquidado sem pagamento',de:'liquidado' as const,ate:'pago' as const,valor:total.liquidado-total.pago}
];}
export function ponteFiscal(v:Record<CampoFiscal,number>){
 let saldo=v.receitaTotal;
 const movimentos=[{nome:'Receita total',inicio:0,fim:saldo,valor:saldo,tipo:'total'}];
 for(const [nome,campo] of [['Transferências por repartição','transferencias'],['Benefícios previdenciários','previdencia'],['Pessoal e encargos','pessoal'],['Outras obrigatórias','outrasObrigatorias'],['Sujeitas à programação financeira','programacaoFinanceira']] as const){
  const inicio=saldo;saldo-=v[campo];movimentos.push({nome,inicio,fim:saldo,valor:-v[campo],tipo:'deducao'});
  if(campo==='transferencias')movimentos.push({nome:'Receita líquida',inicio:0,fim:v.receitaLiquida,valor:v.receitaLiquida,tipo:'total'});
 }
 movimentos.push({nome:'Resultado primário',inicio:0,fim:v.resultado,valor:v.resultado,tipo:'resultado'});
 return movimentos;
}
export function idadesRAP(rs:RegistroRAP[],anoPosicao:number){
 const grupos=[{nome:'1 ano',saldo:0},{nome:'2 a 3 anos',saldo:0},{nome:'4 a 5 anos',saldo:0},{nome:'6 anos ou mais',saldo:0}];
 for(const r of porOrigemRAP(rs)){const idade=anoPosicao-r.ano;const indice=idade<=1?0:idade<=3?1:idade<=5?2:3;grupos[indice].saldo+=r.saldo;}
 return grupos;
}
