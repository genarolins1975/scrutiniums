import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { SecaoReune } from "@/components/home/SecaoReune";
import { SecaoMetodo } from "@/components/home/SecaoMetodo";
import { SecaoPlataforma } from "@/components/home/SecaoPlataforma";
import { SecaoPublicos } from "@/components/home/SecaoPublicos";
import { SecaoAcesso } from "@/components/home/SecaoAcesso";

export const metadata: Metadata = {
  description:
    "Plataforma gratuita de inteligência analítica: bases públicas, registros oficiais, dados econômicos e setoriais, estatística e modelos com fontes, critérios e limitações declaradas. O cadastro é a única exigência.",
};

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main>
        <Hero />
        <SecaoReune />
        <SecaoMetodo />
        <SecaoPlataforma />
        <SecaoPublicos />
        <SecaoAcesso />
      </main>
      <Footer />
    </>
  );
}
