import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { GLOSSARIO } from "@/lib/data/glossario";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Glossário",
  description:
    "Definições, fórmulas, fontes e limitações de todos os indicadores da Scrutiniums. Fonte única de nomes e definições da plataforma.",
};

export default function GlossarioPage() {
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Referência"
          title="Glossário"
          description="Fonte única de nomes e definições da plataforma: um mesmo conceito tem sempre o mesmo nome, a mesma fórmula e as mesmas limitações declaradas em todas as páginas."
        />

        <nav aria-label="Índice do glossário" className="mt-10 border border-linha bg-papel p-6">
          <p className="rotulo mb-4 text-mineral">Índice</p>
          <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {GLOSSARIO.map((entry) => (
              <li key={entry.slug}>
                <a
                  href={`#${entry.slug}`}
                  className="inline-flex min-h-[44px] items-center font-serif text-lg text-carvao underline-offset-4 hover:text-bronze hover:underline"
                >
                  {entry.nome}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 space-y-12">
          {GLOSSARIO.map((entry, index) => (
            <section
              key={entry.slug}
              id={entry.slug}
              aria-labelledby={`${entry.slug}-titulo`}
              className="scroll-mt-24 border border-linha bg-papel p-8"
            >
              <div className="mb-2 flex items-baseline gap-4">
                <span className="font-serif text-xl text-bronze" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 id={`${entry.slug}-titulo`} className="font-serif text-2xl text-carvao md:text-3xl">
                  {entry.nome}
                </h2>
              </div>
              <p className="rotulo mb-6 text-mineral">{entry.unidade}</p>
              <dl className="grid gap-x-10 gap-y-5 md:grid-cols-[14rem_1fr]">
                <dt className="rotulo pt-0.5 text-mineral">Definição</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">{entry.definicao}</dd>

                <dt className="rotulo pt-0.5 text-mineral">Fórmula ou método de cálculo</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">{entry.formula}</dd>

                <dt className="rotulo pt-0.5 text-mineral">Como interpretar</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">{entry.interpretacao}</dd>

                <dt className="rotulo pt-0.5 text-mineral">Fonte</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">{entry.fonte}</dd>

                <dt className="rotulo pt-0.5 text-mineral">Cobertura temporal</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">{entry.cobertura}</dd>

                <dt className="rotulo pt-0.5 text-mineral">Frequência de atualização</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">{entry.frequencia}</dd>

                <dt className="rotulo pt-0.5 text-mineral">Limitações</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">{entry.limitacoes}</dd>

                <dt className="rotulo pt-0.5 text-mineral">Última revisão metodológica</dt>
                <dd className="text-sm leading-relaxed text-carvao-muted">
                  {fmtDate(entry.revisaoMetodologica)}
                </dd>
              </dl>
            </section>
          ))}
        </div>

        <p className="mt-10 max-w-prose2 text-sm text-mineral">
          Os critérios gerais de coleta, tratamento e publicação estão descritos na página de{" "}
          <a href="/observatorio/methodology" className="text-bronze underline underline-offset-4 hover:text-bronze-dark">
            metodologia
          </a>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
