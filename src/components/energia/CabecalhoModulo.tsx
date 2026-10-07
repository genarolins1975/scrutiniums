import type { ReactNode } from "react";
import { legendaDeSiglas } from "@/lib/energia/siglas";

/** Abertura padrão das páginas de módulo: rótulo, pergunta e síntese curta. */
export function CabecalhoModulo({
  rotulo,
  titulo,
  children,
  referencia,
  siglas,
}: {
  rotulo: string;
  titulo: string;
  children?: ReactNode;
  referencia?: ReactNode;
  /** Siglas da página que o leitor encontra sem explicação no texto; o nome por extenso vem de `SIGLAS`. */
  siglas?: readonly string[];
}) {
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
      <LegendaDeSiglas siglas={siglas} />
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

/** Legenda curta com o nome por extenso das siglas da página, logo abaixo do título e das fontes. */
export function LegendaDeSiglas({ siglas }: { siglas?: readonly string[] }) {
  const legenda = siglas ? legendaDeSiglas(siglas) : "";
  if (!legenda) return null;
  return (
    <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-mineral" data-siglas="true">
      <span className="font-medium text-carvao-muted">Siglas: </span>
      {legenda}.
    </p>
  );
}
