import Link from "next/link";
import { BotaoLink } from "@/components/home/BotaoLink";
import { LogoMark } from "@/components/ui/Logo";

/**
 * Hero editorial: título serifado com quebra pensada e uma palavra em
 * bronze como gesto tipográfico; à direita, um colofão abstrato com o
 * verbete latino de "scrutinium" — nenhuma amostra de produto.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className="border-b border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 pb-20 pt-16 md:pb-28 md:pt-24 lg:pb-32">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-8">
            <p className="rotulo text-mineral">Plataforma de inteligência analítica</p>
            <h1
              id="hero-titulo"
              className="mt-7 max-w-4xl font-serif text-[clamp(2.5rem,6.5vw,4.6rem)] leading-[1.06] tracking-[-0.015em] text-carvao"
            >
              Da informação dispersa
              <br className="hidden sm:block" /> ao conhecimento{" "}
              <span className="text-bronze">verificável</span>.
            </h1>
            <p className="mt-8 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
              A Scrutiniums organiza fontes públicas, registros oficiais e séries
              setoriais com estatística e método declarado. Cada análise diz de onde
              veio, como foi feita — e onde termina a certeza.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
              <BotaoLink href="/cadastro">Criar acesso</BotaoLink>
              <Link
                href="/entrar"
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
              >
                Já tenho cadastro
              </Link>
            </div>
            <p className="rotulo mt-9 text-mineral">
              100% gratuito · sem assinatura · sem cobrança
            </p>
          </div>

          <aside
            aria-label="Origem do nome Scrutiniums"
            className="hidden lg:col-span-3 lg:col-start-10 lg:flex lg:flex-col lg:justify-between lg:border-l lg:border-linha lg:pl-10"
          >
            <LogoMark size={38} />
            <div className="mt-16">
              <p className="font-serif text-2xl text-carvao">
                scru<span className="text-bronze">·</span>ti
                <span className="text-bronze">·</span>ni
                <span className="text-bronze">·</span>um
              </p>
              <p className="mt-4 text-sm leading-relaxed text-mineral">
                substantivo latino: exame atento; verificação minuciosa, peça por
                peça, do que se afirma.
              </p>
              <div aria-hidden="true" className="mt-9 h-px w-10 bg-bronze" />
              <p className="rotulo mt-4 text-mineral">Método antes da conclusão</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
