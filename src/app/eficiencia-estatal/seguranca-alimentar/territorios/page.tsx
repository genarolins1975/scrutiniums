import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Territorios",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/territorios"}};
export default function Pagina({searchParams}:{searchParams:{base?:string}}){return <PaginaAlimentar slug="territorios" base={searchParams.base}/>}
