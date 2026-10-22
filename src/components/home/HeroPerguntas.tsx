import Link from "next/link";
import type { ReactNode } from "react";
import { ACENTO } from "@/components/home/acentos";
import { DETALHE_RECOLHIDO, IndicadorRecolhido, RESUMO_RECOLHIDO } from "@/components/observatorios/Recolhido";
import { DOMINIOS } from "@/lib/dominios";
import type { Porta } from "@/lib/perguntas/tipos";
import { rotaPorta } from "@/lib/perguntas/rotas";

/**
 * Primeira tela: o Brasil em seis perguntas. Cada porta mostra um número com
 * fonte e período lidos das golds e leva à página aberta da pergunta. Abaixo,
 * a matriz que liga cada pergunta aos observatórios que a alimentam, lida dos
 * destinos de cada porta: nada nela é marcado à mão.
 */
export function HeroPerguntas({ portas, rodape = null }: Readonly<{ portas: Porta[]; rodape?: ReactNode }>) {
  return (
    <section id="perguntas" aria-labelledby="perguntas-titulo" className="scroll-mt-4 border-b border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 pb-14 pt-12 md:pb-20 md:pt-16">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-8">
            <p className="rotulo text-mineral">Seis observatórios, seis perguntas</p>
            <h1
              id="perguntas-titulo"
              className="mt-5 max-w-4xl font-serif text-[clamp(2.1rem,4.8vw,3.6rem)] leading-[1.08] tracking-[-0.01em] text-carvao [text-wrap:balance]"
            >
              Entenda o Brasil pelas <span className="text-bronze-dark">perguntas que importam</span>.
            </h1>
          </div>
          <p className="max-w-prose2 text-base leading-relaxed text-carvao-muted lg:col-span-4 md:text-lg">
            Cada observatório responde a uma pergunta sobre a vida de quem mora aqui. Nesta página, uma amostra aberta a
            todos: poucos números, cada um com fonte e período. Séries, comparações e downloads ficam nos painéis, que
            abrem com conta gratuita.
          </p>
        </div>

        <ol className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-3 md:mt-12">
          {portas.map((p, i) => {
            const n = p.numeros[0];
            const a = ACENTO[p.acento];
            return (
              <li key={p.id} className="bg-papel">
                <Link href={rotaPorta(p.id)} className="group relative flex h-full min-h-[44px] flex-col p-5 md:p-6">
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${a.filete}`} />
                  <span className="rotulo flex items-baseline gap-3 text-mineral">
                    <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    {p.nome}
                  </span>
                  <span className={`mt-3 font-serif text-xl leading-snug text-carvao transition-colors ${a.hover} [text-wrap:balance]`}>
                    {p.pergunta}
                  </span>
                  {n && (
                    <span className="mt-5 block border-t border-linha pt-4">
                      <span className="block text-sm leading-snug text-carvao-muted">{n.rotulo}</span>
                      {n.valor === null ? (
                        <span className="mt-1 block text-sm text-carvao">Indisponível nesta publicação</span>
                      ) : (
                        <span className="mt-1 block">
                          <span className="font-label text-[1.7rem] leading-none tabular-nums text-carvao">{n.valor}</span>{" "}
                          <span className="text-sm text-carvao-muted">{n.unidade}</span>
                        </span>
                      )}
                      <span className="mt-2 block text-xs leading-relaxed text-mineral">
                        {n.fonte} · {n.periodo}
                      </span>
                    </span>
                  )}
                  <span className="rotulo mt-auto flex items-center gap-2 pt-5 text-carvao">
                    Ver a resposta <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        <MatrizFontes portas={portas} />
      </div>
      {/* faixa no fim da primeira seção (a parceria técnica): a home em inglês só admite as quatro seções seguintes no <main> */}
      {rodape}
    </section>
  );
}

/** Quais coleções alimentam cada observatório, a partir dos destinos declarados em cada porta. */
function MatrizFontes({ portas }: Readonly<{ portas: Porta[] }>) {
  const usados = DOMINIOS.filter((d) => portas.some((p) => p.caminhos.some((c) => c.observatorio === d.nomeCurto)));
  return (
    // mesmo desenho dos outros blocos recolhidos da home (Recolhido.tsx): título em serifa e o sinal de mais, não um rótulo solto
    <details className={`${DETALHE_RECOLHIDO} mt-10 border-t border-linha md:mt-12`}>
      <summary className={`${RESUMO_RECOLHIDO} py-4 font-serif text-xl text-carvao md:text-2xl`}>
        De onde vêm as respostas
        <IndicadorRecolhido />
      </summary>
      <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Cada observatório reúne painéis de várias coleções. A marca indica que a página do observatório leva a pelo menos
        um painel daquela coleção.
      </p>
      <div className="tabela-scroll mt-4">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Coleções que alimentam cada observatório</caption>
          <thead>
            <tr className="border-b border-linha text-left">
              <th scope="col" className="py-2 pr-4 font-normal text-mineral">Observatório</th>
              {usados.map((d) => (
                <th key={d.id} scope="col" className="px-2 py-2 text-center font-normal text-mineral">
                  {d.nomeCurto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {portas.map((p) => (
              <tr key={p.id} className="border-b border-linha">
                <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{p.nome}</th>
                {usados.map((d) => {
                  const sim = p.caminhos.some((c) => c.observatorio === d.nomeCurto);
                  return (
                    <td key={d.id} className="px-2 py-2 text-center">
                      {sim ? (
                        <span aria-label="sim" role="img" className="inline-block h-2 w-2 rounded-full bg-carvao" />
                      ) : (
                        <span className="sr-only">não</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
