import type { Metadata } from "next";
import { ComparadorCapitais } from "@/components/eficiencia/ComparadorCapitais";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainelTema, goldEducacao } from "@/lib/eficiencia/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Comparar capitais",
  description: "As 26 capitais estaduais numa escala comum, com destaque de poucas cidades, tabela completa e referências do grupo.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais/comparar" },
};

export default function PaginaComparar() {
  const g = goldEducacao();
  if (!g) {
    return (
      <Indisponivel
        titulo="Painel indisponível"
        motivo="A base do painel não foi encontrada nesta publicação. Nenhum número é exibido no lugar."
        faltante={["public/eficiencia/gold/educacao_capitais.json"]}
      />
    );
  }
  return <ComparadorCapitais dados={dadosPainelTema(g, "comparar")} contextos={contextos(g)} />;
}
