import type {Metadata} from 'next';
import {PaginaTrabalho} from '@/components/eficiencia/trabalho-renda/PaginaTrabalho';
import {PainelPrincipal} from '@/components/observatorios/PainelPrincipal';
export const metadata:Metadata={title:'Emprego formal nacional'};
// o aviso do painel principal fica logo depois da abertura do molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026)
export default function Pagina(){return <PaginaTrabalho slug="emprego-formal" aviso={<PainelPrincipal rota="/eficiencia-estatal/trabalho-renda/emprego-formal"/>} titulo="Como evoluem os vínculos formais no Brasil?" pergunta="Estoque nacional de vínculos do Novo Caged na série SGS 28763 e sua variação mensal calculada, sem ajuste sazonal. Vínculos em estabelecimentos não equivalem a pessoas únicas ou moradores ocupados." ids={['estoque-formal','saldo-formal']}/>}
