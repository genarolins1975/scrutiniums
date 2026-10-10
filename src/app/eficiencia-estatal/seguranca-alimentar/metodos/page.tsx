import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Metodos",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/metodos"}};
export default function Pagina(){return <PaginaAlimentar slug="metodos"/>}
