import Link from "next/link";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { ACENTO } from "@/components/home/acentos";
import { DOMINIOS, type DominioId } from "@/lib/dominios";
import { atualizacaoPublicada as atualizacaoObservatorio } from "@/lib/publicacao/entradas";
import type { Vitrine } from "@/lib/vitrine";
import { observatoriosDaOrigem } from "@/lib/observatorios/registro";
import { rotaPorta } from "@/lib/perguntas/rotas";
import { AbrirDestinoDaAncora } from "@/components/home/AbrirDestinoDaAncora";
import { DETALHE_RECOLHIDO, IndicadorRecolhido, RESUMO_RECOLHIDO } from "@/components/observatorios/Recolhido";

/**
 * Um capítulo por coleção (os oito domínios, que desde 17/10/2026 vivem dentro
 * dos seis observatórios): a que observatório pertence, pergunta, situação,
 * atualidade lida das golds e os painéis publicados, com fontes ao pé. A situação (piloto, capítulos sem
 * dados, ausência de notas) fica junto do nome, nunca em nota de rodapé.
 *
 * Desde 19/10/2026 (achado A9 da banca) os capítulos ficam recolhidos num
 * <details>: a home mostra uma só taxonomia, a das seis perguntas, e o índice
 * completo continua no HTML, a um clique. As lâminas do índice (Hero) levam a
 * #obs-<coleção>, e AbrirDestinoDaAncora abre o bloco quando a âncora aponta
 * para dentro dele.
 */
