import type { Metadata } from "next";
import { PaginaTemaEducacao } from "@/components/eficiencia/PaginaTemaEducacao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Resultados em Educação nas capitais",
  description: "Taxa de aprovação, Ideb e Saeb da rede municipal das capitais, nos anos iniciais e finais, com referências.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais/resultados" },
};

/** Resultados no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o modelo único dos temas da Educação nas capitais. */
export default function PaginaResultados() {
  return <PaginaTemaEducacao tema="resultados" />;
}
