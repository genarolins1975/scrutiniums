import Link from "next/link";
import type { CartaoLugar } from "@/lib/lugar/ficha";

/**
 * Grade de cartões da ficha do lugar: a mesma forma dos cartões do "Para você" (pergunta, resposta curta, número com
 * fonte e período, destino), com a coleção dona do número no alto. Cartão sem número diz por quê, no lugar do número.
 * Todo cartão marca a prova: `data-prova-numero` (fonte · período) ou `data-sem-numero` (o motivo).
 */
export function CartoesDoLugar({ id, titulo, descricao, cartoes, acao = "Abrir a ficha completa" }: Readonly<{ id: string; titulo: string; descricao: string; cartoes: CartaoLugar[]; acao?: string }>) {
  const colunas = cartoes.length % 4 === 0 ? "md:grid-cols-2 lg:grid-cols-4" : cartoes.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <section aria-labelledby={`${id}-titulo`} data-lugar-grupo={id} className="border-b border-linha">
      <div className="mx-auto max-w-page px-6 py-8 md:py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <h2 id={`${id}-titulo`} className="font-serif text-[clamp(1.5rem,2.6vw,1.9rem)] leading-tight text-carvao">
            {titulo}
          </h2>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{descricao}</p>
        </div>
        <ul className={`mt-6 grid gap-px border border-linha bg-linha ${colunas}`}>
          {cartoes.map((c) => (
            <li
              key={c.id}
              data-lugar-cartao={c.id}
              data-prova-numero={c.numero ? `${c.numero.fonte} · ${c.numero.periodo}` : undefined}
              data-sem-numero={c.numero ? undefined : (c.semNumero ?? "")}
              className="min-w-0 bg-papel"
            >
              <Link href={c.href} prefetch={false} className="group flex h-full min-h-[44px] flex-col p-4 sm:p-5 md:p-6">
                <span className="rotulo text-mineral">{c.colecao}</span>
                <span className="mt-2 font-serif text-lg leading-snug text-carvao group-hover:underline group-hover:decoration-linha group-hover:underline-offset-4">{c.pergunta}</span>
                <span className="mt-2 text-sm leading-relaxed text-carvao-muted">{c.resposta}</span>
                <span aria-hidden="true" className="grow" />
                {c.numero ? (
                  <span className="mt-4 block border-t border-linha pt-3">
                    <span className="block text-xs leading-snug text-carvao-muted">{c.numero.rotulo}</span>
                    {c.numero.valor === null ? (
                      <span className="mt-1 block text-base text-carvao">Indisponível nesta publicação</span>
                    ) : (
                      <span className="mt-1 block">
                        <span className="font-label text-[1.6rem] leading-none tabular-nums text-carvao">{c.numero.valor}</span>{" "}
                        <span className="text-sm text-carvao-muted">{c.numero.unidade}</span>
                      </span>
                    )}
                    <span className="mt-2 block text-xs leading-relaxed text-mineral">
                      {c.numero.fonte} · {c.numero.periodo}
                    </span>
                    {c.numero.nota && c.numero.valor !== null && <span className="mt-1 block text-xs leading-relaxed text-mineral">{c.numero.nota}</span>}
                  </span>
                ) : (
                  <span className="t-meta mt-4 block border-t border-linha pt-3 text-mineral">{c.semNumero}</span>
                )}
                <span className="flex flex-wrap items-center gap-x-1 pt-4 text-sm text-carvao">
                  <span className="underline decoration-linha underline-offset-4 group-hover:decoration-carvao">{acao}</span>
                  <span aria-hidden="true" className="text-mineral transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
