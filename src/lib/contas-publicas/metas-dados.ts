/** Uso no servidor: a base completa não integra o bundle do cliente. */
import fonte from './snapshots/metas.json';
import {estadoMeta,normalizarBusca,type MetaFisica,type MetaExibida,type EstadoMeta,type RespostaMetas} from './metas-modelo';
const d=fonte.dicionarios;
function nome(tabela:Record<string,string>,id:string){return tabela[id]??id}
export const METAS:MetaExibida[]=fonte.registros.map(linha=>{
 const r=Object.fromEntries(fonte.colunas.map((c,i)=>[c,linha[i]])) as unknown as MetaFisica;
 return {...r,titulo:nome(d.acoes,r.acao),orgaoNome:nome(d.orgaos,r.orgao),uoNome:nome(d.uos,r.uo),localNome:nome(d.localizadores,r.id),produtoNome:nome(d.produtos,r.produto),unidadeNome:nome(d.unidades,r.unidade),estado:estadoMeta(r)};
}).sort((a,b)=>(b.autorizado??-Infinity)-(a.autorizado??-Infinity)||a.id.localeCompare(b.id));
export const META_INFO={captura:fonte.captura,referencia:fonte.referencia,edicaoArquivo:fonte.edicaoArquivo,fonte:fonte.fonte,dicionario:fonte.dicionario,cobertura:fonte.cobertura,contagemFonte:fonte.contagemFonte,orgaos:Object.entries(d.orgaos).map(([id,nome])=>({id,nome})).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))};
export type FiltrosMetas={busca:string;orgao:string;estado:EstadoMeta|'todos'};
export function filtrarMetas(f:FiltrosMetas){const q=normalizarBusca(f.busca.trim());return METAS.filter(r=>(!f.orgao||r.orgao===f.orgao)&&(f.estado==='todos'||r.estado===f.estado)&&(!q||normalizarBusca([r.id,r.titulo,r.produtoNome,r.orgaoNome,r.uoNome,r.localNome].join(' ')).includes(q)))}
export function consultarMetas(f:FiltrosMetas,pagina=1):RespostaMetas{
 const registros=filtrarMetas(f);const paginas=Math.max(1,Math.ceil(registros.length/25));const p=Math.min(paginas,Math.max(1,Number.isFinite(pagina)?Math.trunc(pagina):1));
 return {total:registros.length,pagina:p,paginas,registros:registros.slice((p-1)*25,p*25)};
}
