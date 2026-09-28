import Link from "next/link";
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
      escopo="Ambientes de contratação livre e regulada, agentes, contratos quando públicos, Mecanismo de Realocação de Energia (MRE), GSF (sigla usada pela CCEE, definição a conferir), encargos de serviços do sistema e demais mecanismos da CCEE."
      perguntas={[
        "Quanto do consumo está no mercado livre e quanto no regulado, e como isso mudou?",
        "Quantos agentes operam em cada categoria?",
        "Como o GSF (sigla usada pela CCEE; nome e definição a conferir nas Regras de Comercialização) se comportou ao longo do tempo?",
        "Quanto custaram os encargos de serviços do sistema em cada período?",
      ]}
      destaque={
        <>
          O essencial sobre o Mercado de Curto Prazo, onde o PLD é o preço, já está publicado com fonte:{" "}
          <Link href="/setor-eletrico/pld#o-que-e" className="text-energia-dark underline underline-offset-4">capítulo 1 do PLD</Link> e{" "}
          <Link href="/setor-eletrico/aprenda/mcp" className="text-energia-dark underline underline-offset-4">verbete MCP</Link>.
        </>
      }
      temas={["mercado", "preco", "empresas"]}
      orgaos={["CCEE", "ANEEL"]}
      pendencias={[
        "Acesso automatizado ao portal de dados abertos da CCEE instável: recusado e, horas depois, aceito para o PLD_HORARIO em 28/09/2026. A integração dos conjuntos de mercado depende de coleta estável e de conferência documental das Regras de Comercialização.",
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
