import type { Metadata } from "next";
import { PaginaTemaEducacao } from "@/components/eficiencia/PaginaTemaEducacao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Atendimento em Educação nas capitais",
  description: "Matrículas na rede municipal, matrículas em escolas conveniadas e alunos por turma nas capitais, por etapa de ensino, com referências.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais/atendimento" },
};

/** Atendimento no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o modelo único dos temas da Educação nas capitais. */
export default function PaginaAtendimento() {
  return <PaginaTemaEducacao tema="atendimento" />;
}
