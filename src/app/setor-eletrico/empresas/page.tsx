import type { Metadata } from "next";
import { ModuloEmIntegracao } from "@/components/energia/ModuloEmIntegracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Empresas e ativos do setor elétrico (em integração)",
  description: "Grupos econômicos, companhias, usinas, linhas, concessões e distribuidoras ligados por identificadores oficiais: escopo e fontes catalogadas. Dados ainda não integrados.",
  alternates: { canonical: "/setor-eletrico/empresas" },
};

export default function EmpresasPage() {
  return (
    <ModuloEmIntegracao
      atual="empresas"
      secao="energia:empresas"
      rotulo="Empresas e ativos"
      titulo="Quem é dono de quê no setor elétrico?"
      escopo="Ligação entre grupo econômico, companhias, ativos, usinas, linhas, concessões, distribuidoras e dados financeiros públicos, com um cadastro mestre de entidades baseado em identificadores oficiais (CNPJ, código de empreendimento da ANEEL, código CVM). Associações manuais ou probabilísticas serão marcadas como tais; nenhuma ligação por semelhança de nome."
      perguntas={[
        "Quais usinas, linhas e concessões pertencem a cada grupo econômico?",
        "Quanto da capacidade instalada está com cada grupo e em cada fonte?",
        "Como estão os indicadores coletivos de continuidade, DEC (Duração Equivalente de Interrupção por Unidade Consumidora) e FEC (Frequência Equivalente de Interrupção por Unidade Consumidora), além de perdas e tarifas, de cada distribuidora?",
        "Quais companhias listadas têm quais ativos, e o que dizem suas demonstrações?",
      ]}
      temas={["empresas", "distribuicao", "geracao"]}
      orgaos={["ANEEL", "CVM", "B3"]}
      pendencias={[
        "Cadastro mestre de entidades com regras documentadas de ligação (CNPJ, CEG, que é o Código Único de Empreendimentos de Geração, código ANEEL, código CVM).",
        "Integração dos conjuntos da ANEEL (SIGA, o Sistema de Informações de Geração da ANEEL; agentes; composição societária; DEC e FEC; tarifas) e das demonstrações da CVM. Nomes das siglas conforme as descrições dos conjuntos no portal de dados abertos da ANEEL.",
      ]}
    />
  );
}
