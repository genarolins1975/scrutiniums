import 'server-only';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export type Observation={raw:string|null;value:string|number|null;status:'OBSERVADO'|'NAO_INFORMADO'|'NAO_APLICAVEL'};
export type Unit={id:string;kind:string;code:string|null;city:string;uf:string;scope:string;nature:string;complete:string;values:Record<string,Observation>};
export type Metric={id:string;variable:string;kind:string;name:string;definition:string;universe:string;period:string;frequency:string;formula:string;numerator:string;denominator:string;unit:string;source:string;record:string;coverage:number;missing:string;breaks:string;score_role:string;reference:string;limitations:string;publication:string};
export type Summary={total:number;observed:number;missing:number;notApplicable:number;categories:{label:string;count:number;percent:number}[];sum:number|null;median:number|null};
export type RmaValue={sum:number|null;observed:number;total:number;changed:number};
export type SuasData={year:number;ufs:string[];catalog:Metric[];manifest:{captured_at:string;counts:Record<string,number>;rma_rows:number;sources:{file:string;url:string;sha256:string}[];audit:Record<string,unknown>[]};stats:Record<string,{counts:Record<string,{total:number;local:number;regional:number;state:number;complete:number}>;metrics:Record<string,Summary>;monthly:{month:number;values:Record<string,RmaValue>}[]}>};
let cache:SuasData|undefined;
export function dadosAssistencia(){return cache??=JSON.parse(readFileSync(join(process.cwd(),'public/eficiencia/assistencia-social/panorama.json'),'utf8')) as SuasData;}
export const BASE_SUAS='/eficiencia/assistencia-social';
