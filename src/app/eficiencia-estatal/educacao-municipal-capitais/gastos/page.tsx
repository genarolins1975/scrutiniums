import type { Metadata } from "next";
import { PaginaTemaEducacao } from "@/components/eficiencia/PaginaTemaEducacao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Gastos em Educação nas capitais",
  description: "Despesa liquidada em Educação nas capitais: total, por habitante e por matrícula da rede municipal, com referências do grupo, nacionais e internacionais.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais/gastos" },
};

/** Gastos no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o modelo único dos temas da Educação nas capitais. */
export default function PaginaGastos() {
  return <PaginaTemaEducacao tema="gastos" />;
}
