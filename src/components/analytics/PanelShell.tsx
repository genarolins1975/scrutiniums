"use client";

import { useId, useState } from "react";

/**
 * Anatomia padrão de todo painel analítico:
 * título, descrição, período de referência, última atualização, fontes,
 * filtros, visualização, interpretação, metodologia, limitações e download.
 * Metodologia e limitações ficam em um drawer acessível que não ocupa
 * espaço permanente na tela.
 */
export type PanelMeta = {
  titulo: string;
  descricao: string;
  periodo: string;
  atualizadoEm: string;
  fontes: string[];
  unidade: string;
  interpretacao?: string;
  metodologia: string;
  limitacoes: string;
  glossarioSlug?: string;
};

export function PanelShell({
  meta,
  filtros,
  children,
  onDownload,
}: {
  meta: PanelMeta;
  filtros?: React.ReactNode;
  children: React.ReactNode;
  onDownload?: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();

  return (
    <section className="border border-linha bg-papel">
      <header className="border-b border-linha px-6 pb-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl text-carvao">{meta.titulo}</h2>
            <p className="mt-1 max-w-prose2 text-sm text-mineral">{meta.descricao}</p>
          </div>
          <div className="flex items-center gap-4">
            {onDownload && (
              <button
                onClick={onDownload}
                className="rotulo min-h-[44px] border border-linha px-4 text-carvao-muted hover:border-carvao hover:text-carvao"
              >
                Baixar dados
              </button>
            )}
            <button
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              onClick={() => setDrawerOpen((v) => !v)}
              className="rotulo min-h-[44px] border border-linha px-4 text-carvao-muted hover:border-bronze hover:text-bronze"
            >
              Metodologia
            </button>
          </div>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-xs text-mineral">
          <div className="flex gap-1.5">
            <dt className="rotulo">Período:</dt>
            <dd>{meta.periodo}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="rotulo">Unidade:</dt>
            <dd>{meta.unidade}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="rotulo">Atualizado em:</dt>
            <dd>{meta.atualizadoEm}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="rotulo">Fontes:</dt>
            <dd>{meta.fontes.join("; ")}</dd>
          </div>
        </dl>
      </header>

      {drawerOpen && (
        <div id={drawerId} className="border-b border-linha bg-marfim px-6 py-5">
          <h3 className="rotulo mb-2 text-bronze">Metodologia</h3>
          <p className="mb-4 max-w-prose2 text-sm text-carvao-muted">{meta.metodologia}</p>
          <h3 className="rotulo mb-2 text-bronze">Limitações</h3>
          <p className="max-w-prose2 text-sm text-carvao-muted">{meta.limitacoes}</p>
          {meta.glossarioSlug && (
            <a
              href={`/glossario#${meta.glossarioSlug}`}
              className="mt-4 inline-block text-sm text-bronze underline underline-offset-4"
            >
              Ver definição completa no glossário
            </a>
          )}
        </div>
      )}

      {filtros && <div className="border-b border-linha px-6 py-4">{filtros}</div>}

      <div className="px-6 py-6">{children}</div>

      {meta.interpretacao && (
        <footer className="border-t border-linha px-6 py-4">
          <p className="rotulo mb-1 text-mineral">Como interpretar</p>
          <p className="max-w-prose2 text-sm text-carvao-muted">{meta.interpretacao}</p>
        </footer>
      )}
    </section>
  );
}
