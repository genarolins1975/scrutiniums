import Link from "next/link";

/**
 * Aviso de que o tema tem um painel dono mais completo em outra coleção
 * (duplicatas resolvidas no registro, docs/observatorios/REAGRUPAMENTO.md).
 * A página continua publicada, sem perder conteúdo; o aviso leva ao painel dono.
 */
export function PainelMaisCompleto({ href, titulo, colecao, texto }: Readonly<{ href: string; titulo: string; colecao: string; texto: string }>) {
  return (
    <aside aria-label="Painel mais completo sobre este tema" className="my-6 max-w-prose2 border-l-4 border-carvao bg-papel p-4 text-sm leading-relaxed text-carvao">
      <p>
        <span className="font-semibold">Painel mais completo:</span>{" "}
        <Link href={href} prefetch={false} className="underline underline-offset-4">{titulo}</Link>, na coleção {colecao}. {texto}
      </p>
    </aside>
  );
}
