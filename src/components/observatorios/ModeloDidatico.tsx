import type { ReactNode } from "react";

/** Ao menos um item: o tipo não deixa um modelo didático sair sem dizer o que ele não representa. */
export type ListaDeFora = readonly [ReactNode, ...ReactNode[]];

/**
 * Envelope único dos modelos didáticos das entradas (fatia "Artefato" de EntradaColecao; Iniciativa 4 do parecer de UX de
 * 21/10/2026): o rótulo fixo "Modelo didático", o título, o corpo e a lista obrigatória "O que este modelo deixa de fora".
 * "Laboratório ilustrativo", "cenário hipotético" e afins passam a vir neste envelope, para o leitor reconhecer sempre do
 * mesmo jeito que aquilo é uma simplificação do mecanismo, não o dado de um caso real.
 */
export function ModeloDidatico({
  id,
  titulo,
  descricao,
  deixaDeFora,
  children,
  fundo = "marfim",
  largo = false,
}: Readonly<{
  /** Base dos ids (título e lista), única na página. */
  id: string;
  titulo: ReactNode;
  /** O que o modelo mostra, em uma ou duas frases. */
  descricao?: ReactNode;
  deixaDeFora: ListaDeFora;
  children: ReactNode;
  fundo?: "marfim" | "papel";
  /** Corpo sem o contêiner de página (o artefato já traz a própria grade). */
  largo?: boolean;
}>) {
  const cabeca = (
    <>
      <p className="rotulo text-mineral" data-modelo-rotulo="">
        Modelo didático
      </p>
      <h2 id={`${id}-titulo`} className="mt-3 max-w-3xl font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">
        {titulo}
      </h2>
      {descricao && <div className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{descricao}</div>}
    </>
  );
  const fora = (
    <div className="mt-8 max-w-prose2 border-t border-linha pt-5 md:mt-10" data-deixa-de-fora="">
      <h3 id={`${id}-fora`} className="rotulo text-mineral">
        O que este modelo deixa de fora
      </h3>
      <ul aria-labelledby={`${id}-fora`} className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted">
        {deixaDeFora.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <section aria-labelledby={`${id}-titulo`} data-modelo-didatico="" className={`border-y border-linha ${fundo === "marfim" ? "bg-marfim" : "bg-papel"}`}>
      {largo ? (
        <>
          <div className="mx-auto max-w-page px-6 pt-10 md:pt-16">{cabeca}</div>
          {children}
          <div className="mx-auto max-w-page px-6 pb-10 md:pb-16">{fora}</div>
        </>
      ) : (
        <div className="mx-auto max-w-page px-6 py-10 md:py-16">
          {cabeca}
          <div className="mt-8 md:mt-10">{children}</div>
          {fora}
        </div>
      )}
    </section>
  );
}
