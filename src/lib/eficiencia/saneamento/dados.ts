import bruto from '../../../../public/eficiencia/saneamento/snapshot.json';
import type {Indicador,Valor,Fonte} from './modelo';
export const indicadores=bruto.indicadores as Indicador[];
export const valores=bruto.valores as Valor[];
export const fontes=bruto.fontes as Fonte[];
export const cobertura=bruto.cobertura;
export const indicador=(id:string)=>indicadores.find(m=>m.id===id)!;
export const brasil=(id:string)=>valores.find(r=>r.indicador===id&&r.id==='BR')!.valor;
