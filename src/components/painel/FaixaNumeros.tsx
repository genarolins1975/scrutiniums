import type { ReactNode } from "react";
import { tx } from "@/lib/painel/idioma";

/**
 * Faixa de números do painel (fatia `numeros` do PaginaPainel): de um a quatro NumeroIndicador lado a lado, separados por filetes,
 * sem cartões; dois por linha a 390 px. A nota vale para a faixa inteira (universo, regra de comparação) e fica junto dos números.
 * Os valores vêm dos mesmos seletores que alimentam o gráfico e a tabela da página: a faixa nunca calcula nada.
 */
export function FaixaNumeros({ children, rotulo, nota, idioma }: { children: ReactNode; rotulo?: string; nota?: ReactNode; idioma?: "pt" | "en" }) {
  const quantos = Array.isArray(children) ? children.filter(Boolean).length : 1;
  return (
    <section aria-label={rotulo ?? tx("Números principais da página", "Main figures on this page", idioma)} data-faixa-numeros="">
      <div className="faixa-numeros" data-quantos={Math.min(4, Math.max(1, quantos))}>
        {children}
      </div>
      {nota && <div className="t-meta mt-3 max-w-prose2 text-carvao-muted">{nota}</div>}
    </section>
  );
}
