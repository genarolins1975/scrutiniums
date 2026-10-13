import {numero,razao} from '@/lib/contas-publicas/formato';
import {ESTADOS_METAS,numeroFisico,type MetaExibida} from '@/lib/contas-publicas/metas-modelo';
export function escalaCumprimento(r:Pick<MetaExibida,'metaAtual'|'metaOriginal'|'realizado'|'estado'>){
 if(r.estado!=='calculavel'||r.metaAtual===null||r.metaAtual<=0||r.realizado===null||r.realizado<0)return null;
 const max=Math.max(r.metaAtual,r.realizado,r.metaOriginal&&r.metaOriginal>0?r.metaOriginal:0)*1.1;
 return {max,realizado:100*r.realizado/max,atual:100*r.metaAtual/max,original:r.metaOriginal!==null&&r.metaOriginal>0?100*r.metaOriginal/max:null};
}
export function BarraCumprimento({registro:r,legenda=false}:{registro:MetaExibida;legenda?:boolean}){
 const escala=escalaCumprimento(r);
 return <figure className="cp-achievement" aria-label={`Realizado e metas de ${r.acao} em ${r.localNome}`} aria-describedby="metas-proveniencia"><figcaption className={legenda?'cp-note':'cp-sr-only'}>Realizado, meta atual e meta original · 2025 · {r.localNome} · {r.unidadeNome||'unidade não informada'}</figcaption>{escala?<><div className="cp-achievement-track" aria-hidden="true"><span style={{width:`${escala.realizado}%`}}/><i className="cp-target-current" style={{left:`${escala.atual}%`}}/>{escala.original!==null&&<i className="cp-target-original" style={{left:`${escala.original}%`}}/>}</div><p className="cp-achievement-label"><strong>{razao(r.realizado,r.metaAtual)}</strong> da meta atual · original: {numeroFisico(r.metaOriginal)}</p>{legenda&&<p className="cp-note">Barra: realizado · traço sólido: meta atual · tracejado: original. Escala de zero a {numero(escala.max,2)} {r.unidadeNome}. Valores superiores à meta ultrapassam o marcador.</p>}</>:<><div className="cp-pending-track" aria-hidden="true"/><p className="cp-note">Não calculável · {ESTADOS_METAS[r.estado]}</p></>}</figure>;
}
