import type {Metadata} from "next";
import {PaginaTrabalho} from "@/components/eficiencia/trabalho-renda/PaginaTrabalho";
export const metadata:Metadata={title:"Que proteção da renda é declarada pelos domicílios?"};
export default function Pagina(){return <PaginaTrabalho titulo={"Que proteção da renda é declarada pelos domicílios?"} pergunta={"Percentual de domicílios que declararam receber programas sociais na PNAD Contínua. Estas estimativas não são contagens administrativas de famílias atendidas."} ids={["domicilios-bolsa-familia", "domicilios-bpc", "domicilios-programas-sociais"]}/>;}
