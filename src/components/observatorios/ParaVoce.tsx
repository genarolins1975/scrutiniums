import type { ReactNode } from "react";
import Link from "@/components/i18n/LinkIdioma";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";
import { paraVoce, type EntradaParaVoce, type IdPergunta } from "@/lib/observatorios/paraVoce";
import styles from "./ParaVoce.module.css";
import { prefetchDoLink } from "@/lib/rotasPublicas";

/**
 * "Para você": o bloco das entradas, logo depois dos números de abertura, com as duas ou três
 * perguntas de maior valor para o cidadão sobre o próprio caso, cada uma a um clique (checklist
 * da skill, seção 4, item 2). Um componente só para todas as entradas, com a lista central em
 * src/lib/observatorios/paraVoce.ts; mesma linguagem do bloco "Para o seu caso" das portas abertas.
 *
 * Destino fechado leva o selo "com conta" (que só aparece quando a entrada é vista sem sessão, numa
 * rota aberta) e não é pré-carregado. `children` é a consulta embutida da entrada, quando ela tem uma
 * (os focos de calor por município no Território e Clima), mostrada abaixo dos cartões.
 *
 * `artes` põe a gravura da entrada no topo do cartão da pergunta (faixa 16:9, decorativa, aria-hidden), com
 * a nota de que são ilustrações geradas por IA e não representam dados. Use as peças de ArteParaVoce.
 */
export function ParaVoce({
  entrada,
  idioma = "pt",
  conteiner = "mx-auto max-w-page px-6",
  className = "border-b border-linha",
  children = null,
  artes,
}: Readonly<{
  entrada: EntradaParaVoce;
  idioma?: Idioma;
  /** Classes do contêiner interno, no padrão da página (ed-pagina, max-w-page; vazio quando o pai já limita a largura). */
  conteiner?: string;
  /** Classes da seção: a régua de baixo sai quando a seção seguinte já abre com uma. */
  className?: string;
  children?: ReactNode;
  /** Gravura por pergunta, no topo do cartão. */
  artes?: Partial<Record<IdPergunta, ReactNode>>;
}>) {
  const perguntas = paraVoce(entrada, idioma);
  const t = (pt: string, en: string) => tx(pt, en, idioma);
  const colunas = perguntas.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <section aria-labelledby="para-voce-titulo" data-para-voce={entrada} className={`para-voce ${className}`}>
      <div className={`${conteiner} py-10 md:py-12`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <h2 id="para-voce-titulo" className="font-serif text-[clamp(1.5rem,2.6vw,1.9rem)] leading-tight text-carvao">
            {t("Para você", "For you")}
          </h2>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {t(
              "Perguntas sobre o seu caso que a plataforma já responde, a um clique. Cada número traz fonte e período; o destino mostra o detalhe.",
              "Questions about your own case that the platform already answers, one click away. Each number shows its source and period; the destination shows the detail.",
            )}
          </p>
        </div>
        <ul className={`mt-6 grid gap-px border border-linha bg-linha ${colunas}`}>
          {perguntas.map((p) => (
            <li key={p.id} data-para-voce-pergunta={p.id} className="min-w-0 bg-papel">
              <Link href={p.href} prefetch={prefetchDoLink(p.href)} className="group flex h-full min-h-[44px] flex-col p-5 md:p-6">
                {artes?.[p.id] && (
                  <span aria-hidden="true" className={`${styles.arte} -mx-5 -mt-5 mb-5 md:-mx-6 md:-mt-6 md:mb-6`} data-para-voce-arte="">
                    {artes[p.id]}
                  </span>
                )}
                <span className="font-serif text-lg leading-snug text-carvao group-hover:underline group-hover:decoration-linha group-hover:underline-offset-4">
                  {p.pergunta}
                </span>
                <span className="mt-2 text-sm leading-relaxed text-carvao-muted">{p.resposta}</span>
                {/* o espaço sobra acima do número: os números dos cartões ficam na mesma linha */}
                <span aria-hidden="true" className="grow" />
                {p.numero && (
                  <span className="mt-4 block border-t border-linha pt-3" data-para-voce-numero="">
                    <span className="block text-xs leading-snug text-carvao-muted">{p.numero.rotulo}</span>
                    {p.numero.valor === null ? (
                      <span className="mt-1 block text-base text-carvao">{t("Indisponível nesta publicação", "Unavailable in this publication")}</span>
                    ) : (
                      <span className="mt-1 block">
                        <span className="font-label text-[1.6rem] leading-none tabular-nums text-carvao">{p.numero.valor}</span>{" "}
                        <span className="text-sm text-carvao-muted">{p.numero.unidade}</span>
                      </span>
                    )}
                    <span className="mt-2 block text-xs leading-relaxed text-mineral">
                      {p.numero.fonte} · {p.numero.periodo}
                    </span>
                  </span>
                )}
                <span className="flex flex-wrap items-center gap-x-1 pt-4 text-sm text-carvao">
                  <span className="underline decoration-linha underline-offset-4 group-hover:decoration-carvao">{t("Ver a resposta", "See the answer")}</span>
                  <span aria-hidden="true" className="text-mineral transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                  <SeloComConta href={p.href} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {artes && Object.keys(artes).length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-mineral">
            {t(
              "Ilustrações conceituais geradas por IA; não representam dados. Fontes e períodos estão em cada número.",
              "Conceptual illustrations generated by AI; they do not represent data. Sources and periods are given with each number.",
            )}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
