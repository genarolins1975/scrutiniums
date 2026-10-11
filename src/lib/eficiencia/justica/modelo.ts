export const ROTA_JUSTICA = '/eficiencia-estatal/acesso-justica';
export const PAGINAS_JUSTICA = [['','Panorama'],['cobertura','Cobertura territorial'],['tempo-resposta','Tempo e resposta'],['conciliacao','Soluções consensuais'],['recursos','Recursos'],['dados','Dados e métodos']] as const;
export type Comarca = {codigo:string;nome:string;uf:string;estado:string;populacao:number;municipios:number;situacao:string;linha:number};
export type Defensoria = {uf:string;estado:string;ano:number;defensores:number|null;atendimentos:number|null;acordos:number|null;executado:number|null;notaAtendimentos:string;notaAcordos:string;linha:number};
export type Tribunal = {uf:string;tribunal:string;baixados:number;pendentes:number;pagina:number};
export type Cobertura = {uf:string;estado:string;total:number;regular:number;parcial:number;sem:number;populacao:number;popRegular:number;popParcial:number;popSem:number};
export function agruparCobertura(comarcas:Comarca[]):Cobertura[]{
 const grupos=new Map<string,Cobertura>();
 for(const c of comarcas){
  if(!['SIM','NÃO','PARCIALMENTE'].includes(c.situacao)) throw new Error('Situação de cobertura desconhecida');
  const g=grupos.get(c.uf)??{uf:c.uf,estado:c.estado,total:0,regular:0,parcial:0,sem:0,populacao:0,popRegular:0,popParcial:0,popSem:0};
  g.total++;g.populacao+=c.populacao;
  if(c.situacao==='SIM'){g.regular++;g.popRegular+=c.populacao;}else if(c.situacao==='PARCIALMENTE'){g.parcial++;g.popParcial+=c.populacao;}else{g.sem++;g.popSem+=c.populacao;}
  grupos.set(c.uf,g);
 }
 return Array.from(grupos.values()).sort((a,b)=>a.estado.localeCompare(b.estado,'pt-BR'));
}
export function razao(n:number|null,d:number|null){return n!==null&&d!==null&&Number.isFinite(n)&&Number.isFinite(d)&&d>0?n/d:null;}
export function totalInformado(values:(number|null)[]){const validos=values.filter((v):v is number=>v!==null&&Number.isFinite(v));return {valor:validos.length?validos.reduce((a,b)=>a+b,0):null,informados:validos.length,total:values.length};}
export function n(v:number|null,casas=0){return v===null?'Não informado':v.toLocaleString('pt-BR',{minimumFractionDigits:casas,maximumFractionDigits:casas});}
export function duracao(m:number|null){if(m===null)return 'Não informado';const a=Math.floor(m/12),r=m%12;return [a?`${a} ${a===1?'ano':'anos'}`:'',r?`${r} ${r===1?'mês':'meses'}`:''].filter(Boolean).join(' e ')||'0 meses';}
export function csv(headers:string[],rows:(string|number|null)[][]){const escape=(v:string|number|null)=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\ufeff'+[headers,...rows].map(r=>r.map(escape).join(';')).join('\r\n');}
