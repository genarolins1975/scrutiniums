import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PaginaPorta } from "@/components/perguntas/PaginaPorta";
import { IDS_PORTAS, rotaPorta } from "@/lib/perguntas/rotas";
import { portas } from "@/lib/perguntas/portas";
import { dominio } from "@/lib/dominios";
import { observatorio, paineis } from "@/lib/observatorios/registro";

/**
 * Camada aberta "O Brasil em perguntas" (decisão de 17/10/2026): a resposta
 * curta de cada pergunta é pública; painéis e downloads seguem com conta.
 * Estática por construção: os números são lidos das golds no build.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return IDS_PORTAS.map((porta) => ({ porta }));
}

export function generateMetadata({ params }: { params: { porta: string } }): Metadata {
  const p = portas().find((x) => x.id === params.porta);
  if (!p) return {};
  return {
    title: `${p.nomeCompleto}: ${p.pergunta}`,
    description: p.resumo,
    alternates: { canonical: rotaPorta(p.id) },
    openGraph: { title: p.pergunta, description: p.resumo, type: "article" },
  };
}

export default function PortaPage({ params }: { params: { porta: string } }) {
  const todas = portas();
  const porta = todas.find((x) => x.id === params.porta);
  if (!porta) notFound();
  const todos = paineis();
  const colecoes = observatorio(porta.id).colecoes.map((c) => {
    const proprios = todos.filter((p) => p.observatorio === porta.id && p.colecao === c.id);
    const origens = Array.from(new Set(proprios.map((p) => dominio(p.origem).nomeCurto)));
    return { id: c.id, nome: c.nome, href: c.href, paineis: proprios.length, origens: `vem de ${origens.join(" e ")}` };
  });
  return (
    <>
      <PublicHeader />
      <PaginaPorta porta={porta} outras={todas.filter((x) => x.id !== porta.id)} colecoes={colecoes} />
      <Footer />
    </>
  );
}
