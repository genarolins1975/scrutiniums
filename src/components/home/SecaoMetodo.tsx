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
      "Estatística e modelos analíticos aplicados com hipóteses explícitas. Machine learning complementa a análise — não a substitui.",
  },
  {
    numero: "3",
    titulo: "Explicar com transparência",
    descricao:
      "Cada resultado sai publicado com as fontes utilizadas, os critérios adotados, o período de referência e as limitações conhecidas.",
  },
];

export function SecaoMetodo() {
  return (
    <section aria-labelledby="metodo-titulo" className="bg-marfim">
      <div className="mx-auto max-w-page px-6 py-20 md:py-28">
        <div id="metodo-titulo">
          <SectionHeading number="02" label="Método" title="Como o conhecimento é produzido" />
        </div>
        <ol className="grid gap-12 md:grid-cols-3 md:gap-10">
          {PASSOS.map((passo) => (
            <li key={passo.numero} className="border-t border-linha pt-7">
              <span
                aria-hidden="true"
                className="font-serif text-5xl leading-none text-bronze"
              >
                {passo.numero}
              </span>
              <h3 className="mt-5 font-serif text-xl text-carvao">{passo.titulo}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mineral">{passo.descricao}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
