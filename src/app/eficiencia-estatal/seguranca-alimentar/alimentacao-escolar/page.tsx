import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Alimentacao escolar",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/alimentacao-escolar"}};
export default function Pagina(){return <PaginaAlimentar slug="alimentacao-escolar"/>}
