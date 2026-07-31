import type { Metadata } from "next";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { AtividadePanel } from "@/components/analytics/AtividadePanel";
import { PageTitle } from "@/components/ui/SectionHeading";

export const metadata: Metadata = { title: "Atividade setorial" };

export default function AtividadePage() {
  return (
    <div className="space-y-10">
      <MarcaVisita secao="app:atividade" />
      <PageTitle
        label="Painel analítico"
        title="Atividade setorial"
        description="Evolução mensal do Índice de Atividade Setorial para Indústria, Comércio, Serviços, Agronegócio e Construção, com filtros de setor e período."
      />
      <AtividadePanel />
    </div>
  );
}
