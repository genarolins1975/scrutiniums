import { CabecalhoEntrada } from "@/components/eficiencia/CabecalhoEntrada";
import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/seguranca-alimentar") };

/** Visões do tema, no molde comum dos temas da Eficiência Estatal (CabecalhoEntrada com tema, PR #323). */
const ROTA = "/eficiencia-estatal/seguranca-alimentar";
const ABAS = [["", "Panorama"], ["necessidades", "Necessidades"], ["acesso", "Acesso"], ["qualidade", "Qualidade e continuidade"], ["recursos", "Recursos e estrutura"]] as const;
const ACOES = [["dados", "Explorar dados"], ["metodos", "Método e fontes"]] as const;

export default function LayoutAlimentar({ children }: { children: React.ReactNode }) {
  return <><CabecalhoEntrada tema={{ nome: "Segurança alimentar", rota: ROTA, abas: ABAS, acoes: ACOES }} /><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">{children}</main></>;
}
