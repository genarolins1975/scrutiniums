import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Segurança alimentar",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar"}};
export default function Pagina(){return <PaginaAlimentar slug=""/>}
