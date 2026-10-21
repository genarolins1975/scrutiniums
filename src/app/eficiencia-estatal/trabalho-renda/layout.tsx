import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import { CabecalhoEntrada } from "@/components/eficiencia/CabecalhoEntrada";
import "./trabalho-renda.css";
import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/trabalho-renda") };

export default function TrabalhoRendaLayout({children}:{children:React.ReactNode}) {
  return <><CabecalhoEntrada /><div className="tr-shell"><main id="conteudo">{children}<EscoresServicos capitulo="work"/></main></div></>;
}
