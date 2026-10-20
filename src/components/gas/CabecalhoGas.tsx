import { prefetchDoLink } from "@/lib/rotasPublicas";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { ParceriaTecnica } from "@/components/layout/ParceriaTecnica";
import { GRUPOS_GAS, PAGINAS_GAS } from "@/lib/gas/navegacao";

/**
 * Cabeçalho do Observatório Brasileiro de Gás Natural: a barra comum da plataforma (CabecalhoPlataforma: marca, seletor
 * de observatório, abas dos seis observatórios e conta) e, abaixo dela, a navegação por pergunta em quatro grupos,
 * renderizada no servidor e sem JavaScript. A página atual leva aria-current. No celular os grupos viram uma faixa rolável
 * só na própria faixa, nunca na página.
 */
export function CabecalhoGas({ atual }: { atual: string }) {
  return (
    <header className="border-b border-linha bg-superficie">
      <CabecalhoPlataforma colecao="gas" destinoConta="/gas-natural" />
      <nav aria-label="Navegação do Observatório de Gás Natural">
        <div className="ed-pagina">
          <ul className="-mx-1 flex gap-x-1 overflow-x-auto py-1 [scrollbar-width:thin] lg:flex-wrap lg:overflow-visible">
            <li className="shrink-0">
              <Link
                href="/gas-natural"
                prefetch={prefetchDoLink("/gas-natural")}
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
      {/* parceria técnica com o FGV CERI: a marca fecha o cabeçalho de todos os painéis de infraestrutura */}
      <ParceriaTecnica variante="faixa" />
    </header>
  );
}
