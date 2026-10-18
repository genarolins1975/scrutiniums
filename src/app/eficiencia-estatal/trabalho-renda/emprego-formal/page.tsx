import type {Metadata} from 'next';
import {PaginaTrabalho} from '@/components/eficiencia/trabalho-renda/PaginaTrabalho';
import {PainelMaisCompleto} from '@/components/observatorios/PainelMaisCompleto';
export const metadata:Metadata={title:'Emprego formal nacional'};
export default function Pagina(){return <><div className="mx-auto max-w-page px-4 sm:px-6"><PainelMaisCompleto href="/observatorio/formal-employment" titulo="Emprego formal" colecao="Crédito" texto="Mesma fonte (Novo Caged, Banco Central), com série mais longa, ajuste sazonal, admissões e desligamentos, as 21 seções de atividade e as 27 UFs. As capturas podem diferir em um mês."/></div><PaginaTrabalho titulo="Como evoluem os vínculos formais no Brasil?" pergunta="Estoque nacional de vínculos do Novo Caged na série SGS 28763 e sua variação mensal calculada, sem ajuste sazonal. Vínculos em estabelecimentos não equivalem a pessoas únicas ou moradores ocupados." ids={['estoque-formal','saldo-formal']}/></>}
