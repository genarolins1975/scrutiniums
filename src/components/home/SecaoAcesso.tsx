import Link from "next/link";
import { BotaoLink } from "@/components/home/BotaoLink";
import { LogoMark } from "@/components/ui/Logo";
import { ACESSO } from "@/lib/acesso";

/** Fecho da página: a regra de acesso aos painéis e o caminho para a conta. */
export function SecaoAcesso() {
  return (
    <section id="acesso" aria-labelledby="acesso-titulo" className="scroll-mt-4 border-t border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <LogoMark size={34} />
          </div>
          <h2
            id="acesso-titulo"
            className="mt-8 font-serif text-[clamp(2rem,5vw,3rem)] leading-tight text-carvao [text-wrap:balance]"
          >
            Uma conta gratuita abre todos os painéis.
          </h2>
          <p className="mx-auto mt-5 max-w-prose2 leading-relaxed text-carvao-muted">
            {ACESSO.leitura} O cadastro pede e-mail, telefone confirmado por SMS, CPF e um perfil básico.
          </p>
          <p className="mx-auto mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{ACESSO.conta}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <BotaoLink href="/cadastro">{ACESSO.ctaConta}</BotaoLink>
            <Link
              href="/entrar"
              className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
            >
              Já tenho cadastro
            </Link>
          </div>
          <p className="rotulo mt-7 text-mineral">
            100% gratuito · sem assinatura · sem cobrança
          </p>
        </div>
      </div>
    </section>
  );
}
