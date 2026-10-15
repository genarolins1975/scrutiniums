import { fmtNumber } from "../../format";
import type { Idioma } from "../../idioma";

export const ROTA='/eficiencia-estatal/saneamento';
export const PAGINAS=[['','Panorama'],['agua','Água'],['esgoto','Esgoto'],['residuos','Resíduos'],['drenagem','Drenagem'],['recursos','Recursos'],['dados','Dados e métodos']] as const;
export type Grupo='agua'|'esgoto'|'residuos'|'drenagem'|'recursos';
export type Indicador={id:string;grupo:string;nome:string;unidade:string;casas:number;formula:string;base:string;nota:string;regras:string;fonte:string};
export type Valor={id:string;nome:string;tipo:string;indicador:string;valor:number|null;numerador:number|null;denominador:number|null;origem:string};
export type Fonte={id:string;arquivo:string;url:string;sha256:string;aba:string};
export function n(v:number|null,casas=0,idioma:Idioma='pt'){return v===null?'Não informado':fmtNumber(v,casas,idioma);}
export function formatar(v:number|null,m:Indicador,idioma:Idioma='pt'){return v===null?'Não informado':n(v,['domicílios','municípios'].includes(m.unidade)?0:m.casas,idioma)+(m.unidade==='%'?'%':' '+m.unidade);}
export function ordenar(rows:Valor[],ordem:string){return [...rows].sort((a,b)=>a.valor===null&&b.valor!==null?1:b.valor===null&&a.valor!==null?-1:ordem==='nome'?a.nome.localeCompare(b.nome,'pt-BR'):(ordem==='maior'?-1:1)*((a.valor??0)-(b.valor??0))||a.nome.localeCompare(b.nome,'pt-BR'));}
export function csv(headers:string[],rows:(string|number|null)[][]){const esc=(v:string|number|null)=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\ufeff'+[headers,...rows].map(r=>r.map(esc).join(';')).join('\r\n');}
