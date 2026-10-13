import bruto from '../../../../public/eficiencia/previdencia/snapshot.json';
export const ROTA='/eficiencia-estatal/previdencia';
export const PAGINAS=[['','Panorama'],['beneficios','Benefícios'],['territorio','Território'],['recursos','Valores emitidos'],['atendimento','Atendimento'],['metodos','Dados e métodos']] as const;
export type Linha={id:string;name:string;territory:string;values:(number|null)[]};
export const tabelas=bruto.tables as Record<string,Linha[]>;
export const fontes=bruto.sources;
export const regioes=['NORTE','NORDESTE','SUDESTE','SUL','CENTRO-OESTE'];
export const n=(v:number|null,d=0)=>v===null?'Não informado':v.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
export function coluna(ano:string,clientela='total'){return Number(ano)-2022+(['total','urbana','rural'].indexOf(clientela)*3)}
export function valor(tabela:string,nome:string,ano='2024',clientela='total'){return tabelas[tabela].find(r=>r.territory===nome)?.values[coluna(ano,clientela)]??null}
export function total(tabela:string,ano='2024'){return tabelas[tabela][0].values[coluna(ano)]}
export function serie(tabela:string,nome:string){return [2022,2023,2024].map(ano=>({nome:String(ano),valor:valor(tabela,nome,String(ano))}))}
export function csv(headers:string[],rows:(string|number|null)[][]){return '\uFEFF'+[headers,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n')}
export type Medida={id:string;nome:string;tabela:string;unidade:string;nota:string;anoUnico?:boolean;calculo?:'medio'|'soma'|'agencias'};
export const medidas:Record<string,Medida>={
 emitidos:{id:'emitidos',nome:'Benefícios emitidos em dezembro',tabela:'b.13',unidade:'benefícios',nota:'Posição em dezembro; inclui RGPS, benefícios assistenciais e encargos previdenciários da União (EPU). Não é contagem de pessoas únicas nem cobertura da população.'},
 concedidos:{id:'concedidos',nome:'Benefícios concedidos no ano',tabela:'a.14',unidade:'concessões',nota:'Fluxo de novas concessões no ano, incluindo benefícios de curta duração e assistenciais. Não é estoque de benefícios em manutenção, quantidade de requerimentos nem taxa de aprovação.'},
 dezembro:{id:'dezembro',nome:'Valor emitido em dezembro',tabela:'b.14',unidade:'R$',nota:'Valor nominal dos créditos emitidos, com descontos de consignado considerados na fonte. Inclui RGPS, assistenciais e EPU; não equivale à despesa orçamentária ou à renda bruta.'},
 anual:{id:'anual',nome:'Valor emitido acumulado no ano',tabela:'b.15',unidade:'R$',nota:'Acumulado anual nominal, incluindo meses com abono anual. Não multiplicamos dezembro por 12. Inclui descontos considerados pela fonte; não mede déficit, financiamento ou custo administrativo.'},
 medio:{id:'medio',nome:'Valor médio por benefício emitido em dezembro',tabela:'b.14',unidade:'R$/benefício',calculo:'medio',nota:'Razão OBEE: valor emitido em dezembro (R$ mil × 1.000) / benefícios emitidos no mesmo mês e clientela. Média ponderada dos créditos, não renda média de pessoas nem valor de aposentadoria típica.'},
 agencias:{id:'agencias',nome:'Agências fixas com atendimento presencial',tabela:'43.1',unidade:'agências',anoUnico:true,calculo:'agencias',nota:'Rede em dezembro de 2024. Coluna “Fixas” da tabela 43.1; exclui centrais telefônicas, agências de acordos internacionais, unidades móveis e estruturas administrativas. Presença física não mede cobertura, capacidade ou tempo de espera.'},
 atendimentos:{id:'atendimentos',nome:'Atendimentos nas unidades do INSS no ano',tabela:'43.2',unidade:'atendimentos',anoUnico:true,calculo:'soma',nota:'Soma OBEE dos 12 meses de 2024 na tabela 43.2. São atendimentos registrados nas unidades, não usuários únicos, benefícios concedidos nem conjunto dos canais digitais e telefônicos.'},
};
export function calcular(m:Medida,row:Linha,ano:string,clientela:string):number|null{
 if(m.calculo==='agencias')return row.values[2];
 if(m.calculo==='soma')return row.values.some(v=>v===null)?null:row.values.reduce<number>((a,v)=>a+(v??0),0);
 const v=row.values[coluna(ano,clientela)];
 if(m.calculo==='medio'){const d=valor('b.13',row.territory,ano,clientela);return v===null||d===null||d<=0?null:v*1000/d}
 return v===null?null:m.unidade==='R$'?v*1000:v;
}
