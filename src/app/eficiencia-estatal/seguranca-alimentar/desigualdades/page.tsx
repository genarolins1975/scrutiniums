import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Desigualdades",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/desigualdades"}};
export default function Pagina(){return <PaginaAlimentar slug="desigualdades"/>}
