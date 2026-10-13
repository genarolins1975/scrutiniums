import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { ACESSO, listaObservatorios } from "@/lib/acesso";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { SecaoObservatorios } from "@/components/home/SecaoObservatorios";
import { SecaoPlataforma } from "@/components/home/SecaoPlataforma";
import { SecaoRecursos } from "@/components/home/SecaoRecursos";
import { SecaoAcesso } from "@/components/home/SecaoAcesso";
import { vitrines } from "@/lib/vitrine";

export const metadata: Metadata = {
  description:
    `Da informação dispersa ao conhecimento verificável. Uma plataforma, observatórios de ${listaObservatorios()}, com bases públicas, registros oficiais e método declarado. Gratuita. ${ACESSO.curto}`,
};

export default async function HomePage() {
  // Quem já tem sessão vai direto à escolha do observatório: a página
  // institucional é para quem ainda não entrou.
  const user = await getSessionUser();
  if (user && user.onboardingStatus === "COMPLETE") redirect("/app/observatorios");

  const v = vitrines();
  return (
    <>
      <PublicHeader />
      <main>
        <Hero vitrines={v} />
        <SecaoObservatorios vitrines={v} />
        <SecaoPlataforma />
        <SecaoRecursos />
        <SecaoAcesso />
      </main>
      <Footer />
    </>
  );
}
