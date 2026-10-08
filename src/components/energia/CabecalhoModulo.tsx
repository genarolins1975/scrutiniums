import type { ReactNode } from "react";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";

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
    <header className="cab-modulo">
      <p className="rotulo text-mineral">{rotulo}</p>
      <h1 className="mt-3 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] text-carvao">{titulo}</h1>
      {children && <div className="cab-lead max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">{children}</div>}
      {referencia && (
        <p className="cab-ref text-xs text-mineral">
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

/** Legenda de siglas: lista da página no servidor, derivada do texto à vista depois da hidratação (LegendaSiglas). */
export { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
