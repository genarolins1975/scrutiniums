import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { PAGINAS_COMBUSTIVEIS, ROTA_CONSULTA_TANQUE } from "@/lib/combustiveis/paginas";
import { leva2Aprovada, prefetchDoLink } from "@/lib/rotasPublicas";
import { SeloComConta } from "@/components/acesso/SeloComConta";

/**
 * Cabeçalho da coleção Combustíveis: a barra comum da plataforma (CabecalhoPlataforma) com o Observatório de Energia e
 * Infraestrutura marcado e as fontes do domínio gas (a gold é do pipeline do Gás) e, abaixo, a navegação da coleção. A
 * consulta aberta por estado só aparece na navegação depois da aprovação do dono (LEVA_2, item quanto-custa-encher-o-tanque).
 */
export function CabecalhoCombustiveis({ atual }: { atual: string }) {
  const paginas = PAGINAS_COMBUSTIVEIS.filter((p) => p.href !== ROTA_CONSULTA_TANQUE || leva2Aprovada("quanto-custa-encher-o-tanque"));
  return (
    <header className="border-b border-linha bg-superficie">
      <CabecalhoPlataforma observatorio="energia-e-infraestrutura" destinoConta="/combustiveis" fontes={["gas"]} />
      <nav aria-label="Navegação da coleção Combustíveis">
        <div className="ed-pagina">
          <ul className="-mx-1 flex items-center gap-x-1 overflow-x-auto py-1 [scrollbar-width:thin]">
            <li className="shrink-0">
              <span className="rotulo hidden px-2 text-mineral sm:inline">Combustíveis</span>
            </li>
            {paginas.map((p) => (
              <li key={p.slug} className="shrink-0">
                <Link
                  href={p.href}
                  prefetch={prefetchDoLink(p.href)}
                  aria-current={atual === p.slug ? "page" : undefined}
                  className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-2 text-sm ${atual === p.slug ? "border-gas text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
                >
                  {p.rotulo}
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
