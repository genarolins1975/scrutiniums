import {dividirEmCem,numero} from '@/lib/contas-publicas/formato';
export type ParcelaCem={id:string;nome:string;valor:number;financeiro?:boolean};
export function ReguaCem({parcelas}:{parcelas:ParcelaCem[]}){
 if(!parcelas.length||parcelas.reduce((s,p)=>s+p.valor,0)<=0)return <p className="cp-status">Não calculável: não há total positivo neste recorte.</p>;
 const partes=dividirEmCem(parcelas.map(p=>p.valor));
 return <><div className="cp-hundred" aria-hidden="true">{parcelas.map((p,i)=><span key={p.id} className={p.financeiro?'cp-financial':''} style={{width:`${partes[i]}%`}}>{partes[i]>=5?numero(partes[i]):''}</span>)}</div><ol className="cp-hundred-labels" aria-label="Repartição de cada cem reais">{parcelas.map((p,i)=><li key={p.id} className={p.financeiro?'cp-financial-label':''}><span>{p.nome}</span><strong>R$ {numero(partes[i])}</strong></li>)}</ol><p className="cp-note">Régua proporcional. Arredondamento por maiores restos para fechar em R$ 100,0. Os valores da fonte permanecem inalterados.</p></>;
}
