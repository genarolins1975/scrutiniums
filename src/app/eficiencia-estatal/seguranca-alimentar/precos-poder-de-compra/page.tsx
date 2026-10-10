import type {Metadata} from "next";
import {PaginaAlimentar} from "@/components/eficiencia/seguranca-alimentar/PaginaAlimentar";
export const metadata:Metadata={title:"Precos poder de compra",alternates:{canonical:"/eficiencia-estatal/seguranca-alimentar/precos-poder-de-compra"}};
export default function Pagina(){return <PaginaAlimentar slug="precos-poder-de-compra"/>}
