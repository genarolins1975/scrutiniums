import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Aquisicao abastecimento",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/aquisicao-abastecimento"}};
export default function Pagina(){return <PaginaAlimentar slug="aquisicao-abastecimento"/>}
