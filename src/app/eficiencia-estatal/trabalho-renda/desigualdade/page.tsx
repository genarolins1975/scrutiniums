import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Como a renda se distribui?"};
export default function Pagina(){return <PaginaTrabalho titulo={"Como a renda se distribui?"} pergunta={"Acompanhe a concentração da renda domiciliar por pessoa e compare média e mediana do Censo, mantendo calendários e conceitos separados."} ids={["gini", "renda-por-decil", "renda-domiciliar-real", "renda-media", "renda-mediana"]}/>;}
