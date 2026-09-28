import type { Metadata } from "next";
import { ModuloEmIntegracao } from "@/components/energia/ModuloEmIntegracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Expansão do sistema elétrico (em integração)",
  description: "Leilões, projetos, capacidade futura, planejamento e cenários de longo prazo: escopo e fontes catalogadas. Dados ainda não integrados.",
  alternates: { canonical: "/setor-eletrico/expansao" },
};

export default function ExpansaoPage() {
  return (
    <ModuloEmIntegracao
      atual="expansao"
      secao="energia:expansao"
      rotulo="Expansão"
      titulo="Quanta capacidade está chegando, e de que fontes?"
      escopo="Resultados de leilões de geração e transmissão, acompanhamento da expansão da oferta (RALIE), atos de outorga, liberação para operação comercial e o Plano Decenal de Expansão da EPE. Planos e cenários aparecerão com o selo CENÁRIO, nunca como previsão."
      perguntas={[
        "Quanta capacidade entra em operação nos próximos anos, por fonte e subsistema?",
        "Quais projetos estão atrasados em relação ao cronograma de outorga?",
        "O que os leilões contrataram, a que preço e com que prazo?",
        "Como o planejamento decenal projeta a matriz, e com quais hipóteses?",
      ]}
      temas={["expansao"]}
      pendencias={[
        "Integração dos conjuntos da ANEEL (resultado de leilões, RALIE, outorgas, liberação para operação comercial).",
        "Catalogação verificada das publicações da EPE (PDE) com as hipóteses de cada cenário.",
      ]}
    />
  );
}
