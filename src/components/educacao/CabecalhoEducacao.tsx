import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { colecoesDe } from "@/lib/observatorios/colecoes";
import { ROTA_CAPITAIS, ROTA_EDUCACAO, TITULO_CAPITAIS } from "@/lib/educacao/paginas";
import { prefetchDoLink } from "@/lib/rotasPublicas";

/**
 * Cabeçalho da coleção Educação do Observatório dos Serviços Públicos no painel Educação nos municípios: a barra comum da
 * plataforma (CabecalhoPlataforma) com o observatório marcado e a fonte de frescor "educacao" e, abaixo, a navegação da
 * coleção, lida do registro (src/lib/observatorios/colecoes.ts): este painel primeiro, depois o painel das capitais.
 * `navegacao` é falso na versão aperitivo, que não leva a outras páginas (o convite do fim diz o que a conta acrescenta).
 */
export function CabecalhoEducacao({ navegacao = true }: { navegacao?: boolean }) {
  const colecao = colecoesDe("servicos-publicos").find((c) => c.id === "educacao");
  // o tema da Eficiência Estatal se chama só "Educação" no registro; na coleção, ao lado dos municípios, o nome diz o recorte
  const itens = (colecao?.paineis ?? []).map((p) => (p.href === ROTA_CAPITAIS ? { ...p, titulo: TITULO_CAPITAIS } : p));
  return (
    <header className="border-b border-linha bg-superficie">
      <CabecalhoPlataforma observatorio="servicos-publicos" destinoConta={ROTA_EDUCACAO} fontes={["educacao"]} />
      {navegacao && (
        <nav aria-label="Navegação da coleção Educação">
          <div className="ed-pagina">
            <ul className="-mx-1 flex items-center gap-x-1 overflow-x-auto py-1 [scrollbar-width:thin]">
              {itens.map((p) => (
                <li key={p.href} className="shrink-0">
                  <Link
                    href={p.href}
                    prefetch={prefetchDoLink(p.href)}
                    aria-current={p.href === ROTA_EDUCACAO ? "page" : undefined}
                    className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-2 text-sm ${p.href === ROTA_EDUCACAO ? "border-obee text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
                  >
                    {p.titulo}
                    <SeloComConta href={p.href} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </header>
  );
}
