import { SectionHeading } from "@/components/ui/SectionHeading";

const ITENS = [
  {
    titulo: "Bases públicas",
    descricao: "Dados abertos de órgãos e entidades, consolidados e documentados.",
  },
  {
    titulo: "Registros oficiais",
    descricao: "Publicações e registros oficiais organizados para consulta analítica.",
  },
  {
    titulo: "Fontes especializadas",
    descricao: "Publicações técnicas e setoriais escolhidas com critérios declarados.",
  },
  {
    titulo: "Dados econômicos e setoriais",
    descricao: "Séries de atividade, preços, crédito e mercado, por setor e período.",
  },
  {
    titulo: "Documentos técnicos",
    descricao: "Normas, relatórios e pareceres tratados como evidência estruturada.",
  },
  {
    titulo: "Dados próprios",
    descricao: "Levantamentos e séries da própria plataforma, com metodologia aberta.",
  },
  {
    titulo: "Estatística e modelos",
    descricao: "Métodos aplicados com hipóteses e limitações sempre explícitas.",
  },
  {
    titulo: "Machine learning aplicado",
    descricao: "Modelos que complementam a análise — nunca a substituem.",
  },
];

export function SecaoReune() {
  return (
    <section aria-labelledby="reune-titulo" className="border-b border-linha bg-papel">
      <div className="mx-auto max-w-page px-6 py-20 md:py-28">
        <div id="reune-titulo">
          <SectionHeading number="01" label="Acervo" title="O que a plataforma reúne" />
        </div>
        <p className="-mt-4 mb-12 max-w-prose2 leading-relaxed text-mineral">
          Oito frentes de um mesmo acervo. Nada entra sem origem, data e critério
          registrados.
        </p>
        <ul className="grid grid-cols-1 border-l border-t border-linha sm:grid-cols-2 lg:grid-cols-4">
          {ITENS.map((item, i) => (
            <li key={item.titulo} className="border-b border-r border-linha p-6 md:p-7">
              <span aria-hidden="true" className="font-serif text-sm text-bronze">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-serif text-lg leading-snug text-carvao">
                {item.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mineral">{item.descricao}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
