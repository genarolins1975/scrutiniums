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
      icone="expansao"
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
      esquema={{
        titulo: "De hoje ao horizonte: cinco categorias que nunca se misturam",
        linhas: [
          {
            separador: "·",
            nos: [
              { rotulo: "Existente", icone: "geracao", descricao: "Capacidade em operação comercial hoje. Natureza: observado.", estado: "leitura" },
              { rotulo: "Em construção", icone: "expansao", descricao: "Obras com outorga e cronograma. Natureza: observado, com atraso medido contra o cronograma.", estado: "leitura" },
              { rotulo: "Contratado", icone: "mercado", descricao: "Vendido em leilão, ainda sem obra. Natureza: observado no resultado do leilão.", estado: "leitura" },
              { rotulo: "Planejado", icone: "regulacao", descricao: "Indicado no planejamento decenal (PDE). Natureza: cenário.", estado: "leitura" },
            ],
          },
          { setaAntes: "e, separado de tudo,", nos: [{ rotulo: "Cenário", icone: "modelo", descricao: "Simulação condicional a hipóteses declaradas. Nunca é previsão nem plano.", estado: "leitura", destaque: true }] },
        ],
        nota: "Esquema das categorias que o módulo distinguirá com selo próprio (observado, cenário). O mapa temporal de projetos e o gráfico hoje → contratado → projetos → horizonte entram só com os conjuntos da ANEEL (leilões, RALIE, outorgas) e as publicações da EPE integrados. Nenhum número de capacidade futura é publicado antes disso.",
      }}
    />
  );
}
