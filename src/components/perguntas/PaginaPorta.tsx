import Link from "next/link";
import { ACENTO } from "@/components/home/acentos";
import { ConviteConta } from "@/components/perguntas/ConviteConta";
import { ehRotaPublica, prefetchDoLink } from "@/lib/rotasPublicas";
import { rotaPorta } from "@/lib/perguntas/rotas";
import type { Porta } from "@/lib/perguntas/tipos";

function aberto(href: string): boolean {
  return ehRotaPublica(href.split(/[?#]/)[0] || "/");
}

function Cadeado() {
  return (
    <svg aria-hidden="true" width="11" height="12" viewBox="0 0 11 12" fill="none" className="shrink-0">
      <rect x="0.75" y="5.25" width="9.5" height="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.75 5.25V3.5a2.75 2.75 0 0 1 5.5 0v1.75" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * Página aberta de uma pergunta: um aperitivo do tema (poucos números com
 * prova), as consultas abertas do tema para o caso de quem pergunta ("Para o
 * seu caso", leva 1 de 19/10/2026) e o convite para os painéis, onde ficam a
 * profundidade, as séries e os interativos. Não vira painel: nada de série,
 * filtro ou download aqui. Fecha com o que a plataforma ainda não responde e
 * o método recolhido.
 */
/** Coleção com até quatro painéis de exemplo; sem contagem, porque subpáginas não entram no registro. */
export type ColecaoPorta = { id: string; nome: string; href: string; destaques: string[]; mais: boolean; origens: string };

export function PaginaPorta({ porta, outras, colecoes, entrada }: Readonly<{ porta: Porta; outras: Porta[]; colecoes: ColecaoPorta[]; entrada?: string }>) {
  const a = ACENTO[porta.acento];
  return (
    <main className="bg-papel">
      <section aria-labelledby="porta-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-16 md:pt-14">
          <nav aria-label="Trilha" className="text-sm text-carvao-muted">
            <Link href="/#perguntas" className="underline decoration-linha underline-offset-4 hover:text-carvao">
              Os seis observatórios
            </Link>
            <span aria-hidden="true" className="mx-2 text-mineral">/</span>
            <span aria-current="page">{porta.nome}</span>
          </nav>
          <p className="rotulo mt-8 flex items-center gap-3 text-mineral">
            <span aria-hidden="true" className={`h-[3px] w-8 ${a.filete}`} />
            {porta.nomeCompleto}
          </p>
          <h1
            id="porta-titulo"
            className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]"
          >
            {porta.pergunta}
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">{porta.resumo}</p>

          <h2 className="sr-only">Os números</h2>
          <dl className="mt-10 grid gap-px border border-linha bg-linha md:grid-cols-3">
            {porta.numeros.map((n) => (
              <div key={n.rotulo} className="flex flex-col bg-papel p-5 md:p-6">
                <dt className="text-sm leading-snug text-carvao-muted">{n.rotulo}</dt>
                <dd className="mt-2">
                  {n.valor === null ? (
                    <span className="text-base text-carvao">Indisponível nesta publicação</span>
                  ) : (
                    <>
                      <span className="font-label text-[2rem] leading-none tabular-nums text-carvao">{n.valor}</span>{" "}
                      <span className="text-sm text-carvao-muted">{n.unidade}</span>
                    </>
                  )}
                </dd>
                <dd className="mt-3 text-xs leading-relaxed text-mineral">
                  <span className="block">Período: {n.periodo}</span>
                  <span className="block">Fonte: {n.fonte}</span>
                </dd>
                {n.nota && <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{n.nota}</dd>}
                <dd className="mt-auto pt-4">
                  <Link
                    href={n.href}
                    prefetch={prefetchDoLink(n.href)}
                    className="inline-flex min-h-[44px] items-center gap-2 text-sm text-carvao underline decoration-linha underline-offset-4 hover:text-carvao-soft"
                  >
                    Ver a série completa
                    {!aberto(n.href) && (
                      <span className="inline-flex items-center gap-1 text-xs text-mineral no-underline">
                        <Cadeado /> com conta
                      </span>
                    )}
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {porta.paraOSeuCaso.length > 0 && (
        <section aria-labelledby="seu-caso-titulo" data-para-o-seu-caso="" className="border-b border-linha">
          <div className="mx-auto grid max-w-page gap-6 px-6 py-10 md:py-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-4">
              <h2 id="seu-caso-titulo" className="font-serif text-[clamp(1.5rem,2.6vw,1.9rem)] leading-tight text-carvao">
                Para o seu caso
              </h2>
              <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Consultas abertas, sem conta, para o caso de quem pergunta. Cada uma mostra o número com fonte e período; as
                séries completas, as comparações amplas e os arquivos ficam nos painéis.
              </p>
            </div>
            <ul className={`grid gap-px border border-linha bg-linha lg:col-span-8 ${porta.paraOSeuCaso.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {porta.paraOSeuCaso.map((c, i, todas) => (
                // com quantidade ímpar, a última consulta ocupa a linha inteira em vez de deixar uma célula vazia
                <li key={c.href} className={`bg-papel ${todas.length > 1 && i === todas.length - 1 && todas.length % 2 === 1 ? "sm:col-span-2" : ""}`}>
                  <Link href={c.href} prefetch={prefetchDoLink(c.href)} className="group flex h-full min-h-[44px] flex-col p-4 md:p-5">
                    <span className={`flex items-baseline justify-between gap-3 font-serif text-lg leading-snug text-carvao ${a.hover}`}>
                      {c.pergunta}
                      <span aria-hidden="true" className="font-sans text-sm text-mineral transition-transform group-hover:translate-x-0.5">→</span>
                    </span>
                    <span className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.resumo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="caminhos-titulo" className="mx-auto max-w-page px-6 py-14 md:py-20">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <h2 id="caminhos-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">
              No painel completo
            </h2>
            <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Esta página é uma amostra. Cada pergunta abaixo leva a um painel com a série histórica, comparações entre
              estados, municípios ou instituições, fichas e downloads. Os painéis abrem com a conta gratuita; depois de
              entrar, você segue direto para o painel escolhido.
            </p>
            <ConviteConta />
            {entrada && (
              <p className="mt-6 border-t border-linha pt-4 text-sm leading-relaxed text-carvao-muted">
                O observatório tem uma entrada completa, com os números de escala, o modelo didático do tema e todas
                as coleções:{" "}
                <Link href={entrada} prefetch={false} className="inline-flex items-center gap-1 text-carvao underline decoration-linha underline-offset-4">
                  entrar no {porta.nomeCompleto} <Cadeado />
                </Link>
                .
              </p>
            )}
          </div>
          <ul className="border-t border-linha lg:col-span-8">
            {porta.caminhos.map((c) => (
              <li key={c.href} className="border-b border-linha">
                <Link href={c.href} prefetch={prefetchDoLink(c.href)} className="group flex min-h-[44px] flex-col py-5">
                  <span className="rotulo flex flex-wrap items-center gap-x-3 gap-y-1 text-mineral">
                    {c.colecao}
                    {!aberto(c.href) && (
                      <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-carvao-muted">
                        <Cadeado /> com conta gratuita
                      </span>
                    )}
                  </span>
                  <span className={`mt-2 flex items-baseline justify-between gap-3 font-serif text-xl leading-snug text-carvao ${a.hover}`}>
                    {c.pergunta}
                    <span aria-hidden="true" className="font-sans text-sm text-mineral transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                  <span className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.resumo}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="colecoes-titulo" className="border-t border-linha">
        <div className="mx-auto grid max-w-page gap-6 px-6 py-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <h2 id="colecoes-titulo" className="font-serif text-2xl leading-tight text-carvao">
              Tudo o que este observatório reúne
            </h2>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              As coleções do {porta.nomeCompleto}, com exemplos de painéis de cada uma e a origem dos dados. Todas abrem
              com a conta gratuita.
            </p>
          </div>
          <ul className="grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:col-span-8">
            {colecoes.map((c, i) => (
              // com quantidade ímpar, a última coleção ocupa a linha inteira em vez de deixar uma célula vazia
              <li key={c.id} className={`bg-papel ${i === colecoes.length - 1 && colecoes.length % 2 === 1 ? "sm:col-span-2" : ""}`}>
                <Link href={c.href} prefetch={prefetchDoLink(c.href)} className="group flex h-full min-h-[44px] flex-col p-4">
                  <span className={`flex items-baseline justify-between gap-3 font-serif text-lg leading-snug text-carvao ${a.hover}`}>
                    {c.nome}
                    <span aria-hidden="true" className="font-sans text-sm text-mineral">→</span>
                  </span>
                  {c.destaques.length > 0 && (
                    <span className="mt-1 text-sm leading-relaxed text-carvao">
                      {c.destaques.join(", ")}
                      {c.mais ? " e outros" : ""}
                    </span>
                  )}
                  <span className="mt-1 text-xs text-mineral">{c.origens}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {porta.lacunas.length > 0 && (
        <section aria-labelledby="lacunas-titulo" className="border-t border-linha bg-marfim">
          <div className="mx-auto grid max-w-page gap-6 px-6 py-12 lg:grid-cols-12 lg:gap-8">
            <h2 id="lacunas-titulo" className="font-serif text-2xl leading-tight text-carvao lg:col-span-4">
              O que ainda não respondemos
            </h2>
            <div className="lg:col-span-8">
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Perguntas deste tema que a plataforma não cobre hoje. Elas não aparecem como resposta até que exista
                base oficial integrada e conferida.
              </p>
              <ul className="mt-4 space-y-2 text-base leading-relaxed text-carvao">
                {porta.lacunas.map((l) => (
                  <li key={l} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.7rem] h-px w-4 shrink-0 bg-mineral" />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="outras-titulo" className="border-t border-linha">
        <div className="mx-auto max-w-page px-6 py-12">
          <h2 id="outras-titulo" className="rotulo text-mineral">Outras perguntas</h2>
          <ul className="mt-4 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-5">
            {outras.map((o) => (
              <li key={o.id} className="bg-papel">
                <Link href={rotaPorta(o.id)} className="group flex h-full min-h-[44px] flex-col p-4">
                  <span className="rotulo text-mineral">{o.nome}</span>
                  <span className="mt-2 font-serif text-base leading-snug text-carvao group-hover:underline">{o.pergunta}</span>
                </Link>
              </li>
            ))}
          </ul>
          <details className="mt-10 border-t border-linha pt-4">
            <summary className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">
              Método e fontes
            </summary>
            <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Os números desta página são lidos, na publicação do site, das mesmas bases que alimentam os painéis. Cada
              um traz o período da própria fonte, que pode diferir entre eles. Quando uma base não pode ser lida, o número
              aparece como indisponível, nunca como zero. Conceitos, cobertura e limites estão nas páginas de método:
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {porta.metodos.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">
                    {m.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    </main>
  );
}
