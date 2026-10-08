import type { Metadata } from "next";
import { ExploradorTema } from "@/components/eficiencia/ExploradorTema";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Atendimento em Educação nas capitais",
  description: "Matrículas na rede municipal, matrículas em escolas conveniadas e alunos por turma nas capitais, por etapa de ensino, com referências.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais/atendimento" },
};

export default function PaginaAtendimento() {
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
  return <ExploradorTema tema="atendimento" dados={dadosPainel(g)} contextos={contextos(g)} />;
}
