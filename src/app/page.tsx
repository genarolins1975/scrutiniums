import type { Metadata } from "next";
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

export default function HomePage() {
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
