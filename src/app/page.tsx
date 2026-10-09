import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { SecaoObservatorios } from "@/components/home/SecaoObservatorios";
import { SecaoMetodo } from "@/components/home/SecaoMetodo";
import { SecaoPrincipios } from "@/components/home/SecaoPrincipios";
import { SecaoPlataforma } from "@/components/home/SecaoPlataforma";
import { SecaoPublicos } from "@/components/home/SecaoPublicos";
import { SecaoAcesso } from "@/components/home/SecaoAcesso";

export const metadata: Metadata = {
  description:
    "Da informação dispersa ao conhecimento verificável. Uma plataforma, três observatórios: Crédito, Setor Elétrico e Eficiência Estatal, com bases públicas, registros oficiais e método declarado. Gratuita, com leitura aberta e sem cadastro.",
};

export default async function HomePage() {
  // Quem já tem sessão vai direto à escolha do observatório: a página
  // institucional é para quem ainda não entrou.
  const user = await getSessionUser();
  if (user && user.onboardingStatus === "COMPLETE") redirect("/app/observatorios");

  return (
    <>
      <PublicHeader />
      <main>
        <Hero />
        <SecaoObservatorios />
        <SecaoMetodo />
        <SecaoPrincipios />
        <SecaoPlataforma />
        <SecaoPublicos />
        <SecaoAcesso />
      </main>
      <Footer />
    </>
  );
}
