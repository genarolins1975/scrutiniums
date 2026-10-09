import type { Metadata } from "next";
import { ExploradorSaude } from "@/components/eficiencia/saude/ExploradorSaude";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Atendimento e resultados em Saúde nas capitais",
  description: "Internações por condições sensíveis à atenção primária por residência nas 26 capitais, com a cobertura de planos privados como contexto e as lacunas de produção registradas.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/atendimento-e-resultados" },
};

export default function Pagina() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  return <ExploradorSaude tema="resultados" dados={dadosSaude(g, "resultados")} contextos={contextosSaude(g)} />;
}
