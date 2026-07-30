import { BotaoLink } from "@/components/home/BotaoLink";

export function SecaoAcesso() {
  return (
    <section aria-labelledby="acesso-titulo" className="border-t border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-16 md:py-24">
        <div className="border border-linha bg-papel px-6 py-14 text-center md:px-16">
          <h2 id="acesso-titulo" className="font-serif text-3xl text-carvao md:text-4xl">
            Crie seu acesso gratuito
          </h2>
          <p className="mx-auto mt-4 max-w-prose2 text-carvao-muted">
            Seu cadastro é a única exigência para usar a plataforma.
          </p>
          <div className="mt-8 flex justify-center">
            <BotaoLink href="/cadastro">Criar acesso gratuito</BotaoLink>
          </div>
          <p className="rotulo mt-6 text-bronze">
            100% gratuito · sem assinatura · sem cobrança
          </p>
        </div>
      </div>
    </section>
  );
}
