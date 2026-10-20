import {CAPITULOS_PUBLICADOS, INDICADORES, PAINEL_AREAS, type CapituloId} from './catalogo';
export const PAINEIS_COMPLEMENTARES:{capitulo:CapituloId;nome:string;href:string}[] = [{capitulo:'custos',nome:'Custos agregados da União',href:'/contas-publicas/custos#custos-observados'},{capitulo:PAINEL_AREAS.capitulo,nome:PAINEL_AREAS.titulo,href:PAINEL_AREAS.href}];
export function coberturaCapitulo(id:CapituloId){
 const indicadores=INDICADORES.filter(i=>i.capitulo===id);
 return {observados:indicadores.filter(i=>i.status==='integracao-parcial'),pendentes:indicadores.filter(i=>i.status==='aguardando-integracao'),complementares:PAINEIS_COMPLEMENTARES.filter(p=>p.capitulo===id)};
}
/** Cobertura dos capítulos na navegação; os em preparação ficam fora (catálogo, situacao 'em-preparacao'). */
export const COBERTURA=CAPITULOS_PUBLICADOS.map(c=>({...c,...coberturaCapitulo(c.id)}));
