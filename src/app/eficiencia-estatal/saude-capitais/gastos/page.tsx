import type { Metadata } from "next";
import { ExploradorSaude } from "@/components/eficiencia/saude/ExploradorSaude";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Gastos em Saúde nas capitais",
  description: "Despesa liquidada do município em Saúde nas 26 capitais: total, por habitante e percentual aplicado em ações e serviços públicos de saúde, com composição, referências e fontes.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/gastos" },
};

export default function Pagina() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  return <ExploradorSaude tema="gastos" dados={dadosSaude(g, "gastos")} contextos={contextosSaude(g)} />;
}
