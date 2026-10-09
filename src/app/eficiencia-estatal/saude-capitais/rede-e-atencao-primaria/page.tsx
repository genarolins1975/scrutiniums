import type { Metadata } from "next";
import { ExploradorSaude } from "@/components/eficiencia/saude/ExploradorSaude";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Rede e atenção primária nas capitais",
  description: "UBS, equipes de Saúde da Família e de Atenção Primária e cobertura potencial da atenção primária nas 26 capitais, com o que cada número registra e o que não mede.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria" },
};

export default function Pagina() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  return <ExploradorSaude tema="rede" dados={dadosSaude(g, "rede")} contextos={contextosSaude(g)} />;
}
