import type { Metadata } from "next";
import { PaginaTemaSaude } from "@/components/eficiencia/saude/PaginaTemaSaude";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Atendimento e resultados em Saúde nas capitais",
  description: "Internações por condições sensíveis à atenção primária por residência nas 26 capitais, com a cobertura de planos privados como contexto e as lacunas de produção registradas.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/atendimento-e-resultados" },
};

/** Atendimento e resultados no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o modelo único dos temas da Saúde nas capitais. */
export default function Pagina() {
  return <PaginaTemaSaude tema="resultados" />;
}
