import Link from "next/link";
import { BotaoLink } from "@/components/home/BotaoLink";
import { ACENTO } from "@/components/home/acentos";
import { DOMINIOS, type DominioId } from "@/lib/dominios";
import { ACESSO, observatoriosPorExtenso } from "@/lib/acesso";
import type { Vitrine } from "@/lib/vitrine";

/**
 * Abertura: promessa curta e, na mesma dobra, o índice dos observatórios.
 * Cada lâmina usa a gravura editorial do próprio observatório e traz a
 * contagem lida do registro do domínio, na unidade que ele publica.
 */
export function Hero({ vitrines }: { vitrines: Record<DominioId, Vitrine> }) {
  return (
    <section aria-labelledby="hero-titulo" className="border-b border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 pb-14 pt-14 md:pb-20 md:pt-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-8">
            <p className="rotulo text-mineral">Observatórios de dados públicos</p>
            <h1
              id="hero-titulo"
              className="mt-6 max-w-4xl font-serif text-[clamp(2.4rem,5.4vw,4.25rem)] leading-[1.06] tracking-[-0.015em] text-carvao [text-wrap:balance]"
            >
              Da informação dispersa ao conhecimento <span className="text-bronze">verificável</span>.
            </h1>
            <p className="mt-7 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
              {observatoriosPorExtenso(true)} sobre crédito, setor elétrico, gás natural, saneamento, serviços públicos e contas da
              União e dos estados, construídos sobre bases oficiais. Cada painel informa a fonte, o período de referência e o
              que o dado não permite afirmar.
            </p>
          </div>
          <div className="lg:col-span-4 lg:border-l lg:border-linha lg:pl-8">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <BotaoLink href="/cadastro">{ACESSO.ctaConta}</BotaoLink>
              <Link
                href="/entrar"
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
              >
                Já tenho cadastro
              </Link>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-carvao-muted">
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.55rem] h-px w-4 shrink-0 bg-bronze" />
                Todos os painéis com uma conta gratuita
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.55rem] h-px w-4 shrink-0 bg-bronze" />
                Fonte, período e limitações em cada número
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.55rem] h-px w-4 shrink-0 bg-bronze" />
                Gratuito, sem assinatura
              </li>
            </ul>
          </div>
        </div>

        <nav aria-label="Índice dos observatórios" className="mt-12 md:mt-16">
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {DOMINIOS.map((d, i) => {
              const v = vitrines[d.id];
              const a = ACENTO[d.acento];
              const ultimo = i === DOMINIOS.length - 1 && DOMINIOS.length % 2 === 1;
              return (
                <li key={d.id} className={ultimo ? "col-span-2 lg:col-span-1" : undefined}>
                  <a
                    href={`#obs-${d.id}`}
                    className={`group relative block overflow-hidden bg-carvao ${ultimo ? "aspect-[2/1] lg:aspect-[4/5]" : "aspect-[4/5]"}`}
                  >
                    {/* ilustração editorial do observatório; o texto da lâmina nomeia o destino */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.imagem}
                      alt=""
                      width={480}
                      height={600}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                    <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${a.filete}`} />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-carvao from-10% via-carvao/75 via-40% to-transparent to-80%"
                    />
                    <span className="absolute inset-x-0 bottom-0 flex flex-col p-4 md:p-5">
                      <span className="rotulo text-marfim/75">{String(i + 1).padStart(2, "0")}</span>
                      <span className="mt-1.5 font-serif text-lg leading-snug text-marfim md:text-xl">{d.nomeCurto}</span>
                      <span className="mt-2 text-xs leading-snug text-marfim/80">
                        <span className="font-label text-sm tabular-nums text-marfim">{v.contagem.valor}</span>{" "}
                        {v.contagem.unidade}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-mineral">
            Ilustrações editoriais de cada observatório. Não representam dados nem lugares específicos.
          </p>
        </nav>
      </div>
    </section>
  );
}
