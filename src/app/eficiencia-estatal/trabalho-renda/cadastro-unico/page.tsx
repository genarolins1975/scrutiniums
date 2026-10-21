import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Cadastro Único: famílias cadastradas"};
export default function Pagina(){return <PaginaTrabalho arquivo="cadastro.json" titulo="Quem está inscrito no Cadastro Único?" pergunta="Famílias cadastradas e atualização dos registros administrativos. Cadastro não é recebimento de benefício nem taxa de pobreza; os retratos disponíveis não formam uma série mensal contínua."/>}
