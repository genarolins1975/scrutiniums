import Link from "next/link";
import { BotaoLink } from "@/components/home/BotaoLink";
import { AmostraPainel } from "@/components/home/AmostraPainel";

export function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className="border-b border-linha bg-marfim">
      <div className="mx-auto grid max-w-page items-center gap-12 px-6 py-16 md:py-24 lg:grid-cols-[7fr_5fr]">
        <div>
          <p className="rotulo text-mineral">Plataforma de inteligência analítica</p>
          <h1
            id="hero-titulo"
            className="mt-5 font-serif text-4xl leading-tight text-carvao md:text-5xl lg:text-6xl"
          >
            Toda a informação relevante para decisões melhores.
          </h1>
          <p className="mt-6 max-w-prose2 leading-relaxed text-carvao-muted">
            A Scrutiniums reúne bases públicas, registros oficiais, fontes especializadas,
            dados econômicos e setoriais, documentos técnicos e dados próprios — organizados
            com estatística e modelos analíticos para transformar informação dispersa em
            conhecimento útil.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <BotaoLink href="/cadastro">Criar acesso gratuito</BotaoLink>
            <Link
              href="/entrar"
              className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-bronze"
            >
              Já tenho cadastro
            </Link>
          </div>
          <p className="rotulo mt-6 text-bronze">
            100% gratuito · sem assinatura · sem cobrança
          </p>
        </div>
        <div className="hidden lg:block">
          <AmostraPainel />
        </div>
      </div>
    </section>
  );
}
