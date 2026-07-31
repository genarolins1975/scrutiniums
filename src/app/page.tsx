import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { SecaoReune } from "@/components/home/SecaoReune";
import { SecaoMetodo } from "@/components/home/SecaoMetodo";
import { SecaoPrincipios } from "@/components/home/SecaoPrincipios";
import { SecaoPlataforma } from "@/components/home/SecaoPlataforma";
import { SecaoPublicos } from "@/components/home/SecaoPublicos";
import { SecaoAcesso } from "@/components/home/SecaoAcesso";

export const metadata: Metadata = {
  description:
    "Da informação dispersa ao conhecimento verificável: bases públicas, registros oficiais e séries setoriais organizados com estatística e método declarado. Plataforma gratuita — o cadastro é a única exigência.",
};

export default async function HomePage() {
  // Quem já tem sessão abre o app direto na Visão geral do Observatório:
  // a página institucional é para quem ainda não entrou.
  const user = await getSessionUser();
  if (user && user.onboardingStatus === "COMPLETE") redirect("/observatorio");

  return (
    <>
      <PublicHeader />
      <main>
        <Hero />
        <SecaoReune />
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
