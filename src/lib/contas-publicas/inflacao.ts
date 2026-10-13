import snapshot from './snapshots/ipca.json';
import {DADOS,CAMPOS_FISCAIS,type CampoFiscal} from './dados';

export const IPCA = snapshot;
export const BASE_PRECOS = new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${IPCA.basePrecos}-01T00:00:00Z`));
type Fluxo = {periodo:string}&Record<CampoFiscal,number>;
/** Fluxos mensais em R$ milhões; índice do próprio mês, não do mês anterior. */
export function fiscalRealAcumulado(ano:number,mes:number,
  fluxos:readonly Fluxo[]=DADOS.rtnMensal,
  indices:readonly {periodo:string;indice:number}[]=IPCA.registros,
  base=IPCA.basePrecos):Record<CampoFiscal,number>|null {
  if(!Number.isInteger(ano)||!Number.isInteger(mes)||mes<1||mes>12) return null;
  const bases=indices.filter(i=>i.periodo===base);
  if(bases.length!==1||!Number.isFinite(bases[0].indice)||bases[0].indice<=0) return null;
  const total=Object.fromEntries(CAMPOS_FISCAIS.map(c=>[c,0])) as Record<CampoFiscal,number>;
  for(let m=1;m<=mes;m++) {
    const periodo=`${ano}-${String(m).padStart(2,'0')}`;
    const f=fluxos.filter(r=>r.periodo===periodo),i=indices.filter(r=>r.periodo===periodo);
    if(f.length!==1||i.length!==1||!Number.isFinite(i[0].indice)||i[0].indice<=0) return null;
    const fator=bases[0].indice/i[0].indice;
    for(const c of CAMPOS_FISCAIS) {
      if(!Number.isFinite(f[0][c])) return null;
      total[c]+=f[0][c]*fator;
      if(!Number.isFinite(total[c])) return null;
    }
  }
  return total;
}
