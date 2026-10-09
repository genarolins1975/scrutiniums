import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Trabalho e renda"};
export default function Pagina(){return <PaginaTrabalho visao="panorama" titulo={"Trabalho e renda"} ids={["desocupacao","participacao","rendimento-trabalho"]}/>}
