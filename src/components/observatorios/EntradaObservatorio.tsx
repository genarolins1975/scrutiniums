import Link from "next/link";
import { ACENTO } from "@/components/home/acentos";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import type { ReactNode } from "react";
import type { Dominio } from "@/lib/dominios";

export type ColecaoEntrada = {
  id: string;
  nome: string;
  href: string;
  /** Painéis que a coleção mantém e atalhos para painéis de outro observatório, com a coleção de origem. */
  paineis: { titulo: string; href: string; origem?: string }[];
};

export function Numero({ n, grande = false }: Readonly<{ n: NumeroPorta; grande?: boolean }>) {
  return (
    <>
      {n.valor === null ? (
        <span className="block text-base text-carvao">Indisponível nesta publicação</span>
      ) : (
        <span className="block">
          <span className={`font-label leading-none tabular-nums text-carvao ${grande ? "text-[2.1rem]" : "text-[1.35rem]"}`}>{n.valor}</span>{" "}
          <span className="text-sm text-carvao-muted">{n.unidade}</span>
        </span>
      )}
      <span className="mt-2 block text-xs leading-relaxed text-mineral">
        {n.fonte} · {n.periodo}
      </span>
    </>
  );
}

/**
 * Entrada com conta de um observatório que reúne várias coleções, pelo
 * checklist de página de entrada: pergunta e escala na primeira tela,
 * coleções a um clique, um modelo didático do mecanismo, caminhos por
 * pergunta e método recolhido no fim.
 */
export function EntradaObservatorio({
  nomeCurto, nomeCompleto, acento, pergunta, descricao, escala, colecoes, artefato, caminhos, metodo,
}: Readonly<{
  nomeCurto: string;
  nomeCompleto: string;
  acento: Dominio["acento"];
  pergunta: string;
  descricao: string;
  escala: NumeroPorta[];
  colecoes: ColecaoEntrada[];
  artefato: ReactNode;
  caminhos: { pergunta: string; resumo: string; href: string; colecao: string }[];
  metodo: ReactNode;
}>) {
  const a = ACENTO[acento];
  return (
    <main className="bg-papel">
      <section aria-labelledby="entrada-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-16 md:pt-14">
          <nav aria-label="Trilha" className="text-sm text-carvao-muted">
            <Link href="/app/observatorios" className="underline decoration-linha underline-offset-4 hover:text-carvao">
              Observatórios
            </Link>
            <span aria-hidden="true" className="mx-2 text-mineral">/</span>
            <span aria-current="page">{nomeCurto}</span>
          </nav>
          <p className="rotulo mt-8 flex items-center gap-3 text-mineral">
            <span aria-hidden="true" className={`h-[3px] w-8 ${a.filete}`} />
            {nomeCompleto}
          </p>
          <h1 id="entrada-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            {pergunta}
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">{descricao}</p>
          <h2 className="sr-only">O tema em números</h2>
          <dl className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
            {escala.map((n) => (
              <div key={n.rotulo} className="flex flex-col bg-papel p-5">
                <dt className="text-sm leading-snug text-carvao-muted">{n.rotulo}</dt>
                <dd className="mt-2"><Numero n={n} grande /></dd>
                {n.nota && <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{n.nota}</dd>}
                <dd className="mt-auto pt-3">
                  <Link href={n.href} prefetch={false} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4">
                    Ver no painel
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-mineral">
            Os números vêm de fontes e períodos diferentes e não se somam nem se comparam entre si.
          </p>
        </div>
      </section>

      <section aria-labelledby="colecoes-titulo" className="mx-auto max-w-page px-6 py-14 md:py-16">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <h2 id="colecoes-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">As coleções</h2>
            <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Os painéis do observatório, agrupados pelo que cada um responde. Os marcados com a origem são mantidos por
              outro observatório e aparecem aqui como atalho.
            </p>
          </div>
          <div className="grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:col-span-8">
            {colecoes.map((c, i) => (
              <section
                key={c.id}
                aria-labelledby={`colecao-${c.id}`}
                className={`bg-papel p-5 ${i === colecoes.length - 1 && colecoes.length % 2 === 1 ? "sm:col-span-2" : ""}`}
              >
                <h3 id={`colecao-${c.id}`} className="font-serif text-xl leading-snug text-carvao">
                  <Link href={c.href} prefetch={false} className="hover:underline">{c.nome}</Link>
                </h3>
                <ul className="mt-3 space-y-1">
                  {c.paineis.map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} prefetch={false} className="group flex min-h-[44px] items-baseline justify-between gap-3 border-t border-linha py-2 text-sm text-carvao">
                        <span className="group-hover:underline">{p.titulo}</span>
                        {p.origem && <span className="shrink-0 text-xs text-mineral">{p.origem}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>

      {artefato}

      <section aria-labelledby="caminhos-titulo" className="mx-auto max-w-page px-6 py-14 md:py-16">
        <h2 id="caminhos-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Perguntas para começar</h2>
        <ul className="mt-6 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-3">
          {caminhos.map((c, i) => (
            // o último item ocupa o que sobra da linha, em duas e em três colunas, para não deixar célula vazia
            <li key={c.href} className={`bg-papel ${i === caminhos.length - 1 ? `${caminhos.length % 2 === 1 ? "sm:col-span-2" : ""} ${caminhos.length % 3 === 2 ? "lg:col-span-2" : caminhos.length % 3 === 1 ? "lg:col-span-3" : "lg:col-span-1"}` : ""}`}>
              <Link href={c.href} prefetch={false} className="group flex h-full min-h-[44px] flex-col p-5">
                <span className="rotulo text-mineral">{c.colecao}</span>
                <span className={`mt-2 font-serif text-lg leading-snug text-carvao ${a.hover}`}>{c.pergunta}</span>
                <span className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.resumo}</span>
              </Link>
            </li>
          ))}
        </ul>

        <details className="mt-12 border-t border-linha pt-4">
          <summary className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método e fontes</summary>
          <div className="mt-2 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">{metodo}</div>
        </details>
      </section>
    </main>
  );
}
