import type { ReactNode } from "react";
import { tx } from "@/lib/energia/idioma";

/**
 * Peças didáticas das páginas do Setor Elétrico (Onda 3: Carga, Rede e Minha região). Sem estado e sem "use client": servem a
 * componentes de servidor e de cliente. Os textos e números vêm de quem chama, lidos da mesma gold do gráfico ou do cartão ao lado;
 * aqui só há forma.
 *
 * - `ParaLer`: o glossário no ponto de uso. Os conceitos e unidades que a página usa logo abaixo, cada um em uma frase simples e,
 *   quando houver, com um exemplo calculado da gold da página. Não substitui o verbete do Aprenda (o `Termo` leva a ele).
 * - `LeituraGuiada`: uma frase factual sob um gráfico, calculada do mesmo contrato do gráfico, que diz onde olhar primeiro. Não
 *   atribui causa.
 * - `ModeloDidatico`: a moldura de um artefato do mecanismo, identificado como modelo didático, com o que ele deixa de fora e a fonte
 *   dos números que usa.
 */

/** ParaLer e LeituraGuiada moveram para o kit de painel (src/components/painel); este arquivo os reexporta até o PR 5 da Iniciativa 1. */
export { ParaLer } from "@/components/painel/ParaLer";
export { LeituraGuiada } from "@/components/painel/LeituraGuiada";
export type { ItemParaLer } from "@/lib/painel/tipos";

export function ModeloDidatico({
  id,
  titulo,
  intro,
  children,
  deixaDeFora,
  fonte,
  nivelTitulo = 2,
  rotuloModelo,
  rotuloFora,
  rotuloFonte,
}: {
  id: string;
  titulo: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  /** O que o modelo não mostra: sempre à vista, nunca em dica. */
  deixaDeFora: ReactNode[];
  /** Fonte e período dos números usados no modelo. */
  fonte: ReactNode;
  nivelTitulo?: 2 | 3;
  rotuloModelo?: string;
  rotuloFora?: string;
  rotuloFonte?: string;
}) {
  const T = nivelTitulo === 3 ? "h3" : "h2";
  return (
    <section id={id} aria-labelledby={`${id}-t`} data-modelo-didatico={id} className="scroll-mt-28 space-y-4 border border-linha bg-superficie p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <T id={`${id}-t`} className="ed-h3 font-serif text-carvao">
          {titulo}
        </T>
        <span className="rotulo border border-dashed border-mineral px-2 py-0.5 text-xs text-carvao-muted">{rotuloModelo ?? tx("Modelo didático", "Teaching model")}</span>
      </div>
      {intro && <div className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{intro}</div>}
      {children}
      <div className="grid gap-4 border-t border-linha pt-3 text-xs leading-relaxed text-carvao-muted md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <p className="rotulo text-mineral">{rotuloFora ?? tx("O que o modelo deixa de fora", "What the model leaves out")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {deixaDeFora.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
        <p>
          <span className="rotulo block text-mineral">{rotuloFonte ?? tx("Números do modelo", "Figures in the model")}</span>
          {fonte}
        </p>
      </div>
    </section>
  );
}
