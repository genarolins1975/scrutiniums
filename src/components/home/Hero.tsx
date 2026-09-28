import Link from "next/link";
import { BotaoLink } from "@/components/home/BotaoLink";

/**
 * Abertura editorial: o título em serifa com a palavra-chave em bronze e, logo
 * abaixo, a arquitetura da plataforma em uma frase. Sem amostra de produto
 * aqui: os dois painéis vivos vêm na seção seguinte, na mesma dobra.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className="bg-marfim">
      <div className="mx-auto max-w-page px-6 pb-10 pt-14 md:pb-14 md:pt-20">
        <p className="rotulo text-mineral">Plataforma de inteligência analítica · leitura aberta, sem cadastro</p>
        <h1 id="hero-titulo" className="mt-6 max-w-5xl font-serif text-[clamp(2.5rem,6.2vw,4.4rem)] leading-[1.06] tracking-[-0.015em] text-carvao">
          Da informação dispersa ao conhecimento <span className="text-bronze">verificável</span>.
        </h1>
        <p id="observatorios-titulo" className="mt-6 max-w-4xl font-serif text-[clamp(1.35rem,2.6vw,1.9rem)] leading-snug text-carvao-muted">
          Dois observatórios. Uma mesma infraestrutura de dados, método e evidência.
        </p>
        <p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">
          Fontes públicas e registros oficiais organizados com estatística e método declarado. Cada número diz de onde veio, como foi feito e
          onde termina a certeza.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
          <BotaoLink href="/setor-eletrico">Explorar o Setor Elétrico</BotaoLink>
          <BotaoLink href="/observatorio" variant="secondary">
            Explorar o Crédito
          </BotaoLink>
          <Link href="/entrar" className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze">
            Já tenho cadastro
          </Link>
        </div>
      </div>
    </section>
  );
}
