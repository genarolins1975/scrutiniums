import type { Metadata } from "next";
import { PanoramaSaude } from "@/components/eficiencia/saude/PanoramaSaude";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextosSaude } from "@/lib/eficiencia/saude/contexto";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Saúde nas capitais",
  description: "Recursos aplicados pelo município, estrutura e atenção primária registradas e resultados observados entre os moradores das 26 capitais estaduais, com referências e limites de cada número.",
  alternates: { canonical: "/eficiencia-estatal/saude-capitais" },
};

/** Panorama: a entrada do módulo. Nenhuma capital vem selecionada; a primeira tela traz a pergunta, os três perímetros e os primeiros visuais. */
export default function PaginaPanoramaSaude() {
  const g = goldSaude();
  if (!g) {
    return <Indisponivel titulo="Módulo indisponível" motivo="A base do módulo não foi encontrada nesta publicação. Nenhum número é exibido no lugar." faltante={["public/eficiencia/gold/saude_capitais.json"]} />;
  }
  return <PanoramaSaude dados={dadosSaude(g, "panorama")} contextos={contextosSaude(g)} />;
}
