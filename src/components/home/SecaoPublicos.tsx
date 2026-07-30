import { SectionHeading } from "@/components/ui/SectionHeading";

const PUBLICOS = [
  {
    titulo: "Executivos e conselhos",
    descricao:
      "Contexto setorial e indicadores de risco para sustentar decisões de direção e supervisão.",
  },
  {
    titulo: "Instituições financeiras e investidores",
    descricao:
      "Séries econômicas e sinais de risco com critérios verificáveis para análise de crédito e alocação.",
  },
  {
    titulo: "Empresas e áreas de estratégia",
    descricao:
      "Dados setoriais comparáveis para planejamento, estudo de mercado e acompanhamento regulatório.",
  },
  {
    titulo: "Pesquisadores, reguladores e jornalistas",
    descricao:
      "Fontes citáveis, metodologia aberta e séries documentadas para investigação e verificação.",
  },
];

export function SecaoPublicos() {
  return (
    <section id="publicos" aria-labelledby="publicos-titulo" className="bg-marfim">
      <div className="mx-auto max-w-page px-6 py-16 md:py-24">
        <div id="publicos-titulo">
          <SectionHeading number="03" label="Públicos" title="Para quem" />
        </div>
        <ul className="grid grid-cols-1 border-l border-t border-linha sm:grid-cols-2">
          {PUBLICOS.map((publico) => (
            <li key={publico.titulo} className="border-b border-r border-linha p-8">
              <h3 className="font-serif text-xl text-carvao">{publico.titulo}</h3>
              <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-mineral">
                {publico.descricao}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
