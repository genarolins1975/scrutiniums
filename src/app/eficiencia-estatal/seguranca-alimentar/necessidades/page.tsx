import type { Metadata } from "next";
import { dadosAlimentares } from "@/lib/eficiencia/alimentar/dados";
import { NecessidadesAlimentares } from "@/components/eficiencia/alimentar/NecessidadesAlimentares";
export const dynamic="force-static";
export const metadata:Metadata={title:"Necessidades alimentares dos domicílios"};
export default function Necessidades(){return <><p className="rotulo text-obee">Necessidades da população</p><h1 className="mt-3 font-serif text-4xl">Quais famílias enfrentam restrição alimentar?</h1><p className="mt-4 max-w-prose2 text-sm leading-relaxed">A Escala Brasileira de Insegurança Alimentar (EBIA) organiza as experiências dos domicílios em segurança alimentar ou insegurança leve, moderada e grave. Esse retrato informa a necessidade social; não é uma nota de atendimento público.</p><NecessidadesAlimentares rows={dadosAlimentares().needs}/><a href="/eficiencia/seguranca-alimentar/pnad.csv" download className="mt-5 inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">Baixar tabela completa · CSV ↓</a></>}
