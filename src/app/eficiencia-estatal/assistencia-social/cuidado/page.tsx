import type {Metadata} from "next";
import {PainelSuas} from "@/components/eficiencia/assistencia/PainelSuas";
export const dynamic="force-static";
export const metadata:Metadata={title:"Cuidado e proteção"};
export default function Page(){return <><p className="rotulo text-obee">Cuidado e proteção</p><h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight">Apoio quando a família não consegue cuidar sozinha.</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">A proteção básica no domicílio é um serviço específico, diferente de visitas do PAIF. Os volumes referem-se a agosto de 2025. Pessoas idosas e com deficiência podem pertencer aos dois grupos; não some essas categorias. Os centros-dia incluem modalidades similares e organizações não governamentais.</p><PainelSuas ids={["CRAS.q34", "CRAS.q36_1", "CRAS.q36_2", "CRAS.q36_3", "DIA.q23", "DIA.q24", "DIA.q15_4"]}/></>}
