import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MarcaRolagem } from "@/components/energia/MarcaRolagem";
import { RodapeEnergia } from "@/components/energia/RodapeEnergia";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { RetornoContexto } from "@/components/energia/RetornoContexto";
import { rotulosRetorno } from "@/lib/energia/conteudo/rotulos-retorno";

export const metadata: Metadata = {
  title: {
    default: "Setor Elétrico",
    template: "%s · Setor Elétrico · Scrutiniums",
  },
  description:
    "Spot price (PLD), reservoirs, inflows, generation, load and interchanges of the Brazilian power system, from open data published by CCEE, ONS and ANEEL, with the nature, source and limitations of every number stated.",
};

/**
 * Casca inglesa do Setor Elétrico: a mesma do português (src/app/setor-eletrico/layout.tsx).
 * Importar a página portuguesa não herda o layout dela, por isso a casca é espelhada aqui; o nome
 * do observatório fica em português (glossário).
 */
export default function SetorEletricoLayoutIngles({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-energia flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-energia focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Skip to content
      </a>
      <MarcaRolagem />
      <div className="flex-1">{children}</div>
      {/* quem chega de um verbete ou de uma trilha do Aprenda (?volta=) ganha o botão fixo de volta ao contexto */}
      <RetornoContexto rotulos={rotulosRetorno()} />
      <RodapeEnergia />
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer compacto idioma="en" />
    </div>
  );
}
