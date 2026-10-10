import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Equipamentos atendimento",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/equipamentos-atendimento"}};
export default function Pagina(){return <PaginaAlimentar slug="equipamentos-atendimento"/>}
