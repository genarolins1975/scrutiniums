import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Inseguranca alimentar",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/inseguranca-alimentar"}};
export default function Pagina(){return <PaginaAlimentar slug="inseguranca-alimentar"/>}
