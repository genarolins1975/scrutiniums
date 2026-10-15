import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import type { Idioma } from "@/lib/idioma";
import { vitrines } from "@/lib/vitrine";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { Hero } from "./Hero";
import { SecaoObservatorios } from "./SecaoObservatorios";
import { SecaoPlataforma } from "./SecaoPlataforma";
import { SecaoRecursos } from "./SecaoRecursos";
import { SecaoAcesso } from "./SecaoAcesso";

/** As duas entradas compartilham sessão, dados e a composição da página inicial. */
export async function Home({ idioma }: Readonly<{ idioma: Idioma }>) {
  // Quem já tem sessão vai direto à escolha do observatório: a página
  // institucional é para quem ainda não entrou.
  const user = await getSessionUser();
  if (user && user.onboardingStatus === "COMPLETE") redirect("/app/observatorios");

  // As vitrines ainda são blocos portugueses, inclusive na home parcial inglesa.
  const v = vitrines();
  const secoes = (
    <>
      <SecaoObservatorios vitrines={v} />
      <SecaoPlataforma />
      <SecaoRecursos />
      <SecaoAcesso />
    </>
  );
  return (
    <>
      {idioma === "en"
        ? <PortuguesApenas regiao="home-cabecalho"><PublicHeader /></PortuguesApenas>
        : <PublicHeader />}
      <main>
        <Hero vitrines={v} idioma={idioma} />
        {idioma === "en" ? <PortuguesApenas regiao="home-secoes">{secoes}</PortuguesApenas> : secoes}
      </main>
      {idioma === "en"
        ? <PortuguesApenas regiao="home-rodape"><Footer /></PortuguesApenas>
        : <Footer />}
    </>
  );
}
