import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AbreDetalhesAoImprimir } from "@/components/energia/AbreDetalhesAoImprimir";
import { AprendaVerbete } from "@/components/energia/AprendaVerbete";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CONCEITOS, conceito } from "@/lib/energia/conteudo/conceitos";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return CONCEITOS.map((c) => ({ conceito: c.slug }));
}

export function generateMetadata({ params }: { params: { conceito: string } }): Metadata {
  const c = conceito(params.conceito);
  if (!c) return {};
  const nome = c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() ? `${c.sigla}: ${c.nome}` : c.nome;
  return {
    title: `${nome} · Aprenda`,
    description: c.estado === "CONFERIDO" ? c.emUmaFrase : `Verbete em preparação: ${c.nome}. Fonte primária a conferir.`,
    alternates: { canonical: `/setor-eletrico/aprenda/${c.slug}` },
    // verbete em preparação não tem definição publicada: não deve ser indexado
    ...(c.estado === "PENDENTE" ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * Verbete do Aprenda: um conceito por página, com a pergunta prática, a definição da fonte oficial, o exemplo ligado ao painel onde o
 * conceito aparece e o resto da ficha (AprendaVerbete). Verbete em preparação aparece como em preparação, sem definição; ele não é
 * indexado e fica fora do sitemap.
 */
export default function ConceitoPage({ params }: { params: { conceito: string } }) {
  const c = conceito(params.conceito);
  if (!c) notFound();
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <AbreDetalhesAoImprimir />
      <AprendaVerbete c={c} />
    </>
  );
}
