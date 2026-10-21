import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import { CabecalhoEntrada } from "@/components/eficiencia/CabecalhoEntrada";
import "./trabalho-renda.css";

export default function TrabalhoRendaLayout({children}:{children:React.ReactNode}) {
  return <><CabecalhoEntrada /><div className="tr-shell"><main id="conteudo">{children}<EscoresServicos capitulo="work"/></main></div></>;
}
