import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/seguranca-alimentar") };


export default function LayoutAlimentar({ children }: { children: React.ReactNode }) {
  return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/seguranca-alimentar" navegacao="protecao" /></header><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">{children}</main></>;
}
