import snapshot from '../../../../public/eficiencia/habitacao/snapshot.json';
import type {Territorio} from './modelo';
export const dados=snapshot as {versao:number;ano:number;capturadoEm:string;edicao:string;territorios:Territorio[];fontes:{arquivo:string;url:string;sha256:string}[]};
export const brasil=dados.territorios.find(r=>r.id==='BR')!;
