import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Comparar",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/comparar"}};
export default function Pagina({searchParams}:{searchParams:{base?:string}}){return <PaginaAlimentar slug="comparar" base={searchParams.base}/>}
