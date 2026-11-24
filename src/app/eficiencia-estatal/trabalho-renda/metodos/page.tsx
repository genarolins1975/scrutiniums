import type {Metadata} from "next";
import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Método e cobertura"};
export default async function Pagina(){const metodo=await PaginaTrabalho({visao:"metodos",titulo:"Método e cobertura"});return <>{metodo}{/* proposta experimental de escore, em preparação: só no método, com o selo */}<EscoresServicos capitulo="work" preparacao /></>}
