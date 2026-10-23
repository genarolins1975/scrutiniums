import type { Metadata } from "next";
import { PaginaTemaSaude } from "@/components/eficiencia/saude/PaginaTemaSaude";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Rede e atenção primária nas capitais",
  description: "UBS, equipes de Saúde da Família e de Atenção Primária e cobertura potencial da atenção primária nas 26 capitais, com o que cada número registra e o que não mede.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria" },
};

/** Rede e atenção primária no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o modelo único dos temas da Saúde nas capitais. */
export default function Pagina() {
  return <PaginaTemaSaude tema="rede" />;
}
