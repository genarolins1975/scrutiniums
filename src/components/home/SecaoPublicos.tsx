import { SectionHeading } from "@/components/ui/SectionHeading";

const PUBLICOS = [
  {
    titulo: "Executivos e conselhos",
    descricao: "Contexto setorial e risco para decidir e supervisionar com base verificável.",
  },
  {
    titulo: "Instituições financeiras e investidores",
    descricao: "Séries e sinais com critérios auditáveis para crédito e alocação.",
  },
  {
    titulo: "Empresas e áreas de estratégia",
    descricao: "Dados comparáveis para planejar e acompanhar o ambiente regulatório.",
  },
  {
    titulo: "Pesquisadores, reguladores e jornalistas",
    descricao: "Fontes citáveis e metodologia aberta para investigar e verificar.",
  },
];

export function SecaoPublicos() {
  return (
    <section id="publicos" aria-labelledby="publicos-titulo" className="border-t border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-20 md:py-28">
        <div id="publicos-titulo">
          <SectionHeading number="04" label="Públicos" title="Para quem" />
        </div>
        <ol className="border-t border-linha">
          {PUBLICOS.map((publico, i) => (
            <li
              key={publico.titulo}
              className="grid gap-1.5 border-b border-linha py-7 md:grid-cols-[3.5rem_16rem_1fr] md:items-baseline md:gap-8 md:py-8 lg:grid-cols-[4rem_24rem_1fr] lg:gap-10"
            >
              <span aria-hidden="true" className="font-serif text-xl text-bronze">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-serif text-xl leading-snug text-carvao">
                {publico.titulo}
              </h3>
              <p className="leading-relaxed text-mineral">{publico.descricao}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