export function SecaoObservatorios({ vitrines }: { vitrines: Record<DominioId, Vitrine> }) {
  return (
    <section id="observatorios" aria-labelledby="observatorios-titulo" className="scroll-mt-4 bg-papel">
      <AbrirDestinoDaAncora />
      <div className="mx-auto max-w-page px-6">
        <details className={`${DETALHE_RECOLHIDO} border-b border-linha`}>
          <summary className={`${RESUMO_RECOLHIDO} py-6 md:py-8`}>
            <span className="block">
              <span className="rotulo block text-mineral">As coleções</span>
              <h2
                id="observatorios-titulo"
                className="mt-3 font-serif text-[clamp(1.5rem,3.4vw,2.25rem)] leading-[1.15] text-carvao [text-wrap:balance]"
              >
                O que cada coleção já publica
              </h2>
              <span className="mt-2 block max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {DOMINIOS.length} coleções: os painéis de cada uma, as fontes e a data do dado mais recente.
              </span>
            </span>
            <IndicadorRecolhido />
          </summary>
          <div className="grid gap-6 pb-2 pt-2 lg:grid-cols-12 lg:gap-8">
            <p className="max-w-prose2 leading-relaxed text-carvao-muted lg:col-span-7">
              Cada observatório reúne coleções de painéis construídas sobre as mesmas bases. Aqui estão as coleções, com
              os painéis em produção, as fontes que os alimentam e a data do dado mais recente. O que ainda é piloto ou
              método proposto aparece identificado como tal. Os painéis abrem com a conta gratuita; depois de entrar,
              você segue direto para o painel escolhido.
            </p>
          </div>

          <div className="mt-8 md:mt-10">
            {DOMINIOS.map((d) => {
              const v = vitrines[d.id];
              const a = ACENTO[d.acento];
              const at = atualizacaoObservatorio(d.id);
              const donos = observatoriosDaOrigem(d.id);
              return (
                <article
                  key={d.id}
                  id={`obs-${d.id}`}
                  aria-labelledby={`obs-${d.id}-titulo`}
                  className="grid scroll-mt-6 gap-10 border-t border-linha py-14 md:py-16 lg:grid-cols-12 lg:gap-8"
                >
                  <div className="lg:col-span-4 lg:pr-4">
                    <p className="rotulo flex items-center gap-3 text-mineral">
                      <span aria-hidden="true" className={`h-[3px] w-8 ${a.filete}`} />
                      Coleção
                    </p>
                    <h3
                      id={`obs-${d.id}-titulo`}
                      className="mt-5 font-serif text-[1.65rem] leading-snug text-carvao md:text-[1.85rem]"
                    >
                      {d.nomeCurto}
                    </h3>
                    <p className="mt-3 text-sm text-carvao-muted">
                      {donos.length > 1 ? "Nos observatórios " : "No "}
                      {donos.map((o, j) => (
                        <span key={o.id}>
                          {j > 0 && (j === donos.length - 1 ? " e " : ", ")}
                          <Link href={rotaPorta(o.id)} className="text-carvao underline decoration-linha underline-offset-4 hover:text-bronze-dark">
                            {donos.length > 1 ? o.nomeCurto : o.nome}
                          </Link>
                        </span>
                      ))}
                    </p>
                    <p className={`mt-4 font-serif text-lg italic leading-relaxed ${a.texto}`}>{d.pergunta}</p>

                    {v.situacao && (
                      <p className="mt-6 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao-muted">
                        {v.situacao}
                      </p>
                    )}

                    <div className="mt-6">
                      <p className="rotulo text-mineral">{at.rotulo}</p>
                      <ul className="mt-2 space-y-1 text-sm leading-relaxed text-carvao-muted">
                        {at.linhas.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                      <Link
                        href={d.rotaRaiz}
                        prefetch={prefetchDoLink(d.rotaRaiz)}
                        className="rotulo inline-flex min-h-[44px] items-center gap-2 border border-carvao bg-carvao px-5 text-marfim transition-colors hover:bg-carvao-soft"
                      >
                        {d.cta} <span aria-hidden="true">→</span>
                      </Link>
                      {v.metodologia && (
                        <Link
                          href={v.metodologia.href}
                          className={`rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-carvao ${a.decoracao}`}
                        >
                          {v.metodologia.rotulo}
                        </Link>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-carvao-muted">
                      Sem conta?{" "}
                      <Link href="/cadastro" className="text-carvao underline decoration-linha underline-offset-4 hover:text-bronze-dark">
                        Criar conta gratuita
                      </Link>{" "}
                      ou{" "}
                      <Link href="/entrar" className="text-carvao underline decoration-linha underline-offset-4 hover:text-bronze-dark">
                        entrar
                      </Link>
                      .
                    </p>
                  </div>

                  <div className="lg:col-span-8">
                    <p className="rotulo flex flex-wrap items-baseline justify-between gap-2 text-mineral">
                      <span className="flex items-center gap-2">
                        Painéis
                        <span className="flex items-center gap-1.5 normal-case tracking-normal text-carvao-muted">
                          <svg aria-hidden="true" width="11" height="12" viewBox="0 0 11 12" fill="none" className="shrink-0">
                            <rect x="0.75" y="5.25" width="9.5" height="6" stroke="currentColor" strokeWidth="1.2" />
                            <path d="M2.75 5.25V3.5a2.75 2.75 0 0 1 5.5 0v1.75" stroke="currentColor" strokeWidth="1.2" />
                          </svg>
                          com conta gratuita
                        </span>
                      </span>
                      <span>
                        <span className="tabular-nums text-carvao">{v.contagem.valor}</span> {v.contagem.unidade}
                      </span>
                    </p>
                    <ul className="mt-3 grid border-t border-linha sm:grid-cols-2 sm:gap-x-8">
                      {v.paineis.map((p) => (
                        <li key={p.href} className="border-b border-linha">
                          <Link href={p.href} prefetch={prefetchDoLink(p.href)} className="group flex min-h-[44px] flex-col py-4">
                            <span
                              className={`flex items-baseline justify-between gap-3 font-serif text-lg leading-snug text-carvao transition-colors ${a.hover}`}
                            >
                              {p.titulo}
                              <span
                                aria-hidden="true"
                                className="translate-x-0 font-sans text-sm text-mineral transition-transform group-hover:translate-x-0.5"
                              >
                                →
                              </span>
                            </span>
                            <span className="mt-1 text-sm leading-relaxed text-mineral">{p.descricao}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {v.fontes && (
                      <p className="mt-6 text-sm leading-relaxed text-carvao-muted">
                        <span className="rotulo mr-2 text-mineral">Fontes</span>
                        {v.fontes}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </details>
      </div>
    </section>
  );
}
