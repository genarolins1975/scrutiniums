import 'server-only';
import snapshot from '../../../../public/eficiencia/judiciario/internacional.json';
import type {DadosInternacionais} from './internacional';

// Apenas props de Server Components após a barreira de sessão; nenhum snapshot
// entra por import em chunks públicos do cliente. O histórico é carregado sob demanda.
export const internacionalJudiciario=snapshot as DadosInternacionais;
