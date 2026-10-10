import type {Metadata} from "next";
import {PainelSuas} from "@/components/eficiencia/assistencia/PainelSuas";
export const dynamic="force-static";
export const metadata:Metadata={title:"Recursos e capacidade"};
export default function Page(){return <><p className="rotulo text-obee">Recursos e capacidade</p><h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight">Que condições sustentam o atendimento?</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">Os registros de recursos humanos contam vínculos declarados em cada unidade, sem identificar trabalhadores. Não representam pessoas únicas ou equivalentes de jornada completa. O recorte financeiro ainda não foi integrado; estas medidas não são uma nota de eficiência.</p><PainelSuas ids={["CRAS.rh_vinculos", "CREAS.rh_vinculos", "CRAS.q2_2", "CREAS.q4_2", "DIA.q3_2"]}/></>}
