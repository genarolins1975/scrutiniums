import type {Metadata} from 'next';
import {PaginaTrabalho} from '@/components/eficiencia/trabalho-renda/PaginaTrabalho';
export const metadata:Metadata={title:'Ocupações e rendimento'};
export default function Pagina(){return <PaginaTrabalho titulo="Que ocupações aparecem no retrato do trabalho?" pergunta="Grupos da ocupação principal, pessoas ocupadas com rendimento e remuneração no Censo 2022. Não são anúncios de vagas ou expectativas de salário para uma contratação." ids={['ocupacoes-pessoas','ocupacoes-renda-media','ocupacoes-renda-mediana']}/>}
