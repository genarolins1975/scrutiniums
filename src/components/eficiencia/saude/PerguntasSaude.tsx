"use client";

import Link from "next/link";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { CAMINHO_COMPARAR, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import type { PerguntaEntrada } from "./entradaSaude";
import { useBaseSaude } from "./ExploradorSaude";
import { useCapital } from "./PanoramaSaude";

/**
 * Perguntas para começar (checklist da página de entrada, item 4): cada pergunta leva à página que a responde, com a capital
 * escolhida, uma resposta curta e, quando o destino tem número, o número lido da mesma base, com recorte, período e fonte. A
 * comparação entre capitais, o destino mais procurado, abre a lista à vista; o método fecha a lista.
 */
export function PerguntasSaude({ itens, dados: dadosProp }: { itens: PerguntaEntrada[]; dados?: DadosSaude }) {
  const dados = useBaseSaude(dadosProp);
  const { cap } = useCapital(dados);
  const comCap = (p: Record<string, string>) => (cap ? { ...p, cap: cap.id } : p);
  const comparar = itens.find((i) => i.id === "comparar");
  const metodos = itens.find((i) => i.id === "metodos");
  const corpo = itens.filter((i) => i !== comparar && i !== metodos);
  return (
    <Recolhido id="perguntas-saude" titulo="Perguntas para começar" resumo="Cada pergunta leva à página que a responde, com a capital escolhida." aberto nivelTitulo={2}>
      <div data-perguntas-saude="">
        {comparar && (
          <Link
            href={hrefSaude(comparar.caminho, comCap(comparar.params))}
            className="inline-flex min-h-[44px] items-center gap-2 border border-carvao px-5 text-[0.9375rem] font-medium text-carvao hover:bg-papel active:scale-[0.98] motion-safe:transition-transform"
          >
            {comparar.pergunta}
            <span aria-hidden="true">→</span>
          </Link>
        )}
      <ul className="mt-6 grid gap-x-12 md:grid-cols-2">
        {corpo.map((p) => (
          <li key={p.id} className="border-t border-linha">
            <Link href={hrefSaude(p.caminho, comCap(p.params))} className="group block py-5 focus-visible:outline-offset-4" data-pergunta={p.id}>
              <span className="t-h3 block text-carvao underline decoration-linha decoration-1 underline-offset-[6px] group-hover:decoration-obee">
                {p.pergunta}
              </span>
              {p.numero && (
                <span className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="numero-m text-obee-dark">{p.numero}</span>
                  {p.prova && <span className="t-meta text-carvao-muted">{p.prova}</span>}
                </span>
              )}
              <span className="t-corpo mt-2 block max-w-prose2 text-carvao-muted">{p.resposta}</span>
            </Link>
          </li>
        ))}
      </ul>
      {metodos && (
        <p className="mt-2 border-t border-linha pt-4">
          <Link href={hrefSaude(metodos.caminho)} className="inline-flex min-h-[44px] items-center text-[0.9375rem] text-obee-dark underline underline-offset-4">
            {metodos.pergunta} {metodos.resposta}
          </Link>
        </p>
      )}
      </div>
    </Recolhido>
  );
}

/** O destino mais procurado a um clique, logo depois dos números: a comparação entre capitais, com a capital escolhida. */
export function AtalhoCompararSaude({ dados: dadosProp }: { dados?: DadosSaude }) {
  const dados = useBaseSaude(dadosProp);
  const { cap } = useCapital(dados);
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
      <Link
        href={hrefSaude(CAMINHO_COMPARAR, cap ? { cap: cap.id } : {})}
        className="inline-flex min-h-[44px] items-center gap-2 border border-carvao bg-carvao px-5 text-[0.9375rem] font-medium text-marfim hover:bg-carvao-soft active:scale-[0.98] motion-safe:transition-transform"
      >
        {cap ? `Comparar ${cap.nome} com outra capital` : "Comparar duas capitais"}
        <span aria-hidden="true">→</span>
      </Link>
      <a href="#perguntas-saude" className="inline-flex min-h-[44px] items-center text-[0.9375rem] text-obee-dark underline underline-offset-4">
        Ir às perguntas para começar
      </a>
    </p>
  );
}
