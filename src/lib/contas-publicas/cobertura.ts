import {CAPITULOS, INDICADORES, type CapituloId} from './catalogo';
export const PAINEIS_COMPLEMENTARES = [{capitulo:'custos' as const,nome:'Custos agregados da União',href:'/contas-publicas/custos#custos-observados'}];
export function coberturaCapitulo(id:CapituloId){
 const indicadores=INDICADORES.filter(i=>i.capitulo===id);
 return {observados:indicadores.filter(i=>i.status==='integracao-parcial'),pendentes:indicadores.filter(i=>i.status==='aguardando-integracao'),complementares:PAINEIS_COMPLEMENTARES.filter(p=>p.capitulo===id)};
}
export const COBERTURA=CAPITULOS.map(c=>({...c,...coberturaCapitulo(c.id)}));
