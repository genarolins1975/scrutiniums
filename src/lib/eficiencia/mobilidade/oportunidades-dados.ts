import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validarAop,type BaseAop} from './oportunidades';
let cache:{base:BaseAop;hash:string;raw:string}|undefined;
export function dadosOportunidades(){
 if(cache)return cache;
 const root=join(process.cwd(),'data/eficiencia_mobilidade/aop');
 const raw=readFileSync(join(root,'resumo.json'),'utf8'),hash=createHash('sha256').update(raw).digest('hex');
 if(hash!==readFileSync(join(root,'resumo.sha256'),'utf8').trim())throw new Error('Integridade AOP não confirmada');
 const base:BaseAop=JSON.parse(raw);validarAop(base);cache={base,hash,raw};return cache;
}
