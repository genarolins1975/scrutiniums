import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { ROTA_VAREJO } from "@/lib/varejo/paginas";

export const metadata: Metadata = {
  title: {
    default: "Varejo",
    // "Página · Coleção · Scrutiniums", com o nome da coleção lido do registro
    template: modeloDeTitulo(ROTA_VAREJO).template,
  },
  description:
    "As vendas do comércio varejista no Brasil, em volume e em receita, por atividade e por estado, o tamanho do mercado em reais e as demonstrações das companhias abertas, pelas pesquisas do IBGE e pelos dados da CVM, com fonte, período e ressalvas em cada número.",
};

/**
 * Casca da coleção Varejo (Observatório da Economia), mantida pelo próprio observatório (pipeline/varejo, public/varejo).
 * As páginas exigem conta: sem sessão, o endereço público /varejo serve a versão aperitivo (src/app/aperitivo/varejo) por
 * rewrite do middleware, e só o método (/varejo/metodo) é aberto. O cabeçalho é de cada página, porque marca a página atual.
 */
export default function VarejoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-gas flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-carvao focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <div className="flex-1">{children}</div>
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}
