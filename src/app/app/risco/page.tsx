import type { Metadata } from "next";
import { RiscoPanel } from "@/components/analytics/RiscoPanel";
import { PageTitle } from "@/components/ui/SectionHeading";

export const metadata: Metadata = { title: "Risco de crédito" };

export default function RiscoPage() {
  return (
    <div className="space-y-10">
      <PageTitle
        label="Painel analítico"
        title="Risco de crédito"
        description="Inadimplência trimestral acima de 90 dias por setor, comparada com a média dos cinco setores acompanhados."
      />
      <RiscoPanel />
    </div>
  );
}
