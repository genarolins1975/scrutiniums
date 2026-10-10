import type { Metadata } from "next";
import { dadosAlimentares } from "@/lib/eficiencia/alimentar/dados";
import { ExploradorAlimentar } from "@/components/eficiencia/alimentar/ExploradorAlimentar";
export const dynamic="force-static";
export const metadata:Metadata={title:"Explorar dados municipais de segurança alimentar"};
export default function Dados(){const g=dadosAlimentares();return <><p className="rotulo text-obee">Dados de base · MUNIC 2024</p><h1 className="mt-3 font-serif text-4xl">Uma variável, todos os registros.</h1><p className="mt-4 max-w-prose2 text-sm leading-relaxed">Dez variáveis em 5.570 municípios, incluindo ausências: 55.700 respostas. Confira a ficha e o período de cada variável. A coleta de 2024 contém perguntas que se referem a 2023.</p><ExploradorAlimentar fichas={g.catalog.filter(f=>f.grupo!=="necessidades")} ufs={g.ufs}/></>}
