import { SectionHeading } from "@/components/ui/SectionHeading";

const PRINCIPIOS = [
  {
    titulo: "Rastreabilidade",
    frase: "Toda afirmação aponta para a fonte que a sustenta.",
  },
  {
    titulo: "Explicabilidade",
    frase: "Nenhum resultado sem método e critérios publicados.",
  },
  {
    titulo: "Separação de camadas",
    frase: "O observado, o estimado e o previsto nunca se confundem.",
  },
];

/**
 * Três compromissos em uma linha cada: o diferencial intelectual
 * da plataforma, em lista editorial com filetes.
 */
export function SecaoPrincipios() {
  return (
    <section aria-labelledby="principios-titulo" className="border-t border-linha bg-papel">
      <div className="mx-auto max-w-page px-6 py-20 md:py-28">
        <div id="principios-titulo">
          <SectionHeading number="03" label="Princípios" title="Três compromissos" />
        </div>
        <ul className="border-t border-linha">
          {PRINCIPIOS.map((p) => (
            <li
              key={p.titulo}
              className="grid gap-1.5 border-b border-linha py-7 md:grid-cols-[18rem_1fr] md:items-baseline md:gap-10 md:py-8"
            >
              <h3 className="font-serif text-xl text-carvao md:text-2xl">{p.titulo}</h3>
              <p className="leading-relaxed text-mineral md:text-lg md:text-carvao-muted">
                {p.frase}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
