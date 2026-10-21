import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Compare territórios com o mesmo contrato."};
export default function Pagina(){return <PaginaTrabalho visao="explorador" titulo={"Compare territórios com o mesmo contrato."} pergunta={"Selecione uma medida e compare territórios, períodos e populações elegíveis. Calendários e universos permanecem separados."}/>}
