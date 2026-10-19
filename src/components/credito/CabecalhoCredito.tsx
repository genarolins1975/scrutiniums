import Link from "next/link";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { PAGINAS_CREDITO, PAINEL_JUROS, type PaginaCredito } from "@/lib/credito/navegacao";

/**
 * Cabeçalho das páginas Next do Crédito: a barra comum da plataforma (CabecalhoPlataforma, com o Crédito no
 * Observatório da Economia) e, abaixo, a navegação do módulo: a apresentação, as consultas, o painel de juros e o
 * método. Renderizado no servidor, sem JavaScript; no celular a faixa rola só nela mesma.
 */
export function CabecalhoCredito({ atual }: { atual: PaginaCredito["slug"] }) {
  const pagina = PAGINAS_CREDITO.find((p) => p.slug === atual);
  const itens: { href: string; rotulo: string; slug?: string }[] = [
    { href: "/observatorio-do-credito", rotulo: "Crédito" },
    ...PAGINAS_CREDITO.filter((p) => p.slug !== "metodologia").map((p) => ({ href: p.href, rotulo: p.rotulo, slug: p.slug })),
    { href: PAINEL_JUROS, rotulo: "Juros por instituição" },
    { href: "/observatorio", rotulo: "Painel completo" },
    ...PAGINAS_CREDITO.filter((p) => p.slug === "metodologia").map((p) => ({ href: p.href, rotulo: p.rotulo, slug: p.slug })),
  ];
  return (
    <header className="border-b border-linha bg-superficie">
      <CabecalhoPlataforma colecao="credito" destinoConta={pagina?.href ?? "/observatorio-do-credito"} />
      <nav aria-label="Navegação do Observatório de Crédito">
        <div className="ed-pagina">
          <ul className="-mx-1 flex gap-x-1 overflow-x-auto py-1 [scrollbar-width:thin] lg:flex-wrap lg:overflow-visible">
            {itens.map((i) => (
              <li key={i.href} className="shrink-0">
                <Link
                  href={i.href}
                  prefetch={prefetchDoLink(i.href)}
                  aria-current={i.slug === atual ? "page" : undefined}
                  className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-2 text-sm ${i.slug === atual ? "border-bronze text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
                >
                  {i.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
