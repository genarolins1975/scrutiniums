/**
 * Snapshot congelado do piloto v2 com as funções já ligadas a ele.
 * SOMENTE para servidor e testes: componentes cliente devem importar
 * `piloto-nucleo` e receber o snapshot por prop (ver page.tsx).
 */
import snapshot from '../../../docs/obee/resultados/piloto-2022-v2.json';
import {createPilot} from './piloto-nucleo';

export * from './piloto-nucleo';
export const {pilotoResultados,pilotRow,pilotCsv,pilotGap,pilotStability} = createPilot(snapshot);
