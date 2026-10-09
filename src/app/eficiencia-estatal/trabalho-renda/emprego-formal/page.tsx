import type {Metadata} from 'next';
import {PaginaTrabalho} from '@/components/eficiencia/trabalho-renda/PaginaTrabalho';
export const metadata:Metadata={title:'Emprego formal nacional'};
export default function Pagina(){return <PaginaTrabalho titulo="Como evoluem os vínculos formais no Brasil?" pergunta="Estoque nacional de vínculos do Novo Caged na série SGS 28763 e sua variação mensal calculada, sem ajuste sazonal. Vínculos em estabelecimentos não equivalem a pessoas únicas ou moradores ocupados." ids={['estoque-formal','saldo-formal']}/>}
