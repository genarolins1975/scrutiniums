import type { Metadata } from "next";
import { PaginaTemaSaude } from "@/components/eficiencia/saude/PaginaTemaSaude";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Gastos em Saúde nas capitais",
  description: "Despesa liquidada do município em Saúde nas 26 capitais: total, por habitante e percentual aplicado em ações e serviços públicos de saúde, com composição, referências e fontes.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/gastos" },
};

/** Gastos no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o modelo único dos temas da Saúde nas capitais. */
export default function Pagina() {
  return <PaginaTemaSaude tema="gastos" />;
}
