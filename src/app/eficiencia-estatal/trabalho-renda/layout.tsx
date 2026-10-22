import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import "./trabalho-renda.css";
import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/trabalho-renda") };

export default function TrabalhoRendaLayout({children}:{children:React.ReactNode}) {
  return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/trabalho-renda" navegacao="renda" /></header><div className="tr-shell"><main id="conteudo">{children}<EscoresServicos capitulo="work"/></main></div></>;
}
