import 'server-only';
import snapshot from '../../../../public/eficiencia/judiciario/snapshot.json';
import type {RamoAgregado,TribunalJudiciario} from './modelo';

// A passagem por props de Server Components preserva a fronteira de sessão:
// o snapshot inteiro não integra os chunks estáticos públicos do navegador.
export const judiciario={...snapshot,ramos:snapshot.ramos as RamoAgregado[],tribunais:snapshot.tribunais as TribunalJudiciario[]};
