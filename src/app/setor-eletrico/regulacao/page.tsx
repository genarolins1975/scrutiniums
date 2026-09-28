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
      icone="regulacao"
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
      esquema={{
        titulo: "Quem define as regras e quem as aplica",
        linhas: [
          { nos: [{ rotulo: "MME", icone: "regulacao", estado: "leitura", descricao: "Política setorial e portarias." }] },
          { setaAntes: "regula", nos: [{ rotulo: "ANEEL", icone: "regulacao", estado: "conferido", descricao: "Publica as tarifas de aplicação das distribuidoras (TE e TUSD), resultantes dos processos tarifários, e a relação de empreendimentos de micro e minigeração distribuída.", href: "/setor-eletrico/aprenda/geracao-distribuida" }] },
          {
            setaAntes: "operam sob as regras",
            separador: "|",
            nos: [
              { rotulo: "ONS", icone: "sistema", estado: "conferido", descricao: "Publica a operação: carga, geração verificada, EAR, ENA, intercâmbios e CMO.", href: "/setor-eletrico/aprenda/cmo" },
              { rotulo: "CCEE", icone: "preco", estado: "conferido", descricao: "Calcula o PLD por hora e submercado, dentro dos limites mínimo e máximos vigentes, e apura o Mercado de Curto Prazo.", href: "/setor-eletrico/aprenda/pld" },
            ],
          },
          { setaAntes: "alcançam", nos: [{ rotulo: "Agentes e consumidores", icone: "carga", estado: "leitura", descricao: "Geradores, distribuidoras, comercializadoras e consumidores." }] },
        ],
        nota: "Esquema institucional. As descrições da ANEEL, do ONS e da CCEE se limitam ao que está conferido nas descrições oficiais dos conjuntos de dados usados pelo observatório; os papéis do MME e dos agentes são leitura usual do setor. A linha do tempo regulatória interativa (norma, consulta, resolução, mudança operacional, implementação) começa com o primeiro documento primário integrado: nenhum marco é publicado de memória.",
      }}
    />
  );
}
