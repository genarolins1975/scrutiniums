import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Como a renda se distribui entre os domicílios?"};
export default function Pagina(){return <PaginaTrabalho visao="explorador" titulo={"Como a renda se distribui entre os domicílios?"} pergunta={"Explore a renda domiciliar por pessoa: série anual real e distribuição por faixas na PNAD; média e mediana no retrato municipal do Censo 2022. Cada fonte mantém universo, moeda e calendário próprios."} ids={["renda-domiciliar-real", "renda-por-decil", "renda-media", "renda-mediana"]}/>}
