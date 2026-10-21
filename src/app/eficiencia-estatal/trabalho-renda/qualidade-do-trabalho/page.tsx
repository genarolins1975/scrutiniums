import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Como estão as condições do trabalho?"};
export default function Pagina(){return <PaginaTrabalho visao="explorador" titulo={"Como estão as condições do trabalho?"} pergunta={"Explore informalidade e jornada habitual entre os ocupados. Cada medida descreve uma dimensão; nenhuma resume, sozinha, todas as condições de trabalho."} ids={["informalidade", "jornada-habitual"]}/>}
