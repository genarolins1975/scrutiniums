import type { Metadata } from "next";
import { ModuloEmIntegracao } from "@/components/energia/ModuloEmIntegracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Regulação do setor elétrico (em integração)",
  description: "ANEEL, CCEE, ONS e MME com linha do tempo e documentos primários: escopo e fontes catalogadas. Conteúdo ainda não integrado.",
  alternates: { canonical: "/setor-eletrico/regulacao" },
};

export default function RegulacaoPage() {
  return (
    <ModuloEmIntegracao
      atual="regulacao"
      secao="energia:regulacao"
      rotulo="Regulação"
      titulo="Que regras mudaram, quando e com qual efeito declarado?"
      escopo="Linha do tempo das mudanças regulatórias da ANEEL, CCEE, ONS e MME com o documento primário de cada uma, o contexto histórico e o efeito declarado pelo próprio regulador. Cada marco com data, ato e link."
      perguntas={[
        "Quais foram os limites do PLD em cada ano e qual ato os fixou?",
        "Quando mudaram as regras de formação de preço, de bandeiras tarifárias e de contratação?",
        "Quais consultas e audiências públicas estão abertas e o que propõem?",
      ]}
      temas={["regulacao", "preco"]}
      orgaos={["ANEEL", "MME", "CCEE"]}
      pendencias={[
        "Integração das pautas, atas, audiências e consultas públicas da ANEEL (catalogadas).",
        "Levantamento, com documento primário, dos limites anuais do PLD (necessário também para classificar o piso na página do PLD).",
      ]}
    />
  );
}
