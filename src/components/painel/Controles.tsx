import { tx } from "@/lib/painel/idioma";
import type { ControlesProps } from "@/lib/painel/tipos";

/**
 * Controles de um bloco do painel (fatia `controles` do PaginaPainel): sempre imediatamente antes do conteúdo que afetam, nunca
 * flutuando no topo da página. Cada controle traz o próprio `<label>` visível; o grupo tem nome acessível, o resumo do recorte em
 * vigor ("Mostrando 26 capitais, exercício 2025") numa região de status e, quando o recorte não é o padrão, o link para limpar.
 *
 * O recorte vive na URL (src/lib/painel/recorte.ts): o servidor lê os parâmetros e o HTML já sai no recorte pedido, e o link
 * copiado reproduz a página. Sem JavaScript vale o recorte padrão.
 */
export function Controles({ rotulo, children, limpar, resumo, idioma }: ControlesProps) {
  return (
    <div role="group" aria-label={rotulo} data-fatia="controles" className="flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-linha py-3">
      {children}
      {(resumo || limpar) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          {resumo && (
            <p role="status" className="t-meta text-carvao-muted" data-resumo-controles="">
              {resumo}
            </p>
          )}
          {limpar && (
            <a href={limpar.href} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
              {tx("Limpar o recorte", "Clear the selection", idioma)}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
