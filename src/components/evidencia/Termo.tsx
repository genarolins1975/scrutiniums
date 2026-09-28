import type { ReactNode } from "react";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { TermoDica } from "@/components/evidencia/TermoDica";

/**
 * Glossário como parte da interface: a sigla abre uma dica curta (hover ou
 * foco; Esc fecha) e leva ao verbete completo. Verbete pendente de conferência
 * não mostra definição. A base de verbetes fica no servidor; o cliente recebe
 * só o texto da dica.
 */
export function Termo({ slug, children, alvo = false }: { slug: string; children: ReactNode; alvo?: boolean }) {
  const c = conceito(slug);
  if (!c) return <>{children}</>;
  const dica = c.estado === "CONFERIDO" && c.emUmaFrase ? c.emUmaFrase : "Verbete em preparação: fonte primária ainda não conferida.";
  return (
    <TermoDica href={`/setor-eletrico/aprenda/${c.slug}`} rotulo={`${c.sigla ? `${c.sigla} · ` : ""}${c.nome}`} dica={dica} alvo={alvo}>
      {children}
    </TermoDica>
  );
}
