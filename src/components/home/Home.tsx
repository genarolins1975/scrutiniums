import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import type { Idioma } from "@/lib/idioma";
import { vitrines } from "@/lib/vitrine";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { ParceriaTecnica } from "@/components/layout/ParceriaTecnica";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { portas } from "@/lib/perguntas/portas";
import { Hero } from "./Hero";
import { HeroPerguntas } from "./HeroPerguntas";
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
  // A primeira tela responde ao leitor: seis perguntas abertas, com números lidos das golds. No fim dela, a parceria
  // técnica com o FGV CERI (decisão do mantenedor, 20/10/2026): marca oficial e link. Em português nas duas homes,
  // dentro da região portuguesa da home inglesa, que só admite as quatro seções seguintes no <main>.
  const perguntas = <HeroPerguntas portas={portas()} rodape={<ParceriaTecnica variante="bloco" idioma="pt" />} />;
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
        {idioma === "en" ? <PortuguesApenas regiao="home-perguntas">{perguntas}</PortuguesApenas> : perguntas}
        <Hero vitrines={v} idioma={idioma} />
        {idioma === "en" ? <PortuguesApenas regiao="home-secoes">{secoes}</PortuguesApenas> : secoes}
      </main>
      {idioma === "en"
        ? <PortuguesApenas regiao="home-rodape"><Footer /></PortuguesApenas>
        : <Footer />}
    </>
  );
}
