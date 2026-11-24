import Link from "next/link";
import { SEM_DADO, variacao } from "@/lib/varejo/formato";
import { MicroSerie } from "./Miniaturas";

export type EtiquetaDeGondola = {
  id: string;
  nome: string;
  /** O que se vende, em uma linha. */
  descricao?: string | null;
  /** O número da etiqueta (variação, em %) e o que ele mede. Ausente: `estado` diz por quê. */
  valor: number | null;
  medida: string;
  /** Texto do estado quando não há número ("sem atividade equivalente na pesquisa"). */
  estado?: string;
  /** Trajetória recente, para o minigráfico (decorativo: o número está escrito). */
  serie?: readonly (number | null)[];
  href: string;
  selecionado?: boolean;
};

/**
 * Prateleira de segmentos: cada segmento é uma etiqueta de gôndola, com o nome no lugar do produto, o que se vende em uma linha, a
 * trajetória recente e, no lugar do preço, o número do período. As etiquetas de uma fileira dividem o mesmo trilho (o filete escuro
 * de baixo), como numa prateleira. Cada etiqueta é um link que abre o segmento; a escolhida fica invertida. Etiqueta sem número diz
 * o motivo no lugar dele, nunca zero. No celular, uma etiqueta por linha, com o número à direita.
 */
export function Prateleira({ etiquetas, rotulo }: Readonly<{ etiquetas: readonly EtiquetaDeGondola[]; /** Nome acessível da lista. */ rotulo: string }>) {
  return (
    <ul aria-label={rotulo} className="grid sm:grid-cols-2 lg:grid-cols-3" data-figura-varejo="prateleira">
      {etiquetas.map((e) => (
        <li key={e.id} className="border-b-[3px] border-carvao pt-3" data-etiqueta={e.id}>
          <Link
            href={e.href}
            prefetch={false}
            aria-current={e.selecionado ? "true" : undefined}
            className={`group mr-px flex h-full min-h-[44px] items-stretch gap-4 border border-b-0 border-linha px-4 py-3 transition-transform duration-150 ease-out motion-safe:active:scale-[0.985] sm:flex-col sm:gap-3 ${
              e.selecionado ? "bg-carvao text-papel" : "bg-superficie text-carvao [@media(hover:hover)]:hover:bg-marfim"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-lg leading-snug">{e.nome}</span>
              {e.descricao && <span className={`mt-1 block text-sm leading-snug ${e.selecionado ? "text-papel" : "text-carvao-muted"}`}>{e.descricao}</span>}
            </span>
            <span className="flex w-[7.5rem] shrink-0 flex-col justify-end sm:w-full sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              {e.serie && e.valor !== null && <MicroSerie valores={e.serie} cor={e.selecionado ? "var(--cor-papel)" : undefined} altura={30} className="mb-2 w-full sm:mb-1 sm:max-w-[9rem]" />}
              <span className="block text-right sm:shrink-0">
                {e.valor === null ? (
                  <span className={`block text-xs leading-snug ${e.selecionado ? "text-papel" : "text-carvao-muted"}`}>{e.estado ?? SEM_DADO}</span>
                ) : (
                  <>
                    <span className="numero-m block tabular-nums">{variacao(e.valor)}</span>
                    <span className={`block text-xs leading-snug ${e.selecionado ? "text-papel" : "text-carvao-muted"}`}>{e.medida}</span>
                  </>
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
