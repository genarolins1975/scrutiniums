import { tx } from "@/lib/painel/idioma";
import type { ParaLerProps } from "@/lib/painel/tipos";

export type { ItemParaLer } from "@/lib/painel/tipos";

/**
 * O glossário no ponto de uso (fatia `notas` do PaginaPainel): os conceitos e unidades que a página usa, cada um em uma ou duas
 * frases simples e, quando houver, com um exemplo calculado da base da página. Não substitui o verbete do glossário (o `Termo` leva
 * a ele). Sem estado: serve a componentes de servidor e de cliente.
 */
export function ParaLer({ id, titulo, itens, nivelTitulo = 2, nota }: ParaLerProps) {
  const T = nivelTitulo === 3 ? "h3" : "h2";
  return (
    <section id={id} aria-labelledby={`${id}-t`} data-glossario-uso={id} className="scroll-mt-28 border-y border-linha py-5">
      <T id={`${id}-t`} className="rotulo text-mineral">
        {titulo ?? tx("Para ler esta página", "How to read this page")}
      </T>
      <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((it, i) => (
          <div key={i} className="min-w-0">
            <dt className="text-sm font-medium text-carvao">{it.termo}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
              {it.definicao}
              {it.exemplo && <span className="mt-1 block text-carvao">{it.exemplo}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {nota && <p className="t-meta mt-4 max-w-prose2 text-carvao-muted">{nota}</p>}
    </section>
  );
}
