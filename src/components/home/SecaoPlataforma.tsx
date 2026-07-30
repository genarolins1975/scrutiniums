import { SectionHeading } from "@/components/ui/SectionHeading";
import { BotaoLink } from "@/components/home/BotaoLink";

const CONTEUDOS = [
  {
    titulo: "Painéis analíticos",
    descricao: "Visões consolidadas por tema, com gráficos sóbrios e leitura orientada.",
  },
  {
    titulo: "Séries setoriais",
    descricao: "Dados históricos por setor, comparáveis entre períodos e recortes.",
  },
  {
    titulo: "Indicadores de risco",
    descricao: "Sinais construídos com critérios publicados e limitações declaradas.",
  },
  {
    titulo: "Monitoramento regulatório",
    descricao: "Acompanhamento de normas e publicações oficiais relevantes por área.",
  },
  {
    titulo: "Glossário e metodologia abertos",
    descricao: "Definições, métodos e critérios acessíveis a qualquer pessoa, sem cadastro.",
  },
];

export function SecaoPlataforma() {
  return (
    <section id="plataforma" aria-labelledby="plataforma-titulo" className="bg-carvao text-marfim">
      <div className="mx-auto max-w-page px-6 py-16 md:py-24">
        <div id="plataforma-titulo">
          <SectionHeading
            label="Dentro da plataforma"
            title="O que existe do outro lado do cadastro"
            onDark
          />
        </div>
        <ul className="grid grid-cols-1 gap-px border border-linha-escura bg-linha-escura sm:grid-cols-2 lg:grid-cols-5">
          {CONTEUDOS.map((item) => (
            <li key={item.titulo} className="bg-carvao p-6">
              <h3 className="font-serif text-lg text-marfim">{item.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mineral-soft">{item.descricao}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <BotaoLink href="/cadastro" variant="dark">
            Criar acesso
          </BotaoLink>
          <p className="rotulo text-bronze-soft">100% gratuito · sem assinatura · sem cobrança</p>
        </div>
      </div>
    </section>
  );
}
