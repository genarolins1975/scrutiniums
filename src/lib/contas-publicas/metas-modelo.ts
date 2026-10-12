import {cumprimentoFisico} from './entregas';
export type EstadoMeta='calculavel'|'ausente'|'inelegivel'|'sem-produto-unidade'|'sem-data';
export interface MetaFisica {
 id:string;orgao:string;uo:string;funcao:string;programa:string;acao:string;localizador:string;produto:string;unidade:string;
 metaOriginal:number|null;metaAtual:number|null;metaReprogramada:number|null;realizado:number|null;apuracao:string|null;
 realizadoRAP:number|null;apuracaoRAP:string|null;autorizado:number|null;liquidado:number|null;pago:number|null;
 sinalCaptacao:string;linhaFonte:number;esfera:string;
}
export type MetaExibida=MetaFisica&{titulo:string;orgaoNome:string;uoNome:string;localNome:string;produtoNome:string;unidadeNome:string;estado:EstadoMeta};
export const ESTADOS_METAS:Record<EstadoMeta,string>={calculavel:'Razão calculável',ausente:'Meta ou realizado ausente',inelegivel:'Meta ou realizado inelegível','sem-produto-unidade':'Sem produto ou unidade','sem-data':'Sem data de apuração'};
export function estadoMeta(m:MetaFisica):EstadoMeta{
 if(!m.produto||!m.unidade)return 'sem-produto-unidade';
 const medida=cumprimentoFisico(m.realizado,m.metaAtual);
 if(medida.estado==='ausente')return 'ausente';if(medida.estado==='inelegivel')return 'inelegivel';
 return m.apuracao?'calculavel':'sem-data';
}
export const normalizarBusca=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export const numeroFisico=(n:number|null)=>n===null?'Não informado':n.toLocaleString('pt-BR',{maximumFractionDigits:2}).replace('-', '−');
export type RespostaMetas={total:number;pagina:number;paginas:number;registros:MetaExibida[]};
