import type { ReactNode } from "react";

/**
 * Resposta curta de um painel em duas camadas. O veredito, em palavras simples e com no máximo um ou dois números,
 * fica sempre à vista e responde à pergunta do título. Os números por trás (contagens, períodos, tolerâncias,
 * exceções) ficam em Analisar e Auditar, na mesma ordem em que o texto completo sempre foi escrito, e continuam no
 * HTML do servidor: a leitura sem JavaScript, a impressão e a busca do navegador não perdem nada.
 *
 * O elemento externo leva o atributo data-resposta do painel (a coleta e os testes o procuram), e só ele é anunciado
 * como região viva quando a resposta muda com a escolha do leitor.
 */
export function RespostaCurta({
  id,
  veredito,
  children,
  vivo = false,
  atributo = "data-resposta",
  tamanho = "base",
}: {
  id: string;
  veredito: string;
  children: ReactNode;
  vivo?: boolean;
  atributo?: string;
  tamanho?: "base" | "sm";
}) {
  const marca = { [atributo]: id } as Record<string, string>;
  return (
    <div {...marca} aria-live={vivo ? "polite" : undefined} className="max-w-prose2">
      <p className={tamanho === "sm" ? "text-sm leading-relaxed text-carvao" : "text-base leading-relaxed text-carvao"}>{veredito}</p>
      <div data-nivel="analisar" className="mt-3 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted">
        <p className="rotulo mb-1 text-mineral">Os números por trás da resposta</p>
        {children}
      </div>
    </div>
  );
}
