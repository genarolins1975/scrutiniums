import type { Metadata } from "next";
import { ModuloEmIntegracao } from "@/components/energia/ModuloEmIntegracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Mercado de energia (em integração)",
  description: "Ambientes de contratação, agentes e mecanismos de mercado do setor elétrico: escopo, perguntas e fontes catalogadas. Dados ainda não integrados.",
  alternates: { canonical: "/setor-eletrico/mercado" },
};

export default function MercadoPage() {
  return (
    <ModuloEmIntegracao
      atual="mercado"
      secao="energia:mercado"
      rotulo="Mercado"
      titulo="Como a energia é contratada e liquidada?"
      escopo="Ambientes de contratação livre e regulada, agentes, contratos quando públicos, Mecanismo de Realocação de Energia, fator de ajuste da garantia física (GSF), encargos de serviços do sistema e demais mecanismos da CCEE."
      perguntas={[
        "Quanto do consumo está no mercado livre e quanto no regulado, e como isso mudou?",
        "Quantos agentes operam em cada categoria?",
        "Como o GSF se comportou e o que ele representa para os geradores hidrelétricos?",
        "Quanto custaram os encargos de serviços do sistema em cada período?",
      ]}
      temas={["mercado", "preco", "empresas"]}
      orgaos={["CCEE", "ANEEL"]}
      pendencias={[
        "Acesso automatizado ao portal de dados abertos da CCEE instável: recusado com HTTP 403 e, horas depois, bem-sucedido para o PLD_HORARIO em 28/09/2026. A integração dos conjuntos de mercado depende de coleta estável e de conferência documental das Regras de Comercialização.",
        "Conferência das definições nas Regras de Comercialização da CCEE e na Lei nº 10.848/2004 para os verbetes ACL, ACR, MRE, GSF e ESS.",
      ]}
      conceitos={[
        { slug: "acl", rotulo: "ACL" },
        { slug: "acr", rotulo: "ACR" },
        { slug: "mre", rotulo: "MRE" },
        { slug: "gsf", rotulo: "GSF" },
        { slug: "ess", rotulo: "ESS" },
      ]}
    />
  );
}
