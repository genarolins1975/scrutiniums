import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Só o modelo de título "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro; a casca é a da Eficiência Estatal. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/energia-conectividade") };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
