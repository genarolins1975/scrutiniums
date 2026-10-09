import { BotaoLink } from "@/components/home/BotaoLink";

const CONTEUDOS = [
  {
    titulo: "Natureza de cada número",
    descricao:
      "Observado, calculado, estimado, previsto ou cenário: o selo acompanha o valor e as categorias nunca se confundem.",
  },
  {
    titulo: "Proveniência até a fonte primária",
    descricao:
      "Órgão, conjunto de dados, período de referência, momento da captura, transformação, fórmula e versão de cada indicador.",
  },
  {
    titulo: "Regras publicadas",
    descricao:
      "Classificações como alto, baixo ou fora do padrão só existem com regra estatística declarada ao lado do número.",
  },
  {
    titulo: "Ausência declarada",
    descricao: "Dado que falta aparece como lacuna com motivo. Nunca como zero, nunca estimado em silêncio.",
  },
  {
    titulo: "Previsões com estado e arquivo",
    descricao:
      "Modelo em pesquisa não vira previsão oficial, e o que foi publicado fica registrado com versão, dados e data.",
  },
  {
    titulo: "Séries para download e citação",
    descricao: "CSV das séries com fonte e data de referência, para verificar, reproduzir e citar.",
  },
  {
    titulo: "Glossário e base de conhecimento",
    descricao: "Definições com fonte oficial, abertas a qualquer pessoa, sem cadastro.",
  },
];

/**
 * Momento de manifesto: a frase de transparência em serifa grande sobre
 * carvão, seguida do sistema de evidências que os três observatórios
 * compartilham, em lista editorial com filetes, sem cartões.
 */
export function SecaoPlataforma() {
  return (
    <section id="plataforma" aria-labelledby="plataforma-titulo" className="bg-carvao text-marfim">
      <div className="mx-auto max-w-page px-6 py-24 md:py-32">
        <p className="rotulo text-mineral-soft">O que os três observatórios compartilham</p>
        <h2
          id="plataforma-titulo"
          className="mt-7 max-w-5xl font-serif text-[clamp(1.9rem,4.5vw,3.4rem)] leading-[1.12] text-marfim"
        >
          Fontes, critérios, período e limitações —{" "}
          <span className="text-bronze-soft">declarados em cada análise.</span>
        </h2>
        <p className="mt-8 max-w-prose2 leading-relaxed text-mineral-soft">
          O mesmo sistema de evidências vale para o Crédito, o Setor Elétrico e a Eficiência Estatal.
        </p>

        <ul className="mt-16 border-t border-linha-escura">
          {CONTEUDOS.map((item) => (
            <li
              key={item.titulo}
              className="grid gap-1.5 border-b border-linha-escura py-6 md:grid-cols-[16rem_1fr] md:items-baseline md:gap-8 md:py-7 lg:grid-cols-[22rem_1fr] lg:gap-10"
            >
              <h3 className="font-serif text-lg text-marfim md:text-xl">{item.titulo}</h3>
              <p className="text-sm leading-relaxed text-mineral-soft md:text-base">
                {item.descricao}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4">
          <BotaoLink href="/cadastro" variant="dark">
            Criar acesso
          </BotaoLink>
          <p className="rotulo text-mineral-soft">
            100% gratuito · sem assinatura · sem cobrança
          </p>
        </div>
      </div>
    </section>
  );
}
