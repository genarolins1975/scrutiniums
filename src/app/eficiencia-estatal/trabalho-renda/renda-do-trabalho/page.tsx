import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Quanto rende o trabalho?"};
export default function Pagina(){return <PaginaTrabalho visao="explorador" titulo={"Quanto rende o trabalho?"} pergunta={"Acompanhe o rendimento real habitual do trabalho, no universo dos ocupados e com a referência de preços da fonte."} ids={["rendimento-trabalho"]}/>}
