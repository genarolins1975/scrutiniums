import type { ReactNode } from "react";
import type { Idioma } from "@/lib/idioma";

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
  idioma = "pt",
  recolhido = false,
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
  /** Idioma do rótulo e do título da lista (só o Setor Elétrico tem irmã inglesa). */
  idioma?: Idioma;
  /**
   * O corpo num <details> "Abrir o modelo": o título, a descrição e o que o modelo deixa de fora seguem à vista, e o corpo inteiro
   * fica no HTML. É como a entrada cabe no orçamento de comprimento sem apagar o modelo (decisão do dono de 22/10/2026: seguir
   * sempre o padrão de comprimento).
   */
  recolhido?: boolean;
}>) {
  const en = idioma === "en";
  const cabeca = (
    <>
      <p className="rotulo text-mineral" data-modelo-rotulo="">
        {en ? "Teaching model" : "Modelo didático"}
      </p>
      <h2 id={`${id}-titulo`} className="mt-3 max-w-3xl font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">
        {titulo}
      </h2>
      {descricao && <div className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{descricao}</div>}
    </>
  );
  const fora = (classe = "mt-8 md:mt-10") => (
    <div className={`${classe} max-w-prose2 border-t border-linha pt-5`} data-deixa-de-fora="">
      <h3 id={`${id}-fora`} className="rotulo text-mineral">
        {en ? "What this model leaves out" : "O que este modelo deixa de fora"}
      </h3>
      <ul aria-labelledby={`${id}-fora`} className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted">
        {deixaDeFora.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
  const abrir = (corpo: ReactNode, conteiner: string) => (
    <details className={`group/modelo ${conteiner}`} data-modelo-recolhido="">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-3 border border-carvao px-4 text-sm font-medium text-carvao hover:bg-papel [&::-webkit-details-marker]:hidden">
        <span className="group-open/modelo:hidden">{en ? "Open the model" : "Abrir o modelo"}</span>
        <span className="hidden group-open/modelo:inline">{en ? "Close the model" : "Fechar o modelo"}</span>
        <span aria-hidden="true" className="motion-safe:transition-transform group-open/modelo:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-8">{corpo}</div>
    </details>
  );
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} data-modelo-didatico="" className={`border-y border-linha ${fundo === "marfim" ? "bg-marfim" : "bg-papel"}`}>
      {recolhido ? (
        // no desktop, o que o modelo deixa de fora fica ao lado do título e o modelo aberto ocupa a largura toda, embaixo
        <div className="mx-auto grid max-w-page gap-x-12 px-6 py-10 md:py-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="lg:col-start-1 lg:row-start-1">{cabeca}</div>
          {abrir(children, "mt-6 lg:col-span-2 lg:row-start-2")}
          {fora("mt-8 md:mt-10 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:self-end")}
        </div>
      ) : largo ? (
        <>
          <div className="mx-auto max-w-page px-6 pt-10 md:pt-16">{cabeca}</div>
          {children}
          <div className="mx-auto max-w-page px-6 pb-10 md:pb-16">{fora()}</div>
        </>
      ) : (
        <div className="mx-auto max-w-page px-6 py-10 md:py-16">
          {cabeca}
          <div className="mt-8 md:mt-10">{children}</div>
          {fora()}
        </div>
      )}
    </section>
  );
}
