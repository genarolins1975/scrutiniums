import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validarBase,type BaseMobilidade} from './modelo';
let memoria:{base:BaseMobilidade;hash:string;raw:string}|undefined;
/** Apenas servidor: o snapshot integral não é enviado como props ao cliente. */
export function dadosMobilidade(){
  if(memoria)return memoria;
  const raw=readFileSync(join(process.cwd(),'data/eficiencia_mobilidade/gold.json'),'utf8');
  const esperado=readFileSync(join(process.cwd(),'data/eficiencia_mobilidade/gold.sha256'),'utf8').trim();
  const hash=createHash('sha256').update(raw).digest('hex');
  if(hash!==esperado)throw new Error('Falha de integridade do snapshot de Mobilidade');
  const base:BaseMobilidade=JSON.parse(raw);validarBase(base);memoria={base,hash,raw};return memoria;
}
