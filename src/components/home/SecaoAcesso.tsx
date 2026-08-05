import { BotaoLink } from "@/components/home/BotaoLink";
import { LogoMark } from "@/components/ui/Logo";

export function SecaoAcesso() {
  return (
    <section aria-labelledby="acesso-titulo" className="border-t border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <LogoMark size={34} />
          </div>
          <h2
            id="acesso-titulo"
            className="mt-8 font-serif text-[clamp(2rem,5vw,3rem)] leading-tight text-carvao"
          >
            A leitura é aberta. A conta é opcional.
          </h2>
          <p className="mx-auto mt-5 max-w-prose2 leading-relaxed text-carvao-muted">
            Explore o Observatório sem cadastro — análises, séries e metodologia
            abertas ao seu escrutínio. A conta gratuita guarda preferências e dá
            acesso à área de painéis.
          </p>
          <div className="mt-10 flex justify-center">
            <BotaoLink href="/cadastro">Criar acesso</BotaoLink>
          </div>
          <p className="rotulo mt-7 text-mineral">
            100% gratuito · sem assinatura · sem cobrança
          </p>
        </div>
      </div>
    </section>
  );
}
