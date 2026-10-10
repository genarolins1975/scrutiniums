import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Gestao recursos",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/gestao-recursos"}};
export default function Pagina(){return <PaginaAlimentar slug="gestao-recursos"/>}
