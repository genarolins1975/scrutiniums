import type { ReactNode } from "react";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { TermoDica } from "@/components/evidencia/TermoDica";
import { tx } from "@/lib/energia/idioma";

/**
 * Glossário como parte da interface: a sigla abre uma dica curta (hover ou
 * foco; Esc fecha) e leva ao verbete completo. Verbete pendente de conferência
 * não mostra definição. A base de verbetes fica no servidor; o cliente recebe
 * só o texto da dica. O verbete vem no idioma da página (conceito(), do Aprenda).
 */
export function Termo({ slug, children, alvo = false }: { slug: string; children: ReactNode; alvo?: boolean }) {
  const c = conceito(slug);
  if (!c) return <>{children}</>;
  // com a frase em palavras simples, ela vem primeiro e a definição literal da fonte logo depois; sem ela, só a definição da fonte
  const dica =
    c.estado === "CONFERIDO" && c.emUmaFrase
      ? c.emPalavrasSimples
        ? tx(`${c.emPalavrasSimples} Na fonte: ${c.emUmaFrase}`, `${c.emPalavrasSimples} From the source: ${c.emUmaFrase}`)
        : c.emUmaFrase
      : tx("Verbete em preparação: fonte primária ainda não conferida.", "Entry in preparation: primary source not yet checked.");
  return (
    <TermoDica href={`/setor-eletrico/aprenda/${c.slug}`} rotulo={`${c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() ? `${c.sigla} · ` : ""}${c.nome}`} dica={dica} alvo={alvo}>
      {children}
    </TermoDica>
  );
}
