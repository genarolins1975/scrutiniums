import Link from "next/link";
import type { DominioId } from "@/lib/dominios";
import { Nome } from "@/components/i18n/Nome";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { hrefNoIdioma } from "@/lib/i18n-href";

/**
 * Abas dos observatórios: mesmos destinos e rótulos da barra de Crédito
 * (public/obs/index.html), dos cabeçalhos de cada observatório e do cabeçalho
 * público. Fonte única para que as abas não divirjam entre as páginas. Os rótulos são nomes próprios dos observatórios: em inglês
 * ficam em português, marcados com Nome, e o link leva à irmã /en quando ela existe.
 */
export const ABAS_OBSERVATORIOS: { id: DominioId; href: string; rotulo: string }[] = [
  { id: "credito", href: "/observatorio", rotulo: "Crédito" }, // i18n: dado (nome próprio)
  { id: "energia", href: "/setor-eletrico", rotulo: "Setor Elétrico" }, // i18n: dado (nome próprio)
  { id: "eficiencia", href: "/eficiencia-estatal", rotulo: "Eficiência Estatal" }, // i18n: dado (nome próprio)
  { id: "contas", href: "/contas-publicas", rotulo: "Contas Federais" },
  { id: "estados", href: "/contas-publicas-estaduais", rotulo: "Contas Estaduais" },
  { id: "saneamento", href: "/saneamento", rotulo: "Saneamento" }, // i18n: dado (nome próprio)
  { id: "gas", href: "/gas-natural", rotulo: "Gás Natural" }, // i18n: dado (nome próprio)
];

export function NavegacaoObservatorios({ atual }: { atual: DominioId }) {
  const idioma = idiomaEnergia();
  return <nav aria-label={tx("Observatórios da Scrutiniums", "Scrutiniums observatories", idioma)} className="obs-dominios">
    {ABAS_OBSERVATORIOS.map(({ id, href, rotulo }) => <Link key={id} href={hrefNoIdioma(href, idioma)} prefetch={false} aria-current={atual === id ? "true" : undefined}><Nome>{rotulo}</Nome></Link>)}
  </nav>;
}
