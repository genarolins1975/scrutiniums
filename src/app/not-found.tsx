import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
      {/* Variante estática: not-found é pré-renderizada e não pode ler cookies. */}
      <PublicHeaderView />
      <main>
        <section aria-labelledby="nao-encontrada-titulo" className="bg-marfim">
          <div className="mx-auto max-w-page px-6 py-24 md:py-32">
            <p className="rotulo text-mineral">Erro 404</p>
            <p className="mt-4 font-serif text-6xl text-bronze md:text-7xl" aria-hidden="true">
              404
            </p>
            <h1
              id="nao-encontrada-titulo"
              className="mt-4 font-serif text-3xl leading-snug text-carvao md:text-4xl"
            >
              Página não encontrada
            </h1>
            <p className="mt-4 max-w-prose2 text-carvao-muted">
              O endereço solicitado não existe ou foi movido. Verifique o link ou volte para a
              página inicial.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-linha pt-8">
              <Link
                href="/"
                className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-6 text-carvao transition-colors hover:bg-carvao hover:text-marfim"
              >
                Ir para a página inicial
              </Link>
              <Link
                href="/glossario"
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-bronze"
              >
                Consultar o glossário
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
