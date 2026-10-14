import Link from "next/link";
import { NavegacaoObservatorios } from "@/components/observatorios/NavegacaoObservatorios";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { LogoMark } from "@/components/ui/Logo";
import { GRUPOS_GAS, PAGINAS_GAS } from "@/lib/gas/navegacao";

/**
 * Cabeçalho do Observatório Brasileiro de Gás Natural: marca, seletor de observatório, abas dos observatórios e a
 * navegação por pergunta em quatro grupos. Renderizado no servidor; sem JavaScript. A página atual leva aria-current.
 * No celular os grupos viram uma faixa rolável só na própria faixa, nunca na página.
 */
export function CabecalhoGas({ atual }: { atual: string }) {
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="ed-pagina flex flex-wrap items-center justify-between gap-x-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2.5 sm:justify-start">
            <LogoMark size={20} />
            <span className="hidden font-serif text-base uppercase tracking-wide2 text-carvao sm:inline">Scrutiniums</span>
          </Link>
          <span aria-hidden="true" className="h-5 w-px bg-linha" />
          <SwitcherObservatorio atual="gas" />
        </div>
        <NavegacaoObservatorios atual="gas" />
      </div>
      <nav aria-label="Navegação do Observatório de Gás Natural" className="border-t border-linha">
        <div className="ed-pagina">
          <ul className="-mx-1 flex gap-x-1 overflow-x-auto py-1 [scrollbar-width:thin] lg:flex-wrap lg:overflow-visible">
            <li className="shrink-0">
              <Link
                href="/gas-natural"
                aria-current={atual === "inicial" ? "page" : undefined}
                className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-2 text-sm ${atual === "inicial" ? "border-gas text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
              >
                Mapa do observatório
              </Link>
            </li>
            {GRUPOS_GAS.map((g) => (
              <li key={g.id} className="flex shrink-0 items-center">
                <span className="rotulo hidden px-2 text-mineral lg:inline" aria-hidden="true">{g.rotulo}</span>
                <ul className="flex" aria-label={g.rotulo}>
                  {PAGINAS_GAS.filter((p) => p.grupo === g.id).map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={p.href}
                        prefetch={false}
                        aria-current={atual === p.slug ? "page" : undefined}
                        className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-2 text-sm ${atual === p.slug ? "border-gas text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
                      >
                        {p.rotulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
