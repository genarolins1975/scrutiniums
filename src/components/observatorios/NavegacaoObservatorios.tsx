import Link from "next/link";
import type { DominioId } from "@/lib/dominios";

/**
 * Abas dos observatórios: mesmos destinos e rótulos da barra de Crédito
 * (public/obs/index.html), dos cabeçalhos de cada observatório e do cabeçalho
 * público. Fonte única para que as abas não divirjam entre as páginas.
 */
export const ABAS_OBSERVATORIOS: { id: DominioId; href: string; rotulo: string }[] = [
  { id: "credito", href: "/observatorio", rotulo: "Crédito" },
  { id: "energia", href: "/setor-eletrico", rotulo: "Setor Elétrico" },
  { id: "eficiencia", href: "/eficiencia-estatal", rotulo: "Eficiência Estatal" },
  { id: "contas", href: "/contas-publicas", rotulo: "Contas Federais" },
  { id: "estados", href: "/contas-publicas-estaduais", rotulo: "Contas Estaduais" },
  { id: "saneamento", href: "/saneamento", rotulo: "Saneamento" },
];

export function NavegacaoObservatorios({ atual }: { atual: DominioId }) {
  return <nav aria-label="Observatórios da Scrutiniums" className="obs-dominios">
    {ABAS_OBSERVATORIOS.map(({ id, href, rotulo }) => <Link key={id} href={href} prefetch={false} aria-current={atual === id ? "true" : undefined}>{rotulo}</Link>)}
  </nav>;
}
