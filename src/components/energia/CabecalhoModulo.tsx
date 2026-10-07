import type { ReactNode } from "react";

/** Abertura padrão das páginas de módulo: rótulo, pergunta e síntese curta. */
export function CabecalhoModulo({ rotulo, titulo, children, referencia }: { rotulo: string; titulo: string; children?: ReactNode; referencia?: ReactNode }) {
  return (
    <header className="pb-6 pt-10 md:pt-14">
      <p className="rotulo text-mineral">{rotulo}</p>
      <h1 className="mt-3 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] text-carvao">{titulo}</h1>
      {children && <div className="mt-4 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">{children}</div>}
      {referencia && (
        <p className="mt-4 text-xs text-mineral">
          <span className="font-medium text-carvao-muted">Fontes e datas de referência: </span>
          {referencia}
        </p>
      )}
    </header>
  );
}

export function Bloco({ id, children, nivel }: { id?: string; children: ReactNode; nivel?: "analisar" | "auditar" }) {
  return (
    <div id={id} data-nivel={nivel} className="scroll-mt-28 py-6">
      {children}
    </div>
  );
}
