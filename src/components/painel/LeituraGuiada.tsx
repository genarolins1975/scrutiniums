import type { ReactNode } from "react";
import { tx } from "@/lib/painel/idioma";

/**
 * Uma frase factual sob o gráfico, calculada do mesmo contrato do gráfico, que diz onde olhar primeiro. Não atribui causa. Vive dentro
 * da FiguraAnalitica (prop `leitura`). Sem estado: serve a componentes de servidor e de cliente.
 */
export function LeituraGuiada({ children, rotulo, id }: { children: ReactNode; rotulo?: string; id?: string }) {
  return (
    <p data-leitura-guiada={id ?? ""} className="t-corpo max-w-prose2 border-l-2 border-destaque pl-3 text-carvao">
      <span className="rotulo mr-2 text-mineral">{rotulo ?? tx("Como ler", "How to read it")}</span>
      {children}
    </p>
  );
}
