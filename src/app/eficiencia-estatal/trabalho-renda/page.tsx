import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
export const metadata:Metadata={title:tituloNaColecao("Trabalho e renda","/eficiencia-estatal/trabalho-renda")};
export default function Pagina(){return <PaginaTrabalho visao="panorama" titulo={"Trabalho e renda"} ids={["desocupacao","participacao","rendimento-trabalho"]}/>}
