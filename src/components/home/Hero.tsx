import Link from "next/link";
import { BotaoLink } from "@/components/home/BotaoLink";
import { DETALHE_RECOLHIDO, IndicadorRecolhido, RESUMO_RECOLHIDO } from "@/components/observatorios/Recolhido";
import { ACENTO } from "@/components/home/acentos";
import { pt } from "@/i18n/pt";
import { en } from "@/i18n/en";
import { DOMINIOS, type DominioId } from "@/lib/dominios";
import { ACESSO, observatoriosPorExtenso } from "@/lib/acesso";
import { formatarContagemIndice } from "@/lib/i18n-home-indice";
import type { Idioma } from "@/lib/idioma";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Vitrine } from "@/lib/vitrine";

function partesIntroducaoHero(idioma: Idioma) {
  const mensagem = idioma === "en" ? en["home.hero.introducao"].texto : pt["home.hero.introducao"];
  return {
    observatorios: observatoriosPorExtenso(true, idioma),
    restante: mensagem.slice("{observatorios}".length),
  };
}

/**
 * Promessa e conta, logo depois das perguntas (HeroPerguntas, que leva o H1
 * da página e a única taxonomia à vista). As lâminas de cada coleção formam o
 * índice completo, recolhido num <details> dentro do próprio nav: continuam no
 * HTML, a um clique, sem competir com as seis perguntas (achado A9 da banca de
 * 19/10/2026). Cada lâmina usa a gravura editorial do próprio observatório e
 * traz a contagem lida do registro do domínio, na unidade que ele publica.
 */
export function Hero({ vitrines, idioma = "pt" }: { vitrines: Record<DominioId, Vitrine>; idioma?: Idioma }) {
  const tituloInicio = idioma === "en" ? en["home.hero.titulo_inicio"].texto : pt["home.hero.titulo_inicio"];
  const tituloDestaque = idioma === "en" ? en["home.hero.titulo_destaque"].texto : pt["home.hero.titulo_destaque"];
  const introducao = partesIntroducaoHero(idioma);

  return (
    <section aria-labelledby="hero-titulo" className="border-b border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 pb-8 pt-12 md:pb-12 md:pt-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-8">
            <p data-i18n-regiao={idioma === "en" ? "home-rotulo" : undefined} className="rotulo text-mineral">
              {idioma === "en" ? en["home.hero.rotulo"].texto : pt["home.hero.rotulo"]}
            </p>
            <h2
              id="hero-titulo"
              data-i18n-regiao={idioma === "en" ? "home-titulo" : undefined}
              className="mt-6 max-w-4xl font-serif text-[clamp(2rem,4.2vw,3.1rem)] leading-[1.08] tracking-[-0.01em] text-carvao [text-wrap:balance]"
            >
              {tituloInicio}<span className="text-bronze">{tituloDestaque}</span>.
            </h2>
            <p data-i18n-regiao={idioma === "en" ? "home-introducao" : undefined} className="mt-7 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
              {introducao.observatorios}{introducao.restante}
            </p>
          </div>
          <div className="lg:col-span-4 lg:border-l lg:border-linha lg:pl-8">
            <div data-i18n-regiao={idioma === "en" ? "home-acoes" : undefined} className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <BotaoLink href="/cadastro">{idioma === "en" ? en["acesso.criar_conta"].texto : ACESSO.ctaConta}</BotaoLink>
              <Link
                href={hrefNoIdioma("/entrar", idioma)}
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
              >
                {idioma === "en" ? en["home.hero.ja_cadastrado"].texto : pt["home.hero.ja_cadastrado"]}
              </Link>
            </div>
            <ul data-i18n-regiao={idioma === "en" ? "home-beneficios" : undefined} className="mt-6 space-y-2 text-sm text-carvao-muted">
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.55rem] h-px w-4 shrink-0 bg-bronze" />
                {idioma === "en" ? en["home.hero.beneficio_conta"].texto : pt["home.hero.beneficio_conta"]}
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.55rem] h-px w-4 shrink-0 bg-bronze" />
                {idioma === "en" ? en["home.hero.beneficio_evidencia"].texto : pt["home.hero.beneficio_evidencia"]}
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.55rem] h-px w-4 shrink-0 bg-bronze" />
                {idioma === "en" ? en["home.hero.beneficio_gratuidade"].texto : pt["home.hero.beneficio_gratuidade"]}
              </li>
            </ul>
          </div>
        </div>

        <nav
          data-i18n-regiao={idioma === "en" ? "home-indice" : undefined}
          aria-label={idioma === "en" ? en["home.indice.rotulo"].texto : pt["home.indice.rotulo"]}
          className="mt-10 border-y border-linha md:mt-14"
        >
          <details className={DETALHE_RECOLHIDO}>
            <summary className={`${RESUMO_RECOLHIDO} py-4 font-serif text-xl text-carvao md:text-2xl`}>
              {idioma === "en" ? en["home.indice.rotulo"].texto : pt["home.indice.rotulo"]}
              <IndicadorRecolhido />
            </summary>
            <ol className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 xl:grid-cols-7">
              {DOMINIOS.map((d, i) => {
                const v = vitrines[d.id];
                const contagem = formatarContagemIndice(v, idioma);
                const a = ACENTO[d.acento];
                // em duas colunas, o último de uma contagem ímpar ocupa a linha inteira; de 640 px em diante a grade já acomoda todos
                const ultimo = i === DOMINIOS.length - 1 && DOMINIOS.length % 2 === 1;
                return (
                  <li key={d.id} className={ultimo ? "col-span-2 sm:col-span-1" : undefined}>
                    <a
                      href={`#obs-${d.id}`}
                      className={`group relative block overflow-hidden bg-carvao ${ultimo ? "aspect-[2/1] sm:aspect-[4/5]" : "aspect-[4/5]"}`}
                    >
                      {/* ilustração editorial do observatório; o texto da lâmina nomeia o destino */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.imagem}
                        alt=""
                        width={480}
                        height={600}
                        decoding="async"
                        style={v.focoImagem ? { objectPosition: v.focoImagem } : undefined}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${a.filete}`} />
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-carvao from-10% via-carvao/75 via-40% to-transparent to-80%"
                      />
                      <span className="absolute inset-x-0 bottom-0 flex flex-col p-4 md:p-5 xl:p-4">
                        <span className="rotulo text-marfim/75">{String(i + 1).padStart(2, "0")}</span>
                        <span lang={idioma === "en" ? "pt-BR" : undefined} className="mt-1.5 font-serif text-lg leading-snug text-marfim md:text-xl xl:text-lg [text-wrap:balance]">{d.nomeCurto}</span>
                        <span className="mt-2 text-xs leading-snug text-marfim/80">
                          <span className="font-label text-sm tabular-nums text-marfim">{contagem.valor}</span>{" "}
                          {contagem.unidade}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 pb-5 text-xs text-mineral">
              {idioma === "en" ? en["home.indice.ilustracoes"].texto : pt["home.indice.ilustracoes"]}
            </p>
          </details>
        </nav>
      </div>
    </section>
  );
}
