import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Quem participa e quem encontra trabalho?"};
export default function Pagina(){return <PaginaTrabalho visao="explorador" titulo={"Quem participa e quem encontra trabalho?"} pergunta={"Participação, ocupação, desocupação e subutilização mostram dimensões diferentes do acesso ao trabalho."} ids={["desocupacao", "participacao", "subutilizacao", "ocupacao"]}/>}
