import type { Metadata } from "next";
import { ExploradorTema } from "@/components/eficiencia/ExploradorTema";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainelTema, goldEducacao } from "@/lib/eficiencia/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Resultados em Educação nas capitais",
  description: "Taxa de aprovação, Ideb e Saeb da rede municipal das capitais, nos anos iniciais e finais, com referências.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais/resultados" },
};

export default function PaginaResultados() {
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
  return <ExploradorTema tema="resultados" dados={dadosPainelTema(g, "resultados")} contextos={contextos(g)} />;
}
