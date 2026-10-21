import type { Metadata } from "next";
import { ComparadorSaude } from "@/components/eficiencia/saude/ComparadorSaude";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Comparar capitais em Saúde",
  description: "Compare duas capitais na mesma medida de Saúde e no mesmo período, veja a distribuição das 26 e baixe a tabela completa com as referências e as ressalvas.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais/comparar" },
};

export default function PaginaComparar() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  return <ComparadorSaude dados={dadosSaude(g, "comparar")} contextos={contextosSaude(g)} />;
}
