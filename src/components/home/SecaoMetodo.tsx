import { SectionHeading } from "@/components/ui/SectionHeading";

const PASSOS = [
  {
    numero: "1",
    titulo: "Reunir e organizar",
    descricao:
      "As fontes são coletadas, verificadas e estruturadas em séries e documentos comparáveis, com origem e data registradas.",
  },
  {
    numero: "2",
    titulo: "Analisar com método",
    descricao:
      "Estatística e modelos analíticos são aplicados com hipóteses explícitas; machine learning complementa a análise, não a substitui.",
  },
  {
    numero: "3",
    titulo: "Explicar com transparência",
    descricao:
      "Cada resultado é publicado com as fontes utilizadas, os critérios adotados, o período de referência e as limitações conhecidas.",
  },
];

export function SecaoMetodo() {
  return (
    <section aria-labelledby="metodo-titulo" className="border-t border-linha bg-papel">
      <div className="mx-auto max-w-page px-6 py-16 md:py-24">
        <div id="metodo-titulo">
          <SectionHeading
            number="02"
            label="Método"
            title="Como o conhecimento é produzido"
          />
        </div>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {PASSOS.map((passo) => (
            <li key={passo.numero} className="border-t border-linha pt-6">
              <span className="font-serif text-4xl text-bronze" aria-hidden="true">
                {passo.numero}
              </span>
              <h3 className="mt-3 font-serif text-xl text-carvao">{passo.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mineral">{passo.descricao}</p>
            </li>
          ))}
        </ol>
        <p className="mt-12 max-w-prose2 border-l-2 border-bronze pl-5 text-sm leading-relaxed text-carvao-muted">
          Compromisso editorial: cada resultado publica fontes, critérios, período de
          referência e limitações. Modelos complementam a análise — não a substituem.
        </p>
      </div>
    </section>
  );
}
