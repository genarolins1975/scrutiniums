import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Alimentacao saude",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/alimentacao-saude"}};
export default function Pagina(){return <PaginaAlimentar slug="alimentacao-saude"/>}
