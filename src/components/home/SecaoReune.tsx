import { SectionHeading } from "@/components/ui/SectionHeading";

const ITENS = [
  {
    titulo: "Bases públicas",
    descricao: "Conjuntos de dados abertos de órgãos e entidades, consolidados e documentados.",
  },
  {
    titulo: "Registros oficiais",
    descricao: "Informações de registro e publicações oficiais organizadas para consulta analítica.",
  },
  {
    titulo: "Fontes especializadas",
    descricao: "Publicações técnicas e setoriais selecionadas com critérios declarados.",
  },
  {
    titulo: "Dados econômicos e setoriais",
    descricao: "Séries de atividade, preços, crédito e mercado por setor e período.",
  },
  {
    titulo: "Documentos técnicos",
    descricao: "Normas, relatórios e pareceres tratados como fonte estruturada de evidência.",
  },
  {
    titulo: "Dados próprios",
    descricao: "Levantamentos e séries produzidos pela plataforma, com metodologia aberta.",
  },
  {
    titulo: "Estatística e modelos",
    descricao: "Métodos estatísticos aplicados com hipóteses e limitações explícitas.",
  },
  {
    titulo: "Machine learning aplicado",
    descricao: "Modelos que complementam a análise, sempre com fontes e critérios publicados.",
  },
];

export function SecaoReune() {
  return (
    <section aria-labelledby="reune-titulo" className="bg-marfim">
      <div className="mx-auto max-w-page px-6 py-16 md:py-24">
        <div id="reune-titulo">
          <SectionHeading
            number="01"
            label="Acervo"
            title="O que a plataforma reúne"
          />
        </div>
        <ul className="grid grid-cols-1 border-l border-t border-linha sm:grid-cols-2 lg:grid-cols-4">
          {ITENS.map((item) => (
            <li key={item.titulo} className="border-b border-r border-linha p-6">
              <h3 className="font-serif text-lg text-carvao">{item.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mineral">{item.descricao}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
