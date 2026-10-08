"use client";

import { useId, useRef } from "react";
import type { FichaIndicador } from "@/lib/eficiencia/tipos";
import { FichaConteudo, type ContextoFicha } from "./FichaConteudo";

/**
 * Passaporte do indicador em diálogo nativo (showModal: foco preso, Esc
 * fecha, fundo inerte). Abrir e fechar não toca na URL nem nos filtros: o
 * recorte em exibição continua o mesmo ao voltar.
 */
export function Passaporte({
  f,
  ctx,
  rotulo = "Passaporte",
}: {
  f: FichaIndicador;
  ctx: ContextoFicha;
  rotulo?: string;
  /** Mantido por compatibilidade: todos os botões têm agora a mesma altura mínima de 44 px. */
  compacto?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="rotulo inline-flex min-h-[44px] items-center gap-1.5 text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta"
      >
        <span aria-hidden="true">ⓘ</span> {rotulo}
        <span className="sr-only">: {f.nome}</span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby={tituloId}
        className="m-0 ml-auto h-full max-h-none w-full max-w-none bg-superficie p-0 text-obee-tinta backdrop:bg-obee-tinta/40 sm:max-w-2xl"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-linha px-6 py-5">
            <div>
              <p className="rotulo text-mineral">Passaporte do indicador</p>
              <h2 id={tituloId} className="mt-2 font-serif text-xl leading-snug">
                {f.nome}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rotulo min-h-[44px] min-w-[44px] text-mineral hover:text-obee-tinta"
              aria-label="Fechar passaporte"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-2" tabIndex={0} role="region" aria-label={`Passaporte: ${f.nome}`}>
            <FichaConteudo f={f} ctx={ctx} />
          </div>
        </div>
      </dialog>
    </>
  );
}
