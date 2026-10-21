import type { ReactNode } from "react";

/**
 * Seção de análise dentro de um painel ou de uma página: linha fina em cima, pergunta (ou título) em serifa e o conteúdo. Substitui os
 * blocos `*Analise` e `*Auditoria` de cada módulo, que repetiam a mesma estrutura.
 *
 * `nivel` decide a partir de que nível de profundidade a seção aparece: omitido, aparece em todos (é um capítulo visível do Entender);
 * "analisar" e "auditar" ficam fora do Entender, pelo CSS do ModoProfundidade, e continuam no HTML do servidor. Gráficos que respondem a
 * uma pergunta própria da página não devem ficar atrás de Analisar: o Entender é a síntese com as comparações visuais, e o que é tabela
 * completa, regra por extenso, versão e arquivo vai para Analisar e Auditar.
 */
export function SecaoDoPainel({
  id,
  titulo,
  nivel,
  children,
  tracejada = false,
  lead,
}: {
  id?: string;
  titulo: ReactNode;
  nivel?: "analisar" | "auditar";
  children: ReactNode;
  /** Linha tracejada em vez de contínua, como nos blocos de auditoria. */
  tracejada?: boolean;
  /** Frase curta sob o título, quando a seção precisa dizer o que mostra antes da figura. */
  lead?: ReactNode;
}) {
  return (
    <section
      id={id}
      data-nivel={nivel}
      data-secao-painel=""
      aria-labelledby={id ? `${id}-titulo` : undefined}
      className={`scroll-mt-28 space-y-4 border-t pt-6 ${tracejada || nivel === "auditar" ? "border-dashed border-linha" : "border-linha"}`}
    >
      <h3 id={id ? `${id}-titulo` : undefined} className="ed-h3 font-serif text-carvao">
        {titulo}
      </h3>
      {lead && <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{lead}</p>}
      {children}
    </section>
  );
}
