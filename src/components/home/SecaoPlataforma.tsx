import { BotaoLink } from "@/components/home/BotaoLink";

const CONTEUDOS = [
  {
    titulo: "Panorama do Crédito por estado",
    descricao:
      "Mapa e perfis do SCR: carteira, inadimplência arrastada, renda, ocupação e produto em cada UF, com alertas de deterioração por regras publicadas.",
  },
  {
    titulo: "Taxas de juros por instituição",
    descricao:
      "20 modalidades PF e PJ, cerca de 200 instituições: ranking completo, dispersão, quem é persistentemente mais barato e a carteira associada.",
  },
  {
    titulo: "Comparador de instituições",
    descricao:
      "Visão executiva de 2 a 10 bancos e cooperativas (IF.data), com grupo comparável por segmento prudencial e sentido econômico declarado em cada métrica.",
  },
  {
    titulo: "Sinais antecedentes e alertas",
    descricao:
      "Subíndices de estresse decompostos, alertas com persistência mínima e relatório diário automático, tudo com regra publicada.",
  },
  {
    titulo: "Riscos emergentes: bets e fraudes",
    descricao:
      "Apostas e golpes digitais versus crédito das famílias, com hierarquia de evidência A a E e a honestidade de dizer o que ainda é hipótese.",
  },
  {
    titulo: "Mercado & valor dos bancos listados",
    descricao:
      "Retorno total com proventos reinvestidos, drawdown, valuation e resultados das companhias financeiras da B3.",
  },
  {
    titulo: "Glossário e metodologia abertos",
    descricao: "Definições e métodos acessíveis a qualquer pessoa, sem cadastro.",
  },
];

/**
 * Momento de manifesto: a frase de transparência em serifa grande
 * sobre carvão, seguida do que existe dentro da plataforma em lista
 * editorial com filetes — sem cartões.
 */
export function SecaoPlataforma() {
  return (
    <section id="plataforma" aria-labelledby="plataforma-titulo" className="bg-carvao text-marfim">
      <div className="mx-auto max-w-page px-6 py-24 md:py-32">
        <p className="rotulo text-mineral-soft">Dentro da plataforma</p>
        <h2
          id="plataforma-titulo"
          className="mt-7 max-w-5xl font-serif text-[clamp(1.9rem,4.5vw,3.4rem)] leading-[1.12] text-marfim"
        >
          Fontes, critérios, período e limitações —{" "}
          <span className="text-bronze-soft">declarados em cada análise.</span>
        </h2>
        <p className="mt-8 max-w-prose2 leading-relaxed text-mineral-soft">
          É o compromisso que sustenta tudo o que existe do outro lado do cadastro.
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
