import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Método e cobertura"};
export default function Pagina(){return <PaginaTrabalho visao="metodos" titulo={"Método e cobertura"}/>}
