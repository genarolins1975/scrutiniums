import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { colecoesDe } from "@/lib/observatorios/colecoes";
import { ROTA_CONSULTA_CIDADE, ROTA_INFLACAO, paginaInflacao } from "@/lib/inflacao/paginas";
import { leva2Aprovada, prefetchDoLink } from "@/lib/rotasPublicas";

/**
 * Cabeçalho da coleção Custo de vida no painel Inflação por cidade: a barra comum da plataforma (CabecalhoPlataforma) com o
 * Observatório das Famílias marcado e a fonte de frescor "inflacao" e, abaixo, a navegação da coleção, lida do registro
 * (src/lib/observatorios/colecoes.ts): o painel, a consulta por cidade (só depois da aprovação do dono, LEVA_2, item
 * quanto-subiu-o-custo-de-vida) e os demais painéis da coleção, inclusive os atalhos para os de outros observatórios.
 */
export function CabecalhoCustoDeVida({ atual }: { atual: "painel" | "na-minha-cidade" }) {
  const colecao = colecoesDe("familias").find((c) => c.id === "custo-de-vida");
  const consulta = leva2Aprovada("quanto-subiu-o-custo-de-vida") ? [{ titulo: paginaInflacao("na-minha-cidade").rotulo, href: ROTA_CONSULTA_CIDADE }] : [];
  const outros = (colecao?.paineis ?? []).filter((p) => p.href !== ROTA_INFLACAO);
  const itens = [{ titulo: paginaInflacao("painel").rotulo, href: ROTA_INFLACAO }, ...consulta, ...outros];
  const hrefAtual = atual === "painel" ? ROTA_INFLACAO : ROTA_CONSULTA_CIDADE;
  return (
    <header className="border-b border-linha bg-superficie">
      <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_INFLACAO} fontes={["inflacao"]} />
      <nav aria-label="Navegação da coleção Custo de vida">
        <div className="ed-pagina">
          <ul className="-mx-1 flex items-center gap-x-1 overflow-x-auto py-1 [scrollbar-width:thin]">
            <li className="shrink-0">
              <span className="rotulo hidden px-2 text-mineral sm:inline">Custo de vida</span>
            </li>
            {itens.map((p) => (
              <li key={p.href} className="shrink-0">
                <Link
                  href={p.href}
                  prefetch={prefetchDoLink(p.href)}
                  aria-current={p.href === hrefAtual ? "page" : undefined}
                  className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-2 text-sm ${p.href === hrefAtual ? "border-bronze text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
                >
                  {p.titulo}
                  <SeloComConta href={p.href} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
