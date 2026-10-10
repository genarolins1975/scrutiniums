import snapshot from '../../../../public/eficiencia/justica/snapshot.json';
import {agruparCobertura,type Comarca,type Defensoria,type Tribunal} from './modelo';
export const dadosJustica={...snapshot,comarcas:snapshot.comarcas as Comarca[],defensorias:snapshot.defensorias as Defensoria[],tribunais:snapshot.tribunais as Tribunal[]};
export const coberturaJustica=agruparCobertura(dadosJustica.comarcas);
