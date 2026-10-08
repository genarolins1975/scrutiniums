import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";

/**
 * Cabeçalho do OBEE: marca Scrutiniums, nome do observatório, etapa de
 * construção declarada e atalhos para os três níveis de leitura da página
 * (entender, explorar, auditar). Só há destinos que funcionam.
 */
const ATALHOS = [
  { href: "#como-ler", rotulo: "Entender" },
  { href: "#serie", rotulo: "Séries" },
  { href: "#comparacao", rotulo: "Comparação" },
  { href: "#decomposicao", rotulo: "Composição" },
  { href: "#tabela", rotulo: "Tabela" },
  { href: "#metodos", rotulo: "Métodos e fontes" },
];

export function CabecalhoObee() {
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4 sm:px-6">
        <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] items-center gap-2.5">
          <LogoMark size={20} />
          <span className="hidden font-serif text-base uppercase tracking-wide2 text-carvao sm:inline">Scrutiniums</span>
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-linha" />
        <p className="rotulo text-carvao-muted">Etapa inicial · um painel publicado</p>
      </div>
      <div className="mx-auto max-w-page px-4 pb-1 pt-2 sm:px-6">
        <p className="font-serif text-lg leading-snug text-obee-tinta md:text-xl">
          <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 bg-obee align-middle" />
          Observatório Brasileiro de Eficiência Estatal
        </p>
      </div>
      <nav aria-label="Seções do painel" className="mx-auto max-w-page">
        <ul className="flex gap-1 overflow-x-auto px-4 pb-2 pt-1 sm:px-6">
          {ATALHOS.map((a) => (
            <li key={a.href} className="shrink-0">
              <a href={a.href} className="rotulo inline-flex min-h-[44px] items-center px-2 text-carvao-muted hover:text-obee-dark">
                {a.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
