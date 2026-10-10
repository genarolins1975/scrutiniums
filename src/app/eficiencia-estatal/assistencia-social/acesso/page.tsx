import type {Metadata} from "next";
import {PainelSuas} from "@/components/eficiencia/assistencia/PainelSuas";
export const dynamic="force-static";
export const metadata:Metadata={title:"Acesso à proteção social"};
export default function Page(){return <><p className="rotulo text-obee">Acesso à proteção social</p><h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight">A rede pode ser acessada?</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">Horários e adaptações declaradas mostram condições de oferta. A espera aqui se refere especificamente ao atendimento do Cadastro Único no CRAS; não é a fila geral da assistência social. Adequação à norma é autodeclarada, sem auditoria técnica integrada.</p><PainelSuas ids={["CRAS.q9_1", "CRAS.q9_4", "CREAS.q9_1", "DIA.q15_1", "CRAS.q2_1", "CREAS.q4_1", "CRAS.q51_1"]}/></>}
