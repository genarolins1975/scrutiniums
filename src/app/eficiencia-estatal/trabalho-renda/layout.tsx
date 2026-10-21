import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import Link from "next/link";
import { CabecalhoEntrada } from "@/components/eficiencia/CabecalhoEntrada";
import "./trabalho-renda.css";

export default function TrabalhoRendaLayout({children}:{children:React.ReactNode}) {
  return <><CabecalhoEntrada /><div className="tr-shell"><nav aria-label="Caminho da página" className="tr-breadcrumb"><Link href="/eficiencia-estatal">Eficiência Estatal</Link><span aria-hidden="true">/</span><Link href="/eficiencia-estatal/trabalho-renda">Trabalho e renda</Link></nav><main id="conteudo">{children}<EscoresServicos capitulo="work"/></main></div></>;
}
