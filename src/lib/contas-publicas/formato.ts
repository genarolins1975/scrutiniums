/** Presentation only. Source amounts and calculation contracts remain untouched. */
export type UnidadeMonetaria = 'reais' | 'milhoes';
const valido = (v:number|null):v is number => v !== null && Number.isFinite(v);
export function numero(v:number|null, casas=1) {
 if(!valido(v)) return 'Não informado';
 const arredondado = Number(v.toFixed(casas));
 return (Object.is(arredondado,-0)?0:arredondado).toLocaleString('pt-BR',{minimumFractionDigits:casas,maximumFractionDigits:casas}).replace('-', '−');
}
export function moeda(v:number|null, origem:UnidadeMonetaria, op:{curta?:boolean;variacao?:boolean}={}) {
 if(!valido(v)) return 'Não informado';
 const reais=v*(origem==='milhoes'?1e6:1), a=Math.abs(reais);
 const [divisor,longo,curto,casas] = a>=1e12?[1e12,'trilhões','tri',2] as const:a>=1e9?[1e9,'bilhões','bi',1] as const:a>=1e6?[1e6,'milhões','mi',1] as const:[1,'','',1] as const;
 const valor=Number((reais/divisor).toFixed(casas));
 return `${valor<0?'−':op.variacao&&valor>0?'+':''}R$ ${numero(Math.abs(valor),casas)}${longo?' '+(op.curta?curto:longo):''}`;
}
export const participacao=(n:number|null,d:number|null)=>n===null||d===null?'Não informado':d>0&&Number.isFinite(n)&&Number.isFinite(d)?numero(100*n/d)+'%':'Não calculável';
export const razao=participacao;
export const variacaoPercentual=(valor:number|null)=>valido(valor)?`${valor>0?'+':''}${numero(valor)}%`:'Não informado';
/** Inputs already expressed in percentage points, never percentage growth. */
export const pontosPercentuais=(valor:number|null)=>valido(valor)?`${valor>0?'+':''}${numero(valor)} p.p.`:'Não informado';
/** Largest remainders in tenths. Stable input order breaks equal remainders. */
export function dividirEmCem(valores:readonly number[]):number[] {
 if(!valores.length||valores.some(v=>!Number.isFinite(v)||v<0)) throw new Error('Composição exige valores finitos não negativos.');
 const total=valores.reduce((s,v)=>s+v,0);
 if(total<=0) throw new Error('Composição exige total positivo.');
 const exatos=valores.map(v=>1000*v/total), inteiros=exatos.map(Math.floor);
 const ordem=exatos.map((v,i)=>({i,resto:v-inteiros[i]})).sort((a,b)=>b.resto-a.resto||a.i-b.i);
 const faltam=1000-inteiros.reduce((s,v)=>s+v,0);
 for(let i=0;i<faltam;i++) inteiros[ordem[i].i]++;
 return inteiros.map(v=>v/10);
}
export function compararSaldo(atual:number,anterior:number,ano:number) {
 const nome=(v:number)=>v<0?'déficit':v>0?'superávit':'equilíbrio';
 const de=`${nome(anterior)} de ${moeda(Math.abs(anterior),'milhoes')} em ${ano-1}`;
 const para=`${nome(atual)} de ${moeda(Math.abs(atual),'milhoes')} em ${ano}`;
 if(Math.sign(atual)!==Math.sign(anterior)) return `O saldo passou de ${de} para ${para}.`;
 const delta=Math.abs(atual)-Math.abs(anterior);
 return `O ${nome(atual)} ${delta>0?'aumentou':delta<0?'diminuiu':'permaneceu estável'}${delta!==0?' em '+moeda(Math.abs(delta),'milhoes'):''}, passando de ${moeda(Math.abs(anterior),'milhoes')} em ${ano-1} para ${moeda(Math.abs(atual),'milhoes')} em ${ano}.`;
}
