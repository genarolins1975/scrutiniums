import "@/components/educacao/educacao.css";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";

/**
 * Casca do painel Educação nos municípios (Observatório dos Serviços Públicos, coleção Educação), que o próprio
 * observatório mantém (pipeline/educacao, public/educacao). Sem sessão, o middleware serve no mesmo endereço a versão
 * aperitivo (src/app/aperitivo/educacao-municipal); esta casca só chega a quem tem conta. O cabeçalho é da página.
 */
export default function LayoutEducacaoMunicipal({ children }: { children: ReactNode }) {
  return (
    <div className="dominio-obee edm-raiz flex min-h-screen flex-col">
      <a className="edm-pular" href="#conteudo-educacao">Ir para o conteúdo</a>
      <div className="flex-1">{children}</div>
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}
