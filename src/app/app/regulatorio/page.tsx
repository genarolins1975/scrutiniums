import type { Metadata } from "next";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { RegulatorioPanel } from "@/components/analytics/RegulatorioPanel";
import { PageTitle } from "@/components/ui/SectionHeading";

export const metadata: Metadata = { title: "Regulatório" };

export default function RegulatorioPage() {
  return (
    <div className="space-y-10">
      <MarcaVisita secao="app:regulatorio" />
      <PageTitle
        label="Painel analítico"
        title="Regulatório"
        description="Score de Sentimento Regulatório por tema — Crédito, Mercado de capitais e Seguros — em escala de -1 a +1, com linha de referência em zero."
      />
      <RegulatorioPanel />
    </div>
  );
}
