import { LITERAIS, ROTULO_PAPEL, type ClasseLiteral } from "@/lib/literais-fonte";

/**
 * Literal preservado exatamente como está: valor ou trecho da fonte, ou identificador gerado pelo
 * observatório. Contrato em src/lib/literais-fonte.ts, verificado sobre o HTML gerado.
 *
 * O rótulo visível diz o que o texto é e de onde vem; `origem` (https ou caminho do site) fica em
 * `data-origem` e identifica o recurso de onde o literal foi tirado. O conteúdo é texto escapado,
 * copiável e nunca interpretado como HTML.
 */
export function LiteralFonte({ classe, origem, children, bloco = false }: { classe: ClasseLiteral; origem: string; children: string; bloco?: boolean }) {
  const def = LITERAIS[classe];
  const Valor = def.papel === "citacao" ? "q" : "code";
  return (
    <span data-literal-fonte={classe} data-origem={origem} className={bloco ? "block" : "inline"}>
      <span data-literal-rotulo="" className="rotulo mr-1 text-[0.62rem] text-mineral">
        {ROTULO_PAPEL[def.papel]} · {def.fonteCurta}
      </span>
      <Valor data-literal-valor="" className="[overflow-wrap:anywhere] bg-papel px-1 font-mono text-[0.8rem] font-normal not-italic text-carvao">
        {children}
      </Valor>
    </span>
  );
}
