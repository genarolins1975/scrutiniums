import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MarcaRolagem } from "@/components/energia/MarcaRolagem";
import { RodapeEnergia } from "@/components/energia/RodapeEnergia";

export const metadata: Metadata = {
  title: {
    default: "Observatório Brasileiro do Setor Elétrico",
    template: "%s · Setor Elétrico · Scrutiniums",
  },
  description:
    "PLD, reservatórios, afluências, geração, carga e intercâmbios do sistema elétrico brasileiro a partir de dados abertos da CCEE, do ONS e da ANEEL, com natureza, fonte e limitações declaradas em cada número.",
};

/**
 * Casca do domínio Energia. O cabeçalho é de cada página (marca o módulo
 * ativo); aqui ficam o fundo do domínio e os rodapés. Público para leitura,
 * como o Crédito: o middleware só protege /app.
 */
export default function SetorEletricoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-energia flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-energia focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <MarcaRolagem />
      <div className="flex-1">{children}</div>
      <RodapeEnergia />
      <Footer compacto />
    </div>
  );
}
