import Link from "next/link";
import type { ReactNode } from "react";
import { conceito } from "@/lib/energia/conteudo/conceitos";

/**
 * Glossário como parte da interface: a sigla abre uma dica curta (hover, foco
 * ou toque) e leva ao verbete completo. Verbete pendente de conferência não
 * mostra definição.
 */
export function Termo({ slug, children }: { slug: string; children: ReactNode }) {
  const c = conceito(slug);
  if (!c) return <>{children}</>;
  const href = `/setor-eletrico/aprenda/${c.slug}`;
  const dica = c.estado === "CONFERIDO" && c.emUmaFrase ? c.emUmaFrase : "Verbete em preparação: fonte primária ainda não conferida.";
  const id = `termo-${c.slug}`;
  return (
    <span className="termo relative inline">
      <Link
        href={href}
        aria-describedby={id}
        className="underline decoration-energia/50 decoration-dotted underline-offset-4 hover:decoration-energia"
      >
        {children}
      </Link>
      <span
        id={id}
        role="tooltip"
        className="termo-dica pointer-events-none absolute bottom-full left-0 z-40 mb-2 w-[min(18rem,80vw)] border border-linha bg-superficie p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-carvao shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
      >
        <span className="rotulo block text-mineral">
          {c.sigla ? `${c.sigla} · ` : ""}
          {c.nome}
        </span>
        <span className="mt-1 block">{dica}</span>
      </span>
    </span>
  );
}
